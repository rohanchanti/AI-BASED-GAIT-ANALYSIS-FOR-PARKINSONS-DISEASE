import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUBJECT_CODE_PATTERN } from "@/lib/subject-validation";
import { validateDataset, type ResearchBundle } from "@/lib/research-dataset";
import { agreement } from "@/lib/research-stats";
import { PARAMETER_DEFINITIONS, ENGINE_VERSION } from "@/lib/gait-engine/parameters";
import { ANALYSIS_VERSIONS } from "@/lib/analysis-version";

type Sb = any;
const json = <T,>(v: T) => JSON.parse(JSON.stringify(v)) as T;

async function requireResearch(supabase: Sb, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const r = ((data ?? []) as { role: string }[]).map((x) => x.role);
  if (!r.includes("researcher") && !r.includes("admin")) throw new Error("Research workspace requires the researcher or admin role.");
}
async function ownProject(supabase: Sb, userId: string, projectId: string) {
  const { data } = await supabase.from("research_projects").select("*").eq("id", projectId).eq("owner_id", userId).maybeSingle();
  if (!data) throw new Error("Project not found or not accessible.");
  return data;
}
async function audit(supabase: Sb, userId: string, action: string, entity: string, entityId: string, details: Record<string, unknown> = {}) {
  await supabase.from("audit_log").insert({ actor_id: userId, action, entity, entity_id: entityId, details });
}

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireResearch(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("research_projects")
      .select("id, project_code, title, status, created_at, updated_at, research_participants(id)")
      .eq("owner_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return json(data ?? []);
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().trim().regex(SUBJECT_CODE_PATTERN), title: z.string().trim().min(3).max(200), description: z.string().max(4000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireResearch(supabase, userId);
    const { data: row, error } = await supabase
      .from("research_projects")
      .insert({ owner_id: userId, project_code: data.code, title: data.title, description: data.description ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message.includes("duplicate") ? "A project with this code already exists." : error.message);
    await audit(supabase, userId, "project_created", "research_projects", row.id);
    return { id: row.id as string };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        inclusion: z.string().max(4000).nullable(),
        exclusion: z.string().max(4000).nullable(),
        status: z.enum(["exploratory", "validated", "archived"]),
        protocol: z.object({
          recordingProtocol: z.string().max(40),
          cameraView: z.string().max(40),
          walkingDistanceM: z.number().min(0).max(100).nullable(),
          trialsPerParticipant: z.number().int().min(1).max(20),
          measurementProtocol: z.string().max(2000),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireResearch(supabase, userId);
    const before = await ownProject(supabase, userId, data.id);
    const { error } = await supabase
      .from("research_projects")
      .update({ inclusion_criteria: data.inclusion, exclusion_criteria: data.exclusion, status: data.status, protocol: data.protocol, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "project_updated", "research_projects", data.id, { before: { status: before.status, protocol: before.protocol }, after: { status: data.status, protocol: data.protocol } });
    return { ok: true };
  });

export const addParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        code: z.string().trim().regex(SUBJECT_CODE_PATTERN),
        age: z.number().int().min(1).max(120).nullable(),
        sex: z.enum(["Male", "Female", "Other", "Prefer not to say"]).nullable(),
        included: z.boolean(),
        exclusionReason: z.string().max(500).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireResearch(supabase, userId);
    await ownProject(supabase, userId, data.projectId);
    if (!data.included && !data.exclusionReason?.trim()) throw new Error("An exclusion reason is required.");
    const { data: row, error } = await supabase
      .from("research_participants")
      .insert({ owner_id: userId, project_id: data.projectId, participant_code: data.code, included: data.included, exclusion_reason: data.included ? null : data.exclusionReason, metadata: { age: data.age, sex: data.sex } })
      .select("id")
      .single();
    if (error) throw new Error(error.message.includes("duplicate") ? "This participant code is already registered." : error.message);
    return { id: row.id as string };
  });

export const updateParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), included: z.boolean(), exclusionReason: z.string().max(500).nullable(), split: z.enum(["train", "validation", "test"]).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireResearch(supabase, userId);
    if (!data.included && !data.exclusionReason?.trim()) throw new Error("An exclusion reason is required.");
    const { data: before } = await supabase.from("research_participants").select("included, exclusion_reason, split").eq("id", data.id).eq("owner_id", userId).maybeSingle();
    if (!before) throw new Error("Participant not found.");
    const { error } = await supabase.from("research_participants").update({ included: data.included, exclusion_reason: data.included ? null : data.exclusionReason, split: data.split }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "participant_updated", "research_participants", data.id, { before, after: { included: data.included, split: data.split } });
    return { ok: true };
  });

/** Creates a coded research subject + visit so the shared recorder can attach recordings. */
export const startParticipantSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ participantId: z.string().uuid(), recordingCondition: z.string().trim().min(1).max(200), notes: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireResearch(supabase, userId);
    const { data: p } = await supabase.from("research_participants").select("id, project_id, participant_code, subject_id, metadata, research_projects(project_code, protocol)").eq("id", data.participantId).eq("owner_id", userId).maybeSingle();
    if (!p) throw new Error("Participant not found.");
    let subjectId = p.subject_id as string | null;
    const code = `${(p as any).research_projects.project_code}.${p.participant_code}`.slice(0, 64);
    if (!subjectId) {
      const md = (p.metadata ?? {}) as { age?: number; sex?: string };
      const { data: s, error } = await supabase
        .from("subjects")
        .upsert({ owner_id: userId, subject_code: code, display_name: code, age: md.age ?? null, sex: md.sex ?? null, workflow: "research" }, { onConflict: "owner_id,subject_code" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      subjectId = s.id;
      await supabase.from("research_participants").update({ subject_id: subjectId }).eq("id", p.id);
    }
    const proto = ((p as any).research_projects.protocol ?? {}) as { recordingProtocol?: string };
    const { data: v, error: ve } = await supabase
      .from("visits")
      .insert({ owner_id: userId, subject_id: subjectId, protocol: proto.recordingProtocol ?? "straight", recording_condition: data.recordingCondition, notes: data.notes })
      .select("id, visit_code")
      .single();
    if (ve) throw new Error(ve.message);
    return { visitId: v.id as string, code: v.visit_code as string };
  });

export const importDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        source: z.string().trim().min(1).max(300),
        version: z.string().trim().min(1).max(40),
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
        rows: z.array(z.record(z.string(), z.any())).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireResearch(supabase, userId);
    await ownProject(supabase, userId, data.projectId);
    const v = validateDataset(data.rows);
    if (!v.ok) return { ok: false as const, validation: v };
    const { data: dup } = await supabase.from("research_datasets").select("id").eq("project_id", data.projectId).eq("checksum", data.checksum).maybeSingle();
    if (dup) return { ok: false as const, validation: { ...v, ok: false, errors: ["This exact file has already been imported."] } };
    const { data: row, error } = await supabase
      .from("research_datasets")
      .insert({ owner_id: userId, project_id: data.projectId, name: data.name, source: data.source, version: data.version, checksum: data.checksum, row_count: v.rowCount, columns: v.columns, validation: v as any, rows: data.rows })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "dataset_imported", "research_datasets", row.id, { checksum: data.checksum, rows: v.rowCount });
    return { ok: true as const, id: row.id as string, validation: v };
  });

export const addAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        participantId: z.string().uuid(),
        runId: z.string().uuid().nullable(),
        parameterKey: z.enum(PARAMETER_DEFINITIONS.map((p) => p.key) as [string, ...string[]]),
        value: z.number().finite(),
        method: z.string().trim().min(2).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireResearch(supabase, userId);
    await ownProject(supabase, userId, data.projectId);
    const def = PARAMETER_DEFINITIONS.find((p) => p.key === data.parameterKey)!;
    const { data: row, error } = await supabase
      .from("research_annotations")
      .insert({ owner_id: userId, project_id: data.projectId, participant_id: data.participantId, run_id: data.runId, parameter_key: data.parameterKey, value: data.value, unit: def.unit, method: data.method })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

async function loadBundle(supabase: Sb, userId: string, projectId: string): Promise<ResearchBundle & { runs: any[] }> {
  const project = await ownProject(supabase, userId, projectId);
  const { data: participants } = await supabase.from("research_participants").select("id, participant_code, subject_id, included, exclusion_reason, split, metadata, created_at").eq("project_id", projectId).order("participant_code");
  const { data: datasets } = await supabase.from("research_datasets").select("id, name, source, version, checksum, row_count, columns, validation, created_at").eq("project_id", projectId).order("created_at");
  const { data: experiments } = await supabase.from("research_experiments").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  const { data: anns } = await supabase.from("research_annotations").select("id, participant_id, run_id, parameter_key, value, unit, method, created_at").eq("project_id", projectId);
  const parts = (participants ?? []) as any[];
  const subjIds = parts.map((p) => p.subject_id).filter(Boolean);
  let runs: any[] = [];
  if (subjIds.length) {
    const { data: visits } = await supabase
      .from("visits")
      .select("id, visit_code, subject_id, recordings(id, protocol, trial_number, analysis_runs(id, status, completed_at, model_version, feature_pipeline_version, pose_estimator_version, gait_results(engine_output, quality)))")
      .in("subject_id", subjIds);
    for (const v of (visits ?? []) as any[])
      for (const r of v.recordings ?? [])
        for (const a of r.analysis_runs ?? []) {
          const part = parts.find((p) => p.subject_id === v.subject_id);
          const g = Array.isArray(a.gait_results) ? a.gait_results[0] : a.gait_results;
          runs.push({ runId: a.id, status: a.status, completedAt: a.completed_at, visitCode: v.visit_code, protocol: r.protocol, trial: r.trial_number, participantId: part?.id, participant_code: part?.participant_code, parameters: g?.engine_output?.parameters ?? [], quality: g?.quality ?? null, versions: { model: a.model_version, features: a.feature_pipeline_version, pose: a.pose_estimator_version } });
        }
  }
  const unit = (k: string) => PARAMETER_DEFINITIONS.find((d) => d.key === k)?.unit ?? "";
  const measurements = runs
    .filter((r) => r.status === "completed" || r.status === "completed_with_warnings")
    .flatMap((r) => (r.parameters as any[]).map((p) => ({ participant_code: r.participant_code, run_id: r.runId, parameter_key: p.key, value: p.status === "unavailable" ? null : p.value, unit: unit(p.key), status: p.status })));
  const code = (id: string) => parts.find((p) => p.id === id)?.participant_code ?? "?";
  const annotations = ((anns ?? []) as any[]).map((a) => ({ ...a, value: Number(a.value), participant_code: code(a.participant_id) }));
  return { project, participants: parts, datasets: datasets ?? [], experiments: experiments ?? [], measurements, annotations, runs };
}

export const getProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireResearch(context.supabase, context.userId);
    return json(await loadBundle(context.supabase, context.userId, data.id)) as any;
  });

/**
 * Runs an evaluation: pairs each annotation with the measurement from the same run
 * (or the participant's latest completed run) and computes agreement per parameter.
 * Only included participants in the chosen split are used.
 */
export const runExperiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        split: z.enum(["all", "train", "validation", "test"]),
        features: z.array(z.string()).min(1).max(40),
        preprocessing: z.record(z.string(), z.any()),
        notes: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireResearch(supabase, userId);
    const b = await loadBundle(supabase, userId, data.projectId);
    const eligible = new Set(b.participants.filter((p: any) => p.included && (data.split === "all" || p.split === data.split)).map((p: any) => p.id));
    const completed = b.runs.filter((r) => r.status === "completed" || r.status === "completed_with_warnings");
    const perParam = data.features.map((key) => {
      const pairs: { m: number; t: number; participant: string }[] = [];
      for (const a of (b.annotations as any[]).filter((x) => x.parameter_key === key && eligible.has(x.participant_id))) {
        const run = a.run_id ? completed.find((r) => r.runId === a.run_id) : completed.filter((r) => r.participantId === a.participant_id).sort((x, y) => String(y.completedAt).localeCompare(String(x.completedAt)))[0];
        const p = run?.parameters.find((x: any) => x.key === key);
        if (p && p.status !== "unavailable" && p.value != null) pairs.push({ m: p.value, t: a.value, participant: a.participant_code });
      }
      const def = PARAMETER_DEFINITIONS.find((d) => d.key === key);
      return { key, name: def?.name ?? key, unit: def?.unit ?? "", participants: new Set(pairs.map((p) => p.participant)).size, pairs, agreement: agreement(pairs.map((p) => p.m), pairs.map((p) => p.t)) };
    });
    const results = { split: data.split, evaluatedAt: new Date().toISOString(), perParameter: perParam };
    const status = perParam.some((p) => p.agreement.status === "ok") ? "evaluated" : "insufficient_data";
    const { data: row, error } = await supabase
      .from("research_experiments")
      .insert({ owner_id: userId, project_id: data.projectId, name: data.name, status, preprocessing: data.preprocessing, features: data.features, notes: data.notes ?? null, versions: { ...ANALYSIS_VERSIONS, engine: ENGINE_VERSION }, results: results as any })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "experiment_run", "research_experiments", row.id, { split: data.split, status });
    return { id: row.id as string, status, results: json(results) };
  });

export const logResearchExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid(), format: z.enum(["csv", "json", "pdf"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("export_log").insert({ user_id: context.userId, format: `research-${data.format}`, deidentified: true });
    await audit(context.supabase, context.userId, "research_export", "research_projects", data.projectId, { format: data.format });
    return { ok: true };
  });
