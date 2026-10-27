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
});