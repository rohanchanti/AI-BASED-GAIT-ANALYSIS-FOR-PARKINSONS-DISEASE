import {
  GAIT_LANDMARKS,
  LANDMARK_NAMES,
  type LandmarkName,
  type PoseLandmark,
} from "@/types/pose";

export type LandmarkMap = Partial<Record<LandmarkName, PoseLandmark>>;

export function toLandmarkArray(
  raw: { x: number; y: number; z: number; visibility?: number }[],
): PoseLandmark[] {
  return raw.slice(0, LANDMARK_NAMES.length).map((l, i) => ({
    name: LANDMARK_NAMES[i],
    x: l.x,
    y: l.y,
    z: l.z ?? 0,
    visibility: l.visibility ?? 0,
    presence: l.visibility ?? 0,
  }));
}

export function indexLandmarks(landmarks: PoseLandmark[] | null): LandmarkMap {
  const map: LandmarkMap = {};
  if (!landmarks) return map;
  for (const l of landmarks) map[l.name] = l;
  return map;
}

export function reliable(
  map: LandmarkMap,
  name: LandmarkName,
  threshold: number,
): PoseLandmark | null {
  const l = map[name];
  if (!l) return null;
  if (l.visibility < threshold) return null;
  return l;
}

/** true when every landmark needed for gait analysis is above threshold */
export function hasUsableGaitLandmarks(
  landmarks: PoseLandmark[] | null,
  threshold: number,
): boolean {
  if (!landmarks) return false;
  const map = indexLandmarks(landmarks);
  return GAIT_LANDMARKS.every((n) => (map[n]?.visibility ?? 0) >= threshold);
}

/**
 * Angle at point B formed by A→B→C, in degrees (0..180).
 * Uses the 2D image plane (x,y) which is the sagittal plane for a side-view
 * recording. The same convention is applied to left and right sides.
 */
export function angleAt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number | null {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 < 1e-6 || n2 < 1e-6) return null;
  let cos = (v1x * v2x + v1y * v2y) / (n1 * n2);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Mean visibility of a landmark set (0..1). */
export function meanVisibility(map: LandmarkMap, names: LandmarkName[]): number {
  const vals = names.map((n) => map[n]?.visibility ?? 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/** Torso diagonal size — used to pick the closest/primary subject. */
export function subjectSize(landmarks: PoseLandmark[]): number {
  const map = indexLandmarks(landmarks);
  const ls = map["left_shoulder"];
  const rh = map["right_hip"];
  const rs = map["right_shoulder"];
  const lh = map["left_hip"];
  const d1 = ls && rh ? Math.hypot(ls.x - rh.x, ls.y - rh.y) : 0;
  const d2 = rs && lh ? Math.hypot(rs.x - lh.x, rs.y - lh.y) : 0;
  return Math.max(d1, d2);
}
