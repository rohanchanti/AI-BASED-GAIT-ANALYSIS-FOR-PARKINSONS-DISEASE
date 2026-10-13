import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUBJECT_CODE_PATTERN } from "@/lib/subject-validation";
import { canGenerateReport, REVIEW_DECISIONS, timedProtocolResult } from "@/lib/clinical-rules";
import { PROTOCOLS } from "@/lib/video-config";
import { ANALYSIS_VERSIONS } from "@/lib/analysis-version";

type Sb = any;
const json = <T,>(v: T) => JSON.parse(JSON.stringify(v)) as T;

async function roles(supabase: Sb, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return ((data ?? []) as { role: string }[]).map((r) => r.role);
}
async function requireClinical(supabase: Sb, userId: string) {
  const r = await roles(supabase, userId);
  if (!r.includes("clinician") && !r.includes("admin")) throw new Error("Clinical workspace requires the clinician or admin role.");
}
async function audit(supabase: Sb, userId: string, action: string, entity: string, entityId: string, details: Record<string, unknown> = {}) {
  await supabase.from("audit_log").insert({ actor_id: userId, action, entity, entity_id: entityId, details });
}

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ roles: await roles(context.supabase, context.userId) }));

export const listPatients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ search: z.string().max(64).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireClinical(supabase, userId);
    let q = supabase
      .from("subjects")
      .select("id, subject_code, display_name, age, sex, updated_at, created_at, visits(id, visit_date)")
      .eq("owner_id", userId)
      .eq("workflow", "clinical")
      .order("updated_at", { ascending: false })
      .limit(200);
    const term = data.search.replace(/[^A-Za-z0-9 ._-]/g, "").trim();
    if (term) q = q.or(`subject_code.ilike.%${term}%,display_name.ilike.%${term}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return json(rows ?? []);
  });

const patientInput = z.object({
  name: z.string().trim().min(1).max(120),
  subjectId: z.string().trim().regex(SUBJECT_CODE_PATTERN),
  age: z.number().int().min(1).max(120),
  sex: z.enum(["Male", "Female", "Other", "Prefer not to say"]),
  heightCm: z.number().min(50).max(250).nullable().optional(),
  weightKg: z.number().min(10).max(400).nullable().optional(),
  clinicalHistory: z.string().max(4000).nullable().optional(),
});

export const createPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => patientInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireClinical(supabase, userId);
    const { data: existing } = await supabase.from("subjects").select("id").eq("owner_id", userId).eq("subject_code", data.subjectId).maybeSingle();
    if (existing) throw new Error("A patient with this Subject ID already exists.");
    const { data: row, error } = await supabase
      .from("subjects")
      .insert({
        owner_id: userId,
        subject_code: data.subjectId,
        display_name: data.name,
        age: data.age,
        sex: data.sex,
        height_cm: data.heightCm ?? null,
        weight_kg: data.weightKg ?? null,
        clinical_history: data.clinicalHistory ?? null,
        workflow: "clinical",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "patient_created", "subjects", row.id);
    return { id: row.id as string };
  });

/** Corrections are logged with before/after values in the audit trail. */
export const updatePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => patientInput.omit({ subjectId: true }).extend({ id: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireClinical(supabase, userId);
    const { data: before, error } = await supabase.from("subjects").select("display_name, age, sex, height_cm, weight_kg, clinical_history").eq("id", data.id).eq("owner_id", userId).single();
    if (error || !before) throw new Error("Patient not found.");
    const after = { display_name: data.name, age: data.age, sex: data.sex, height_cm: data.heightCm ?? null, weight_kg: data.weightKg ?? null, clinical_history: data.clinicalHistory ?? null };
    const changed = Object.fromEntries(Object.entries(after).filter(([k, v]) => (before as any)[k] !== v).map(([k, v]) => [k, { from: (before as any)[k], to: v }]));
    if (!Object.keys(changed).length) return { ok: true, changed: 0 };
    const { error: ue } = await supabase.from("subjects").update({ ...after, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (ue) throw new Error(ue.message);
    await audit(supabase, userId, "patient_corrected", "subjects", data.id, { reason: data.reason, changed });
    return { ok: true, changed: Object.keys(changed).length };
  });

export const getPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireClinical(supabase, userId);
    const { data: subject, error } = await supabase.from("subjects").select("*").eq("id", data.id).eq("owner_id", userId).eq("workflow", "clinical").maybeSingle();
    if (error) throw new Error(error.message);
    if (!subject) throw new Error("Patient not found or not accessible.");
    const { data: visits } = await supabase
      .from("visits")
      .select("id, visit_code, visit_date, protocol, status, is_baseline, recording_condition, medication_state, recordings(id, protocol, trial_number, created_at, analysis_runs(id, status, started_at, completed_at))")
      .eq("subject_id", data.id)
      .order("visit_date", { ascending: false });
    const { data: consents } = await supabase.from("consents").select("id, consent_type, granted, document_version, recorded_at, withdrawn_at").eq("subject_id", data.id).order("recorded_at", { ascending: false });
    const { data: history } = await supabase.from("audit_log").select("action, details, created_at").eq("entity_id", data.id).order("created_at", { ascending: false }).limit(50);
    return json({ subject, visits: visits ?? [], consents: consents ?? [], history: history ?? [] });
  });

export const createVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        subjectId: z.string().uuid(),
        protocol: z.enum(PROTOCOLS.map((p) => p.id) as [string, ...string[]]),
        recordingCondition: z.string().trim().min(1).max(200),
        notes: z.string().trim().min(1).max(1000),
        medicationState: z.string().max(100).nullable().optional(),
        clinicalScores: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
        consent: z.object({ granted: z.literal(true), documentVersion: z.string().trim().min(1).max(40), recordedBy: z.string().trim().min(1).max(120) }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireClinical(supabase, userId);
    const { data: subj } = await supabase.from("subjects").select("id").eq("id", data.subjectId).eq("owner_id", userId).maybeSingle();
    if (!subj) throw new Error("Patient not found or not accessible.");
    const { data: consent, error: ce } = await supabase
      .from("consents")
      .insert({ owner_id: userId, subject_id: data.subjectId, consent_type: "video_recording_clinical", granted: true, document_version: data.consent.documentVersion, notes: `Recorded by ${data.consent.recordedBy}` })
      .select("id")
      .single();
    if (ce) throw new Error(ce.message);
    const { data: visit, error } = await supabase
      .from("visits")
      .insert({
        owner_id: userId,
        subject_id: data.subjectId,
        protocol: data.protocol,
        recording_condition: data.recordingCondition,
        notes: data.notes,
        medication_state: data.medicationState ?? null,
        clinical_scores: data.clinicalScores ?? {},
        consent_id: consent.id,
      })
      .select("id, visit_code")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("subjects").update({ updated_at: new Date().toISOString() }).eq("id", data.subjectId);
    await audit(supabase, userId, "visit_created", "visits", visit.id, { consent_id: consent.id, protocol: data.protocol });
    return { id: visit.id as string, code: visit.visit_code as string };
  });

/** Everything about one visit: subject, recordings, runs, results, reviews, timings, reports. */
export const getVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: visit, error } = await supabase
      .from("visits")
      .select("*, subjects(id, subject_code, display_name, age, sex, height_cm, workflow), consents(granted, document_version, recorded_at)")
      .eq("id", data.id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!visit) throw new Error("Visit not found or not accessible.");
    const { data: recs } = await supabase
      .from("recordings")
      .select("id, protocol, trial_number, source, duration_sec, fps, camera_view, walking_distance_m, deviations, protocol_checks, created_at, analysis_runs(id, status, stage, error_message, started_at, completed_at, quality_report, model_version, feature_pipeline_version, pose_estimator_version, platform_version)")
      .eq("visit_id", data.id)
      .order("created_at", { ascending: true });
    const runIds = (recs ?? []).flatMap((r: any) => (r.analysis_runs ?? []).map((a: any) => a.id));
    const [results, reviews, timings, reports] = runIds.length
      ? await Promise.all([
          supabase.from("gait_results").select("run_id, engine_output, quality").in("run_id", runIds),
          supabase.from("clinician_reviews").select("id, run_id, decision, notes, supersedes, reviewer_id, created_at").in("run_id", runIds).order("created_at"),
          supabase.from("protocol_timings").select("*").in("run_id", runIds).order("created_at"),
          supabase.from("clinical_reports").select("id, run_id, created_at").eq("visit_id", data.id).order("created_at"),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
    return json({ visit, recordings: recs ?? [], results: results.data ?? [], reviews: reviews.data ?? [], timings: timings.data ?? [], reports: reports.data ?? [] });
  });

/** Reviews are append-only; a correction references the review it supersedes. */
export const addReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ runId: z.string().uuid(), decision: z.enum(REVIEW_DECISIONS), notes: z.string().trim().min(1).max(4000), supersedes: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireClinical(supabase, userId);
    const { data: row, error } = await supabase
      .from("clinician_reviews")
      .insert({ run_id: data.runId, reviewer_id: userId, decision: data.decision, notes: data.notes, supersedes: data.supersedes ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(supabase, userId, data.supersedes ? "review_corrected" : "review_added", "clinician_reviews", row.id, { run_id: data.runId, supersedes: data.supersedes ?? null });
    return { id: row.id as string };
  });

export const addProtocolTiming = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ runId: z.string().uuid(), startSec: z.number().min(0), endSec: z.number().min(0), distanceM: z.number().min(0).max(100).nullable(), notes: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: run } = await supabase.from("analysis_runs").select("id, recordings(protocol, duration_sec)").eq("id", data.runId).eq("owner_id", userId).maybeSingle();
    const rec = (run as any)?.recordings;
    if (!run || !rec) throw new Error("Run not found.");
    const check = timedProtocolResult({ protocol: rec.protocol, startSec: data.startSec, endSec: data.endSec, distanceM: data.distanceM, videoDurationSec: rec.duration_sec });
    if (!check) throw new Error("This protocol does not use timing marks.");
    if (!check.verified) throw new Error(check.reason);
    const { data: row, error } = await supabase
      .from("protocol_timings")
      .insert({ owner_id: userId, run_id: data.runId, protocol: rec.protocol, start_sec: data.startSec, end_sec: data.endSec, distance_m: data.distanceM, method: "operator video marks", verified_by: userId, notes: data.notes ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "timing_recorded", "protocol_timings", row.id, { run_id: data.runId });
    return { id: row.id as string, result: check };
  });

/** Snapshot report. Refused unless the run finished; the database enforces the same rule. */
export const createClinicalReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ visitId: z.string().uuid(), runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireClinical(supabase, userId);
    const { data: run } = await supabase
      .from("analysis_runs")
      .select("id, status, quality_report, platform_version, model_version, feature_pipeline_version, pose_estimator_version, completed_at, recordings(id, visit_id, protocol, trial_number, duration_sec, fps, camera_view, deviations, protocol_checks)")
      .eq("id", data.runId)
      .eq("owner_id", userId)
      .maybeSingle();
    const rec = (run as any)?.recordings;
    if (!run || !rec || rec.visit_id !== data.visitId) throw new Error("Run does not belong to this visit.");
    if (!canGenerateReport(run.status)) throw new Error(`Report blocked: analysis is "${run.status}". Only completed analyses can be reported.`);
    const { data: visit } = await supabase.from("visits").select("visit_code, visit_date, recording_condition, notes, medication_state, clinical_scores, subjects(subject_code, display_name, age, sex, height_cm)").eq("id", data.visitId).single();
    const { data: result } = await supabase.from("gait_results").select("engine_output, quality").eq("run_id", data.runId).maybeSingle();
    const { data: reviews } = await supabase.from("clinician_reviews").select("id, decision, notes, supersedes, created_at").eq("run_id", data.runId).order("created_at");
    const { data: timings } = await supabase.from("protocol_timings").select("start_sec, end_sec, distance_m, method, created_at").eq("run_id", data.runId).order("created_at", { ascending: false }).limit(1);
    const t = timings?.[0];
    const timed = timedProtocolResult({ protocol: rec.protocol, startSec: t ? Number(t.start_sec) : null, endSec: t ? Number(t.end_sec) : null, distanceM: t?.distance_m != null ? Number(t.distance_m) : null, videoDurationSec: rec.duration_sec });
    const content = json({
      generatedAt: new Date().toISOString(),
      visit,
      recording: rec,
      run: { id: run.id, status: run.status, completedAt: run.completed_at, quality: run.quality_report, versions: { platform: run.platform_version, model: run.model_version, features: run.feature_pipeline_version, pose: run.pose_estimator_version } },
      parameters: (result?.engine_output as any)?.parameters ?? [],
      quality: result?.quality ?? null,
      timedResult: timed,
      reviews: reviews ?? [],
      appVersions: ANALYSIS_VERSIONS,
      disclaimer: "Decision-support information for review by a qualified clinician. Not a diagnosis and not a treatment recommendation.",
    });
    const { data: row, error } = await supabase.from("clinical_reports").insert({ owner_id: userId, visit_id: data.visitId, run_id: data.runId, content }).select("id, created_at").single();
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "clinical_report_generated", "clinical_reports", row.id, { run_id: data.runId });
    return { id: row.id as string, content };
  });

export const getClinicalReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.from("clinical_reports").select("id, content, created_at").eq("id", data.id).maybeSingle();
    if (error || !r) throw new Error("Report not found.");
    return json(r);
  });

export const finalizeVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ visitId: z.string().uuid(), baseline: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireClinical(supabase, userId);
    const { data: v } = await supabase.from("visits").select("id, subject_id").eq("id", data.visitId).eq("owner_id", userId).maybeSingle();
    if (!v) throw new Error("Visit not found.");
    const { count } = await supabase.from("clinical_reports").select("id", { count: "exact", head: true }).eq("visit_id", data.visitId);
    if (!count) throw new Error("Generate a report before saving the visit.");
    if (data.baseline) await supabase.from("visits").update({ is_baseline: false }).eq("subject_id", v.subject_id).eq("owner_id", userId);
    const { error } = await supabase.from("visits").update({ status: "closed", ...(data.baseline ? { is_baseline: true } : {}) }).eq("id", data.visitId);
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "visit_finalized", "visits", data.visitId, { baseline: data.baseline });
    return { ok: true };
  });

/** Stored per-frame landmarks and a short-lived video URL for playback with overlay. */
export const getRunMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: run } = await supabase.from("analysis_runs").select("id, recordings(storage_path)").eq("id", data.runId).eq("owner_id", userId).maybeSingle();
    const path = (run as any)?.recordings?.storage_path;
    if (!path) throw new Error("Recording not found.");
    const { data: signed } = await supabase.storage.from("recordings").createSignedUrl(path, 600);
    const { data: g } = await supabase.from("gait_results").select("landmark_frames").eq("run_id", data.runId).maybeSingle();
    const frames = ((g?.landmark_frames as any)?.frames ?? []).map((f: any) => ({ t: f.t, lm: f.lm }));
    return { url: signed?.signedUrl ?? null, frames: frames as { t: number; lm: number[] | null }[] };
  });
