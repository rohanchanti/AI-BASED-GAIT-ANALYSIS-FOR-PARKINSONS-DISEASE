/**
 * Real-time video motion analyzer.
 *
 * Actually decodes the uploaded video frame-by-frame, computes motion energy
 * signals per region (left/right/top/bottom halves) via inter-frame pixel
 * differencing on a downscaled greyscale, and derives gait-relevant
 * measurements: cadence (via autocorrelation of the periodic step signal),
 * symmetry (left vs right motion energy), stability (variance of vertical
 * motion), and overall motion magnitude.
 *
 * The output is a set of raw measurements that a downstream mapper turns into
 * the 22 clinical gait parameters. No results are pre-baked — every number
 * comes from the pixels of the actual video the user uploaded.
 */

export interface FrameSample {
  t: number; // seconds
  energy: number; // total inter-frame diff, normalized
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface VideoMeasurements {
  durationSec: number;
  frameCount: number;
  width: number;
  height: number;
  meanEnergy: number; // avg per-frame motion energy 0..1
  motionStd: number;
  /** symmetry 0..1 — 1 means perfectly symmetric L/R motion */
  lrSymmetry: number;
  /** vertical/horizontal motion ratio — proxy for bounce/step lift */
  verticalRatio: number;
  /** dominant motion period in seconds (step period), NaN if not periodic */
  stepPeriodSec: number;
  /** strength of periodicity 0..1 */
  periodicity: number;
  samples: FrameSample[];
}

const TARGET_W = 96;
const TARGET_H = 54;
const SAMPLE_FPS = 15;

export async function analyzeVideoFile(
  file: File,
  onProgress: (p: number) => void,
  signal?: AbortSignal,
): Promise<VideoMeasurements> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      const ok = () => resolve();
      const err = () => reject(new Error("Failed to load video metadata"));
      video.addEventListener("loadedmetadata", ok, { once: true });
      video.addEventListener("error", err, { once: true });
    });

    const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 4;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;

    const canvas = document.createElement("canvas");
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D not available");

    const step = 1 / SAMPLE_FPS;
    const total = Math.max(4, Math.floor(duration * SAMPLE_FPS));
    const samples: FrameSample[] = [];
    let prev: Uint8ClampedArray | null = null;

    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new Error("aborted");
      const t = Math.min(duration - 0.001, i * step);
      await seekTo(video, t);
      ctx.drawImage(video, 0, 0, TARGET_W, TARGET_H);
      const img = ctx.getImageData(0, 0, TARGET_W, TARGET_H);
      const grey = toGrey(img.data);
      if (prev) {
        const s = diffRegions(prev, grey, TARGET_W, TARGET_H);
        samples.push({ t, ...s });
      }
      prev = grey;
      onProgress(Math.min(0.95, (i + 1) / total));
      // yield to keep UI responsive
      if ((i & 3) === 0) await new Promise((r) => setTimeout(r, 0));
    }

    const energies = samples.map((s) => s.energy);
    const meanEnergy = mean(energies);
    const motionStd = std(energies, meanEnergy);
    const leftSum = sum(samples.map((s) => s.left));
    const rightSum = sum(samples.map((s) => s.right));
    const topSum = sum(samples.map((s) => s.top));
    const bottomSum = sum(samples.map((s) => s.bottom));

    const lrSymmetry =
      leftSum + rightSum > 0
        ? 1 - Math.abs(leftSum - rightSum) / (leftSum + rightSum)
        : 1;
    const verticalRatio =
      leftSum + rightSum > 0 ? (topSum + bottomSum) / (leftSum + rightSum) : 1;

    const { periodSec, strength } = detectPeriod(energies, SAMPLE_FPS);

    onProgress(1);

    return {
      durationSec: duration,
      frameCount: total,
      width,
      height,
      meanEnergy,
      motionStd,
      lrSymmetry: clamp01(lrSymmetry),
      verticalRatio,
      stepPeriodSec: periodSec,
      periodicity: strength,
      samples,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("seek failed"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try {
      video.currentTime = t;
    } catch (e) {
      onError();
    }
  });
}

function toGrey(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    out[j] = (rgba[i] * 76 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  }
  return out;
}

function diffRegions(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  w: number,
  h: number,
) {
  let total = 0,
    left = 0,
    right = 0,
    top = 0,
    bottom = 0;
  const halfW = w >> 1;
  const halfH = h >> 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = Math.abs(a[i] - b[i]);
      total += d;
      if (x < halfW) left += d;
      else right += d;
      if (y < halfH) top += d;
      else bottom += d;
    }
  }
  const norm = 255 * w * h;
  return {
    energy: total / norm,
    left: left / (norm / 2),
    right: right / (norm / 2),
    top: top / (norm / 2),
    bottom: bottom / (norm / 2),
  };
}

function detectPeriod(signal: number[], fps: number) {
  if (signal.length < fps) return { periodSec: NaN, strength: 0 };
  const m = mean(signal);
  const centered = signal.map((v) => v - m);
  const variance = centered.reduce((a, v) => a + v * v, 0);
  if (variance <= 1e-9) return { periodSec: NaN, strength: 0 };
  // step periods for humans: 0.3s .. 1.2s
  const minLag = Math.max(2, Math.floor(0.3 * fps));
  const maxLag = Math.min(centered.length - 2, Math.floor(1.2 * fps));
  let bestLag = -1;
  let bestCorr = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < centered.length - lag; i++) {
      s += centered[i] * centered[i + lag];
    }
    const c = s / variance;
    if (c > bestCorr) {
      bestCorr = c;
      bestLag = lag;
    }
  }
  if (bestLag < 0) return { periodSec: NaN, strength: 0 };
  return {
    periodSec: bestLag / fps,
    strength: clamp01(bestCorr),
  };
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const std = (a: number[], m: number) =>
  a.length ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) : 0;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
