/**
 * Analysis-quality assessment.
 *
 * Produces an auditable set of 0..100 sub-scores plus a weighted composite
 * (weights live in poseConfig). Quality is descriptive only — it never alters
 * a measured value, it tells the reader how much to trust it.
 */
import { GAIT_LANDMARKS, type PoseFrame, type VideoInfo } from "@/types/pose";
import type { AnalysisQuality } from "@/types/gait";
import type { PreprocessingReport } from "./temporalFilter";
import type { PosePipelineConfig } from "./poseConfig";
import { indexLandmarks } from "./poseLandmarkUtils";

const UPPER_BODY = ["left_shoulder", "right_shoulder", "nose"] as const;

function pct(v: number) {
  return +(Math.max(0, Math.min(1, v)) * 100).toFixed(1);
}

/**
 * Camera-shake proxy: high-frequency jitter of the torso centre after removing
 * the smooth walking trend (3-point moving average). Real walking translation
 * is low-frequency, so residual jitter is dominated by camera motion.
 */
export function estimateCameraJitter(frames: PoseFrame[]): number | null {
  const pts: { x: number; y: number }[] = [];
  for (const f of frames) {
    const map = indexLandmarks(f.landmarks);
    const lh = map["left_hip"];
    const rh = map["right_hip"];
    const ls = map["left_shoulder"];
    const rs = map["right_shoulder"];
    if (!lh || !rh || !ls || !rs) continue;
    pts.push({ x: (lh.x + rh.x + ls.x + rs.x) / 4, y: (lh.y + rh.y + ls.y + rs.y) / 4 });
  }
  if (pts.length < 6) return null;
  let sum = 0;
  let n = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const trendX = (pts[i - 1].x + pts[i].x + pts[i + 1].x) / 3;
    const trendY = (pts[i - 1].y + pts[i].y + pts[i + 1].y) / 3;
    sum += Math.hypot(pts[i].x - trendX, pts[i].y - trendY);
    n++;
  }
  return n ? sum / n : null;
}

/** Share of frames in which the full body (upper + lower limbs) is visible. */
export function bodyVisibilityScore(frames: PoseFrame[], threshold: number): number {
  if (!frames.length) return 0;
  let ok = 0;
  for (const f of frames) {
    const map = indexLandmarks(f.landmarks);
    const lower = GAIT_LANDMARKS.every((n) => (map[n]?.visibility ?? 0) >= threshold);
    const upper = UPPER_BODY.some((n) => (map[n]?.visibility ?? 0) >= threshold);
    if (lower && upper) ok++;
  }
  return ok / frames.length;
}

export function computeAnalysisQuality(args: {
  frames: PoseFrame[];
  report: PreprocessingReport;
  validCycles: number;
  info: VideoInfo;
  cfg: PosePipelineConfig;
}): AnalysisQuality {
  const { frames, report, validCycles, info, cfg } = args;
  const warnings: string[] = [];

  const confVals = frames
    .map((f) => f.frameConfidence ?? 0)
    .filter((v) => v > 0);
  const poseConfidence = confVals.length
    ? confVals.reduce((a, b) => a + b, 0) / confVals.length
    : 0;

  const validFrames = report.validFramePercent / 100;
  const continuity = report.continuityScore;
  const bodyVisibility = bodyVisibilityScore(frames, cfg.minLandmarkConfidence);
  const cycleSufficiency = Math.min(1, validCycles / Math.max(1, cfg.minGaitCycles * 2));

  const jitter = estimateCameraJitter(frames);
  const videoStability =
    jitter == null ? 0.5 : Math.max(0, Math.min(1, 1 - jitter / cfg.maxCameraJitter));

  const w = cfg.qualityWeights;
  const overall =
    poseConfidence * w.poseConfidence +
    validFrames * w.validFrames +
    continuity * w.continuity +
    bodyVisibility * w.bodyVisibility +
    cycleSufficiency * w.cycleSufficiency +
    videoStability * w.videoStability;

  if (validFrames * 100 < cfg.minValidFramePercent)
    warnings.push(
      `Only ${report.validFramePercent}% of sampled frames contained a complete, reliable lower-limb pose.`,
    );
  if (poseConfidence < cfg.minLandmarkConfidence + 0.15)
    warnings.push("Landmark confidence is low; measurements may be noisy.");
  if (bodyVisibility < 0.6)
    warnings.push("The full body was not consistently visible in the frame.");
  if (validCycles < cfg.minGaitCycles)
    warnings.push(
      `Only ${validCycles} complete gait cycle(s) detected; cycle-averaged metrics are unstable below ${cfg.minGaitCycles}.`,
    );
  if (jitter != null && jitter > cfg.maxCameraJitter)
    warnings.push("Noticeable camera movement detected; spatial estimates are less reliable.");
  if (info.durationSec > 0 && info.durationSec < cfg.minDurationSec)
    warnings.push("Recording is shorter than the minimum recommended walking duration.");
  if (report.droppedJumps > report.totalFrames * 0.1)
    warnings.push("Frequent tracking jumps were rejected; subject tracking was unstable.");

  return {
    poseConfidence: pct(poseConfidence),
    validFramePercent: report.validFramePercent,
    continuityScore: pct(continuity),
    bodyVisibilityScore: pct(bodyVisibility),
    gaitCycleSufficiency: pct(cycleSufficiency),
    videoStabilityScore: pct(videoStability),
    overall: pct(overall),
    validCycles,
    cameraJitter: jitter == null ? null : +jitter.toFixed(4),
    warnings,
  };
}
