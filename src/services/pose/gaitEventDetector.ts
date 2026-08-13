/**
 * Algorithmic gait-event estimation (NOT a clinically validated detector).
 *
 * Signal
 * ------
 * For each side, the foot position is expressed in BODY-RELATIVE coordinates
 * (relative to the pelvis centre, scaled by torso length) and projected on the
 * dominant direction of travel:
 *
 *   s(t) = (foot_x(t) − pelvis_x(t)) / torsoLength(t) × travelSign
 *
 * Body-relative scaling removes camera translation and most perspective scale
 * drift, so the oscillation amplitude stays comparable as the subject walks
 * toward or away from the camera.
 *
 * Event rules
 * -----------
 *   • local MAXIMUM of s(t)  → foot maximally in front of the body → initial
 *     contact (heel strike). Confirmed by a sign change of ds/dt from + to −.
 *   • local MINIMUM of s(t)  → foot maximally behind the body → toe-off,
 *     confirmed by a − to + sign change.
 *
 * Candidates are accepted only when
 *   – they are ≥ cfg.eventMinSeparationSec apart (per side),
 *   – their prominence exceeds cfg.eventProminenceFactor × signal SD,
 *   – the derivative sign change is consistent with the event type.
 * Frames with low-confidence or rejected landmarks contribute nothing, and when
 * the signal carries no usable oscillation NO events are emitted (rather than
 * fabricating a cadence).
 */
import type { GaitEvent } from "@/types/gait";
import type { PoseFrame } from "@/types/pose";
import { indexLandmarks, meanVisibility, reliable } from "./poseLandmarkUtils";
import { toBodyRelative } from "./temporalFilter";
import { DEFAULT_POSE_CONFIG, type PosePipelineConfig } from "./poseConfig";

interface Point {
  t: number;
  frame: number;
  v: number;
  /** central-difference derivative of v */
  dv: number;
  conf: number;
}

function buildSignal(
  frames: PoseFrame[],
  side: "left" | "right",
  threshold: number,
): Point[] {
  const pts: Point[] = [];
  for (const f of frames) {
    const map = indexLandmarks(f.landmarks);
    const rel = toBodyRelative(f.landmarks);
    const heel = reliable(map, `${side}_heel`, threshold);
    const toe = reliable(map, `${side}_foot_index`, threshold);
    const ankle = reliable(map, `${side}_ankle`, threshold);
    if (!rel || !ankle || (!heel && !toe)) continue;

    // Body-relative foot x (already pelvis-centred and torso-normalized).
    const relHeel = heel ? rel.get(`${side}_heel`) : null;
    const relToe = toe ? rel.get(`${side}_foot_index`) : null;
    const relAnkle = rel.get(`${side}_ankle`);
    const xs = [relHeel?.x, relToe?.x].filter((v): v is number => v != null);
    const v = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : relAnkle?.x;
    if (v == null || !isFinite(v)) continue;

    pts.push({
      t: f.timestamp,
      frame: f.frameNumber,
      v,
      dv: 0,
      conf: meanVisibility(map, [`${side}_heel`, `${side}_ankle`, `${side}_foot_index`]),
    });
  }
  return pts;
}

function smooth(pts: Point[], win = 3): Point[] {
  if (pts.length < win) return pts;
  const half = Math.floor(win / 2);
  return pts.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < pts.length) {
        sum += pts[j].v;
        n++;
      }
    }
    return { ...p, v: sum / n };
  });
}

/** Central-difference velocity of the signal (units per second). */
function withDerivative(pts: Point[]): Point[] {
  return pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dt = next.t - prev.t;
    return { ...p, dv: dt > 1e-6 ? (next.v - prev.v) / dt : 0 };
  });
}

function stdev(vals: number[]) {
  if (!vals.length) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length);
}

function findExtrema(
  pts: Point[],
  kind: "max" | "min",
  minProm: number,
  minSeparation: number,
): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const isExt =
      kind === "max"
        ? p.v >= pts[i - 1].v && p.v >= pts[i + 1].v
        : p.v <= pts[i - 1].v && p.v <= pts[i + 1].v;
    if (!isExt) continue;
    // velocity confirmation: + → − at a maximum, − → + at a minimum
    const dvBefore = pts[i - 1].dv;
    const dvAfter = pts[i + 1].dv;
    const velOk =
      kind === "max" ? dvBefore >= -1e-9 && dvAfter <= 1e-9 : dvBefore <= 1e-9 && dvAfter >= -1e-9;
    if (!velOk) continue;

    const last = out[out.length - 1];
    if (last && p.t - last.t < minSeparation) {
      const better = kind === "max" ? p.v > last.v : p.v < last.v;
      if (better) out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  // prominence filter against the signal mean
  const mean = pts.reduce((a, b) => a + b.v, 0) / (pts.length || 1);
  return out.filter((p) => Math.abs(p.v - mean) >= minProm);
}

export interface GaitEventResult {
  events: GaitEvent[];
  /** direction of travel in normalized x per second (sign only is meaningful) */
  travelSign: 1 | -1;
  reason?: string;
}

export function detectGaitEvents(
  frames: PoseFrame[],
  threshold: number,
  cfg: PosePipelineConfig = DEFAULT_POSE_CONFIG,
): GaitEventResult {
  // Dominant travel direction from pelvis displacement.
  const pelvis: { t: number; x: number }[] = [];
  for (const f of frames) {
    const map = indexLandmarks(f.landmarks);
    const lh = reliable(map, "left_hip", threshold);
    const rh = reliable(map, "right_hip", threshold);
    if (lh && rh) pelvis.push({ t: f.timestamp, x: (lh.x + rh.x) / 2 });
  }
  const drift = pelvis.length > 1 ? pelvis[pelvis.length - 1].x - pelvis[0].x : 0;
  const travelSign: 1 | -1 = drift >= 0 ? 1 : -1;

  const events: GaitEvent[] = [];
  let usableSides = 0;

  for (const side of ["left", "right"] as const) {
    const raw = buildSignal(frames, side, threshold);
    if (raw.length < 8) continue;
    const pts = withDerivative(
      smooth(raw).map((p) => ({ ...p, v: p.v * travelSign })),
    );
    const sd = stdev(pts.map((p) => p.v));
    // Body-relative units: torso lengths. Below ~2% of a torso length there is
    // no meaningful foot oscillation to detect.
    if (sd < 0.02) continue;
    const minProm = sd * cfg.eventProminenceFactor;
    usableSides++;
    for (const p of findExtrema(pts, "max", minProm, cfg.eventMinSeparationSec)) {
      events.push({
        timestamp: +p.t.toFixed(3),
        frameNumber: p.frame,
        side,
        type: "heel_strike",
        confidence: +p.conf.toFixed(3),
      });
    }
    for (const p of findExtrema(pts, "min", minProm, cfg.eventMinSeparationSec)) {
      events.push({
        timestamp: +p.t.toFixed(3),
        frameNumber: p.frame,
        side,
        type: "toe_off",
        confidence: +p.conf.toFixed(3),
      });
    }
  }

  events.sort((a, b) => a.timestamp - b.timestamp);

  if (!usableSides) {
    return {
      events: [],
      travelSign,
      reason: "Insufficient pose quality for reliable gait-event estimation.",
    };
  }
  return { events, travelSign };
}
