/**
 * Temporal preprocessing of raw pose landmark trajectories.
 *
 *   raw landmarks
 *     → confidence filtering        (drop samples below minLandmarkConfidence)
 *     → outlier / jump rejection    (physiologically impossible displacement)
 *     → interpolation of short gaps (occlusion up to maxInterpolationGapFrames)
 *     → temporal smoothing          (Savitzky-Golay, quadratic)
 *     → per-frame validity marking  (unusable frames are marked, not guessed)
 *
 * Design notes
 * ------------
 * • Smoothing is applied per landmark and per axis on the *time* series, so a
 *   gap of missing samples never bleeds a neighbouring landmark's position in.
 * • A Savitzky-Golay filter is used rather than a plain moving average because
 *   it preserves peak amplitude and timing (critical for gait events) while
 *   removing high-frequency tracking noise. It degrades to a moving average
 *   for very short windows.
 * • Nothing is fabricated: samples that cannot be recovered stay `null` and the
 *   frame is marked unusable.
 */
import {
  GAIT_LANDMARKS,
  LANDMARK_NAMES,
  type LandmarkName,
  type PoseFrame,
  type PoseLandmark,
} from "@/types/pose";
import { DEFAULT_POSE_CONFIG, type PosePipelineConfig } from "./poseConfig";

interface Sample {
  x: number;
  y: number;
  z: number;
  visibility: number;
  interpolated: boolean;
}

export interface PreprocessingReport {
  totalFrames: number;
  framesWithPose: number;
  validFrames: number;
  validFramePercent: number;
  droppedLowConfidence: number;
  droppedJumps: number;
  interpolatedSamples: number;
  /** 0..1 — share of gait-landmark samples that survived without a gap */
  continuityScore: number;
  smoothingWindow: number;
  smoothingMethod: "savitzky-golay" | "moving-average" | "none";
  config: PosePipelineConfig;
}

export interface PreprocessResult {
  frames: PoseFrame[];
  report: PreprocessingReport;
}

/**
 * Savitzky-Golay smoothing coefficients for a quadratic/cubic fit evaluated at
 * the window centre. m = half-window.
 *   c_i = 3(3m² + 3m − 1 − 5i²) / ((2m+1)(4m² + 4m − 3))
 */
function sgCoefficients(m: number): number[] {
  const denom = (2 * m + 1) * (4 * m * m + 4 * m - 3);
  const out: number[] = [];
  for (let i = -m; i <= m; i++) {
    out.push((3 * (3 * m * m + 3 * m - 1 - 5 * i * i)) / denom);
  }
  return out;
}

/** Smooth one axis of one landmark. Missing samples are skipped (kept null). */
function smoothSeries(
  values: (number | null)[],
  window: number,
  method: "savitzky-golay" | "moving-average",
): (number | null)[] {
  const n = values.length;
  if (n === 0 || window < 3) return values;
  const w = window % 2 === 0 ? window + 1 : window;
  const m = (w - 1) / 2;
  const coeffs = method === "savitzky-golay" ? sgCoefficients(m) : null;
  const out: (number | null)[] = values.slice();

  for (let i = 0; i < n; i++) {
    if (values[i] == null) continue;
    let sum = 0;
    let weight = 0;
    for (let k = -m; k <= m; k++) {
      const j = i + k;
      if (j < 0 || j >= n) continue;
      const v = values[j];
      if (v == null) continue;
      const c = coeffs ? coeffs[k + m] : 1;
      sum += v * c;
      weight += c;
    }
    // Re-normalize because the window may be truncated or contain gaps.
    out[i] = weight !== 0 ? sum / weight : values[i];
  }
  return out;
}

/** Linear interpolation of runs of missing samples up to `maxGap` long. */
function interpolateGaps(
  series: (Sample | null)[],
  maxGap: number,
): { filled: (Sample | null)[]; interpolated: number } {
  const out = series.slice();
  let interpolated = 0;
  let i = 0;
  while (i < out.length) {
    if (out[i] != null) {
      i++;
      continue;
    }
    const start = i;
    while (i < out.length && out[i] == null) i++;
    const end = i; // first valid index after the gap
    const gap = end - start;
    const before = start > 0 ? out[start - 1] : null;
    const after = end < out.length ? out[end] : null;
    if (before && after && gap <= maxGap) {
      for (let k = 0; k < gap; k++) {
        const t = (k + 1) / (gap + 1);
        out[start + k] = {
          x: before.x + (after.x - before.x) * t,
          y: before.y + (after.y - before.y) * t,
          z: before.z + (after.z - before.z) * t,
          visibility: Math.min(before.visibility, after.visibility),
          interpolated: true,
        };
        interpolated++;
      }
    }
  }
  return { filled: out, interpolated };
}

export function preprocessPoseFrames(
  frames: PoseFrame[],
  cfg: PosePipelineConfig = DEFAULT_POSE_CONFIG,
): PreprocessResult {
  const n = frames.length;
  const dtDefault =
    n > 1 ? Math.max(1e-3, (frames[n - 1].timestamp - frames[0].timestamp) / (n - 1)) : 1 / 15;

  const method: PreprocessingReport["smoothingMethod"] =
    cfg.smoothingWindow >= 5 ? "savitzky-golay" : cfg.smoothingWindow >= 3 ? "moving-average" : "none";

  let droppedLowConfidence = 0;
  let droppedJumps = 0;
  let interpolatedSamples = 0;
  let gaitSamplesTotal = 0;
  let gaitSamplesPresent = 0;

  // 1. build per-landmark series with confidence filtering
  const series = new Map<LandmarkName, (Sample | null)[]>();
  for (const name of LANDMARK_NAMES) {
    const arr: (Sample | null)[] = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      const lm = frames[i].landmarks?.find((l) => l.name === name);
      if (!lm) continue;
      if (lm.visibility < cfg.minLandmarkConfidence) {
        droppedLowConfidence++;
        continue;
      }
      arr[i] = { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility, interpolated: false };
    }
    series.set(name, arr);
  }

  // 2. jump rejection — compare against the last accepted sample
  for (const [name, arr] of series) {
    let lastIdx = -1;
    for (let i = 0; i < n; i++) {
      const s = arr[i];
      if (!s) continue;
      if (lastIdx >= 0) {
        const prev = arr[lastIdx]!;
        const dt = Math.max(dtDefault, frames[i].timestamp - frames[lastIdx].timestamp);
        const disp = Math.hypot(s.x - prev.x, s.y - prev.y);
        if (disp / dt > cfg.maxLandmarkDisplacementPerSec) {
          arr[i] = null;
          droppedJumps++;
          continue;
        }
      }
      lastIdx = i;
    }
    series.set(name, arr);
  }

  // 3. interpolate short gaps (temporary occlusion)
  for (const [name, arr] of series) {
    const { filled, interpolated } = interpolateGaps(arr, cfg.maxInterpolationGapFrames);
    interpolatedSamples += interpolated;
    series.set(name, filled);
  }

  // 4. temporal smoothing per axis
  if (method !== "none") {
    for (const [name, arr] of series) {
      const xs = smoothSeries(arr.map((s) => (s ? s.x : null)), cfg.smoothingWindow, method);
      const ys = smoothSeries(arr.map((s) => (s ? s.y : null)), cfg.smoothingWindow, method);
      const zs = smoothSeries(arr.map((s) => (s ? s.z : null)), cfg.smoothingWindow, method);
      for (let i = 0; i < n; i++) {
        const s = arr[i];
        if (!s) continue;
        arr[i] = { ...s, x: xs[i] ?? s.x, y: ys[i] ?? s.y, z: zs[i] ?? s.z };
      }
      series.set(name, arr);
    }
  }

  // 5. rebuild frames and mark validity
  const out: PoseFrame[] = frames.map((f, i) => {
    const landmarks: PoseLandmark[] = [];
    let interpolatedHere = false;
    for (const name of LANDMARK_NAMES) {
      const s = series.get(name)![i];
      if (!s) continue;
      if (s.interpolated) interpolatedHere = true;
      landmarks.push({
        name,
        x: s.x,
        y: s.y,
        z: s.z,
        visibility: s.visibility,
        presence: s.visibility,
      });
    }
    const present = new Set(landmarks.map((l) => l.name));
    let confSum = 0;
    let confN = 0;
    for (const g of GAIT_LANDMARKS) {
      gaitSamplesTotal++;
      const lm = landmarks.find((l) => l.name === g);
      if (lm) {
        gaitSamplesPresent++;
        confSum += lm.visibility;
        confN++;
      }
    }
    const valid =
      f.peopleDetected >= 1 && GAIT_LANDMARKS.every((g) => present.has(g));
    return {
      ...f,
      landmarks: landmarks.length ? landmarks : null,
      valid,
      frameConfidence: confN ? confSum / confN : 0,
      interpolated: interpolatedHere,
    };
  });

  const framesWithPose = out.filter((f) => f.landmarks != null).length;
  const validFrames = out.filter((f) => f.valid).length;

  return {
    frames: out,
    report: {
      totalFrames: n,
      framesWithPose,
      validFrames,
      validFramePercent: n ? +((validFrames / n) * 100).toFixed(1) : 0,
      droppedLowConfidence,
      droppedJumps,
      interpolatedSamples,
      continuityScore: gaitSamplesTotal ? +(gaitSamplesPresent / gaitSamplesTotal).toFixed(3) : 0,
      smoothingWindow: cfg.smoothingWindow,
      smoothingMethod: method,
      config: cfg,
    },
  };
}

/**
 * Body-relative (perspective-robust) coordinates.
 *
 * Landmarks are expressed relative to the pelvis centre and scaled by the
 * torso length (hip→shoulder). This removes camera translation and most scale
 * drift as the subject walks toward/away from the camera, so trajectory shapes
 * become comparable across frames without absolute image coordinates.
 * Returns null when the reference landmarks are unavailable.
 */
export function toBodyRelative(
  landmarks: PoseLandmark[] | null,
): { get: (n: LandmarkName) => { x: number; y: number } | null; scale: number } | null {
  if (!landmarks) return null;
  const find = (n: LandmarkName) => landmarks.find((l) => l.name === n) ?? null;
  const lh = find("left_hip");
  const rh = find("right_hip");
  const ls = find("left_shoulder");
  const rs = find("right_shoulder");
  if (!lh || !rh || !ls || !rs) return null;
  const px = (lh.x + rh.x) / 2;
  const py = (lh.y + rh.y) / 2;
  const sx = (ls.x + rs.x) / 2;
  const sy = (ls.y + rs.y) / 2;
  const scale = Math.hypot(sx - px, sy - py);
  if (!isFinite(scale) || scale < 1e-4) return null;
  return {
    scale,
    get: (n: LandmarkName) => {
      const l = find(n);
      if (!l) return null;
      return { x: (l.x - px) / scale, y: (l.y - py) / scale };
    },
  };
}
