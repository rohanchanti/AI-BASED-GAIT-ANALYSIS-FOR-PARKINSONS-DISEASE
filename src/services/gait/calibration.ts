/**
 * Pixel → real-world calibration.
 *
 * MediaPipe returns normalized image coordinates (0..1), so any distance taken
 * directly from them is a RELATIVE quantity, not metres. This module is the
 * single place where a normalized distance may be converted to metres, and it
 * refuses to do so without a calibration reference.
 *
 * Two references are supported today:
 *   1. known-distance  — the operator measured a real distance visible in the
 *                        frame (most accurate, no assumptions).
 *   2. subject-height   — the subject's standing height is known; the pixel
 *                        span head→ankle in a well-postured frame gives the
 *                        scale. Marked `estimated` because perspective and
 *                        posture introduce error.
 *
 * When neither is available the calibration is `none`: physical distances are
 * NOT reported as measured values, and downstream code must label them as
 * uncalibrated estimates. The abstraction is intentionally thin so a future
 * camera-intrinsics / homography based calibrator can implement the same
 * interface.
 */
import type { CalibrationInfo } from "@/types/gait";
import type { PoseFrame } from "@/types/pose";
import { indexLandmarks } from "@/services/pose/poseLandmarkUtils";

export const NO_CALIBRATION: CalibrationInfo = {
  source: "none",
  metersPerUnit: null,
  estimated: true,
  note:
    "No spatial calibration reference was provided. Distance-based values are uncalibrated relative estimates, not measured metres.",
};

export function calibrationFromKnownDistance(
  normalizedDistance: number,
  realMeters: number,
): CalibrationInfo {
  if (!(normalizedDistance > 1e-6) || !(realMeters > 0)) return NO_CALIBRATION;
  return {
    source: "known-distance",
    metersPerUnit: realMeters / normalizedDistance,
    estimated: false,
    note: "Scale derived from an operator-supplied known distance in the scene.",
  };
}

/**
 * Median normalized head→ankle span across valid frames, used as the pixel
 * proxy for the subject's standing height.
 */
export function subjectPixelHeight(frames: PoseFrame[], threshold: number): number | null {
  const spans: number[] = [];
  for (const f of frames) {
    const map = indexLandmarks(f.landmarks);
    const nose = map["nose"];
    const la = map["left_ankle"];
    const ra = map["right_ankle"];
    if (!nose || (!la && !ra)) continue;
    if (nose.visibility < threshold) continue;
    const ankles = [la, ra].filter((a) => a && a.visibility >= threshold) as NonNullable<
      typeof la
    >[];
    if (!ankles.length) continue;
    const ankleY = Math.max(...ankles.map((a) => a.y));
    const span = Math.abs(ankleY - nose.y);
    if (span > 0.05) spans.push(span);
  }
  if (spans.length < 5) return null;
  spans.sort((a, b) => a - b);
  return spans[Math.floor(spans.length / 2)];
}

export function calibrationFromSubjectHeight(
  frames: PoseFrame[],
  subjectHeightMeters: number,
  threshold: number,
): CalibrationInfo {
  const span = subjectPixelHeight(frames, threshold);
  if (span == null || !(subjectHeightMeters > 0.5)) return NO_CALIBRATION;
  // nose→ankle is ~0.936 of standing height (nose sits below the vertex).
  const NOSE_TO_ANKLE_FRACTION = 0.936;
  return {
    source: "subject-height",
    metersPerUnit: (subjectHeightMeters * NOSE_TO_ANKLE_FRACTION) / span,
    estimated: true,
    note:
      "Scale estimated from the subject's stated standing height and the tracked head-to-ankle span. Perspective and posture add error; treat distances as estimates.",
  };
}

/** Converts a normalized-image distance to metres, or null when uncalibrated. */
export function toMeters(cal: CalibrationInfo, normalizedDistance: number): number | null {
  if (cal.metersPerUnit == null || !isFinite(normalizedDistance)) return null;
  return normalizedDistance * cal.metersPerUnit;
}

/** speed = calibrated distance / elapsed time; null when uncalibrated. */
export function speedFromDistance(
  cal: CalibrationInfo,
  normalizedDistance: number,
  seconds: number,
): number | null {
  if (!(seconds > 0)) return null;
  const m = toMeters(cal, normalizedDistance);
  return m == null ? null : m / seconds;
}
