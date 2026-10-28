import { describe, expect, it } from "vitest";
import type { DashboardRun } from "@/lib/dashboard-data";
import { visitComparison } from "@/lib/visit-comparison";

const run = (id: string, o: { subject?: string; protocol?: string | null; view?: string | null; pipeline?: string | null } = {}) => ({
  id, status: "completed", pipeline_version: o.pipeline === undefined ? "v1" : o.pipeline, gait_results: {},
  recordings: { subject_id: o.subject ?? "s1", protocol: o.protocol === undefined ? "10mwt" : o.protocol, camera_view: o.view === undefined ? "side" : o.view },
}) as unknown as DashboardRun;

describe("visit comparison", () => {
  it("compares runs with matching protocol, view and pipeline", () => {
    expect(visitComparison(run("a"), [run("a"), run("b")]).comparable.map((r) => r.id)).toEqual(["b"]);
  });
  it("warns on protocol mismatch", () => {
    expect(visitComparison(run("a"), [run("b", { protocol: "tug" })]).mismatched[0].fields).toEqual(["protocol"]);
  });
  it("warns on camera view mismatch", () => {
    expect(visitComparison(run("a"), [run("b", { view: "front" })]).mismatched[0].fields).toEqual(["camera view"]);
  });
  it("warns on pipeline version mismatch or missing value", () => {
    expect(visitComparison(run("a"), [run("b", { pipeline: "v2" }), run("c", { pipeline: null })]).mismatched.map((m) => m.fields)).toEqual([["pipeline version"], ["pipeline version"]]);
  });
  it("ignores other subjects", () => {
    const r = visitComparison(run("a"), [run("b", { subject: "s2" })]);
    expect(r.comparable).toEqual([]);
    expect(r.mismatched).toEqual([]);
  });
});
