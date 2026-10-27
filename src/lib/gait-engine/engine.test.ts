// Software verification with SYNTHETIC signals only. Not scientific validation.
import { describe, it, expect } from "vitest";
import type { GaitEvent } from "@/types/gait";
import { computeGaitParameters, CALIBRATION_REQUIRED } from "./parameters";
import { normalizedToPixel, pixelToMetric } from "./coordinates";
import { mae, rmse, blandAltman, icc21, classificationMetrics, participantSplit, assertNoLeakage, wilson } from "./validation";
import { parseGaitpdbFileName, forceReferenceFeatures, parseGaitpdbText } from "./gaitpdb";

const ev = (t: number, side: "left" | "right", type: GaitEvent["type"] = "heel_strike"): GaitEvent => ({ timestamp: t, frameNumber: Math.round(t * 15), side, type, confidence: 0.9 });
function synthetic(nStrides = 6, stride = 1.0, rightOffset = 0.5) {
  const e: GaitEvent[] = [];
  for (let k = 0; k < nStrides; k++) {
    e.push(ev(k * stride, "left"), ev(k * stride + 0.6, "left", "toe_off"));
    e.push(ev(k * stride + rightOffset, "right"), ev(k * stride + rightOffset + 0.6, "right", "toe_off"));
  }
  return e;
}
const get = (o: ReturnType<typeof computeGaitParameters>, k: string) => {
  const p = o.parameters.find((p) => p.key === k);
  if (!p) throw new Error(`Missing parameter ${k}`);
  return p;
};

describe("temporal parameters", () => {
  const out = computeGaitParameters({ events: synthetic() });
  it("cadence is 120 steps/min for 0.5 s steps", () => expect(get(out, "cadence").value).toBeCloseTo(120, 6));
  it("stride time is 1.0 s", () => expect(get(out, "strideTimeLeft").value).toBeCloseTo(1, 6));
  it("pooled stride time is 1.0 s", () => expect(get(out, "strideTime").value).toBe(1));
  it("step time is 0.5 s", () => expect(get(out, "stepTime").value).toBe(0.5));
  it("regular stride-time variability is zero", () => expect(get(out, "strideTimeCV").value).toBe(0));
  it("equal left/right step timing has 100% symmetry", () => expect(get(out, "stepTimeSymmetry").value).toBe(100));
  it("0.6/0.4 s steps have 60% temporal symmetry", () => expect(get(computeGaitParameters({ events: synthetic(6, 1, 0.6) }), "stepTimeSymmetry").value).toBe(60));
  it("every requested feature includes its unit and ankle-event method", () => {
    for (const [key, unit] of [["cadence", "steps/min"], ["stepTime", "s"], ["strideTime", "s"], ["strideTimeCV", "% CV"], ["stepTimeSymmetry", "%"]]) {
      expect(get(out, key).unit).toBe(unit);
      expect(get(out, key).method).toContain("Ankle position relative to pelvis");
    }
  });
  it("stance 0.6 s and swing 0.4 s", () => {
    expect(get(out, "stanceTime").value).toBeCloseTo(0.6, 6);
    expect(get(out, "swingTime").value).toBeCloseTo(0.4, 6);
  });
  it("perfectly regular signal has 0% variability", () => expect(get(out, "stepTimeCV").value).toBeCloseTo(0, 6));
  it("symmetric gait has 0% asymmetry", () => expect(get(out, "stepTimeAsymmetry").value).toBeCloseTo(0, 6));
  it("asymmetry formula: 0.6 vs 0.4 s steps gives 40%", () => {
    const o = computeGaitParameters({ events: synthetic(6, 1, 0.6) });
    expect(get(o, "stepTimeAsymmetry").value).toBeCloseTo(40, 4);
  });
});

describe("missing data", () => {
  it("too few cycles returns unavailable with reason, never a value", () => {
    const o = computeGaitParameters({ events: synthetic(1) });
    expect(get(o, "cadence").value).toBeNull();
    expect(get(o, "cadence").reason).toMatch(/Needs/);
  });
  it("step length is unavailable without calibration", () => expect(get(computeGaitParameters({ events: synthetic() }), "stepLength").status).toBe("unavailable"));
  it("walking speed unavailable without distance", () => expect(get(computeGaitParameters({ events: synthetic() }), "walkingSpeed").value).toBeNull());
  it("walking speed = distance / duration", () => {
    const o = computeGaitParameters({ events: synthetic(), walkingDistanceM: 5.5, calibration: { source: "known-distance", metersPerUnit: 10, estimated: false, note: "Measured 5 m reference spanning 0.5 normalized units" } });
    expect(get(o, "walkingSpeed").value).toBeCloseTo(5.5 / 5.5, 3); // contacts span 0 → 5.5 s
  });
  it("entered walking distance alone cannot unlock speed or stride length", () => {
    const o = computeGaitParameters({ events: synthetic(), walkingDistanceM: 5.5 });
    for (const key of ["walkingSpeed", "strideLength"]) {
      expect(get(o, key).value).toBeNull();
      expect(get(o, key).reason).toBe(CALIBRATION_REQUIRED);
    }
  });
  it("invalid calibration cannot unlock speed", () => {
    const o = computeGaitParameters({ events: synthetic(), walkingDistanceM: 5.5, calibration: { source: "known-distance", metersPerUnit: NaN, estimated: false, note: "invalid" } });
    expect(get(o, "walkingSpeed").reason).toBe(CALIBRATION_REQUIRED);
    expect(o.calibration).toBeNull();
  });
  it("invalid timestamps are rejected", () => {
    const o = computeGaitParameters({ events: [...synthetic(), ev(NaN, "left"), ev(-1, "right")] });
    expect(o.counts.rejectedEvents).toBe(2);
    expect(get(o, "cadence").value).toBeCloseTo(120, 6);
  });
});

describe("coordinates", () => {
  it("normalized → pixel uses frame size", () => expect(normalizedToPixel({ x: 0.5, y: 0.25 }, 1280, 720)).toMatchObject({ x: 640, y: 180, unit: "px" }));
  it("no metric output without a scale", () => expect(pixelToMetric(normalizedToPixel({ x: 1, y: 1 }, 100, 100), null)).toBeNull());
});

describe("validation metrics", () => {
  it("MAE and RMSE", () => {
    expect(mae([1, 2, 3], [1, 2, 5])).toBeCloseTo(2 / 3);
    expect(rmse([1, 2, 3], [1, 2, 5])).toBeCloseTo(Math.sqrt(4 / 3));
  });
  it("Bland–Altman bias", () => expect(blandAltman([2, 3, 4], [1, 2, 3]).bias).toBeCloseTo(1));
  it("ICC(2,1) of identical ratings is 1", () => expect(icc21([[1, 1], [2, 2], [3, 3], [5, 5]])).toBeCloseTo(1));
  it("confusion matrix and sensitivity", () => {
    const m = classificationMetrics([1, 1, 0, 0], [1, 0, 0, 1]);
    expect(m.confusion).toEqual({ tp: 1, tn: 1, fp: 1, fn: 1 });
    expect(m.sensitivity).toBe(0.5);
  });
  it("Wilson CI contains the point estimate", () => {
    const c = wilson(8, 10);
    expect(c.lower).toBeLessThan(0.8);
    expect(c.upper).toBeGreaterThan(0.8);
  });
});

describe("participant-level separation", () => {
  it("no participant appears in two partitions even with repeated trials", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `P${i % 13}`);
    const s = participantSplit(ids);
    expect(assertNoLeakage(s)).toBe(true);
    expect(s.dev.length + s.val.length + s.test.length).toBe(13);
  });
  it("leakage is detected", () => expect(() => assertNoLeakage({ dev: ["A"], val: ["A"], test: [] })).toThrow());
});

describe("gaitpdb", () => {
  it("parses file names into participant and group", () => expect(parseGaitpdbFileName("GaPt03_01.txt")).toMatchObject({ participantId: "GaPt03", group: "PD" }));
  it("recovers stride time from a synthetic 1 Hz force signal", () => {
    const rows: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const t = i / 100;
      const ph = t % 1;
      const l = ph < 0.6 ? 600 : 0;
      const r = ((t + 0.5) % 1) < 0.6 ? 600 : 0;
      rows.push([t, ...Array(16).fill(0), l, r].join("\t"));
    }
    const f = forceReferenceFeatures(parseGaitpdbText(rows.join("\n")));
    expect(f.leftStrideTime!.mean).toBeCloseTo(1, 2);
    expect(f.leftStanceTime!.mean).toBeCloseTo(0.6, 1);
  });
});
