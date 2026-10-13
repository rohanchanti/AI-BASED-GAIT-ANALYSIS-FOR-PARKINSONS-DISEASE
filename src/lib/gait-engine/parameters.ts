/**
 * Traceable gait-parameter engine.
 * Inputs: video-derived gait events (timestamps in seconds from the decoded video clock).
 * Every output is either a value with provenance or an explicit "unavailable" with a reason.
 */
import type { GaitEvent } from "@/types/gait";

export const ENGINE_VERSION = "gait-engine 1.0.0";

export type ParamStatus = "measured" | "estimated" | "experimental" | "unavailable";
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
}

export const PARAMETER_DEFINITIONS: ParamDefinition[] = [
  { key: "cadence", name: "Cadence", unit: "steps/min", definition: "Steps per minute.", formula: "60 / mean(step time), steps = consecutive contralateral initial contacts", inputs: "Left + right initial-contact timestamps", minimum: "≥ 4 steps", validation: "software-verified (synthetic)", failureModes: "Missed or duplicate contacts; turning; non-steady walking." },
  { key: "stepTime", name: "Step time", unit: "s", definition: "Time from initial contact of one foot to the next contact of the other foot.", formula: "IC(side B, k) − IC(side A, k)", inputs: "Alternating initial contacts", minimum: "≥ 4 steps", validation: "software-verified (synthetic)", failureModes: "Same-side consecutive detections are discarded, which reduces n." },
  { key: "stepTimeLeft", name: "Step time (left)", unit: "s", definition: "Step ending with a left initial contact.", formula: "IC(L) − preceding IC(R)", inputs: "Alternating initial contacts", minimum: "≥ 2 left steps", validation: "software-verified (synthetic)", failureModes: "One-sided occlusion in side view." },
  { key: "stepTimeRight", name: "Step time (right)", unit: "s", definition: "Step ending with a right initial contact.", formula: "IC(R) − preceding IC(L)", inputs: "Alternating initial contacts", minimum: "≥ 2 right steps", validation: "software-verified (synthetic)", failureModes: "One-sided occlusion in side view." },
  { key: "strideTimeLeft", name: "Stride time (left)", unit: "s", definition: "Time between successive left initial contacts.", formula: "IC(L, k+1) − IC(L, k)", inputs: "Left initial contacts", minimum: "≥ 2 strides", validation: "software-verified (synthetic)", failureModes: "A missed contact doubles the interval (intervals > 2.5 s are rejected)." },
  { key: "strideTimeRight", name: "Stride time (right)", unit: "s", definition: "Time between successive right initial contacts.", formula: "IC(R, k+1) − IC(R, k)", inputs: "Right initial contacts", minimum: "≥ 2 strides", validation: "software-verified (synthetic)", failureModes: "As left." },
  { key: "stanceTime", name: "Stance time", unit: "s", definition: "Initial contact to toe-off of the same foot.", formula: "TO(side, k) − IC(side, k), TO taken as first toe-off after IC and before next IC", inputs: "Initial contacts + toe-offs", minimum: "≥ 2 stance phases", validation: "software-verified (synthetic)", failureModes: "Toe-off from ankle kinematics is less reliable than contact; experimental." },
  { key: "swingTime", name: "Swing time", unit: "s", definition: "Toe-off to next initial contact of the same foot.", formula: "IC(side, k+1) − TO(side, k)", inputs: "Initial contacts + toe-offs", minimum: "≥ 2 swing phases", validation: "software-verified (synthetic)", failureModes: "As stance." },
  { key: "doubleSupport", name: "Double-support time", unit: "s", definition: "Time both feet are on the ground per stride.", formula: "Not computed", inputs: "Bilateral IC + TO", minimum: "Validated bilateral toe-off detection", validation: "not implemented", failureModes: "Video toe-off timing error is the same order as double support (~0.1 s)." },
  { key: "stepTimeCV", name: "Step-time variability", unit: "% CV", definition: "Coefficient of variation of step time.", formula: "100 × SD / mean (sample SD, n−1)", inputs: "Step times", minimum: "≥ 6 steps", validation: "software-verified (synthetic)", failureModes: "Inflated by detection jitter; short trials." },
  { key: "strideTimeCV", name: "Stride-time variability", unit: "% CV", definition: "CV of stride time pooled over both sides.", formula: "100 × SD / mean", inputs: "Stride times", minimum: "≥ 4 strides", validation: "software-verified (synthetic)", failureModes: "As step-time CV." },
  { key: "stepTimeAsymmetry", name: "Step-time asymmetry", unit: "%", definition: "Left/right temporal asymmetry.", formula: "100 × |L − R| / (0.5 × (L + R)) using mean left and right step times", inputs: "Left and right step times", minimum: "≥ 2 steps per side", validation: "software-verified (synthetic)", failureModes: "Biased by one-sided occlusion." },
  { key: "walkingSpeed", name: "Walking speed", unit: "m/s", definition: "Entered walking distance divided by walking duration.", formula: "distance / (last IC − first IC)", inputs: "Entered distance (m) + IC timestamps", minimum: "Distance entered and covered within the recording", validation: "not validated", failureModes: "Assumes the entered distance was walked between first and last contact." },
  { key: "stepLength", name: "Step length", unit: "m", definition: "Distance between feet at contact.", formula: "Requires metric calibration", inputs: "Calibrated foot positions", minimum: "Validated spatial calibration", validation: "not implemented", failureModes: "Perspective, lens distortion and camera distance." },
  { key: "strideLength", name: "Stride length", unit: "m", definition: "Distance between successive same-foot contacts.", formula: "Requires metric calibration", inputs: "Calibrated foot positions", minimum: "Validated spatial calibration", validation: "not implemented", failureModes: "As step length." },
  { key: "turnDuration", name: "Turning duration", unit: "s", definition: "Duration of the TUG turn.", formula: "Not computed", inputs: "Trunk orientation", minimum: "Validated turn detector", validation: "not implemented", failureModes: "Monocular trunk yaw is ambiguous." },
  { key: "fog", name: "Freezing-of-gait indicator", unit: "—", definition: "Not computed.", formula: "—", inputs: "—", minimum: "Dedicated validated method", validation: "not implemented", failureModes: "—" },
  { key: "tremor", name: "Tremor features", unit: "Hz", definition: "Not computed.", formula: "—", inputs: "—", minimum: "Sampling ≥ 2× tremor band (4–12 Hz) with a validated method", validation: "not implemented", failureModes: "Video sampled at 15 fps cannot resolve tremor frequencies reliably." },
];

const MAX_INTERVAL = 2.5;
const MIN_INTERVAL = 0.15;

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

const valid = (d: number) => d > MIN_INTERVAL && d < MAX_INTERVAL;

export interface EngineInput {
  events: GaitEvent[];
  walkingDistanceM?: number | null;
  durationSec?: number | null;
}

export interface EngineOutput {
  version: string;
  parameters: ParamValue[];
  counts: { initialContacts: number; toeOffs: number; steps: number; strides: number; rejectedEvents: number };
  notes: string[];
  stepSeries: { t: number; side: "left" | "right"; stepTime: number }[];
}

export function computeGaitParameters(input: EngineInput): EngineOutput {
  const notes: string[] = [];
  const { ok, rejected, reason } = validateEvents(input.events);
  if (reason) notes.push(reason);
  const ic = ok.filter((e) => e.type === "heel_strike");
  const to = ok.filter((e) => e.type === "toe_off");

  const stepsL: number[] = [];
  const stepsR: number[] = [];
  const stepSeries: { t: number; side: "left" | "right"; stepTime: number }[] = [];
  for (let i = 1; i < ic.length; i++) {
    if (ic[i].side === ic[i - 1].side) continue;
    const d = ic[i].timestamp - ic[i - 1].timestamp;
    if (!valid(d)) continue;
    (ic[i].side === "left" ? stepsL : stepsR).push(d);
    stepSeries.push({ t: ic[i].timestamp, side: ic[i].side, stepTime: +d.toFixed(4) });
  }
  const steps = [...stepsL, ...stepsR];
  const stride = (side: "left" | "right") => {
    const s = ic.filter((e) => e.side === side);
    const out: number[] = [];
    for (let i = 1; i < s.length; i++) {
      const d = s[i].timestamp - s[i - 1].timestamp;
      if (d > 2 * MIN_INTERVAL && d < MAX_INTERVAL) out.push(d);
    }
    return out;
  };
  const strL = stride("left");
  const strR = stride("right");
  const strides = [...strL, ...strR];

  const stance: number[] = [];
  const swing: number[] = [];
  for (const side of ["left", "right"] as const) {
    const s = ic.filter((e) => e.side === side);
    const t = to.filter((e) => e.side === side);
    for (let i = 0; i < s.length - 1; i++) {
      const toe = t.find((x) => x.timestamp > s[i].timestamp && x.timestamp < s[i + 1].timestamp);
      if (!toe || !valid(s[i + 1].timestamp - s[i].timestamp)) continue;
      stance.push(toe.timestamp - s[i].timestamp);
      swing.push(s[i + 1].timestamp - toe.timestamp);
    }
  }

  const P: ParamValue[] = [];
  const put = (key: string, arr: number[], min: number, f: (a: number[]) => number, status: ParamStatus = "measured") =>
    P.push(
      arr.length >= min
        ? { key, value: +f(arr).toFixed(4), status, n: arr.length }
        : { key, value: null, status: "unavailable", n: arr.length, reason: `Needs ≥ ${min} valid intervals; ${arr.length} found.` },
    );
  put("cadence", steps, 4, (a) => 60 / mean(a));
  put("stepTime", steps, 4, mean);
  put("stepTimeLeft", stepsL, 2, mean);
  put("stepTimeRight", stepsR, 2, mean);
  put("strideTimeLeft", strL, 2, mean);
  put("strideTimeRight", strR, 2, mean);
  put("stanceTime", stance, 2, mean, "experimental");
  put("swingTime", swing, 2, mean, "experimental");
  P.push({ key: "doubleSupport", value: null, status: "unavailable", n: 0, reason: "No validated bilateral toe-off method for monocular video." });
  put("stepTimeCV", steps, 6, (a) => (100 * sd(a)) / mean(a));
  put("strideTimeCV", strides, 4, (a) => (100 * sd(a)) / mean(a));
  if (stepsL.length >= 2 && stepsR.length >= 2) {
    const l = mean(stepsL), r = mean(stepsR);
    P.push({ key: "stepTimeAsymmetry", value: +((100 * Math.abs(l - r)) / (0.5 * (l + r))).toFixed(3), status: "measured", n: stepsL.length + stepsR.length });
  } else P.push({ key: "stepTimeAsymmetry", value: null, status: "unavailable", n: 0, reason: "Needs ≥ 2 steps on each side." });

  const dist = input.walkingDistanceM;
  if (dist && dist > 0 && ic.length >= 2) {
    const dur = ic[ic.length - 1].timestamp - ic[0].timestamp;
    P.push(dur > 0.5
      ? { key: "walkingSpeed", value: +(dist / dur).toFixed(3), status: "estimated", n: ic.length, reason: "Uses entered distance; assumes it was walked between first and last contact." }
      : { key: "walkingSpeed", value: null, status: "unavailable", n: 0, reason: "Walking duration too short." });
  } else P.push({ key: "walkingSpeed", value: null, status: "unavailable", n: 0, reason: "Walking distance not entered or too few contacts." });

  for (const key of ["stepLength", "strideLength"])
    P.push({ key, value: null, status: "unavailable", n: 0, reason: "Normalized image coordinates are not metric; no validated calibration." });
  P.push({ key: "turnDuration", value: null, status: "unavailable", n: 0, reason: "No validated turn detector implemented." });
  P.push({ key: "fog", value: null, status: "unavailable", n: 0, reason: "No dedicated validated freezing-of-gait method implemented." });
  P.push({ key: "tremor", value: null, status: "unavailable", n: 0, reason: "15 fps sampling and current algorithm cannot support tremor measurement." });

  return {
    version: ENGINE_VERSION,
    parameters: P,
    counts: { initialContacts: ic.length, toeOffs: to.length, steps: steps.length, strides: strides.length, rejectedEvents: rejected },
    notes,
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
