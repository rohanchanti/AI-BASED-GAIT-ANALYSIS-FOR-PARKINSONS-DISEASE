import { describe, expect, it } from "vitest";
import { JOB_STATUS_COLUMNS, shouldCreateReanalysis, withFeatureMethods } from "./analysis-storage";

describe("analysis history", () => {
  it("status checks keep all retry metadata without downloading saved result snapshots", () => {
    const columns = JOB_STATUS_COLUMNS.split(", ");
    expect(columns).toEqual(["id", "owner_id", "recording_id", "status", "attempts", "analysis_mode", "model_name", "model_version", "pipeline_version", "feature_pipeline_version", "pose_estimator_version", "platform_version", "preprocessing_config"]);
    for (const snapshot of ["parameters", "quality_metrics", "quality_report", "*"]) expect(columns).not.toContain(snapshot);
  });
  it("reanalysis of finished runs creates a new run", () => {
    for (const status of ["complete", "completed", "completed_with_warnings", "failed", "cancelled"])
      expect(shouldCreateReanalysis(status, true)).toBe(true);
    expect(shouldCreateReanalysis("processing", true)).toBe(false);
  });
  it("feature provenance preserves unavailable values", () => {
    const original = { parameters: [{ key: "stepLength", value: null, status: "unavailable" }] };
    const stored = withFeatureMethods(original);
    expect(stored.parameters[0].value).toBeNull();
    expect(stored.parameters[0].unit).toBe("m");
    expect(stored.parameters[0].method).toContain("Requires metric calibration");
    expect(original.parameters[0]).not.toHaveProperty("method");
  });
  it("preserves the computed ankle-event method when preparing feature storage", () => {
    const stored = withFeatureMethods({ parameters: [{ key: "cadence", value: 120, unit: "steps/min", method: "Ankle position relative to pelvis; 60 / mean(step time)", status: "estimated" }] });
    expect(stored.parameters[0].method).toBe("Ankle position relative to pelvis; 60 / mean(step time)");
    expect(stored.parameters[0].unit).toBe("steps/min");
    expect(stored.parameters[0].value).toBe(120);
  });
});