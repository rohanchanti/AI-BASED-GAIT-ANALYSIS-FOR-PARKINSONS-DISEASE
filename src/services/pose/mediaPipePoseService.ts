/**
 * MediaPipe Tasks Vision — Pose Landmarker service.
 *
 * Runs fully in the browser: the uploaded video never leaves the device.
 * The model asset is served from this app (/mediapipe/pose_landmarker_lite.task)
 * and the WASM runtime from the pinned MediaPipe CDN build.
 */
import type { PoseFrame, VideoInfo } from "@/types/pose";
import { subjectSize, toLandmarkArray } from "./poseLandmarkUtils";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
export const POSE_MODEL_URL = "/mediapipe/pose_landmarker_lite.task";
const MAX_POSES = 2;

type Landmarker = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => { landmarks?: { x: number; y: number; z: number; visibility?: number }[][] };
  close: () => void;
};

let cached: Promise<Landmarker> | null = null;

export class PoseInitError extends Error {}
export class VideoDecodeError extends Error {}

export async function getPoseLandmarker(): Promise<Landmarker> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
      const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: MAX_POSES,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      return landmarker as unknown as Landmarker;
    } catch {
      // GPU delegate can be unavailable — retry on CPU before giving up.
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
        const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: MAX_POSES,
        });
        return landmarker as unknown as Landmarker;
      } catch (err) {
        cached = null;
        throw new PoseInitError(
          "Pose estimation could not be initialized. Verify that the pose model is available and your browser supports WebAssembly, then try again.",
        );
      }
    }
  })();
  return cached;
}

export async function isPoseAvailable(): Promise<boolean> {
  try {
    await getPoseLandmarker();
    return true;
  } catch {
    return false;
  }
}

export async function loadVideoElement(file: File): Promise<{
  video: HTMLVideoElement;
  info: Omit<VideoInfo, "sampledFps" | "sampledFrames">;
  revoke: () => void;
}> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
    video.addEventListener(
      "error",
      () => reject(new VideoDecodeError("This video could not be decoded by your browser. Try an MP4 (H.264) file.")),
      { once: true },
    );
  });
  const durationSec = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  return {
    video,
    info: { width: video.videoWidth, height: video.videoHeight, durationSec },
    revoke: () => URL.revokeObjectURL(url),
  };
}

export function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      reject(new VideoDecodeError("Video seeking failed while extracting frames."));
    };
    video.addEventListener("seeked", done);
    video.addEventListener("error", fail);
    try {
      video.currentTime = t;
    } catch {
      fail();
    }
  });
}

export interface FrameExtractionResult {
  frames: PoseFrame[];
  info: VideoInfo;
}

/**
 * Decodes the video at `sampleFps` and extracts pose landmarks per frame.
 * When multiple people are detected, the largest (closest) subject is used
 * consistently as the primary subject — landmarks are never merged.
 */
export async function extractPoseFrames(
  file: File,
  opts: { sampleFps?: number; onProgress?: (p: number) => void; signal?: AbortSignal } = {},
): Promise<FrameExtractionResult> {
  const sampleFps = opts.sampleFps ?? 15;
  const landmarker = await getPoseLandmarker();
  const { video, info, revoke } = await loadVideoElement(file);
  try {
    if (info.durationSec <= 0) throw new VideoDecodeError("Video duration could not be determined.");
    const total = Math.max(2, Math.floor(info.durationSec * sampleFps));
    const frames: PoseFrame[] = [];
    for (let i = 0; i < total; i++) {
      if (opts.signal?.aborted) throw new Error("aborted");
      const t = Math.min(info.durationSec - 0.001, i / sampleFps);
      await seekTo(video, t);
      let landmarks: PoseFrame["landmarks"] = null;
      let people = 0;
      try {
        const res = landmarker.detectForVideo(video, Math.round(t * 1000) + i);
        const sets = res.landmarks ?? [];
        people = sets.length;
        if (sets.length > 0) {
          const parsed = sets.map(toLandmarkArray);
          parsed.sort((a, b) => subjectSize(b) - subjectSize(a));
          landmarks = parsed[0];
        }
      } catch {
        landmarks = null;
      }
      frames.push({ frameNumber: i, timestamp: t, landmarks, peopleDetected: people });
      opts.onProgress?.((i + 1) / total);
      if ((i & 3) === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return {
      frames,
      info: { ...info, sampledFps: sampleFps, sampledFrames: frames.length },
    };
  } finally {
    revoke();
  }
}
