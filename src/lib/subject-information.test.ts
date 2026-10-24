import { describe, expect, it } from "vitest";
import { subjectInformationSchema, isDuplicateParticipantError, acquisitionConsentSchema, ACQUISITION_CONSENT_VERSION } from "./subject-information";

const valid = { subjectName: "Test Participant", subjectId: "TEST-001", age: "64", sex: "Female", condition: "Corridor", notes: "" };

describe("acquisition subject information", () => {
  it("requires affirmative versioned consent", () => {
    expect(acquisitionConsentSchema.safeParse({ granted: false, version: ACQUISITION_CONSENT_VERSION }).success).toBe(false);
    expect(acquisitionConsentSchema.safeParse({ granted: true, version: "outdated" }).success).toBe(false);
    expect(acquisitionConsentSchema.safeParse({ granted: true, version: ACQUISITION_CONSENT_VERSION }).success).toBe(true);
  });
  it("accepts optional empty notes", () => expect(subjectInformationSchema.safeParse(valid).success).toBe(true));
  it("requires participant ID", () => expect(subjectInformationSchema.safeParse({ ...valid, subjectId: " " }).success).toBe(false));
  it("requires age", () => expect(subjectInformationSchema.safeParse({ ...valid, age: "" }).success).toBe(false));
  it("accepts the inclusive age range 18–110", () => {
    for (const age of ["18", "110"]) expect(subjectInformationSchema.safeParse({ ...valid, age }).success).toBe(true);
    for (const age of ["17", "111", "18.5"]) expect(subjectInformationSchema.safeParse({ ...valid, age }).success).toBe(false);
  });
  it("requires a supported sex value", () => expect(subjectInformationSchema.safeParse({ ...valid, sex: "" }).success).toBe(false));
  it("requires recording condition", () => expect(subjectInformationSchema.safeParse({ ...valid, condition: " " }).success).toBe(false));
  it("identifies duplicate ID constraint failures", () => {
    expect(isDuplicateParticipantError("23505")).toBe(true);
    expect(isDuplicateParticipantError("42501")).toBe(false);
  });
});