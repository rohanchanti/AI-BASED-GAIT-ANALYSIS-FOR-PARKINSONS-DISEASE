import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { subjectInformationSchema, DUPLICATE_PARTICIPANT_MESSAGE, isDuplicateParticipantError } from "./subject-information";

export const saveSubjectInformation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ subject: subjectInformationSchema, visitId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const s = data.subject;
    // A linked visit already belongs to a participant; do not create a duplicate.
    if (data.visitId) {
      const { data: visit, error } = await supabase.from("visits").select("subject_id").eq("id", data.visitId).eq("owner_id", userId).single();
      if (error || !visit) return { success: false as const, field: null, message: "Linked participant could not be verified." };
      const { data: subject } = await supabase.from("subjects").select("id, subject_code").eq("id", visit.subject_id).eq("owner_id", userId).single();
      if (!subject || subject.subject_code !== s.subjectId) return { success: false as const, field: "subjectId" as const, message: "Participant ID must match the linked visit." };
      return { success: true as const, subjectRecordId: subject.id };
    }
    const { data: subject, error } = await supabase.from("subjects").insert({
      owner_id: userId, subject_code: s.subjectId, display_name: s.subjectName,
      age: Number(s.age), sex: s.sex,
    }).select("id").single();
    if (error || !subject) return {
      success: false as const,
      field: isDuplicateParticipantError(error?.code) ? "subjectId" as const : null,
      message: isDuplicateParticipantError(error?.code) ? DUPLICATE_PARTICIPANT_MESSAGE : "Subject information could not be saved. Please try again.",
    };
    return { success: true as const, subjectRecordId: subject.id };
  });