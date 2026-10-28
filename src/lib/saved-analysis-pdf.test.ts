import { describe, expect, it } from "vitest";
import type { DashboardRun, DashboardSubject, DashboardVisit } from "@/lib/dashboard-data";
import { savedReportContent } from "@/lib/saved-analysis-pdf";

const run = {
  id: "r1", status: "completed", started_at: "2026-10-01T10:00:00Z", completed_at: "2026-10-01T10:05:00Z", pipeline_version: "1.2.0", analysis_mode: "gait",
  quality_report: { issues: [{ message: "Low pose confidence." }] },
  recordings: { protocol: "10mwt", camera_view: "side" },
  gait_results: { engine_output: { parameters: [
    { key: "cadence", value: 110, status: "measured" },
    { key: "stanceTime", value: 0.6, status: "experimental" },
    { key: "walkingSpeed", value: null, status: "unavailable", reason: "Not available - calibration required" },
  ] } },
} as unknown as DashboardRun;
const subject = { subject_code: "SUBJ-007", display_name: "Jane Doe" } as unknown as DashboardSubject;
const visit = { recording_condition: "Off medication" } as unknown as DashboardVisit;

describe("saved analysis report", () => {
  const c = savedReportContent(run, visit, subject);
  it("uses the coded ID, never the name", () => {
    expect(c.codedId).toBe("SUBJ-007");
    expect(JSON.stringify(c)).not.toContain("Jane Doe");
  });
  it("includes date, protocol and pipeline version", () => {
    expect([c.date, c.protocol, c.pipelineVersion]).toEqual(["2026-10-01", "10mwt", "1.2.0"]);
  });
  it("shows values with units and status", () => {
    expect(c.measurements[0]).toEqual({ name: "Cadence", value: "110 steps/min", status: "measured" });
    expect(c.measurements[1].status).toBe("unreliable");
    expect(c.measurements[2].value).toBe("Not available");
  });
  it("lists quality limitations", () => {
    expect(c.limitations).toContain("Low pose confidence.");
    expect(c.limitations).toContain("Walking speed: Not available - calibration required");
  });
  it("carries the disclaimer", () => {
    expect(c.disclaimer).toBe("Automated outputs are not a diagnosis.");
  });
});
