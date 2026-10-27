import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { AnalysisResult } from "@/lib/mock-analysis";
import type { EngineOutput } from "@/lib/gait-engine/parameters";
import type { PoseAnalysis } from "@/types/gait";

export type DashboardSubject = Tables<"subjects">;
export type DashboardVisit = Tables<"visits">;
export type DashboardRun = Tables<"analysis_runs"> & {
  recordings: Tables<"recordings"> | null;
  gait_results: Pick<Tables<"gait_results">, "result_payload" | "engine_output" | "pose_metrics" | "quality" | "validation" | "events"> | null;
};

export const dashboardQueryOptions = (userId: string) => queryOptions({
  queryKey: ["dashboard-records", userId],
  queryFn: async () => {
    const [subjects, visits, runs, reports] = await Promise.all([
      supabase.from("subjects").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("visits").select("*").eq("owner_id", userId).order("visit_date", { ascending: false }),
      supabase.from("analysis_runs").select("*, recordings(*), gait_results(result_payload, engine_output, pose_metrics, quality, validation, events)").eq("owner_id", userId).order("started_at", { ascending: false }),
      supabase.from("reports").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    for (const response of [subjects, visits, runs, reports]) if (response.error) throw new Error("Your saved dashboard records could not be loaded. Please try again.");
    return { subjects: subjects.data ?? [], visits: visits.data ?? [], runs: (runs.data ?? []) as DashboardRun[], reports: reports.data ?? [] };
  },
});

export function savedDashboardResult(run: DashboardRun | undefined, subjects: DashboardSubject[]) {
  if (!run || !["complete", "completed", "completed_with_warnings"].includes(run.status)) return null;
  const snapshot = run.gait_results;
  const payload = snapshot?.result_payload as unknown as AnalysisResult | null;
  if (!snapshot || !payload || !Array.isArray(payload.parameters) || !payload.summary) return null;
  const rec = run.recordings;
  const subject = subjects.find((s) => s.id === rec?.subject_id);
  const engine = snapshot.engine_output as unknown as EngineOutput | null;
  const pose: PoseAnalysis | null = snapshot.pose_metrics && rec ? {
    method: "mediapipe-pose", generatedAt: run.completed_at ?? run.started_at,
    metrics: snapshot.pose_metrics as unknown as PoseAnalysis["metrics"],
    quality: snapshot.quality as unknown as PoseAnalysis["quality"],
    validation: snapshot.validation as unknown as PoseAnalysis["validation"],
    events: (snapshot.events ?? []) as unknown as PoseAnalysis["events"], angles: [],
    video: { width: rec.width ?? 0, height: rec.height ?? 0, durationSec: rec.duration_sec ?? 0, sampledFps: 0, sampledFrames: 0 },
  } : null;
  return { engine, pose, stored: {
    result: payload, patient_name: subject?.display_name ?? subject?.subject_code ?? "",
    patient_id: subject?.subject_code, patient_age: subject?.age == null ? "" : String(subject.age),
    patient_gender: subject?.sex ?? "", media_kind: payload.kind, media_name: rec?.original_filename ?? "",
    analysis_id: run.analysis_code ?? run.id, analysis_timestamp: run.completed_at ?? run.started_at,
  } };
}

/** Older saved reports have no run snapshot; retain their stored values without inventing missing fields. */
export function savedLegacyDashboardResult(report: Tables<"reports"> | undefined) {
  if (!report) return null;
  const parameters = report.parameters as unknown as { rows?: AnalysisResult["parameters"]; summary?: AnalysisResult["summary"]; media_name?: string };
  if (!parameters?.rows || !parameters.summary) return null;
  const result: AnalysisResult = { kind: report.kind as AnalysisResult["kind"], mode: report.mode as AnalysisResult["mode"], probability: report.probability, confidence: report.confidence, riskLevel: report.risk_level as AnalysisResult["riskLevel"], parameters: parameters.rows, summary: parameters.summary };
  return { engine: null, pose: null, stored: { result, patient_name: report.patient_name ?? "", patient_id: undefined,
    patient_age: report.age == null ? "" : String(report.age), patient_gender: report.gender ?? "", media_kind: result.kind,
    media_name: parameters.media_name ?? "", analysis_id: report.id, analysis_timestamp: report.created_at } };
}