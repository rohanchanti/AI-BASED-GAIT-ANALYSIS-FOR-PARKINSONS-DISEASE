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
    const [subjects, visits, runs] = await Promise.all([
      supabase.from("subjects").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("visits").select("*").eq("owner_id", userId).order("visit_date", { ascending: false }),
      supabase.from("analysis_runs").select("*, recordings(*), gait_results(result_payload, engine_output, pose_metrics, quality, validation, events)").eq("owner_id", userId).order("started_at", { ascending: false }),
    ]);
    for (const response of [subjects, visits, runs]) if (response.error) throw new Error("Your saved dashboard records could not be loaded. Please try again.");
    return { subjects: subjects.data ?? [], visits: visits.data ?? [], runs: (runs.data ?? []) as DashboardRun[] };
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