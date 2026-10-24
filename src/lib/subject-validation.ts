/** Shared rules for the mandatory subject fields (used by forms and the server). */
export interface SubjectFields {
  name: string;
  subjectId: string;
  age: string;
  sex: string;
  recordingCondition: string;
  notes: string;
}

export const SUBJECT_CODE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function validateSubjectFields(f: SubjectFields): Partial<Record<keyof SubjectFields, string>> {
  const e: Partial<Record<keyof SubjectFields, string>> = {};
  const req = "This field is required.";
  if (!f.name.trim()) e.name = req;
  else if (f.name.trim().length > 120) e.name = "Use 120 characters or fewer.";
  if (!f.subjectId.trim()) e.subjectId = req;
  else if (!SUBJECT_CODE_PATTERN.test(f.subjectId.trim()))
    e.subjectId = "Use letters, numbers, dot, dash or underscore (max 64).";
  const age = Number(f.age);
  if (!f.age.trim()) e.age = req;
  else if (!Number.isInteger(age) || age < 0 || age > 150) e.age = "Enter a whole number between 0 and 150.";
  if (!f.sex.trim()) e.sex = req;
  if (!f.recordingCondition.trim()) e.recordingCondition = req;
  if (f.notes.length > 1000) e.notes = "Use 1000 characters or fewer.";
  return e;
}
