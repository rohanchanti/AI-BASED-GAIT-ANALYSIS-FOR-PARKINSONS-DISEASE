import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const auditAccessInput = z.object({
  action: z.enum(["view", "export"]),
  entity: z.enum(["analysis_runs", "reports", "data_dictionary"]),
  entityId: z.string().uuid().nullable(),
  format: z.enum(["pdf", "csv", "json", "png"]).optional(),
});

/** Records views and exports; edits and deletions are logged by database triggers. */
export const logAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => auditAccessInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("audit_log").insert({
      actor_id: context.userId, action: data.action, entity: data.entity, entity_id: data.entityId,
      details: data.format ? { format: data.format } : {},
    });
    if (error) throw new Error("Audit entry could not be saved");
    return { ok: true };
  });
