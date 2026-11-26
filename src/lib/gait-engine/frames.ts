import type { PoseAnalysisFull } from "@/types/gait";
import { computeGaitParameters } from "./parameters";
import { FRAME_SCHEMA } from "./coordinates";
import { ANALYSIS_VERSIONS } from "@/lib/analysis-version";
import { LANDMARK_NAMES } from "@/types/pose";
import { indexLandmarks } from "@/services/pose/poseLandmarkUtils";
import { measureFrameRate, TIMING_FEATURE_KEYS } from "./frame-rate";
import type { EngineInput } from "./parameters";

/** Apply timestamp reliability only after existing interval filtering/calculations. */
export function computePoseGaitParameters(pose: PoseAnalysisFull, options: Omit<EngineInput, "events"> = {}) {
  const engine = computeGaitParameters({ ...options, events: pose.events ?? [] });
  const frameRate = measureFrameRate(pose.frames.map((frame) => frame.timestamp));
  if (frameRate.reason) {
    engine.parameters = engine.parameters.map((parameter) => TIMING_FEATURE_KEYS.has(parameter.key)
      ? { ...parameter, value: null, status: "unreliable", reason: frameRate.reason ?? undefined } : parameter);
    engine.notes.push(frameRate.reason);
  }
  return { ...engine, qualitySummary: { ...engine.qualitySummary, frameRate } };
}

/**
 * Compact per-frame landmark record for persistence.
 * lm: flat [x, y, z, visibility] × 33 rounded to 4 dp (normalized image coordinates).
 */
export function serializeFrames(pose: PoseAnalysisFull, maxFrames = 1800) {
  const frames = pose.frames.slice(0, maxFrames).map((f) => ({
    i: f.frameNumber,
    t: +f.timestamp.toFixed(3),
    pid: f.landmarks ? 0 : null, // primary (largest) subject; landmarks are never merged across people
    people: f.peopleDetected ?? 0,
    q: f.landmarks ? (f.valid === false ? "rejected" : "usable") : "no_pose",
    c: f.frameConfidence != null ? +f.frameConfidence.toFixed(3) : null,
    lm: f.landmarks ? LANDMARK_NAMES.flatMap((name) => {
      const p = indexLandmarks(f.landmarks)[name];
      return p && [p.x, p.y, p.z, p.visibility].every(Number.isFinite)
        ? [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4), +p.visibility.toFixed(3)]
        : [null, null, null, null];
    }) : null,
  }));
  return {
    schema: { ...FRAME_SCHEMA, fields: "i=frame index, t=timestamp, pid=tracked person, people=persons detected, q=frame quality, c=frame confidence, lm=[x,y,z,visibility]×33; missing landmarks use null slots in canonical MediaPipe order" },
    model: ANALYSIS_VERSIONS.poseEstimator ?? "MediaPipe Pose Landmarker (lite)",
    frameSize: { width: pose.video.width, height: pose.video.height, unit: "px" },
    sampledFps: pose.video.sampledFps,
    truncated: pose.frames.length > maxFrames,
    frames,
  };
}

/** Quality and uncertainty summary. Pose confidence is model confidence, not measurement accuracy. */
export function qualitySummary(pose: PoseAnalysisFull) {
  const fr = pose.frames;
  const frameRate = measureFrameRate(fr.map((frame) => frame.timestamp));
  const withPose = fr.filter((f) => f.landmarks);
  const usable = fr.filter((f) => f.landmarks && f.valid !== false);
  const conf = withPose.map((f) => f.frameConfidence ?? 0).sort((a, b) => a - b);
  const q = (p: number) => (conf.length ? +conf[Math.floor(p * (conf.length - 1))].toFixed(3) : null);
  const ev = pose.events ?? [];
  return {
    frameRate,
    intervalFiltering: computeGaitParameters({ events: ev }).qualitySummary.intervalFiltering,
    framesProcessed: fr.length,
    usableFrames: usable.length,
    usablePercent: fr.length ? +((100 * usable.length) / fr.length).toFixed(1) : 0,
    missingLandmarkRate: fr.length ? +(1 - withPose.length / fr.length).toFixed(3) : 1,
    usableCycles: pose.quality?.validCycles ?? 0,
    poseConfidence: { median: q(0.5), p10: q(0.1), p90: q(0.9), note: "Model detection confidence — not measurement accuracy." },
    eventConfidence: ev.length ? +(ev.reduce((a, e) => a + e.confidence, 0) / ev.length).toFixed(3) : null,
    eventConfidenceNote: "Mean foot-landmark visibility at event frames; not a probability of correct timing.",
    warnings: [...new Set([...(pose.quality?.warnings ?? []), ...((pose.validation?.warnings as string[]) ?? []), ...(frameRate.reason ? [frameRate.reason] : [])])],
    uncertainty: "No parameter-specific uncertainty or repeatability has been established for this pipeline yet.",
  };
}
