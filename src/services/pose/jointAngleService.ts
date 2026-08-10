/**
 * Geometric joint-angle extraction from pose landmarks.
 *
 * Conventions (identical for left and right sides):
 *   Knee  = angle(hip, knee, ankle)          — 180° ≈ full extension
 *   Hip   = angle(shoulder, hip, knee)       — 180° ≈ trunk/thigh aligned
 *   Ankle = angle(knee, ankle, foot_index)   — ~90° ≈ neutral dorsiflexion
 *
 * Any angle whose contributing landmarks fall below the confidence threshold
 * is stored as `null` (missing) — never substituted with a placeholder value.
 */
import type { JointAngleSample, JointKey, JointStats } from "@/types/gait";
import type { PoseFrame } from "@/types/pose";
import { angleAt, indexLandmarks, reliable } from "./poseLandmarkUtils";

export function computeAngleSeries(
  frames: PoseFrame[],
  threshold: number,
): JointAngleSample[] {
  return frames.map((f) => {
    const map = indexLandmarks(f.landmarks);
    const g = (n: Parameters<typeof reliable>[1]) => reliable(map, n, threshold);

    const lHip = g("left_hip");
    const rHip = g("right_hip");
    const lKnee = g("left_knee");
    const rKnee = g("right_knee");
    const lAnk = g("left_ankle");
    const rAnk = g("right_ankle");
    const lSho = g("left_shoulder");
    const rSho = g("right_shoulder");
    const lFoot = g("left_foot_index");
    const rFoot = g("right_foot_index");

    return {
      frameNumber: f.frameNumber,
      timestamp: f.timestamp,
      leftKnee: lHip && lKnee && lAnk ? angleAt(lHip, lKnee, lAnk) : null,
      rightKnee: rHip && rKnee && rAnk ? angleAt(rHip, rKnee, rAnk) : null,
      leftHip: lSho && lHip && lKnee ? angleAt(lSho, lHip, lKnee) : null,
      rightHip: rSho && rHip && rKnee ? angleAt(rSho, rHip, rKnee) : null,
      leftAnkle: lKnee && lAnk && lFoot ? angleAt(lKnee, lAnk, lFoot) : null,
      rightAnkle: rKnee && rAnk && rFoot ? angleAt(rKnee, rAnk, rFoot) : null,
    };
  });
}

export function jointStats(
  samples: JointAngleSample[],
  key: JointKey,
): JointStats | null {
  const vals = samples
    .map((s) => s[key])
    .filter((v): v is number => v != null && isFinite(v));
  if (vals.length < 3) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return {
    min: +min.toFixed(1),
    max: +max.toFixed(1),
    mean: +mean.toFixed(1),
    rom: +(max - min).toFixed(1),
    sampleCount: vals.length,
  };
}
