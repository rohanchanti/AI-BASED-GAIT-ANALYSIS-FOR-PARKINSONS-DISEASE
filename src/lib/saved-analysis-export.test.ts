import { describe, expect, it } from "vitest";
import type { DashboardRun, DashboardSubject, DashboardVisit } from "@/lib/dashboard-data";
import { dataDictionaryCsv, deidentifiedCsv, deidentifiedJson, deidentifiedRows, CSV_COLUMNS } from "@/lib/saved-analysis-export";

const run = {
  id: "r1", analysis_code: "A-1", status: "completed", started_at: "2026-10-01T10:00:00Z", completed_at: null, pipeline_version: "1.2.0",
  recordings: { protocol: "10mwt" },
  gait_results: { engine_output: { parameters: [{ key: "cadence", value: 110, status: "measured" }] } },
} as unknown as DashboardRun;
const subject = { subject_code: "SUBJ-007", display_name: "Jane Doe" } as unknown as DashboardSubject;
const visit = { notes: "Jane said hi", recording_condition: "Off" } as unknown as DashboardVisit;

describe("de-identified exports", () => {
  const rows = deidentifiedRows(run, visit, subject);
  it("CSV has coded ID and no name or notes", () => {
    const csv = deidentifiedCsv(rows);
    expect(csv).toContain("SUBJ-007");
    expect(csv).not.toContain("Jane");
  });
  it("JSON has coded ID and no name", () => {
    const json = JSON.stringify(deidentifiedJson(run, visit, subject));
    expect(json).toContain("SUBJ-007");
    expect(json).not.toContain("Jane");
  });
  it("rows carry unit and method", () => {
    expect(rows[0].unit).toBe("steps/min");
    expect(rows[0].method).not.toBe("");
  });
  it("dictionary lists every CSV column", () => {
    const dict = dataDictionaryCsv();
    for (const c of CSV_COLUMNS) expect(dict).toMatch(new RegExp(`^${c},column,`, "m"));
    expect(dict).toMatch(/^cadence,parameter,steps\/min,/m);
  });
});
