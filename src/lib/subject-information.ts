import { z } from "zod";

const required = "This field is required.";
export const ACQUISITION_CONSENT_VERSION = "neurostride.media-consent/1";
export const ACQUISITION_CONSENT_TEXT = "I confirm that the participant has consented to recording or uploading their video, storing it privately with their subject information, and processing it for movement analysis. This is not a validated diagnostic assessment or medical advice.";
export const acquisitionConsentSchema = z.object({
  granted: z.literal(true, { message: "Consent is required before analysis." }),
  version: z.literal(ACQUISITION_CONSENT_VERSION),
});
export const subjectInformationSchema = z.object({
  subjectName: z.string().trim().min(1, required).max(100, "Must be under 100 characters."),
  subjectId: z.string().trim().min(1, required).max(50, "Must be under 50 characters.").regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dot, dash or underscore."),
  age: z.string().trim().min(1, required).regex(/^\d{1,3}$/, "Enter a whole number between 18 and 110.").refine((v) => Number(v) >= 18 && Number(v) <= 110, "Enter a whole number between 18 and 110."),
  sex: z.enum(["Male", "Female", "Other", "Prefer not to say"], { message: required }),
  condition: z.string().trim().min(1, required).max(200, "Must be under 200 characters."),
  notes: z.string().trim().max(1000, "Must be under 1000 characters."),
});

export const DUPLICATE_PARTICIPANT_MESSAGE = "A participant with this ID already exists.";
export function isDuplicateParticipantError(code: string | undefined) {
  return code === "23505";
}