/**
 * Orchestrates the MediaPipe pose pipeline:
 *   video → landmarks → joint angles → gait events → gait metrics
 * Every returned number is derived from the uploaded video. When a value
 * cannot be derived it is `null` and the UI shows "Insufficient data".
 */
import {
  JOINT_KEYS,
  symmetryIndex,
  type CameraView,
  type GaitEvent,
  type JointAngleSample,
  type JointKey,
  type JointStats,
  type PoseAnalysisFull,
  type PoseGaitMetrics,
  type SymmetryEntry,
} from "@/types/gait";
import type { PoseFrame } from "@/types/pose";
import { extractPoseFrames } from "./mediaPipePoseService";
import { preprocessPoseFrames } from "./temporalFilter";
import { buildGaitCycles, summarizeCycles, robustValue, type CycleSummary } from "./gaitCycleService";
import { computeAnalysisQuality } from "./qualityService";
import { validateAnalysis, validateVideoMetadata } from "./videoValidation";
import { resolvePoseConfig, type PosePipelineConfig } from "./poseConfig";
import { NO_CALIBRATION, calibrationFromSubjectHeight } from "@/services/gait/calibration";
import { computeAngleSeries, jointStats } from "./jointAngleService";
import { detectGaitEvents } from "./gaitEventDetector";
import { hasUsableGaitLandmarks, indexLandmarks, reliable } from "./poseLandmarkUtils";

export type PoseStage =
  | "IDLE"
  | "LOADING"
  | "INITIALIZING_POSE"
  | "PROCESSING_VIDEO"
  | "EXTRACTING_LANDMARKS"
  | "CALCULATING_ANGLES"
  | "DETECTING_GAIT_EVENTS"
  | "CALCULATING_METRICS"
  | "COMPLETE"
  | "ERROR";

export interface PoseAnalysisConfig {
  confidenceThreshold?: number;
  cameraView?: CameraView;
  sampleFps?: number;
  /** overrides for the centralized pipeline thresholds */
  pipeline?: Partial<PosePipelineConfig>;
  /** optional spatial calibration reference: subject standing height (m) */
  subjectHeightMeters?: number;
}

export interface PoseProgress {
  stage: PoseStage;
  progress: number; // 0..1
  framesProcessed: number;
  totalFrames: number;
}

const MIN_DURATION_FOR_CYCLES = 3; // seconds

function mean(a: number[]) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

function intervals(events: GaitEvent[], side?: "left" | "right") {
  const hs = events
    .filter((e) => e.type === "heel_strike" && (!side || e.side === side))
    .map((e) => e.timestamp)
    .sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < hs.length; i++) out.push(hs[i] - hs[i - 1]);
  return out.filter((d) => d > 0.15 && d < 3);
}

function estimateCameraView(frames: PoseFrame[], threshold: number): CameraView {
  const ratios: number[] = [];
  for (const f of frames) {
    const map = indexLandmarks(f.landmarks);
    const ls = reliable(map, "left_shoulder", threshold);
    const rs = reliable(map, "right_shoulder", threshold);
    const lh = reliable(map, "left_hip", threshold);
    if (!ls || !rs || !lh) continue;
    const shoulderW = Math.abs(ls.x - rs.x);
    const torsoH = Math.abs(((ls.y + rs.y) / 2) - lh.y);
    if (torsoH > 1e-3) ratios.push(shoulderW / torsoH);
  }
  if (ratios.length < 5) return "unknown";
  const r = mean(ratios);
  // narrow shoulders relative to torso height ⇒ profile view
  return r < 0.45 ? "side" : "front";
}

function relativeSpatial(frames: PoseFrame[], threshold: number, duration: number) {
  const pelvis: number[] = [];
  const footSpread: number[] = [];
  for (const f of frames) {
    const map = indexLandmarks(f.landmarks);
    const lh = reliable(map, "left_hip", threshold);
    const rh = reliable(map, "right_hip", threshold);
    const la = reliable(map, "left_ankle", threshold);
    const ra = reliable(map, "right_ankle", threshold);
    if (lh && rh) pelvis.push((lh.x + rh.x) / 2);
    if (la && ra) footSpread.push(Math.abs(la.x - ra.x));
  }
  const relativeStepLength = footSpread.length >= 5 ? +Math.max(...footSpread).toFixed(4) : null;
  const relativeWalkingSpeed =
    pelvis.length >= 5 && duration > 0
      ? +(Math.abs(pelvis[pelvis.length - 1] - pelvis[0]) / duration).toFixed(4)
      : null;
  return { relativeStepLength, relativeWalkingSpeed };
}

export function computeMetrics(
  frames: PoseFrame[],
  angles: JointAngleSample[],
  events: GaitEvent[],
  opts: {
    threshold: number;
    duration: number;
    cameraView: CameraView;
    eventReason?: string;
    cycles?: CycleSummary;
  },
): PoseGaitMetrics {
  const { threshold, duration } = opts;
  const total = frames.length || 1;
  const framesWithoutPerson = frames.filter((f) => f.peopleDetected === 0).length;
  const framesWithMultiplePeople = frames.filter((f) => f.peopleDetected > 1).length;
  const usableFrames = frames.filter(
    (f) => f.peopleDetected === 1 && hasUsableGaitLandmarks(f.landmarks, threshold),
  ).length;
  const poseQuality = +((usableFrames / total) * 100).toFixed(1);

  const joints = JOINT_KEYS.reduce(
    (acc, k) => {
      acc[k] = jointStats(angles, k);
      return acc;
    },
    {} as Record<JointKey, JointStats | null>,
  );

  const heelStrikes = events.filter((e) => e.type === "heel_strike");
  const stepCount = heelStrikes.length;
  const allIntervals = intervals(events);
  // Prefer the robust (median-aware) cycle aggregate over a raw mean so a
  // single mis-detected interval cannot shift cadence.
  const cycleStepTime = opts.cycles ? robustValue(opts.cycles.stepTime) : null;
  const meanStepTime =
    cycleStepTime != null
      ? +cycleStepTime.toFixed(3)
      : allIntervals.length
      ? +mean(allIntervals).toFixed(3)
      : null;
  const cadence = meanStepTime ? +(60 / meanStepTime).toFixed(1) : null;

  const leftInts = intervals(events, "left");
  const rightInts = intervals(events, "right");
  const leftCycleDuration = leftInts.length ? +mean(leftInts).toFixed(3) : null;
  const rightCycleDuration = rightInts.length ? +mean(rightInts).toFixed(3) : null;
  const cycleVals = [leftCycleDuration, rightCycleDuration].filter(
    (v): v is number => v != null,
  );
  const gaitCycleDuration = cycleVals.length ? +mean(cycleVals).toFixed(3) : null;

  const leftStepTime = leftCycleDuration ? +(leftCycleDuration / 2).toFixed(3) : null;
  const rightStepTime = rightCycleDuration ? +(rightCycleDuration / 2).toFixed(3) : null;

  const romOf = (k: JointKey) => joints[k]?.rom ?? null;
  const symmetry: SymmetryEntry[] = [
    { label: "Knee ROM", left: romOf("leftKnee"), right: romOf("rightKnee"), unit: "°" },
    { label: "Hip ROM", left: romOf("leftHip"), right: romOf("rightHip"), unit: "°" },
    { label: "Ankle ROM", left: romOf("leftAnkle"), right: romOf("rightAnkle"), unit: "°" },
    { label: "Step timing", left: leftStepTime, right: rightStepTime, unit: "s" },
    { label: "Gait-cycle timing", left: leftCycleDuration, right: rightCycleDuration, unit: "s" },
  ].map((e) => ({
    ...e,
    difference: e.left != null && e.right != null ? +Math.abs(e.left - e.right).toFixed(2) : null,
    index: symmetryIndex(e.left, e.right),
  }));

  const idxVals = symmetry.map((s) => s.index).filter((v): v is number => v != null);
  const overallSymmetryIndex = idxVals.length ? +mean(idxVals).toFixed(1) : null;

  const warnings: string[] = [];
  if (duration > 0 && duration < MIN_DURATION_FOR_CYCLES)
    warnings.push("Video duration may be insufficient for gait-cycle analysis.");
  if (poseQuality < 60) warnings.push("Low pose confidence detected across many frames.");
  if (framesWithoutPerson / total > 0.2)
    warnings.push("No person was detected in a significant share of frames.");
  if (framesWithMultiplePeople / total > 0.2)
    warnings.push(
      "Multiple people detected; the largest subject was analysed and results may be unreliable.",
    );
  if (usableFrames / total < 0.5)
    warnings.push("Both legs are frequently occluded or out of frame.");
  if (opts.eventReason) warnings.push(opts.eventReason);
  if (stepCount < 3)
    warnings.push("Too few gait events detected for reliable cadence estimation.");
  if (opts.cameraView === "front" || opts.cameraView === "rear")
    warnings.push(
      "Side-view walking video is preferred for temporal and sagittal-plane gait analysis; sagittal joint angles are not reliably measurable from this view.",
    );

  const cyc = opts.cycles;
  return {
    stepCount,
    cycleCount: cyc?.cycles.length ?? 0,
    stancePct: cyc ? robustValue(cyc.stancePct) : null,
    swingPct: cyc ? robustValue(cyc.swingPct) : null,
    doubleSupportPct: cyc?.doubleSupportPct ?? null,
    singleSupportPct: cyc?.singleSupportPct ?? null,
    strideTimeCv: cyc?.strideTimeCv ?? null,
    cadence: stepCount >= 3 ? cadence : null,
    meanStepTime: stepCount >= 3 ? meanStepTime : null,
    gaitCycleDuration,
    leftStepTime,
    rightStepTime,
    leftCycleDuration,
    rightCycleDuration,
    joints,
    symmetry,
    overallSymmetryIndex,
    poseQuality,
    usableFrames,
    missingFrames: total - usableFrames,
    framesWithoutPerson,
    framesWithMultiplePeople,
    confidenceThreshold: threshold,
    analysisDurationSec: +duration.toFixed(2),
    cameraView: opts.cameraView,
    warnings,
    ...relativeSpatial(frames, threshold, duration),
  };
}

export async function runPoseGaitAnalysis(
  file: File,
  config: PoseAnalysisConfig = {},
  onProgress?: (p: PoseProgress) => void,
  signal?: AbortSignal,
): Promise<PoseAnalysisFull> {
  const cfg = resolvePoseConfig({
    ...(config.pipeline ?? {}),
    ...(config.confidenceThreshold != null
      ? { minLandmarkConfidence: config.confidenceThreshold }
      : {}),
  });
  const threshold = cfg.minLandmarkConfidence;
  const sampleFps = config.sampleFps ?? 15;
  let totalFrames = 0;

  const report = (stage: PoseStage, progress: number, framesProcessed = 0) =>
    onProgress?.({ stage, progress, framesProcessed, totalFrames });

  report("INITIALIZING_POSE", 0.02);

  const { frames: rawFrames, info } = await extractPoseFrames(file, {
    sampleFps,
    signal,
    onProgress: (p) => report("EXTRACTING_LANDMARKS", 0.05 + p * 0.8, Math.round(p * 1000)),
  });
  totalFrames = rawFrames.length;

  const metaValidation = validateVideoMetadata(info, cfg);

  // Temporal preprocessing: confidence filtering → jump rejection →
  // short-gap interpolation → Savitzky-Golay smoothing → validity marking.
  const { frames, report: pre } = preprocessPoseFrames(rawFrames, cfg);

  report("CALCULATING_ANGLES", 0.88, totalFrames);
  const angles = computeAngleSeries(frames, threshold);

  report("DETECTING_GAIT_EVENTS", 0.93, totalFrames);
  const { events, reason } = detectGaitEvents(frames, threshold, cfg);
  const cycles = buildGaitCycles(events, cfg);
  const cycleSummary = summarizeCycles(cycles);

  report("CALCULATING_METRICS", 0.97, totalFrames);
  const cameraView =
    config.cameraView && config.cameraView !== "unknown"
      ? config.cameraView
      : estimateCameraView(frames, threshold);

  const quality = computeAnalysisQuality({
    frames,
    report: pre,
    validCycles: cycles.length,
    info,
    cfg,
  });
  const validation = validateAnalysis(frames, quality, info, cfg);
  validation.blocking.push(...metaValidation.blocking);
  validation.warnings.push(...metaValidation.warnings);
  validation.ok = validation.blocking.length === 0;

  const calibration =
    config.subjectHeightMeters && config.subjectHeightMeters > 0.5
      ? calibrationFromSubjectHeight(frames, config.subjectHeightMeters, threshold)
      : NO_CALIBRATION;

  const metrics = computeMetrics(frames, angles, events, {
    threshold,
    duration: info.durationSec,
    cameraView,
    eventReason: reason,
    cycles: cycleSummary,
  });
  metrics.warnings.push(...validation.warnings.filter((w) => !metrics.warnings.includes(w)));

  report("COMPLETE", 1, totalFrames);

  return {
    method: "mediapipe-pose",
    generatedAt: new Date().toISOString(),
    video: info,
    metrics,
    angles,
    events,
    frames,
    quality,
    cycles,
    calibration,
    validation,
    preprocessing: pre as unknown as Record<string, unknown>,
  };
}
