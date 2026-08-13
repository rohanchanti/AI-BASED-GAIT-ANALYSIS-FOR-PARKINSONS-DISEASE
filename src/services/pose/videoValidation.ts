/**
 * Pre-analysis video validation.
 *
 * Distinguishes BLOCKING problems (analysis cannot yield meaningful numbers)
 * from WARNINGS (analysis proceeds, reliability reduced). The bar for blocking
 * is deliberately high so valid recordings are never rejected unnecessarily.
 */
import type { PoseFrame, VideoInfo } from "@/types/pose";
import type { AnalysisQuality, VideoValidationResult } from "@/types/gait";
import type { PosePipelineConfig } from "./poseConfig";

/** Cheap checks that only need container metadata (run before pose extraction). */
export function validateVideoMetadata(
  info: Pick<VideoInfo, "width" | "height" | "durationSec">,
  cfg: PosePipelineConfig,
): VideoValidationResult {
  const blocking: string[] = [];
  const warnings: string[] = [];

  if (!(info.durationSec > 0))
    blocking.push("The video duration could not be determined — the file may be corrupted or unsupported.");
  else if (info.durationSec < 1)
    blocking.push("The recording is too short to contain any walking activity.");
  else if (info.durationSec < cfg.minDurationSec)
    warnings.push(
      `Recording is ${info.durationSec.toFixed(1)}s; at least ${cfg.minDurationSec}s of walking is recommended.`,
    );

  if (!(info.width > 0) || !(info.height > 0))
    blocking.push("The video frames could not be decoded by this browser. Try an MP4 (H.264) file.");
  else if (info.width < cfg.minWidth || info.height < cfg.minHeight)
    warnings.push(
      `Low resolution (${info.width}×${info.height}); landmark precision is reduced below ${cfg.minWidth}×${cfg.minHeight}.`,
    );

  return { ok: blocking.length === 0, blocking, warnings };
}

/** Full validation once pose frames and quality scores are available. */
export function validateAnalysis(
  frames: PoseFrame[],
  quality: AnalysisQuality,
  info: VideoInfo,
  cfg: PosePipelineConfig,
): VideoValidationResult {
  const blocking: string[] = [];
  const warnings: string[] = [...quality.warnings];

  const withPose = frames.filter((f) => f.landmarks != null).length;
  if (frames.length < 8)
    blocking.push("Too few frames could be sampled from this video for gait analysis.");
  if (frames.length && withPose / frames.length < 0.15)
    blocking.push("No person could be tracked in this video. Record the full body in frame and try again.");
  if (frames.length && quality.validFramePercent < 10)
    blocking.push(
      "The lower limbs were not visible often enough to measure gait. Record from the side with the legs and feet fully in frame.",
    );
  if (info.sampledFps > 0 && info.sampledFps < cfg.minSampleFps)
    warnings.push(
      `Effective sampling rate ${info.sampledFps} fps is below the recommended ${cfg.minSampleFps} fps.`,
    );

  const multi = frames.filter((f) => f.peopleDetected > 1).length;
  if (frames.length && multi / frames.length > 0.2)
    warnings.push("Multiple people were detected; only the primary (largest) subject was analysed.");

  return { ok: blocking.length === 0, blocking, warnings };
}
