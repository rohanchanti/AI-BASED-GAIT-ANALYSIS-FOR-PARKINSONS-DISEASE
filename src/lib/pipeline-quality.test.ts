import { describe, it, expect } from "vitest";
import { LANDMARK_NAMES, type PoseFrame } from "@/types/pose";
import type { PoseAnalysisFull } from "@/types/gait";
import { toLandmarkArray } from "@/services/pose/poseLandmarkUtils";
import { preprocessPoseFrames } from "@/services/pose/temporalFilter";
import { DEFAULT_POSE_CONFIG } from "@/services/pose/poseConfig";
import { bodyVisibilityScore } from "@/services/pose/qualityService";
import { assessRecording, qualityInputFromPose } from "./job-runner";
import { protocolById } from "./video-config";
import { serializeFrames } from "./gait-engine/frames";

// Synthetic software fixtures, not patient data or clinical validation.
const landmarks = () => LANDMARK_NAMES.map((name, i) => ({ name, x: 0.4, y: i === 0 ? 0.1 : i >= 27 ? 0.9 : 0.5, z: 0, visibility: 0.9, presence: 0.9 }));
const frame = (i = 0): PoseFrame => ({ frameNumber: i, timestamp: i / 15, landmarks: landmarks(), peopleDetected: 1, valid: true, frameConfidence: 0.9 });
function pose(): PoseAnalysisFull {
  return {
    method: "mediapipe-pose", generatedAt: "2026-10-27T00:00:00Z",
    video: { width: 640, height: 480, durationSec: 10, sampledFps: 15, sampledFrames: 150 },
    frames: Array.from({ length: 150 }, (_, i) => frame(i)), events: [], angles: [],
    metrics: { cameraView: "side" } as PoseAnalysisFull["metrics"],
    quality: { poseConfidence: 90, bodyVisibilityScore: 100, validFramePercent: 100, continuityScore: 100,
      gaitCycleSufficiency: 100, videoStabilityScore: 100, overall: 95, validCycles: 2, cameraJitter: 0, warnings: [] },
    validation: { ok: true, blocking: [], warnings: [] },
  };
}

describe("missing landmark integrity", () => {
  it("omits missing depth instead of manufacturing a zero and preserves landmark names", () => {
    const parsed = toLandmarkArray([{ x: 0.2, y: 0.3, visibility: 0.9 }, { x: 0, y: 0, z: 0, visibility: 0.9 }]);
    expect(parsed.map((p) => p.name)).toEqual(["left_eye_inner"]);
    expect(parsed[0].z).toBe(0);
  });
  it("rejects nonfinite coordinates and missing confidence", () => {
    expect(toLandmarkArray([{ x: NaN, y: 0.2, z: 0, visibility: 0.9 }, { x: 0.2, y: 0.3, z: 0 }])).toEqual([]);
  });
  it("unrecoverable landmarks stay absent through preprocessing", () => {
    const frames = Array.from({ length: 10 }, (_, i) => ({ ...frame(i), landmarks: landmarks().filter((p) => p.name !== "left_ankle") }));
    const out = preprocessPoseFrames(frames, DEFAULT_POSE_CONFIG);
    expect(out.frames.every((f) => f.landmarks?.every((p) => p.name !== "left_ankle"))).toBe(true);
    expect(out.report.validFrames).toBe(0);
  });
  it("stores null slots without shifting subsequent landmarks", () => {
    const p = pose();
    p.frames = [{ ...frame(), landmarks: landmarks().filter((l) => l.name !== "left_ankle") }];
    const lm = serializeFrames(p).frames[0].lm;
    expect(lm).toHaveLength(132);
    expect(lm?.slice(27 * 4, 28 * 4)).toEqual([null, null, null, null]);
    expect(lm?.slice(28 * 4, 29 * 4)).toEqual([0.4, 0.9, 0, 0.9]);
  });
});

describe("recording quality assessment", () => {
  it("normalizes 90% confidence to 0.9 and passes sufficient evidence", () => {
    expect(qualityInputFromPose(pose()).poseConfidence).toBe(0.9);
    expect(assessRecording(pose(), protocolById("straight")).status).toBe("pass");
  });
  it("fails confidence below threshold with a blocking reason", () => {
    const p = pose();
    if (p.quality) p.quality.poseConfidence = 39;
    expect(assessRecording(p, protocolById("straight")).issues).toContainEqual(expect.objectContaining({ code: "low_confidence", severity: "blocking" }));
  });
  it("fails when feet are missing despite a stale full-body score", () => {
    const p = pose();
    p.frames.forEach((f) => { f.landmarks = f.landmarks?.filter((l) => l.name !== "left_ankle") ?? null; });
    expect(assessRecording(p, protocolById("straight")).status).toBe("fail");
  });
  it("requires both shoulders inside the image", () => {
    const f = frame();
    const shoulder = f.landmarks?.find((l) => l.name === "right_shoulder");
    if (shoulder) shoulder.x = 1.2;
    expect(bodyVisibilityScore([f], 0.5)).toBe(0);
  });
  it("enforces the selected protocol minimum duration", () => {
    const p = pose(); p.video.durationSec = 4;
    const result = assessRecording(p, protocolById("straight"));
    expect(result.status).toBe("fail");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "short_duration", severity: "blocking" }));
  });
  it("rejects fewer than two complete gait cycles", () => {
    const p = pose(); if (p.quality) p.quality.validCycles = 1;
    const result = assessRecording(p, protocolById("straight"));
    expect(result.status).toBe("fail");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "few_gait_cycles", severity: "blocking" }));
  });
});