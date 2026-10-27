import { describe, expect, it } from "vitest";
import { savedDashboardResult, savedLegacyDashboardResult, dashboardQueryOptions, type DashboardRun } from "./dashboard-data";
import { unavailableGaitAnalysis } from "./mock-analysis";
import type { Tables } from "@/integrations/supabase/types";

describe("saved dashboard results", () => {
  it("uses separate cache keys for separate accounts", () => {
    expect(dashboardQueryOptions("owner-a").queryKey).not.toEqual(dashboardQueryOptions("owner-b").queryKey);
  });
  it("restores run result values without browser storage", () => {
    const payload = unavailableGaitAnalysis("normal");
    payload.parameters[0].patient = 112;
    const run = { id: "run-1", status: "completed", started_at: "2026-10-27T00:00:00Z", recordings: null, gait_results: { result_payload: payload, engine_output: null, pose_metrics: null } } as unknown as DashboardRun;
    expect(savedDashboardResult(run, [])?.stored.result.parameters[0].patient).toBe(112);
    expect(savedDashboardResult({ ...run, status: "needs_better_video" }, [])).toBeNull();
  });
  it("restores stored legacy reports without inventing absent scores", () => {
    const result = unavailableGaitAnalysis("normal");
    const report = { id: "report-1", kind: "gait", mode: "normal", probability: null, confidence: null, risk_level: "Not available", parameters: { rows: result.parameters, summary: result.summary } } as unknown as Tables<"reports">;
    const restored = savedLegacyDashboardResult(report);
    expect(restored?.stored.analysis_id).toBe("report-1");
    expect(restored?.stored.result.probability).toBeNull();
    expect(restored?.stored.result.parameters[0].patient).toBeNull();
  });
});