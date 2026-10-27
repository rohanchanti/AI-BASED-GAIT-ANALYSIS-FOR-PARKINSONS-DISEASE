/**
 * Client orchestration for a server-tracked gait analysis job.
 * Upload goes to private storage; pose/gait computation reuses the existing
 * in-browser MediaPipe pipeline; every status change is persisted server-side.
 */
import type { PoseAnalysisFull } from "@/types/gait";
import type { PoseFrame } from "@/types/pose";
import { evaluateQuality, checkProtocol, type Protocol, type QualityInput } from "@/lib/video-config";
import { DEFAULT_POSE_CONFIG } from "@/services/pose/poseConfig";
import { indexLandmarks, reliable } from "@/services/pose/poseLandmarkUtils";
import { bodyVisibilityScore } from "@/services/pose/qualityService";

export class UploadCancelled extends Error {}

export function uploadWithProgress(
  path: string,
  token: string,
  file: File,
  onProgress: (p: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const url = `${base}/storage/v1/object/upload/sign/recordings/${path.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(token)}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(xhr.status === 413 ? "File is too large for storage." : `Upload failed (HTTP ${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onabort = () => reject(new UploadCancelled("Upload cancelled."));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

export async function uploadWithRetry(
  path: string,
  token: string,
  file: File,
  onProgress: (p: number) => void,
  signal?: AbortSignal,
  attempts = 3,
) {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await uploadWithProgress(path, token, file, onProgress, signal);
    } catch (e) {
      if (e instanceof UploadCancelled) throw e;
      last = e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw last;
}

const BODY_NAMES = ["nose", "left_shoulder", "right_shoulder", "left_hip", "right_hip", "left_ankle", "right_ankle"] as const;

/** Build the data-quality input from real pose frames. */
export function qualityInputFromPose(pose: PoseAnalysisFull, minConf = DEFAULT_POSE_CONFIG.minLandmarkConfidence): QualityInput {
  const frames: PoseFrame[] = pose.frames ?? [];
  const withPose = frames.filter((f) => f.landmarks && f.landmarks.length);
  const heights: number[] = [];
  let edge = 0;
  for (const f of withPose) {
    const map = indexLandmarks(f.landmarks);
    const pts = BODY_NAMES.flatMap((name) => { const p = reliable(map, name, minConf); return p ? [p] : []; });
    if (pts.length >= 3) {
      const ys = pts.map((p) => p.y);
      heights.push(Math.max(...ys) - Math.min(...ys));
    }
    if (pts.some((p) => p.y < 0.01 || p.y > 0.99 || p.x < 0.01 || p.x > 0.99)) edge++;
  }
  const q = pose.quality;
  return {
    durationSec: pose.video?.durationSec ?? 0,
    fps: null, // native frame rate is not exposed by browser decoders
    totalFrames: frames.length,
    framesWithPose: withPose.length,
    multiPersonFrames: frames.filter((f) => (f.peopleDetected ?? 0) > 1).length,
    poseConfidence: q ? q.poseConfidence / 100 : 0,
    bodyVisibility: bodyVisibilityScore(frames, minConf),
    usableFrames: frames.filter((f) => f.valid ?? !!f.landmarks).length,
    validCycles: q?.validCycles ?? pose.cycles?.length ?? null,
    meanSubjectHeight: heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : null,
    edgeCutRatio: withPose.length ? edge / withPose.length : null,
    meanLuminance: null,
  };
}

export function assessRecording(pose: PoseAnalysisFull, protocol: Protocol) {
  const qi = qualityInputFromPose(pose);
  const gate = evaluateQuality(qi);
  // Existing pipeline blocking validation also counts.
  const blocking = (pose.validation?.blocking ?? []) as string[];
  for (const b of blocking)
    if (!gate.issues.some((i) => i.message === b))
      gate.issues.push({ code: "pipeline", severity: "blocking", message: b, advice: "Re-record following the guidelines." });
  const status = gate.issues.some((i) => i.severity === "blocking") ? "fail" : gate.issues.length ? "warn" : "pass";
  const checks = checkProtocol(protocol, {
    durationSec: qi.durationSec || null,
    cameraView: (pose.metrics as unknown as { cameraView?: string })?.cameraView ?? null,
    bodyVisibility: qi.totalFrames ? qi.bodyVisibility : null,
  });
  if (checks.find((c) => c.name === "Minimum duration")?.result !== "pass" &&
      !gate.issues.some((i) => i.code === "short_duration"))
    gate.issues.push({ code: "short_duration", severity: "blocking", message: `This protocol requires at least ${protocol.minDurationSec} s; ${qi.durationSec.toFixed(1)} s recorded.`, advice: "Record a longer walking video." });
  const finalStatus = gate.issues.some((i) => i.severity === "blocking") ? "fail" : status;
  return { input: qi, status: finalStatus, issues: gate.issues, checks };
}
