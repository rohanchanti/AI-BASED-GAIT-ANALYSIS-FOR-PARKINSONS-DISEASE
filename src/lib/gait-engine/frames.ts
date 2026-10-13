import type { PoseAnalysisFull } from "@/types/gait";
import { FRAME_SCHEMA } from "./coordinates";
import { ANALYSIS_VERSIONS } from "@/lib/analysis-version";

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
    lm: f.landmarks ? f.landmarks.flatMap((p) => [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4), +(p.visibility ?? 0).toFixed(3)]) : null,
  }));
  return {
    schema: { ...FRAME_SCHEMA, fields: "i=frame index, t=timestamp, pid=tracked person, people=persons detected, q=frame quality, c=frame confidence, lm=[x,y,z,visibility]×33" },
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
  const withPose = fr.filter((f) => f.landmarks);
  const usable = fr.filter((f) => f.landmarks && f.valid !== false);
  const conf = withPose.map((f) => f.frameConfidence ?? 0).sort((a, b) => a - b);
  const q = (p: number) => (conf.length ? +conf[Math.floor(p * (conf.length - 1))].toFixed(3) : null);
  const ev = pose.events ?? [];
  return {
    framesProcessed: fr.length,
    usableFrames: usable.length,
    usablePercent: fr.length ? +((100 * usable.length) / fr.length).toFixed(1) : 0,
    missingLandmarkRate: fr.length ? +(1 - withPose.length / fr.length).toFixed(3) : 1,
    usableCycles: pose.quality?.validCycles ?? 0,
    poseConfidence: { median: q(0.5), p10: q(0.1), p90: q(0.9), note: "Model detection confidence — not measurement accuracy." },
    eventConfidence: ev.length ? +(ev.reduce((a, e) => a + e.confidence, 0) / ev.length).toFixed(3) : null,
    eventConfidenceNote: "Mean foot-landmark visibility at event frames; not a probability of correct timing.",
    warnings: [...(pose.quality?.warnings ?? []), ...((pose.validation?.warnings as string[]) ?? [])],
    uncertainty: "No parameter-specific uncertainty or repeatability has been established for this pipeline yet.",
  };
}
