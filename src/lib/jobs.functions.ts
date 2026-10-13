import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateSubjectFields } from "@/lib/subject-validation";
import { VIDEO_LIMITS, ALLOWED_MIME, sniffContainer, canTransition, PROTOCOLS, type JobStatus } from "@/lib/video-config";

const BUCKET = "recordings";

const createInput = z.object({
  sessionKey: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  subject: z.object({
    name: z.string(),
    subjectId: z.string(),
    age: z.string(),
    sex: z.string(),
    recordingCondition: z.string(),
    notes: z.string(),
  }),
  protocol: z.enum(PROTOCOLS.map((p) => p.id) as [string, ...string[]]),
  trialNumber: z.number().int().min(1).max(50),
  walkingDistanceM: z.number().min(0).max(100).nullable(),
  deviations: z.string().max(1000),
  source: z.enum(["live", "upload"]),
  file: z.object({ name: z.string().max(200), type: z.string().max(80), size: z.number().int().min(1) }),
  versions: z.record(z.string(), z.string().nullable()).optional(),
  analysisCode: z.string().max(40).optional(),
});

/** Idempotent: the same sessionKey returns the existing job instead of creating a duplicate. */
export const createAnalysisJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const errs = validateSubjectFields(data.subject);
    if (Object.keys(errs).length) throw new Error("Subject information is incomplete or invalid.");
    if (data.file.size > VIDEO_LIMITS.maxBytes) throw new Error("File exceeds the upload size limit.");
    const mime = data.file.type.split(";")[0];
    if (mime && !(ALLOWED_MIME as readonly string[]).includes(mime)) throw new Error("Unsupported video type.");

    const { data: existing } = await supabase
      .from("analysis_runs")
      .select("id, recording_id, status, recordings(storage_path)")
      .eq("session_key", data.sessionKey)
      .maybeSingle();
    if (existing) {
      const path = (existing as unknown as { recordings: { storage_path: string } | null }).recordings?.storage_path ?? null;
      return { runId: existing.id, recordingId: existing.recording_id, storagePath: path, status: existing.status, reused: true };
    }

    const s = data.subject;
    const { data: subj, error: se } = await supabase
      .from("subjects")
      .upsert(
        { owner_id: userId, subject_code: s.subjectId.trim(), display_name: s.name.trim(), age: Number(s.age), sex: s.sex },
        { onConflict: "owner_id,subject_code" },
      )
      .select("id")
      .single();
    if (se) throw new Error(se.message);
    const { data: visit, error: ve } = await supabase
      .from("visits")
      .insert({ owner_id: userId, subject_id: subj.id, recording_condition: s.recordingCondition.trim(), notes: s.notes.trim() })
      .select("id")
      .single();
    if (ve) throw new Error(ve.message);
    const proto = PROTOCOLS.find((p) => p.id === data.protocol)!;
    const ext = mime === "video/mp4" ? "mp4" : mime === "video/quicktime" ? "mov" : "webm";
    const storagePath = `${userId}/${visit.id}/${data.sessionKey}.${ext}`;
    const { data: rec, error: re } = await supabase
      .from("recordings")
      .insert({
        owner_id: userId,
        visit_id: visit.id,
        source: data.source,
        modality: "gait",
        original_filename: data.file.name,
        storage_path: storagePath,
        mime_type: mime || null,
        size_bytes: data.file.size,
        camera_view: proto.expectedView,
        walking_distance_m: data.walkingDistanceM,
        protocol: proto.id,
        trial_number: data.trialNumber,
        deviations: data.deviations.trim() || null,
        processing_status: "pending",
      })
      .select("id")
      .single();
    if (re) throw new Error(re.message);
    const v = data.versions ?? {};
    const { data: run, error: rue } = await supabase
      .from("analysis_runs")
      .insert({
        owner_id: userId,
        recording_id: rec.id,
        session_key: data.sessionKey,
        status: "queued",
        stage: "video_received",
        analysis_mode: proto.mode,
        analysis_code: data.analysisCode ?? null,
        platform_version: v.platform ?? null,
        model_version: v.gaitModel ?? null,
        feature_pipeline_version: v.featurePipeline ?? null,
        pose_estimator_version: v.poseEstimator ?? null,
        heartbeat_at: new Date().toISOString(),
        completed_at: null,
      })
      .select("id")
      .single();
    if (rue) throw new Error(rue.message);
    await supabase.from("audit_log").insert({ actor_id: userId, action: "job_created", entity: "analysis_runs", entity_id: run.id, details: { protocol: proto.id } });
    return { runId: run.id, recordingId: rec.id, storagePath, status: "queued", reused: false };
  });

export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: run, error } = await supabase
      .from("analysis_runs")
      .select("id, status, recordings(storage_path)")
      .eq("id", data.runId)
      .single();
    if (error || !run) throw new Error("Job not found.");
    const path = (run as unknown as { recordings: { storage_path: string } }).recordings.storage_path;
    const { data: signed, error: se } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (se || !signed) throw new Error(se?.message ?? "Could not prepare upload.");
    await supabase.from("analysis_runs").update({ status: "uploading", stage: "uploading", heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", data.runId);
    return { path, token: signed.token };
  });

/** Server-side check of the stored object: real size and container signature. Rejected files are deleted. */
export const verifyUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: run, error } = await supabase
      .from("analysis_runs")
      .select("id, recording_id, recordings(storage_path, size_bytes)")
      .eq("id", data.runId)
      .single();
    if (error || !run) throw new Error("Job not found.");
    const rec = (run as unknown as { recordings: { storage_path: string; size_bytes: number | null } }).recordings;
    const fail = async (msg: string) => {
      await supabase.storage.from(BUCKET).remove([rec.storage_path]);
      await supabase.from("recordings").update({ processing_status: "rejected" }).eq("id", run.recording_id);
      await supabase.from("analysis_runs").update({ status: "failed", stage: "file_verification", error_message: msg, updated_at: new Date().toISOString() }).eq("id", run.id);
      return { ok: false as const, error: msg };
    };
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(rec.storage_path, 60);
    if (!signed?.signedUrl) return fail("The uploaded file was not found in storage.");
    const res = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-63" } });
    if (!res.ok && res.status !== 206) return fail("The uploaded file could not be read.");
    const bytes = new Uint8Array(await res.arrayBuffer());
    const total = Number(res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length") ?? 0);
    if (total > VIDEO_LIMITS.maxBytes) return fail("File exceeds the upload size limit.");
    if (rec.size_bytes && total && total !== rec.size_bytes) return fail("Upload was incomplete. Please retry.");
    const container = sniffContainer(bytes);
    if (!container) return fail("The file is not a valid MP4, WebM or MOV video (it may be corrupted).");
    await supabase.from("recordings").update({ processing_status: "verified" }).eq("id", run.recording_id);
    await supabase.from("analysis_runs").update({ status: "processing", stage: "file_verification", progress: 0.05, heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", run.id);
    return { ok: true as const, container, size: total };
  });

const statusEnum = z.enum(["queued", "uploading", "processing", "completed", "completed_with_warnings", "failed", "cancelled"]);

export const updateJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        status: statusEnum,
        stage: z.string().max(40).optional(),
        progress: z.number().min(0).max(1).optional(),
        error: z.string().max(1000).optional(),
        retry: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: run, error } = await supabase.from("analysis_runs").select("status, attempts").eq("id", data.runId).single();
    if (error || !run) throw new Error("Job not found.");
    if (run.status !== data.status && !canTransition(run.status, data.status as JobStatus))
      return { ok: false, status: run.status };
    const now = new Date().toISOString();
    const patch: import("@/integrations/supabase/types").TablesUpdate<"analysis_runs"> = { status: data.status, heartbeat_at: now, updated_at: now };
    if (data.stage) patch.stage = data.stage;
    if (data.progress != null) patch.progress = data.progress;
    if (data.error) patch.error_message = data.error;
    if (data.retry) {
      if (run.attempts >= VIDEO_LIMITS.maxAttempts) return { ok: false, status: run.status, error: "Retry limit reached." };
      patch.attempts = run.attempts + 1;
      patch.error_message = null;
    }
    if (["completed", "completed_with_warnings", "failed", "cancelled"].includes(data.status)) patch.completed_at = now;
    const { error: ue } = await supabase.from("analysis_runs").update(patch).eq("id", data.runId);
    if (ue) throw new Error(ue.message);
    return { ok: true, status: data.status };
  });

export const saveJobResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        status: z.enum(["completed", "completed_with_warnings", "failed"]),
        qualityReport: z.any(),
        protocolChecks: z.array(z.object({ name: z.string(), result: z.string(), detail: z.string() })).max(20),
        video: z.object({ durationSec: z.number().nullable(), width: z.number().nullable(), height: z.number().nullable(), fps: z.number().nullable() }),
        result: z.any().optional(),
        pose: z.object({ metrics: z.any(), quality: z.any(), validation: z.any(), events: z.array(z.any()).max(2000) }).optional(),
        error: z.string().max(1000).optional(),
        engine: z.any().optional(),
        frames: z.any().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: run, error } = await supabase.from("analysis_runs").select("id, recording_id, status").eq("id", data.runId).single();
    if (error || !run) throw new Error("Job not found.");
    if (run.status !== "processing" && run.status !== "running") throw new Error(`Job is ${run.status}; results not saved.`);
    const now = new Date().toISOString();
    await supabase
      .from("recordings")
      .update({
        duration_sec: data.video.durationSec,
        width: data.video.width ? Math.round(data.video.width) : null,
        height: data.video.height ? Math.round(data.video.height) : null,
        fps: data.video.fps,
        protocol_checks: data.protocolChecks,
        processing_status: data.status === "failed" ? "failed" : "complete",
      })
      .eq("id", run.recording_id);
    if (data.status !== "failed" && data.result) {
      await supabase.from("gait_results").delete().eq("run_id", run.id);
      const { error: ge } = await supabase.from("gait_results").insert({
        owner_id: userId,
        run_id: run.id,
        parameters: data.result.parameters ?? [],
        pose_metrics: data.pose?.metrics ?? null,
        quality: data.pose?.quality ?? null,
        validation: data.pose?.validation ?? null,
        events: data.pose?.events ?? null,
        model_score: typeof data.result.probability === "number" ? data.result.probability : null,
        model_confidence: typeof data.result.confidence === "number" ? data.result.confidence : null,
        result_payload: data.result,
        engine_output: data.engine ?? null,
        landmark_frames: data.frames ?? null,
        is_synthetic: false,
      });
      if (ge) throw new Error(ge.message);
    }
    await supabase
      .from("analysis_runs")
      .update({
        status: data.status,
        stage: data.status === "failed" ? "quality_control" : "report_available",
        progress: 1,
        quality_report: data.qualityReport,
        error_message: data.error ?? null,
        completed_at: now,
        heartbeat_at: now,
        updated_at: now,
      })
      .eq("id", run.id);
    return { ok: true };
  });

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("analysis_runs")
      .select(
        "id, status, stage, progress, attempts, heartbeat_at, error_message, started_at, completed_at, analysis_mode, quality_report, recordings(original_filename, protocol, trial_number, source, size_bytes, duration_sec, protocol_checks, visits(subjects(subject_code)))",
      )
      .not("session_key", "is", null)
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return JSON.parse(JSON.stringify(data ?? [])) as Array<Record<string, any>>;
  });

export const getJobFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: run } = await supabase
      .from("analysis_runs")
      .select("recordings(storage_path, original_filename, mime_type, protocol, trial_number, walking_distance_m, deviations, visits(recording_condition, notes, subjects(subject_code, display_name, age, sex)))")
      .eq("id", data.runId)
      .single();
    const rec = (run as unknown as { recordings: any } | null)?.recordings;
    if (!rec?.storage_path) throw new Error("Recording not found.");
    const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(rec.storage_path, 600);
    if (error || !signed) throw new Error("The stored video is no longer available.");
    return { url: signed.signedUrl, recording: JSON.parse(JSON.stringify(rec)) as Record<string, any> };
  });

export const getJobResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase
      .from("gait_results")
      .select("result_payload, pose_metrics, quality, validation, events, engine_output")
      .eq("run_id", data.runId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return r ? (JSON.parse(JSON.stringify(r)) as Record<string, any>) : null;
  });

export type CreateJobInput = z.infer<typeof createInput>;
export type JobStatusUpdate = { status: z.infer<typeof statusEnum>; stage?: string; progress?: number; error?: string; retry?: boolean };
