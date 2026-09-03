/**
 * Reproducibility metadata.
 *
 * Every analysis records the exact software versions that produced it, so a
 * result can be traced back to the pipeline that generated it. Bump the
 * relevant version whenever the corresponding stage changes behaviour.
 */

export const ANALYSIS_VERSIONS = {
  /** overall product/analysis release */
  platform: "NeuroStride-v1.0",
  /** risk/severity model applied to the gait feature vector */
  gaitModel: "NeuroStride-Gait-v1.2",
  /** feature-extraction pipeline (preprocessing + biomarker computation) */
  featurePipeline: "v1.1",
  /** markerless pose estimator */
  poseEstimator: "MediaPipe Pose Landmarker (lite) v2.0",
  /** facial landmark pipeline — not configured yet */
  faceEstimator: null as string | null,
} as const;

export interface AnalysisIdentity {
  analysisId: string;
  subjectId: string | null;
  sessionId: string | null;
  analysisTimestamp: string;
}

/** `NS-2026-0417` — year + a per-day sequence kept in local storage. */
export function nextAnalysisId(now = new Date()): string {
  const year = now.getFullYear();
  const key = `neurostride:analysis-seq:${year}`;
  let seq = 1;
  try {
    seq = Number(localStorage.getItem(key) ?? "0") + 1;
    localStorage.setItem(key, String(seq));
  } catch {
    /* storage unavailable — fall back to a time-derived sequence */
    seq = Math.floor((now.getTime() / 1000) % 10000);
  }
  return `NS-${year}-${String(seq).padStart(4, "0")}`;
}

export function formatAnalysisDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
