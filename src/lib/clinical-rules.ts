/** Pure clinical-workflow rules shared by UI, server functions and tests. */

export const REPORTABLE_STATUSES = ["completed", "completed_with_warnings"] as const;

/** A report may only be produced from a run that actually finished. */
export function canGenerateReport(status: string | null | undefined): boolean {
  return !!status && (REPORTABLE_STATUSES as readonly string[]).includes(status);
}

export const REVIEW_DECISIONS = ["pending", "reviewed", "needs_repeat"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface TimingInput {
  protocol: string;
  startSec: number | null;
  endSec: number | null;
  distanceM: number | null;
  videoDurationSec: number | null;
}

export type TimedResult =
  | { verified: true; label: string; value: number; unit: string; formula: string }
  | { verified: false; label: string; reason: string };

/**
 * TUG and 10MWT are only reported when the operator marks start/stop on the video
 * (and, for 10MWT, confirms the timed distance). Nothing is inferred from the clip alone.
 */
export function timedProtocolResult(t: TimingInput): TimedResult | null {
  const isTug = t.protocol === "tug";
  const is10 = t.protocol === "10mwt";
  if (!isTug && !is10) return null;
  const label = isTug ? "TUG time" : "10MWT gait speed";
  if (t.startSec == null || t.endSec == null) return { verified: false, label, reason: "Start and stop marks have not been recorded." };
  if (!(t.endSec > t.startSec)) return { verified: false, label, reason: "Stop mark must be after the start mark." };
  if (t.startSec < 0 || (t.videoDurationSec != null && t.endSec > t.videoDurationSec + 0.05))
    return { verified: false, label, reason: "Marks fall outside the recorded video." };
  const dt = t.endSec - t.startSec;
  if (isTug) return { verified: true, label, value: +dt.toFixed(2), unit: "s", formula: "stop mark − start mark" };
  if (t.distanceM == null || t.distanceM !== 10)
    return { verified: false, label, reason: "The timed distance must be confirmed as exactly 10 m." };
  return { verified: true, label, value: +(t.distanceM / dt).toFixed(3), unit: "m/s", formula: "10 m ÷ (stop mark − start mark)" };
}

export interface ParamLike {
  key: string;
  value: number | null;
  status: string;
  n?: number;
}

export interface ParamDiff {
  key: string;
  a: number | null;
  b: number | null;
  diff: number | null;
  pct: number | null;
  note?: string;
}

/** Neutral differences only — never labelled as improvement or deterioration. */
export function compareParameters(a: ParamLike[], b: ParamLike[]): ParamDiff[] {
  const keys = Array.from(new Set([...a.map((p) => p.key), ...b.map((p) => p.key)]));
  return keys.map((key) => {
    const pa = a.find((p) => p.key === key);
    const pb = b.find((p) => p.key === key);
    const va = pa && pa.status !== "unavailable" ? pa.value : null;
    const vb = pb && pb.status !== "unavailable" ? pb.value : null;
    if (va == null || vb == null) return { key, a: va, b: vb, diff: null, pct: null, note: "Not available in both visits" };
    const diff = vb - va;
    return { key, a: va, b: vb, diff: +diff.toFixed(4), pct: va !== 0 ? +((100 * diff) / Math.abs(va)).toFixed(1) : null };
  });
}
