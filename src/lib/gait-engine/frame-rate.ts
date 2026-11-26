/** Effective pose-pipeline rate, not the container's native camera rate. Timestamps are seconds. */
export const FRAME_RATE_REASON = "frame rate unknown or irregular";
export const FPS_SOURCE = "measured_from_timestamps";
export const TIMING_FEATURE_KEYS = new Set([
  "cadence", "stepTime", "stepTimeLeft", "stepTimeRight", "strideTime", "strideTimeLeft", "strideTimeRight",
  "stanceTime", "swingTime", "doubleSupport", "stepTimeCV", "strideTimeCV", "stepTimeAsymmetry", "stepTimeSymmetry",
]);

function percentile(sorted: number[], fraction: number): number | null {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * fraction;
  const lower = sorted[Math.floor(position)], upper = sorted[Math.ceil(position)];
  if (lower === undefined || upper === undefined) return null;
  return lower + (upper - lower) * (position - Math.floor(position));
}

export function measureFrameRate(timestamps: readonly (number | null | undefined)[]) {
  const gaps: number[] = [];
  let invalid = timestamps.length < 2;
  for (let i = 0; i < timestamps.length; i++) {
    const current = timestamps[i];
    if (typeof current !== "number" || !Number.isFinite(current) || current < 0) { invalid = true; continue; }
    if (i === 0) continue;
    const previous = timestamps[i - 1];
    if (typeof previous !== "number" || !Number.isFinite(previous)) { invalid = true; continue; }
    const gap = current - previous;
    if (gap <= 0) { invalid = true; continue; }
    gaps.push(gap);
  }
  gaps.sort((a, b) => a - b);
  const medianGapSec = percentile(gaps, 0.5);
  const p95GapSec = percentile(gaps, 0.95);
  const measured = medianGapSec !== null && medianGapSec > 0 ? 1 / medianGapSec : null;
  const fps = measured !== null && Number.isFinite(measured) ? measured : null;
  const unreliable = invalid || fps === null || p95GapSec === null || medianGapSec === null || p95GapSec > 2.5 * medianGapSec;
  return { fps, fps_source: FPS_SOURCE, medianGapSec, p95GapSec, status: unreliable ? "unreliable" as const : "measured" as const, reason: unreliable ? FRAME_RATE_REASON : null };
}

/** Keep prior snapshots alongside acquisition metadata; never replace them with frame-rate metadata alone. */
export function parametersWithFrameRate(parameters: unknown, fps: number | null) {
  const snapshot = parameters && typeof parameters === "object" && !Array.isArray(parameters)
    ? parameters as Record<string, unknown> : { features: parameters ?? [] };
  return { ...snapshot, fps, fps_source: FPS_SOURCE };
}