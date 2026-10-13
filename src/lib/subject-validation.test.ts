import { describe, it, expect } from "vitest";
import { validateSubjectFields } from "./subject-validation";

const ok = { name: "A B", subjectId: "S-001", age: "64", sex: "Female", recordingCondition: "corridor", notes: "n" };

describe("subject fields", () => {
  it("accepts complete fields", () => expect(validateSubjectFields(ok)).toEqual({}));
  it("requires all six fields", () => {
    const e = validateSubjectFields({ name: "", subjectId: "", age: "", sex: "", recordingCondition: "", notes: "" });
    expect(Object.keys(e).sort()).toEqual(["age", "name", "notes", "recordingCondition", "sex", "subjectId"]);
  });
  it("rejects age above 150", () => expect(validateSubjectFields({ ...ok, age: "151" }).age).toBeDefined());
  it("rejects spaces in subject ID", () => expect(validateSubjectFields({ ...ok, subjectId: "S 1" }).subjectId).toBeDefined());
});
