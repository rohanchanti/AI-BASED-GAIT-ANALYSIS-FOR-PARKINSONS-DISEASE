/**
 * Traceable gait-parameter engine.
 * Inputs: video-derived gait events (timestamps in seconds from the decoded video clock).
 * Every output is either a value with provenance or an explicit "unavailable" with a reason.
 */
import type { CalibrationInfo, GaitEvent } from "@/types/gait";

export const ENGINE_VERSION = "gait-engine 1.2.0";
export const CALIBRATION_REQUIRED = "Not available - calibration required";

export type ParamStatus = "measured" | "estimated" | "experimental" | "unreliable" | "unavailable";
export type ValidationStatus = "software-verified (synthetic)" | "not validated" | "not implemented";

export interface ParamDefinition {
  key: string;
  name: string;
  unit: string;
  definition: string;
  formula: string;
  inputs: string;
  minimum: string;
  validation: ValidationStatus;
  failureModes: string;
}

export interface ParamValue {
  key: string;
  value: number | null;
  status: ParamStatus;
  n: number; // number of intervals/cycles used
  reason?: string;
  unit?: string;
  method?: string;
}

export const PARAMETER_DEFINITIONS: ParamDefinition[] = [
  { key: "cadence", name: "Cadence", unit: "steps/min", definition: "Steps per minute.", formula: "60 / mean(step time), steps = consecutive contralateral initial contacts", inputs: "Left + right initial-contact timestamps", minimum: "≥ 10 valid intervals per foot", validation: "software-verified (synthetic)", failureModes: "Missed or duplicate contacts; turning; non-steady walking." },
  { key: "stepTime", name: "Step time", unit: "s", definition: "Time from initial contact of one foot to the next contact of the other foot.", formula: "IC(side B, k) − IC(side A, k)", inputs: "Alternating initial contacts", minimum: "≥ 10 valid intervals per foot", validation: "software-verified (synthetic)", failureModes: "Same-side consecutive detections are discarded, which reduces n." },
  { key: "stepTimeLeft", name: "Step time (left)", unit: "s", definition: "Step ending with a left initial contact.", formula: "IC(L) − preceding IC(R)", inputs: "Alternating initial contacts", minimum: "≥ 10 valid left intervals", validation: "software-verified (synthetic)", failureModes: "One-sided occlusion in side view." },
  { key: "stepTimeRight", name: "Step time (right)", unit: "s", definition: "Step ending with a right initial contact.", formula: "IC(R) − preceding IC(L)", inputs: "Alternating initial contacts", minimum: "≥ 10 valid right intervals", validation: "software-verified (synthetic)", failureModes: "One-sided occlusion in side view." },
  { key: "strideTimeLeft", name: "Stride time (left)", unit: "s", definition: "Time between successive left initial contacts.", formula: "IC(L, k+1) − IC(L, k)", inputs: "Left initial contacts", minimum: "≥ 10 valid stride intervals per contributing foot", validation: "software-verified (synthetic)", failureModes: "A missed contact doubles the interval (intervals outside 0.5–1.5× foot median or 0.4–3.0 s are rejected)." },
  { key: "strideTimeRight", name: "Stride time (right)", unit: "s", definition: "Time between successive right initial contacts.", formula: "IC(R, k+1) − IC(R, k)", inputs: "Right initial contacts", minimum: "≥ 10 valid stride intervals per contributing foot", validation: "software-verified (synthetic)", failureModes: "As left." },
  { key: "strideTime", name: "Stride time", unit: "s", definition: "Mean of complete same-side contact intervals pooled over both sides.", formula: "mean(IC(side, k+1) − IC(side, k))", inputs: "Bilateral initial contacts", minimum: "≥ 10 valid stride intervals per contributing foot", validation: "software-verified (synthetic)", failureModes: "Missed contacts and turning bias intervals." },
  { key: "stanceTime", name: "Stance time", unit: "s", definition: "Initial contact to toe-off of the same foot.", formula: "TO(side, k) − IC(side, k), TO taken as first toe-off after IC and before next IC", inputs: "Initial contacts + toe-offs", minimum: "≥ 10 valid stance phases per foot", validation: "software-verified (synthetic)", failureModes: "Toe-off from ankle kinematics is less reliable than contact; experimental." },
  { key: "swingTime", name: "Swing time", unit: "s", definition: "Toe-off to next initial contact of the same foot.", formula: "IC(side, k+1) − TO(side, k)", inputs: "Initial contacts + toe-offs", minimum: "≥ 10 valid swing phases per foot", validation: "software-verified (synthetic)", failureModes: "As stance." },
  { key: "doubleSupport", name: "Double-support time", unit: "s", definition: "Time both feet are on the ground per stride.", formula: "Not computed", inputs: "Bilateral IC + TO", minimum: "Validated bilateral toe-off detection", validation: "not implemented", failureModes: "Video toe-off timing error is the same order as double support (~0.1 s)." },
  { key: "stepTimeCV", name: "Step-time variability", unit: "% CV", definition: "Coefficient of variation of step time.", formula: "100 × SD / mean (sample SD, n−1)", inputs: "Step times", minimum: "≥ 10 valid step intervals per foot", validation: "software-verified (synthetic)", failureModes: "Inflated by detection jitter; short trials." },
  { key: "strideTimeCV", name: "Stride-time variability", unit: "% CV", definition: "CV of stride time pooled over both sides.", formula: "100 × SD / mean", inputs: "Stride times", minimum: "≥ 10 valid stride intervals per foot", validation: "software-verified (synthetic)", failureModes: "As step-time CV." },
  { key: "stepTimeAsymmetry", name: "Step-time asymmetry", unit: "%", definition: "Left/right temporal asymmetry.", formula: "100 × |L − R| / (0.5 × (L + R)) using mean left and right step times", inputs: "Left and right step times", minimum: "≥ 10 valid step intervals per foot", validation: "software-verified (synthetic)", failureModes: "Biased by one-sided occlusion." },
  { key: "stepTimeSymmetry", name: "Left-right symmetry", unit: "%", definition: "Temporal symmetry of mean left and right step times; 100% means equal timing.", formula: "clamp(100 × (1 − |L − R| / (0.5 × (L + R))), 0, 100)", inputs: "Left and right step times", minimum: "≥ 10 valid step intervals per foot", validation: "software-verified (synthetic)", failureModes: "Not spatial symmetry; one-sided occlusion biases estimates." },
  { key: "walkingSpeed", name: "Walking speed", unit: "m/s", definition: "Recorded walking distance divided by walking duration, only with recorded spatial calibration.", formula: "distance / (last IC − first IC)", inputs: "Recorded metric calibration + entered distance (m) + IC timestamps", minimum: "Calibration recorded; distance entered and covered within the recording", validation: "not validated", failureModes: "Assumes the entered distance was walked between first and last contact." },
  { key: "stepLength", name: "Step length", unit: "m", definition: "Distance between feet at contact.", formula: "Requires metric calibration", inputs: "Calibrated foot positions", minimum: "Validated spatial calibration", validation: "not implemented", failureModes: "Perspective, lens distortion and camera distance." },
  { key: "strideLength", name: "Stride length", unit: "m", definition: "Distance between successive same-foot contacts.", formula: "Requires metric calibration", inputs: "Calibrated foot positions", minimum: "Validated spatial calibration", validation: "not implemented", failureModes: "As step length." },
  { key: "turnDuration", name: "Turning duration", unit: "s", definition: "Duration of the TUG turn.", formula: "Not computed", inputs: "Trunk orientation", minimum: "Validated turn detector", validation: "not implemented", failureModes: "Monocular trunk yaw is ambiguous." },
  { key: "fog", name: "Freezing-of-gait indicator", unit: "—", definition: "Not computed.", formula: "—", inputs: "—", minimum: "Dedicated validated method", validation: "not implemented", failureModes: "—" },
  { key: "tremor", name: "Tremor features", unit: "Hz", definition: "Not computed.", formula: "—", inputs: "—", minimum: "Sampling ≥ 2× tremor band (4–12 Hz) with a validated method", validation: "not implemented", failureModes: "Video sampled at 15 fps cannot resolve tremor frequencies reliably." },
];

export const INTERVAL_FILTER_RULE = "0.5-1.5x median, plausibility window";
export const MIN_VALID_INTERVALS = 10;

export interface IntervalQuality {
  before: number;
  discarded: number;
  remaining: number;
  median: number | null;
  windowSeconds: [number, number];
  rule: string;
}

/** Median is computed per foot and interval kind BEFORE either filter. */
export function filterIntervals(intervals: number[], kind: "step" | "stride") {
  const windowSeconds: [number, number] = kind === "step" ? [0.3, 1.5] : [0.4, 3.0];
  const sorted = intervals.filter(Number.isFinite).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted[middle - 1];
  const median = upper === undefined ? null
    : sorted.length % 2 === 0 && lower !== undefined ? (lower + upper) / 2 : upper;
  const retainedIndices: number[] = [];
  const values = intervals.filter((value, index) => {
    const keep = median !== null && Number.isFinite(value)
      && value >= 0.5 * median && value <= 1.5 * median
      && value >= windowSeconds[0] && value <= windowSeconds[1];
    if (keep) retainedIndices.push(index);
    return keep;
  });
  const quality: IntervalQuality = {
    before: intervals.length, discarded: intervals.length - values.length,
    remaining: values.length, median, windowSeconds, rule: INTERVAL_FILTER_RULE,
  };
  return { values, retainedIndices, quality };
}

/** Never promote a derived feature above its least reliable input. */
export function weakestStatus(statuses: ParamStatus[]): ParamStatus {
  const order: ParamStatus[] = ["measured", "estimated", "experimental", "unreliable", "unavailable"];
  return statuses.reduce<ParamStatus>((weakest, status) =>
    order.indexOf(status) > order.indexOf(weakest) ? status : weakest, "measured");
}

export const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
export function sd(a: number[]) {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}

export function validateEvents(events: GaitEvent[]): { ok: GaitEvent[]; rejected: number; reason?: string } {
  const ok = events.filter((e) => Number.isFinite(e.timestamp) && e.timestamp >= 0);
  const sorted = [...ok].sort((a, b) => a.timestamp - b.timestamp);
  // duplicate same-side same-type timestamps are invalid
  const dedup = sorted.filter((e, i) => !sorted.slice(0, i).some((p) => p.side === e.side && p.type === e.type && Math.abs(p.timestamp - e.timestamp) < 1e-6));
  const rejected = events.length - dedup.length;
  return { ok: dedup, rejected, reason: rejected ? `${rejected} event(s) with invalid or duplicate timestamps removed.` : undefined };
}

export interface EngineInput {
  events: GaitEvent[];
  walkingDistanceM?: number | null;
  durationSec?: number | null;
  /** Explicit calibration evidence, retained in the persisted engine snapshot. */
  calibration?: CalibrationInfo | null;
}

export interface EngineOutput {
  version: string;
  parameters: ParamValue[];
  counts: { initialContacts: number; toeOffs: number; steps: number; strides: number; rejectedEvents: number };
  notes: string[];
  qualitySummary: { intervalFiltering: Record<"left" | "right", { step: IntervalQuality; stride: IntervalQuality }> };
  stepSeries: { t: number; side: "left" | "right"; stepTime: number }[];
  calibration?: CalibrationInfo | null;
}

export function computeGaitParameters(input: EngineInput): EngineOutput {
  const notes: string[] = [];
  const { ok, rejected, reason } = validateEvents(input.events);
  if (reason) notes.push(reason);
  const ic = ok.filter((e) => e.type === "heel_strike");
  const to = ok.filter((e) => e.type === "toe_off");

  const rawSteps: Record<"left" | "right", { t: number; side: "left" | "right"; stepTime: number }[]> = { left: [], right: [] };
  for (let i = 1; i < ic.length; i++) {
    const current = ic[i], previous = ic[i - 1];
    if (!current || !previous || current.side === previous.side) continue;
    rawSteps[current.side].push({ t: current.timestamp, side: current.side, stepTime: current.timestamp - previous.timestamp });
  }
  const stepL = filterIntervals(rawSteps.left.map((s) => s.stepTime), "step");
  const stepR = filterIntervals(rawSteps.right.map((s) => s.stepTime), "step");
  const stepSeries = (["left", "right"] as const).flatMap((side) => {
    const retained = new Set((side === "left" ? stepL : stepR).retainedIndices);
    return rawSteps[side].filter((_, index) => retained.has(index));
  }).sort((a, b) => a.t - b.t);
  const stepsL = stepL.values, stepsR = stepR.values;
  const steps = [...stepsL, ...stepsR];
  const contacts = (side: "left" | "right") => ic.filter((e) => e.side === side);
  const stride = (side: "left" | "right") => {
    const events = contacts(side);
    return filterIntervals(events.slice(1).map((event, index) => event.timestamp - events[index].timestamp), "stride");
  };
  const strideL = stride("left"), strideR = stride("right");
  const strL = strideL.values, strR = strideR.values;
  const strides = [...strL, ...strR];
  const intervalFiltering = {
    left: { step: stepL.quality, stride: strideL.quality },
    right: { step: stepR.quality, stride: strideR.quality },
  };
  for (const side of ["left", "right"] as const) {
    for (const kind of ["step", "stride"] as const) {
      const q = intervalFiltering[side][kind];
      notes.push(`${side} ${kind}: ${q.before} intervals before filtering, ${q.discarded} discarded, ${q.remaining} retained; ${q.rule}.`);
    }
  }

  const stance: Record<"left" | "right", number[]> = { left: [], right: [] };
  const swing: Record<"left" | "right", number[]> = { left: [], right: [] };
  for (const side of ["left", "right"] as const) {
    const s = contacts(side);
    const t = to.filter((e) => e.side === side);
    for (const index of (side === "left" ? strideL : strideR).retainedIndices) {
      const start = s[index], end = s[index + 1];
      if (!start || !end) continue;
      const toe = t.find((x) => x.timestamp > start.timestamp && x.timestamp < end.timestamp);
      if (!toe) continue;
      stance[side].push(toe.timestamp - start.timestamp);
      swing[side].push(end.timestamp - toe.timestamp);
    }
  }

  const P: ParamValue[] = [];
  const put = (key: string, groups: number[][], f: (a: number[]) => number, status: ParamStatus = "estimated") => {
    const arr = groups.flat();
    const reliable = groups.every((group) => group.length >= MIN_VALID_INTERVALS);
    const value = reliable ? f(arr) : null;
    P.push(value !== null && Number.isFinite(value)
      ? { key, value: +value.toFixed(4), status, n: arr.length }
      : { key, value: null, status: "unreliable", n: arr.length, reason: "too few valid intervals" });
  };
  put("cadence", [stepsL, stepsR], (a) => 60 / mean(a));
  put("stepTime", [stepsL, stepsR], mean);
  put("stepTimeLeft", [stepsL], mean);
  put("stepTimeRight", [stepsR], mean);
  put("strideTimeLeft", [strL], mean);
  put("strideTimeRight", [strR], mean);
  put("strideTime", [strL, strR], mean);
  put("stanceTime", [stance.left, stance.right], mean, "experimental");
  put("swingTime", [swing.left, swing.right], mean, "experimental");
  P.push({ key: "doubleSupport", value: null, status: "unavailable", n: 0, reason: "No validated bilateral toe-off method for monocular video." });
  put("stepTimeCV", [stepsL, stepsR], (a) => (100 * sd(a)) / mean(a));
  put("strideTimeCV", [strL, strR], (a) => (100 * sd(a)) / mean(a));
  const left = P.find((p) => p.key === "stepTimeLeft");
  const right = P.find((p) => p.key === "stepTimeRight");
  if (left && right) {
    const status = weakestStatus([left.status, right.status]);
    const asymmetry = left.value !== null && right.value !== null
      ? 100 * Math.abs(left.value - right.value) / (0.5 * (left.value + right.value)) : null;
    for (const key of ["stepTimeAsymmetry", "stepTimeSymmetry"]) {
      P.push(asymmetry !== null
        ? { key, value: +(key === "stepTimeAsymmetry" ? asymmetry : Math.max(0, Math.min(100, 100 - asymmetry))).toFixed(3), status, n: steps.length }
        : { key, value: null, status, n: steps.length, reason: left.reason ?? right.reason ?? "too few valid intervals" });
    }
  }

  const dist = input.walkingDistanceM;
  const cal = input.calibration;
  const calibrated = cal?.source === "known-distance" && typeof cal.metersPerUnit === "number" && Number.isFinite(cal.metersPerUnit) && cal.metersPerUnit > 0;
  if (!calibrated) P.push({ key: "walkingSpeed", value: null, status: "unavailable", n: 0, reason: CALIBRATION_REQUIRED });
  else if (dist && Number.isFinite(dist) && dist > 0 && ic.length >= 2) {
    const dur = ic[ic.length - 1].timestamp - ic[0].timestamp;
    P.push(dur > 0.5
      ? { key: "walkingSpeed", value: +(dist / dur).toFixed(3), status: "estimated", n: ic.length, reason: "Uses entered distance; assumes it was walked between first and last contact." }
      : { key: "walkingSpeed", value: null, status: "unavailable", n: 0, reason: "Walking duration too short." });
  } else P.push({ key: "walkingSpeed", value: null, status: "unavailable", n: 0, reason: "Walking distance not entered or too few contacts." });

  for (const key of ["stepLength", "strideLength"])
    P.push({ key, value: null, status: "unavailable", n: 0, reason: calibrated ? "Not available - calibrated contact-position extraction not implemented" : CALIBRATION_REQUIRED });
  P.push({ key: "turnDuration", value: null, status: "unavailable", n: 0, reason: "No validated turn detector implemented." });
  P.push({ key: "fog", value: null, status: "unavailable", n: 0, reason: "No dedicated validated freezing-of-gait method implemented." });
  P.push({ key: "tremor", value: null, status: "unavailable", n: 0, reason: "15 fps sampling and current algorithm cannot support tremor measurement." });

  return {
    version: ENGINE_VERSION,
    parameters: P.map((p) => {
      const definition = PARAMETER_DEFINITIONS.find((d) => d.key === p.key);
      return { ...p, unit: definition?.unit ?? "", method: `${EVENT_METHOD.name}; ${INTERVAL_FILTER_RULE}; ${definition?.formula ?? "Not computed"}; inputs: ${definition?.inputs ?? "Not available"}` };
    }),
    calibration: calibrated ? cal : null,
    counts: { initialContacts: ic.length, toeOffs: to.length, steps: steps.length, strides: strides.length, rejectedEvents: rejected },
    notes,
    qualitySummary: { intervalFiltering },
    stepSeries,
  };
}

export const EVENT_METHOD = {
  name: "Ankle position relative to pelvis (Zeni-style kinematic method)",
  description:
    "For each side the horizontal ankle-minus-pelvis signal (in torso lengths, signed by travel direction) is smoothed; local maxima are initial-contact estimates and local minima are toe-off estimates.",
  thresholds: "Signal SD ≥ 0.02 torso lengths; peak prominence ≥ SD × prominence factor; minimum event separation from pipeline config.",
  minimumQuality: "≥ 8 frames with reliable hip and ankle landmarks per side.",
  limitations:
    "Designed for side-view, straight-line walking. Front view, turning and shuffling gait reduce accuracy. Events are algorithmic estimates, not ground truth — they have not been compared with force plates or annotated video.",
};
