import { describe, expect, it } from "vitest";
import type { GaitEvent } from "@/types/gait";
import { computeGaitParameters, filterIntervals, INTERVAL_FILTER_RULE, mean, sd, weakestStatus } from "./parameters";
import { qualitySummary } from "./frames";
import type { PoseAnalysisFull } from "@/types/gait";

const contact = (timestamp: number, side: "left" | "right"): GaitEvent => ({
  timestamp, side, type: "heel_strike", frameNumber: Math.round(timestamp * 30), confidence: 0.9,
});
const regular = (count: number) => Array.from({ length: count }, (_, i) =>
  [contact(i, "left"), contact(i + 0.5, "right")]).flat();
const parameter = (events: GaitEvent[], key: string) => {
  const p = computeGaitParameters({ events }).parameters.find((p) => p.key === key);
  if (!p) throw new Error(`Missing ${key}`);
  return p;
};

describe("per-foot interval filtering", () => {
  it("rejects outside 0.5–1.5 times the unfiltered median, inclusively retaining boundaries", () => {
    const result = filterIntervals([1, 1, 1, 1, 0.49, 0.5, 1.5, 1.51], "stride");
    expect(result.values).toEqual([1, 1, 1, 1, 0.5, 1.5]);
  });
  it("enforces the 0.3–1.5 s step plausibility window independently of the median", () => {
    expect(filterIntervals([0.2, 0.2, 0.2, 0.3], "step").values).toEqual([0.3]);
    expect(filterIntervals([1.5, 1.6, 1.6, 1.6], "step").values).toEqual([1.5]);
  });
  it("enforces the 0.4–3.0 s stride plausibility window independently of the median", () => {
    expect(filterIntervals([0.3, 0.3, 0.3, 0.4], "stride").values).toEqual([0.4]);
    expect(filterIntervals([3, 3.1, 3.1, 3.1], "stride").values).toEqual([3]);
  });
  it("calculates mean, sample SD and CV from retained values, excluding doubled and short intervals", () => {
    const values = filterIntervals([1, 1.1, 0.9, 1, 2, 0.1], "stride").values;
    expect(values).toEqual([1, 1.1, 0.9, 1]);
    expect(mean(values)).toBe(1);
    expect(sd(values)).toBeCloseTo(Math.sqrt(0.02 / 3), 10);
    expect(100 * sd(values) / mean(values)).toBeCloseTo(8.1649658, 6);
  });
  it("records before/discarded counts and the exact rule for each foot and kind", () => {
    const events = regular(20).filter((e) => !(e.side === "left" && e.timestamp === 5));
    const output = computeGaitParameters({ events });
    expect(output.qualitySummary.intervalFiltering.left.stride).toMatchObject({
      before: 18, discarded: 1, remaining: 17, rule: "0.5-1.5x median, plausibility window",
    });
    expect(output.qualitySummary.intervalFiltering.right.stride).toMatchObject({ before: 19, discarded: 0, remaining: 19 });
    expect(output.qualitySummary.intervalFiltering.left.step).toMatchObject({ before: 18, discarded: 0 });
    expect(output.qualitySummary.intervalFiltering.right.step).toMatchObject({ before: 19, discarded: 0 });
    expect(parameter(events, "strideTimeCV").value).toBe(0);
    expect(parameter(events, "stepTimeCV").value).toBe(0);
    const pose = { frames: [], events } as unknown as PoseAnalysisFull;
    expect(qualitySummary(pose).intervalFiltering).toEqual(output.qualitySummary.intervalFiltering);
    expect(output.notes.some((note) => note.includes(INTERVAL_FILTER_RULE))).toBe(true);
  });
  it("uses separate foot medians rather than a pooled median", () => {
    const events = Array.from({ length: 14 }, (_, i) => [contact(i * 1.2, "left"), contact(i * 1.2 + 0.35, "right")]).flat();
    const output = computeGaitParameters({ events });
    expect(output.qualitySummary.intervalFiltering.left.step.median).toBeCloseTo(0.85);
    expect(output.qualitySummary.intervalFiltering.right.step.median).toBeCloseTo(0.35);
    expect(parameter(events, "stepTimeLeft").value).toBe(0.85);
    expect(parameter(events, "stepTimeRight").value).toBe(0.35);
  });
  it("withholds dependent features at nine valid intervals for either foot", () => {
    const events = regular(10);
    for (const key of ["cadence", "stepTime", "stepTimeLeft", "strideTime", "strideTimeLeft", "strideTimeRight", "stepTimeCV", "strideTimeCV", "stepTimeAsymmetry", "stepTimeSymmetry"]) {
      expect(parameter(events, key)).toMatchObject({ value: null, status: "unreliable", reason: "too few valid intervals" });
    }
    expect(parameter(events, "stepTimeRight").value).toBe(0.5);
  });
  it("accepts exactly ten retained intervals on each foot", () => {
    const events = regular(11);
    expect(parameter(events, "strideTimeLeft")).toMatchObject({ value: 1, n: 10, status: "estimated" });
    expect(parameter(events, "stepTimeAsymmetry")).toMatchObject({ value: 0, status: "estimated" });
  });
  it("applies the ten-interval limit after rejection, not before", () => {
    const events = regular(12).filter((e) => !(e.side === "left" && e.timestamp === 5));
    expect(parameter(events, "strideTimeLeft")).toMatchObject({ n: 9, value: null, status: "unreliable", reason: "too few valid intervals" });
    expect(parameter(events, "strideTimeRight")).toMatchObject({ n: 11, value: 1 });
    expect(parameter(events, "strideTimeCV").value).toBeNull();
  });
  it("propagates estimated, experimental, unreliable and unavailable input statuses", () => {
    expect(weakestStatus(["measured", "estimated"])).toBe("estimated");
    expect(weakestStatus(["estimated", "experimental"])).toBe("experimental");
    expect(weakestStatus(["measured", "unreliable"])).toBe("unreliable");
    expect(weakestStatus(["unreliable", "unavailable"])).toBe("unavailable");
    expect(parameter(regular(12), "stepTimeAsymmetry").status).toBe("estimated");
  });
  it("does not replace empty or nonfinite measurements with zero", () => {
    expect(filterIntervals([], "step")).toMatchObject({ values: [], quality: { median: null } });
    expect(filterIntervals([NaN, Infinity], "stride")).toMatchObject({ values: [], quality: { median: null, discarded: 2 } });
    for (const key of ["stepTime", "strideTime", "stepTimeCV", "strideTimeCV", "stepTimeAsymmetry"]) {
      expect(parameter([], key).value).toBeNull();
    }
  });
});