import { describe, expect, it } from "vitest";
import { LANDMARK_NAMES, type PoseFrame } from "@/types/pose";
import { detectGaitEvents } from "@/services/pose/gaitEventDetector";
import { computeGaitParameters } from "./parameters";
import { withFeatureMethods } from "@/lib/analysis-storage";

// Synthetic kinematics verify software behavior, not clinical accuracy.
function ankleFrames(): PoseFrame[] {
  return Array.from({ length: 360 }, (_, i) => {
    const timestamp = i / 30;
    const pelvisX = 0.3 + timestamp * 0.02;
    const landmarks = LANDMARK_NAMES.map((name) => ({
      name, x: pelvisX, y: name.includes("shoulder") ? 0.3 : 0.6,
      z: 0, visibility: 0.9, presence: 0.9,
    }));
    for (const p of landmarks) {
      if (p.name === "left_ankle") p.x += 0.06 * Math.cos(2 * Math.PI * timestamp);
      if (p.name === "right_ankle") p.x += 0.06 * Math.cos(2 * Math.PI * timestamp + Math.PI);
    }
    // Heels and toes are intentionally stationary: the detector must use ankles.
    return { frameNumber: i, timestamp, landmarks, peopleDetected: 1, valid: true };
  });
}

describe("ankle kinematics to stored temporal features", () => {
  it("derives 120 steps/min from alternating ankle maxima, not stationary heels", () => {
    const { events } = detectGaitEvents(ankleFrames(), 0.5);
    expect(events.filter((e) => e.type === "heel_strike").length).toBeGreaterThan(16);
    const result = computeGaitParameters({ events });
    expect(result.parameters.find((p) => p.key === "cadence")?.value).toBeCloseTo(120, 0);
    expect(result.parameters.find((p) => p.key === "strideTime")?.value).toBeCloseTo(1, 2);
    expect(result.parameters.find((p) => p.key === "stepTime")?.value).toBeCloseTo(0.5, 2);
    expect(result.parameters.find((p) => p.key === "stepTimeSymmetry")?.value).toBeCloseTo(100, 0);
  });
  it("retains each requested unit and ankle method through storage serialization", () => {
    const { events } = detectGaitEvents(ankleFrames(), 0.5);
    const stored = JSON.parse(JSON.stringify(withFeatureMethods(computeGaitParameters({ events }))));
    for (const key of ["cadence", "stepTime", "strideTime", "strideTimeCV", "stepTimeSymmetry"]) {
      const p = stored.parameters.find((p: { key: string }) => p.key === key);
      expect(p.value).not.toBeNull();
      expect(p.unit.length).toBeGreaterThan(0);
      expect(p.method).toContain("Ankle position relative to pelvis");
    }
  });
  it("never emits contacts from rejected ankle frames", () => {
    const frames = ankleFrames().map((f) => ({ ...f, valid: false }));
    expect(detectGaitEvents(frames, 0.5).events).toEqual([]);
  });
});