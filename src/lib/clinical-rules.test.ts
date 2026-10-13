import { describe, it, expect } from "vitest";
import { canGenerateReport, timedProtocolResult } from "./clinical-rules";
import { validateDataset } from "./research-dataset";

describe("clinical rules", () => {
  it("failed or cancelled processing cannot produce a report", () => {
    expect(canGenerateReport("failed")).toBe(false);
    expect(canGenerateReport("cancelled")).toBe(false);
    expect(canGenerateReport("processing")).toBe(false);
    expect(canGenerateReport("completed")).toBe(true);
    expect(canGenerateReport("completed_with_warnings")).toBe(true);
  });
  it("TUG is not verified without operator start/stop marks", () => {
    expect(timedProtocolResult({ protocol: "tug", startSec: null, endSec: null, distanceM: null, videoDurationSec: 20 })?.verified).toBe(false);
    const r = timedProtocolResult({ protocol: "tug", startSec: 1, endSec: 12.5, distanceM: null, videoDurationSec: 20 });
    expect(r).toMatchObject({ verified: true, value: 11.5 });
  });
  it("10MWT requires a confirmed 10 m distance", () => {
    expect(timedProtocolResult({ protocol: "10mwt", startSec: 2, endSec: 10, distanceM: 8, videoDurationSec: 20 })?.verified).toBe(false);
    expect(timedProtocolResult({ protocol: "10mwt", startSec: 2, endSec: 10, distanceM: 10, videoDurationSec: 20 })).toMatchObject({ verified: true, value: 1.25 });
  });
  it("arbitrary walking video gives no timed result", () => {
    expect(timedProtocolResult({ protocol: "straight", startSec: 1, endSec: 5, distanceM: null, videoDurationSec: 10 })).toBeNull();
  });
});

describe("research datasets", () => {
  it("rejects identifying columns", () => {
    expect(validateDataset([{ participant_code: "P1", name: "Jane" }]).ok).toBe(false);
  });
  it("accepts coded rows", () => {
    expect(validateDataset([{ participant_code: "P1", cadence: "110" }]).ok).toBe(true);
  });
});
