import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const paramRow = z.object({
  key: z.string().optional(),
  name: z.string(),
  unit: z.string(),
  standard: z.number(),
  patient: z.number(),
  status: z.enum(["normal", "borderline", "abnormal"]),
  range: z.tuple([z.number(), z.number()]).optional(),
  deviationPct: z.number().optional(),
  interpretation: z.string().optional(),
});

const saveInput = z.object({
  kind: z.enum(["gait", "facial"]),
  mode: z.string().max(32),
  probability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  risk_level: z.string().max(32),
  patient_name: z.string().max(120).optional(),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.string().max(32).optional(),
  parameters: z.array(paramRow).max(60),
  media_name: z.string().max(200).optional(),
  summary: z.record(z.string(), z.any()).optional(),
  // Linked-record context (optional for backward compatibility)
  subject_code: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/).optional(),
  recording_condition: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  analysis_code: z.string().max(40).optional(),
  analysis_timestamp: z.string().max(40).optional(),
  versions: z.record(z.string(), z.string().nullable()).optional(),
  pose: z
    .object({
      metrics: z.any().optional(),
      quality: z.any().optional(),
      validation: z.any().optional(),
      events: z.array(z.any()).max(2000).optional(),
      video: z.any().optional(),
    })
    .optional(),
});

export const saveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("reports")
      .insert({
        user_id: userId,
        kind: data.kind,
        mode: data.mode,
        probability: data.probability,
        confidence: data.confidence,
        risk_level: data.risk_level,
        patient_name: data.patient_name ?? null,
        age: data.age ?? null,
        gender: data.gender ?? null,
        parameters: {
          rows: data.parameters,
          media_name: data.media_name ?? null,
          summary: data.summary ?? null,
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Link subject → visit → recording → run → result. Failure never blocks the legacy report.
    let runId: string | null = null;
    try {
      const code = data.subject_code ?? `S-${crypto.randomUUID().slice(0, 8)}`;
      const { data: subj, error: se } = await supabase
        .from("subjects")
        .upsert(
          {
            owner_id: userId,
            subject_code: code,
            display_name: data.patient_name ?? null,
            age: data.age ?? null,
            sex: data.gender ?? null,
          },
          { onConflict: "owner_id,subject_code" },
        )
        .select("id")
        .single();
      if (se) throw se;
      const { data: visit, error: ve } = await supabase
        .from("visits")
        .insert({
          owner_id: userId,
          subject_id: subj.id,
          visit_date: data.analysis_timestamp ?? new Date().toISOString(),
          recording_condition: data.recording_condition ?? null,
          notes: data.notes ?? null,
        })
        .select("id")
        .single();
      if (ve) throw ve;
      const v = data.pose?.video ?? {};
      const { data: rec, error: re } = await supabase
        .from("recordings")
        .insert({
          owner_id: userId,
          visit_id: visit.id,
          source: "upload",
          modality: data.kind,
          original_filename: data.media_name ?? null,
          duration_sec: typeof v.durationSec === "number" ? v.durationSec : null,
          fps: typeof v.fps === "number" ? v.fps : null,
          width: typeof v.width === "number" ? Math.round(v.width) : null,
          height: typeof v.height === "number" ? Math.round(v.height) : null,
          camera_view: data.pose?.metrics?.cameraView ?? null,
          processing_status: "complete",
        })
        .select("id")
        .single();
      if (re) throw re;
      const ver = data.versions ?? {};
      const { data: run, error: rue } = await supabase
        .from("analysis_runs")
        .insert({
          owner_id: userId,
          recording_id: rec.id,
          analysis_code: data.analysis_code ?? null,
          analysis_mode: data.mode,
          platform_version: ver.platform ?? null,
          model_version: ver.gaitModel ?? null,
          feature_pipeline_version: ver.featurePipeline ?? null,
          pose_estimator_version: ver.poseEstimator ?? null,
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (rue) throw rue;
      runId = run.id;
      await supabase.from("gait_results").insert({
        owner_id: userId,
        run_id: run.id,
        parameters: data.parameters,
        pose_metrics: data.pose?.metrics ?? null,
        quality: data.pose?.quality ?? null,
        validation: data.pose?.validation ?? null,
        events: data.pose?.events ?? null,
        model_score: data.probability,
        model_confidence: data.confidence,
      });
      await supabase.from("reports").update({ analysis_run_id: run.id }).eq("id", row.id);
      await supabase.from("audit_log").insert({
        actor_id: userId,
        action: "analysis_saved",
        entity: "analysis_runs",
        entity_id: run.id,
        details: { report_id: row.id, subject_id: subj.id },
      });
    } catch (e) {
      console.error("[saveReport] linking failed", e);
    }
    return { id: row.id, runId };
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reports")
      .select("id, kind, mode, probability, confidence, risk_level, patient_name, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
