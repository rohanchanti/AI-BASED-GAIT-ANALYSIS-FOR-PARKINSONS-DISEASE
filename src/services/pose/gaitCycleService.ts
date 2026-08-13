/**
 * Gait-cycle construction and robust multi-cycle aggregation.
 *
 * A gait cycle is defined as consecutive heel strikes of the SAME side.
 * Stance = heel strike → next toe-off of that side; swing = the remainder.
 * Every downstream temporal metric is computed from these cycle objects so
 * all metrics share one event definition.
 *
 * Aggregation uses mean, median, SD and coefficient of variation. The median
 * is the robust estimator reported when the CV is high, so one abnormal cycle
 * cannot dominate the result.
 */
import type { Aggregate, GaitCycle, GaitEvent, SymmetryStat } from "@/types/gait";
import type { PosePipelineConfig } from "./poseConfig";

export function aggregate(values: number[]): Aggregate {
  const vals = values.filter((v) => isFinite(v));
  if (!vals.length) return { n: 0, mean: null, median: null, sd: null, cv: null };
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const median =
    sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const sd =
    vals.length > 1
      ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1))
      : 0;
  const cv = Math.abs(mean) > 1e-9 ? (sd / Math.abs(mean)) * 100 : null;
  return {
    n: vals.length,
    mean: +mean.toFixed(4),
    median: +median.toFixed(4),
    sd: +sd.toFixed(4),
    cv: cv == null ? null : +cv.toFixed(2),
  };
}

/** Robust point estimate: median when variability is high, otherwise mean. */
export function robustValue(a: Aggregate, cvThreshold = 20): number | null {
  if (a.n === 0) return null;
  if (a.cv != null && a.cv > cvThreshold) return a.median;
  return a.mean;
}

/**
 * Normalized asymmetry index, 0..100 where 100 = perfectly symmetric.
 * index = 100 × (1 − |L − R| / ((L + R)/2)), guarded against division by zero
 * and clamped. Returns null when either side is missing.
 */
export function asymmetryIndex(left: number | null, right: number | null): number | null {
  if (left == null || right == null) return null;
  const mean = (left + right) / 2;
  if (!isFinite(mean) || Math.abs(mean) < 1e-6) return null;
  return +Math.max(0, Math.min(100, 100 * (1 - Math.abs(left - right) / Math.abs(mean)))).toFixed(1);
}

export function buildGaitCycles(
  events: GaitEvent[],
  cfg: PosePipelineConfig,
): GaitCycle[] {
  const cycles: GaitCycle[] = [];
  for (const side of ["left", "right"] as const) {
    const hs = events
      .filter((e) => e.side === side && e.type === "heel_strike")
      .map((e) => e.timestamp)
      .sort((a, b) => a - b);
    const to = events
      .filter((e) => e.side === side && e.type === "toe_off")
      .map((e) => e.timestamp)
      .sort((a, b) => a - b);

    for (let i = 1; i < hs.length; i++) {
      const start = hs[i - 1];
      const end = hs[i];
      const duration = end - start;
      // Physiologically plausible cycle window; anything else is not a cycle.
      if (duration < cfg.eventMinSeparationSec * 2 || duration > 3) continue;
      const toeOff = to.find((t) => t > start && t < end) ?? null;
      const stanceSec = toeOff != null ? toeOff - start : null;
      const swingSec = stanceSec != null ? duration - stanceSec : null;
      cycles.push({
        side,
        startTime: +start.toFixed(3),
        endTime: +end.toFixed(3),
        duration: +duration.toFixed(3),
        toeOff: toeOff == null ? null : +toeOff.toFixed(3),
        stanceSec: stanceSec == null ? null : +stanceSec.toFixed(3),
        swingSec: swingSec == null ? null : +swingSec.toFixed(3),
        stancePct: stanceSec == null ? null : +((stanceSec / duration) * 100).toFixed(1),
        swingPct: swingSec == null ? null : +((swingSec / duration) * 100).toFixed(1),
      });
    }
  }
  return cycles.sort((a, b) => a.startTime - b.startTime);
}

export interface CycleSummary {
  cycles: GaitCycle[];
  cycleDuration: Aggregate;
  stepTime: Aggregate;
  stancePct: Aggregate;
  swingPct: Aggregate;
  /** double support ≈ 100 − 2 × swing% (single-camera estimate) */
  doubleSupportPct: number | null;
  singleSupportPct: number | null;
  left: { cycleDuration: Aggregate; stancePct: Aggregate };
  right: { cycleDuration: Aggregate; stancePct: Aggregate };
  symmetry: SymmetryStat[];
  /** stride-time variability (CV %) — a validated marker of gait instability */
  strideTimeCv: number | null;
}

export function summarizeCycles(cycles: GaitCycle[]): CycleSummary {
  const of = (arr: GaitCycle[], pick: (c: GaitCycle) => number | null) =>
    aggregate(arr.map(pick).filter((v): v is number => v != null));

  const cycleDuration = of(cycles, (c) => c.duration);
  const stancePct = of(cycles, (c) => c.stancePct);
  const swingPct = of(cycles, (c) => c.swingPct);
  const stepTime = aggregate(cycles.map((c) => c.duration / 2));

  const L = cycles.filter((c) => c.side === "left");
  const R = cycles.filter((c) => c.side === "right");
  const left = { cycleDuration: of(L, (c) => c.duration), stancePct: of(L, (c) => c.stancePct) };
  const right = { cycleDuration: of(R, (c) => c.duration), stancePct: of(R, (c) => c.stancePct) };

  const swing = robustValue(swingPct);
  // In a full cycle each limb swings once; the overlap of the two stance
  // phases is the double-support fraction: DS ≈ 100 − 2 × swing%.
  const doubleSupportPct =
    swing == null ? null : +Math.max(0, Math.min(45, 100 - 2 * swing)).toFixed(1);
  const singleSupportPct = swing == null ? null : +Math.max(0, Math.min(50, swing)).toFixed(1);

  const symmetry: SymmetryStat[] = [
    {
      label: "Gait-cycle duration",
      left: left.cycleDuration,
      right: right.cycleDuration,
      unit: "s",
      difference:
        robustValue(left.cycleDuration) != null && robustValue(right.cycleDuration) != null
          ? +Math.abs(robustValue(left.cycleDuration)! - robustValue(right.cycleDuration)!).toFixed(3)
          : null,
      index: asymmetryIndex(robustValue(left.cycleDuration), robustValue(right.cycleDuration)),
    },
    {
      label: "Stance phase",
      left: left.stancePct,
      right: right.stancePct,
      unit: "%",
      difference:
        robustValue(left.stancePct) != null && robustValue(right.stancePct) != null
          ? +Math.abs(robustValue(left.stancePct)! - robustValue(right.stancePct)!).toFixed(2)
          : null,
      index: asymmetryIndex(robustValue(left.stancePct), robustValue(right.stancePct)),
    },
  ];

  return {
    cycles,
    cycleDuration,
    stepTime,
    stancePct,
    swingPct,
    doubleSupportPct,
    singleSupportPct,
    left,
    right,
    symmetry,
    strideTimeCv: cycleDuration.cv,
  };
}
