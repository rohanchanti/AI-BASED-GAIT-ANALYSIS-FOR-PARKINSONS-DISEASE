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
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
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
