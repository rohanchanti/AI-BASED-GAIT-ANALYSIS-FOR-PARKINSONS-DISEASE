import { describe, expect, it } from "vitest";
import { analysisFromEngine, generateMockAnalysis, unavailableGaitAnalysis } from "./mock-analysis";
import { computeGaitParameters } from "./gait-engine/parameters";

describe("gait values without invented replacements", () => {
  it("never generates random gait measurements", () => {
    for (const seed of ["one", "two"]) {
      const result = generateMockAnalysis("gait", "normal", seed);
      expect(result.parameters.every((p) => p.patient === null)).toBe(true);
      expect(result.probability).toBeNull();
      expect(result.confidence).toBeNull();
    }
  });

  it("preserves unavailable values through JSON persistence", () => {
    const result = JSON.parse(JSON.stringify(unavailableGaitAnalysis("normal")));
    expect(result.parameters[0].patient).toBeNull();
    expect(result.parameters[0].status).toBe("unavailable");
    expect(result.summary.overallGaitHealth).toBeNull();
  });

  it("retains measured engine cadence without inventing speed or risk", () => {
    const events = Array.from({ length: 12 }, (_, i) => ({
      timestamp: i * 0.5, frameNumber: i * 15,
      side: i % 2 ? "right" as const : "left" as const,
      type: "heel_strike" as const, confidence: 0.9,
    }));
    const result = analysisFromEngine(computeGaitParameters({ events }), "normal");
    expect(result.parameters.find((p) => p.key === "cadence")?.patient).toBe(120);
    expect(result.parameters.find((p) => p.key === "walking_speed")?.patient).toBeNull();
    expect(result.summary.parkinsonsRisk).toBeNull();
  });
});