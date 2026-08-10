import type { PoseAnalysis, PoseAnalysisFull } from "@/types/gait";

/**
 * Full analysis (incl. raw landmark frames) is kept in module memory only —
 * it is large and never written to storage. A compact version (metrics,
 * angle series, events) is persisted in sessionStorage for the dashboard.
 */
let fullAnalysis: PoseAnalysisFull | null = null;

export const POSE_SESSION_KEY = "latestPoseAnalysis";

export function setFullPoseAnalysis(a: PoseAnalysisFull | null) {
  fullAnalysis = a;
}

export function getFullPoseAnalysis(): PoseAnalysisFull | null {
  return fullAnalysis;
}

/** Strip raw frames for storage; downsample angle series to keep it small. */
export function toStorable(a: PoseAnalysisFull): PoseAnalysis {
  const stepEvery = Math.max(1, Math.ceil(a.angles.length / 600));
  return {
    method: a.method,
    generatedAt: a.generatedAt,
    video: a.video,
    metrics: a.metrics,
    angles: a.angles.filter((_, i) => i % stepEvery === 0),
    events: a.events,
  };
}

export function persistPoseAnalysis(a: PoseAnalysisFull | null) {
  setFullPoseAnalysis(a);
  try {
    if (!a) sessionStorage.removeItem(POSE_SESSION_KEY);
    else sessionStorage.setItem(POSE_SESSION_KEY, JSON.stringify(toStorable(a)));
  } catch {
    /* storage full — dashboard falls back to in-memory copy */
  }
}

export function readPoseAnalysis(): PoseAnalysis | null {
  const full = getFullPoseAnalysis();
  if (full) return toStorable(full);
  try {
    const raw = sessionStorage.getItem(POSE_SESSION_KEY);
    return raw ? (JSON.parse(raw) as PoseAnalysis) : null;
  } catch {
    return null;
  }
}
