import { describe, it, expect } from "vitest";
import { checkVideoFile, checkUploadFile, sniffContainer, canTransition, isStale, evaluateQuality, checkProtocol, protocolById, VIDEO_LIMITS } from "./video-config";

const good = { durationSec: 10, fps: 30, totalFrames: 150, framesWithPose: 145, multiPersonFrames: 0, poseConfidence: 0.8, bodyVisibility: 0.9, usableFrames: 140, meanSubjectHeight: 0.6, edgeCutRatio: 0, meanLuminance: null };

describe("upload limits", () => {
  it("max upload is 500 MB", () => expect(VIDEO_LIMITS.maxBytes).toBe(500 * 1024 * 1024));
  it("rejects files over 500 MB", () => expect(checkUploadFile({ name: "a.mp4", type: "video/mp4", size: 500 * 1024 * 1024 + 1 })).toMatch(/too large/));
  it("accepts MP4, MOV and AVI uploads", () => {
    expect(checkUploadFile({ name: "a.mp4", type: "video/mp4", size: 5000 })).toBeNull();
    expect(checkUploadFile({ name: "a.mov", type: "video/quicktime", size: 5000 })).toBeNull();
    expect(checkUploadFile({ name: "a.avi", type: "video/x-msvideo", size: 5000 })).toBeNull();
  });
  it("rejects WebM and other types for uploads", () => {
    expect(checkUploadFile({ name: "a.webm", type: "video/webm", size: 5000 })).toMatch(/Wrong file type/);
    expect(checkUploadFile({ name: "a.mkv", type: "video/x-matroska", size: 5000 })).toMatch(/Wrong file type/);
  });
  it("uploads must be at least 5 s", () => expect(VIDEO_LIMITS.uploadMinDurationSec).toBe(5));
  it("still accepts WebM camera recordings", () => expect(checkVideoFile({ name: "a.webm", type: "video/webm", size: 5000 })).toBeNull());
  it("recognises AVI containers", () => expect(sniffContainer(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 65, 86, 73, 32]))).toBe("avi"));
});

describe("signature check", () => {
  it("detects webm", () => expect(sniffContainer(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe("webm"));
  it("detects mp4", () => expect(sniffContainer(new TextEncoder().encode("\0\0\0\x18ftypisom"))).toBe("mp4"));
  it("rejects random bytes", () => expect(sniffContainer(new TextEncoder().encode("hello world, not a video"))).toBeNull());
});

describe("job status", () => {
  it("cannot complete a queued job directly", () => expect(canTransition("queued", "completed")).toBe(false));
  it("failed job can be retried", () => expect(canTransition("failed", "queued")).toBe(true));
  it("completed job is final", () => expect(canTransition("completed", "processing")).toBe(false));
  it("processing job with 3-minute-old heartbeat is stale", () =>
    expect(isStale("processing", new Date(Date.now() - 180000).toISOString())).toBe(true));
});

describe("quality gate", () => {
  it("passes a good recording", () => expect(evaluateQuality(good).status).toBe("pass"));
  it("blocks under 3 s", () => expect(evaluateQuality({ ...good, durationSec: 2 }).status).toBe("fail"));
  it("blocks when two people in most frames", () => expect(evaluateQuality({ ...good, multiPersonFrames: 100 }).status).toBe("fail"));
  it("blocks under 30 usable frames", () => expect(evaluateQuality({ ...good, usableFrames: 20 }).status).toBe("fail"));
  it("warns at moderate confidence", () => expect(evaluateQuality({ ...good, poseConfidence: 0.5 }).status).toBe("warn"));
});

describe("protocol checks", () => {
  it("side protocol fails on front-view video", () => {
    const c = checkProtocol(protocolById("side"), { durationSec: 10, cameraView: "front", bodyVisibility: 0.9 });
    expect(c.find((x) => x.name === "Camera view")?.result).toBe("fail");
  });
  it("walking distance is never claimed verified", () => {
    const c = checkProtocol(protocolById("straight"), { durationSec: 10, cameraView: "side", bodyVisibility: 0.9 });
    expect(c.find((x) => x.name.startsWith("Walking"))?.result).toBe("not_verified");
  });
});
