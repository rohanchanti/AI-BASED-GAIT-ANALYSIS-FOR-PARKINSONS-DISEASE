/**
 * Normalized pose data structures for MediaPipe Pose Landmarker output.
 * All coordinates stay in MediaPipe's normalized image space (0..1),
 * so any spatial measurement derived from them is a RELATIVE / pixel-space
 * estimate — never a physically calibrated distance.
 */

export const LANDMARK_NAMES = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
] as const;

export type LandmarkName = (typeof LANDMARK_NAMES)[number];

export interface PoseLandmark {
  name: LandmarkName;
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number;
}

export interface PoseFrame {
  frameNumber: number;
  /** seconds from start of video */
  timestamp: number;
  /** primary-subject landmarks, or null when no person was detected */
  landmarks: PoseLandmark[] | null;
  /** how many people MediaPipe detected in this frame */
  peopleDetected: number;
  /** set by temporal preprocessing: all gait landmarks present & trusted */
  valid?: boolean;
  /** mean visibility of the gait landmarks in this frame (0..1) */
  frameConfidence?: number;
  /** true when one or more samples in this frame were gap-interpolated */
  interpolated?: boolean;
}

export interface VideoInfo {
  width: number;
  height: number;
  durationSec: number;
  sampledFps: number;
  sampledFrames: number;
}

/** Landmarks required for sagittal-plane gait analysis. */
export const GAIT_LANDMARKS: LandmarkName[] = [
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
];

/** Landmarks tracked and drawn by the overlay. */
export const TRACKED_LANDMARKS: LandmarkName[] = [
  "nose",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  ...GAIT_LANDMARKS,
];

export const SKELETON_CONNECTIONS: [LandmarkName, LandmarkName][] = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["left_ankle", "left_heel"],
  ["left_heel", "left_foot_index"],
  ["left_ankle", "left_foot_index"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["right_ankle", "right_heel"],
  ["right_heel", "right_foot_index"],
  ["right_ankle", "right_foot_index"],
];
