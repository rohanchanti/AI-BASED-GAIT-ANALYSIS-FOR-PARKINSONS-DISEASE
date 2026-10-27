import { describe, expect, it } from "vitest";
import { shouldCreateReanalysis, withFeatureMethods } from "./analysis-storage";

describe("analysis history", () => {
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