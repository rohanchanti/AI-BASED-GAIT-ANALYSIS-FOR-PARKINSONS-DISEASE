/**
 * Centralized configuration for the pose / gait analysis pipeline.
 *
 * Every threshold used by pose preprocessing, gait-event detection, quality
 * scoring and video validation lives here — no scattered magic numbers.
 * Values are engineering defaults for a browser MediaPipe pipeline; they are
 * NOT clinically validated cut-offs.
 */

export interface PosePipelineConfig {
  /** minimum MediaPipe landmark visibility for a coordinate to be trusted */
  minLandmarkConfidence: number;
  /** odd window length (frames) for temporal smoothing */
  smoothingWindow: number;
  /** polynomial order for the Savitzky-Golay filter (2 = quadratic) */
  smoothingPolyOrder: number;
  /**
   * maximum plausible landmark displacement in normalized image units per
   * second. Anything faster is treated as a tracking jump, not real motion.
   */
  maxLandmarkDisplacementPerSec: number;
  /** longest run of missing samples that may be linearly interpolated */
  maxInterpolationGapFrames: number;
  /** minimum share (%) of sampled frames that must be usable */
  minValidFramePercent: number;
  /** minimum number of complete gait cycles for stable aggregation */
  minGaitCycles: number;
  /** minimum walking-video duration (s) for cycle-based metrics */
  minDurationSec: number;
  /** minimum decoded video resolution */
  minWidth: number;
  minHeight: number;
  /** minimum effective sampling rate (frames/s) */
  minSampleFps: number;
  /** seconds between two successive events of the same side */
  eventMinSeparationSec: number;
  /** peak prominence as a fraction of the signal standard deviation */
  eventProminenceFactor: number;
  /** normalized jitter above which the camera is considered unstable */
  maxCameraJitter: number;
  /** weights for the overall analysis-quality composite (must sum to 1) */
  qualityWeights: {
    poseConfidence: number;
    validFrames: number;
    continuity: number;
    bodyVisibility: number;
    cycleSufficiency: number;
    videoStability: number;
  };
}

export const DEFAULT_POSE_CONFIG: PosePipelineConfig = {
  minLandmarkConfidence: 0.5,
  smoothingWindow: 5,
  smoothingPolyOrder: 2,
  maxLandmarkDisplacementPerSec: 2.5,
  maxInterpolationGapFrames: 4,
  minValidFramePercent: 50,
  minGaitCycles: 2,
  minDurationSec: 3,
  minWidth: 240,
  minHeight: 180,
  minSampleFps: 10,
  eventMinSeparationSec: 0.28,
  eventProminenceFactor: 0.35,
  maxCameraJitter: 0.02,
  qualityWeights: {
    poseConfidence: 0.2,
    validFrames: 0.25,
    continuity: 0.15,
    bodyVisibility: 0.15,
    cycleSufficiency: 0.15,
    videoStability: 0.1,
  },
};

export function resolvePoseConfig(
  partial?: Partial<PosePipelineConfig>,
): PosePipelineConfig {
  if (!partial) return DEFAULT_POSE_CONFIG;
  return {
    ...DEFAULT_POSE_CONFIG,
    ...partial,
    qualityWeights: {
      ...DEFAULT_POSE_CONFIG.qualityWeights,
      ...(partial.qualityWeights ?? {}),
    },
  };
}
