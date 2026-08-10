import type { PoseFrame, VideoInfo } from "./pose";

export type CameraView = "side" | "front" | "rear" | "unknown";

export type JointKey =
  | "leftKnee"
  | "rightKnee"
  | "leftHip"
  | "rightHip"
  | "leftAnkle"
  | "rightAnkle";

export const JOINT_KEYS: JointKey[] = [
  "leftKnee",
  "rightKnee",
  "leftHip",
  "rightHip",
  "leftAnkle",
  "rightAnkle",
];

export const JOINT_LABEL: Record<JointKey, string> = {
  leftKnee: "Left Knee",
  rightKnee: "Right Knee",
  leftHip: "Left Hip",
  rightHip: "Right Hip",
  leftAnkle: "Left Ankle",
  rightAnkle: "Right Ankle",
};

/** One timestamped set of joint angles. `null` = not reliably measurable. */
export interface JointAngleSample {
  frameNumber: number;
  timestamp: number;
  leftKnee: number | null;
  rightKnee: number | null;
  leftHip: number | null;
  rightHip: number | null;
  leftAnkle: number | null;
  rightAnkle: number | null;
}

export type GaitEventType = "heel_strike" | "toe_off";

export interface GaitEvent {
  timestamp: number;
  frameNumber: number;
  side: "left" | "right";
  type: GaitEventType;
  /** mean landmark visibility of the foot at the event frame (0..1) */
  confidence: number;
}

export interface JointStats {
  min: number;
  max: number;
  mean: number;
  rom: number;
  sampleCount: number;
}

export interface SymmetryEntry {
  label: string;
  left: number | null;
  right: number | null;
  /** |L-R| */
  difference: number | null;
  /** symmetry index 0..100, see SYMMETRY_FORMULA */
  index: number | null;
  unit: string;
}

export interface PoseGaitMetrics {
  stepCount: number;
  /** steps per minute, null when too few events */
  cadence: number | null;
  meanStepTime: number | null;
  gaitCycleDuration: number | null;
  leftStepTime: number | null;
  rightStepTime: number | null;
  leftCycleDuration: number | null;
  rightCycleDuration: number | null;
  joints: Record<JointKey, JointStats | null>;
  symmetry: SymmetryEntry[];
  /** overall left-right symmetry index 0..100 */
  overallSymmetryIndex: number | null;
  /** % of sampled frames with all required gait landmarks above threshold */
  poseQuality: number;
  usableFrames: number;
  missingFrames: number;
  framesWithoutPerson: number;
  framesWithMultiplePeople: number;
  confidenceThreshold: number;
  analysisDurationSec: number;
  cameraView: CameraView;
  warnings: string[];
  /** relative (pixel-space) spatial estimates — NOT metres */
  relativeStepLength: number | null;
  relativeWalkingSpeed: number | null;
}

export interface PoseAnalysis {
  method: "mediapipe-pose";
  generatedAt: string;
  video: VideoInfo;
  metrics: PoseGaitMetrics;
  angles: JointAngleSample[];
  events: GaitEvent[];
}

/** Full result incl. raw landmarks — kept in memory only (export use). */
export interface PoseAnalysisFull extends PoseAnalysis {
  frames: PoseFrame[];
}

export const SYMMETRY_FORMULA =
  "Symmetry index = 100 × (1 − |L − R| / ((L + R) / 2)), clamped to 0–100. 100 = identical left/right values.";

export const POSE_QUALITY_FORMULA =
  "Pose detection quality = usable sampled frames ÷ total sampled frames × 100. A frame is usable when a single primary subject is detected and all 10 required gait landmarks (hips, knees, ankles, heels, foot indices) report visibility ≥ the configured confidence threshold.";

export function symmetryIndex(left: number | null, right: number | null): number | null {
  if (left == null || right == null) return null;
  const mean = (left + right) / 2;
  if (!isFinite(mean) || Math.abs(mean) < 1e-6) return null;
  const v = 100 * (1 - Math.abs(left - right) / Math.abs(mean));
  return Math.max(0, Math.min(100, v));
}
