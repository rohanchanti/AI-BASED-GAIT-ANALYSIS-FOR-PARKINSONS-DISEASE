/**
 * Algorithmic gait-event estimation (NOT a clinically validated detector).
 *
 * Signal: for each side, the horizontal offset of the foot relative to the
 * pelvis centre, projected on the dominant direction of travel:
 *
 *   s(t) = (foot_x(t) − pelvis_x(t)) × travelSign
 *
 * In a sagittal-plane recording this signal oscillates once per gait cycle.
 *   • local MAXIMUM  → foot maximally in front of the body  → initial contact
 *     (heel strike)
 *   • local MINIMUM  → foot maximally behind the body        → toe-off
 *
 * Peaks are accepted only when they are separated by >= MIN_SEPARATION seconds
 * and their prominence exceeds a fraction of the signal's standard deviation.
 * Frames with low-confidence landmarks are excluded from the signal entirely.
 */
import type { GaitEvent } from "@/types/gait";
import type { PoseFrame } from "@/types/pose";
import { indexLandmarks, meanVisibility, reliable } from "./poseLandmarkUtils";

const MIN_SEPARATION = 0.28; // seconds between successive events of one side
const PROMINENCE_FACTOR = 0.35; // × signal std-dev

interface Point {
  t: number;
  frame: number;
  v: number;
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
    const lh = reliable(map, "left_hip", threshold);
    const rh = reliable(map, "right_hip", threshold);
    const heel = reliable(map, `${side}_heel`, threshold);
    const toe = reliable(map, `${side}_foot_index`, threshold);
    const ankle = reliable(map, `${side}_ankle`, threshold);
    if (!lh || !rh || !ankle || (!heel && !toe)) continue;
    const pelvisX = (lh.x + rh.x) / 2;
    const footX = heel && toe ? (heel.x + toe.x) / 2 : (heel ?? toe)!.x;
    pts.push({
      t: f.timestamp,
      frame: f.frameNumber,
      v: footX - pelvisX,
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

function stdev(vals: number[]) {
  if (!vals.length) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length);
}

function findExtrema(pts: Point[], kind: "max" | "min", minProm: number): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const isExt =
      kind === "max"
        ? p.v >= pts[i - 1].v && p.v >= pts[i + 1].v
        : p.v <= pts[i - 1].v && p.v <= pts[i + 1].v;
    if (!isExt) continue;
    const last = out[out.length - 1];
    if (last && p.t - last.t < MIN_SEPARATION) {
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
    const pts = smooth(raw).map((p) => ({ ...p, v: p.v * travelSign }));
    const sd = stdev(pts.map((p) => p.v));
    if (sd < 0.005) continue; // essentially no oscillation
    const minProm = sd * PROMINENCE_FACTOR;
    usableSides++;
    for (const p of findExtrema(pts, "max", minProm)) {
      events.push({
        timestamp: +p.t.toFixed(3),
        frameNumber: p.frame,
        side,
        type: "heel_strike",
        confidence: +p.conf.toFixed(3),
      });
    }
    for (const p of findExtrema(pts, "min", minProm)) {
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
