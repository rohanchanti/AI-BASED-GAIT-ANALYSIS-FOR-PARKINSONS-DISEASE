import { describe, expect, it } from "vitest";
import type { PoseAnalysisFull, GaitEvent } from "@/types/gait";
import { FRAME_RATE_REASON, measureFrameRate, parametersWithFrameRate, TIMING_FEATURE_KEYS } from "./frame-rate";
import { computePoseGaitParameters, qualitySummary } from "./frames";

const regular = Array.from({ length: 601 }, (_, index) => index / 30);
const events: GaitEvent[] = Array.from({ length: 18 }, (_, index) => ([
  { timestamp: index, frameNumber: index * 30, side: "left" as const, type: "heel_strike" as const, confidence: 0.9 },
  { timestamp: index + 0.5, frameNumber: index * 30 + 15, side: "right" as const, type: "heel_strike" as const, confidence: 0.9 },
])).flat();
function pose(timestamps: number[]): PoseAnalysisFull {
  return {
    frames: timestamps.map((timestamp, frameNumber) => ({ timestamp, frameNumber, landmarks: null, peopleDetected: 0 })),
    events, quality: null, validation: { warnings: [] },
  } as unknown as PoseAnalysisFull;
}

describe("pose timestamp frame-rate reliability", () => {
  it("measures regular 30 fps timestamps without a warning", () => {
    expect(measureFrameRate(regular).fps).toBeCloseTo(30, 8);
    expect(measureFrameRate(regular).reason).toBeNull();
    expect(qualitySummary(pose(regular)).warnings).not.toContain(FRAME_RATE_REASON);
    expect(computePoseGaitParameters(pose(regular)).parameters.find((p) => p.key === "cadence")).toMatchObject({ value: 120, status: "estimated" });
  });
  it("marks every timing output unreliable when p95 gaps exceed 2.5 times the median", () => {
    let time = 0;
    const irregular = Array.from({ length: 601 }, (_, index) => { if (index) time += index % 10 === 0 ? 0.4 : 1 / 30; return time; });
    const measured = measureFrameRate(irregular);
    expect(measured.fps).toBeCloseTo(30, 8);
    expect(measured.p95GapSec).toBeCloseTo(0.4, 8);
    expect(measured.status).toBe("unreliable");
    const engine = computePoseGaitParameters(pose(irregular));
    const timings = engine.parameters.filter((p) => TIMING_FEATURE_KEYS.has(p.key));
    expect(timings).toHaveLength(TIMING_FEATURE_KEYS.size);
    for (const parameter of timings) expect(parameter).toMatchObject({ value: null, status: "unreliable", reason: FRAME_RATE_REASON });
    expect(engine.qualitySummary.frameRate.reason).toBe(FRAME_RATE_REASON);
    expect(qualitySummary(pose(irregular)).warnings).toContain(FRAME_RATE_REASON);
    expect(engine.parameters.find((p) => p.key === "strideLength")).toMatchObject({ value: null, status: "unavailable" });
  });
  it("missing timestamps cannot determine fps and never default to a guessed rate", () => {
    for (const timestamps of [[], [null, null], [undefined, undefined], [NaN, NaN]]) {
      expect(measureFrameRate(timestamps)).toMatchObject({ fps: null, status: "unreliable", reason: FRAME_RATE_REASON });
    }
    for (const parameter of computePoseGaitParameters(pose([])).parameters.filter((p) => TIMING_FEATURE_KEYS.has(p.key)))
      expect(parameter).toMatchObject({ value: null, status: "unreliable", reason: FRAME_RATE_REASON });
  });
  it("duplicate or reversed timestamps cannot be hidden by sorting", () => {
    expect(measureFrameRate([0, 1 / 30, 1 / 30, 0]).status).toBe("unreliable");
  });
  it("keeps the strict greater-than 2.5x threshold", () => {
    const timestamps = [0];
    for (let index = 0; index < 100; index++) timestamps.push((timestamps.at(-1) ?? 0) + (index % 10 === 0 ? 2.5 : 1));
    expect(measureFrameRate(timestamps).status).toBe("measured");
  });
  it("does not alter existing per-foot interval filtering", () => {
    expect(computePoseGaitParameters(pose([])).qualitySummary.intervalFiltering)
      .toEqual(computePoseGaitParameters(pose(regular)).qualitySummary.intervalFiltering);
  });
  it("preserves feature snapshots and records measured fps with its exact source", () => {
    const parameters = [{ key: "cadence", value: null, status: "unreliable" }];
    expect(parametersWithFrameRate(parameters, measureFrameRate(regular).fps)).toEqual({
      features: parameters, fps: expect.closeTo(30, 8), fps_source: "measured_from_timestamps",
    });
    expect(parametersWithFrameRate({ features: parameters, protocol: "straight" }, null)).toEqual({
      features: parameters, protocol: "straight", fps: null, fps_source: "measured_from_timestamps",
    });
  });
});