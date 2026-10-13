/** Shared, pure configuration and rules for video acquisition, jobs and quality gating. */

export const VIDEO_LIMITS = {
  maxBytes: 200 * 1024 * 1024,
  minBytes: 1024,
  minDurationSec: 3,
  maxRecordSeconds: 120,
  staleHeartbeatMs: 2 * 60 * 1000,
  maxAttempts: 3,
};

export const ALLOWED_MIME = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const ALLOWED_EXT = /\.(mp4|webm|mov)$/i;
export const ACCEPT_ATTR = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

export function checkVideoFile(f: { name: string; type: string; size: number }, limits = VIDEO_LIMITS): string | null {
  const mimeOk = (ALLOWED_MIME as readonly string[]).includes(f.type.split(";")[0]);
  if (!mimeOk && !ALLOWED_EXT.test(f.name)) return "Unsupported format. Please choose an MP4, WebM or MOV video.";
  if (f.size < limits.minBytes) return "This file is empty or too small to be a valid video.";
  if (f.size > limits.maxBytes)
    return `File is too large (${(f.size / 1048576).toFixed(0)} MB). The limit is ${limits.maxBytes / 1048576} MB.`;
  return null;
}

/** Detect container type from the first bytes of a file. */
export function sniffContainer(bytes: Uint8Array): "mp4" | "quicktime" | "webm" | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  if (bytes.length >= 12) {
    const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (box === "ftyp") {
      const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      return brand === "qt  " ? "quicktime" : "mp4";
    }
    if (["moov", "mdat", "wide", "free", "skip"].includes(box)) return "quicktime";
  }
  return null;
}

export type JobStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "cancelled";

export const TERMINAL: JobStatus[] = ["completed", "completed_with_warnings", "failed", "cancelled"];

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ["uploading", "processing", "failed", "cancelled"],
  uploading: ["queued", "processing", "failed", "cancelled"],
  processing: ["completed", "completed_with_warnings", "failed", "cancelled", "processing"],
  completed: [],
  completed_with_warnings: [],
  failed: ["queued", "processing"], // retry
  cancelled: ["queued", "processing"], // retry
};

export function canTransition(from: string, to: JobStatus): boolean {
  if (from === "running") from = "processing";
  return (TRANSITIONS[from as JobStatus] ?? []).includes(to);
}

export function isStale(status: string, heartbeatAt: string | null, now = Date.now(), limits = VIDEO_LIMITS) {
  if (status !== "processing" && status !== "uploading") return false;
  if (!heartbeatAt) return true;
  return now - new Date(heartbeatAt).getTime() > limits.staleHeartbeatMs;
}

export const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  uploading: "Uploading",
  processing: "Processing",
  running: "Processing",
  completed: "Completed",
  complete: "Completed",
  completed_with_warnings: "Completed with warnings",
  failed: "Failed",
  cancelled: "Cancelled",
};

// ---------- Protocols ----------
export type ProtocolId = "straight" | "tug" | "front" | "side";
export interface Protocol {
  id: ProtocolId;
  label: string;
  mode: "normal" | "tug" | "front" | "side";
  expectedView: "front" | "side" | null;
  minDurationSec: number;
  instructions: string[];
}
export const PROTOCOLS: Protocol[] = [
  {
    id: "straight",
    label: "Straight-line walking",
    mode: "normal",
    expectedView: null,
    minDurationSec: 5,
    instructions: ["Mark a straight path (e.g. 5–10 m).", "Walk at a self-selected pace from start to end.", "Record at least 3–4 full steps per leg."],
  },
  {
    id: "tug",
    label: "Timed Up and Go (TUG)",
    mode: "tug",
    expectedView: "side",
    minDurationSec: 5,
    instructions: ["Start seated in a chair with arms.", "Stand, walk 3 m, turn, walk back, sit down.", "Keep the chair and the 3 m line in view."],
  },
  {
    id: "front",
    label: "Front-view recording",
    mode: "front",
    expectedView: "front",
    minDurationSec: 4,
    instructions: ["Place the camera at the end of the walkway.", "Walk towards the camera.", "Keep feet and head in frame the whole time."],
  },
  {
    id: "side",
    label: "Side-view recording",
    mode: "side",
    expectedView: "side",
    minDurationSec: 4,
    instructions: ["Place the camera perpendicular to the walkway.", "Walk across the frame from one side to the other.", "Keep the full body in view."],
  },
];
export const protocolById = (id: string) => PROTOCOLS.find((p) => p.id === id) ?? PROTOCOLS[0];

export interface ProtocolCheck {
  name: string;
  result: "pass" | "fail" | "not_verified";
  detail: string;
}

export function checkProtocol(
  p: Protocol,
  m: { durationSec: number | null; cameraView: string | null; bodyVisibility: number | null },
): ProtocolCheck[] {
  const out: ProtocolCheck[] = [];
  out.push(
    m.durationSec == null
      ? { name: "Minimum duration", result: "not_verified", detail: "Duration unavailable." }
      : {
          name: "Minimum duration",
          result: m.durationSec >= p.minDurationSec ? "pass" : "fail",
          detail: `${m.durationSec.toFixed(1)} s recorded; ${p.minDurationSec} s required.`,
        },
  );
  if (p.expectedView) {
    out.push(
      !m.cameraView || m.cameraView === "unknown"
        ? { name: "Camera view", result: "not_verified", detail: "View could not be estimated from landmarks." }
        : {
            name: "Camera view",
            result: m.cameraView === p.expectedView ? "pass" : "fail",
            detail: `Estimated ${m.cameraView} view; protocol expects ${p.expectedView}.`,
          },
    );
  }
  out.push(
    m.bodyVisibility == null
      ? { name: "Full body visible", result: "not_verified", detail: "Visibility unavailable." }
      : {
          name: "Full body visible",
          result: m.bodyVisibility >= 0.6 ? "pass" : "fail",
          detail: `Upper and lower body visible in ${Math.round(m.bodyVisibility * 100)}% of frames.`,
        },
  );
  out.push({ name: "Walking distance / task sequence", result: "not_verified", detail: "Not measurable from video; recorded as entered." });
  return out;
}

// ---------- Data-quality gate ----------
export const QUALITY_THRESHOLDS = {
  minDurationSec: 3,
  minFps: 15,
  warnFps: 24,
  maxUnreadableRatio: 0.3,
  maxMultiPersonRatio: 0.2,
  minPoseConfidence: 0.4,
  warnPoseConfidence: 0.6,
  minBodyVisibility: 0.4,
  warnBodyVisibility: 0.7,
  minUsableFrames: 30,
  minSubjectHeight: 0.25,
  maxEdgeCutRatio: 0.3,
  minLuminance: 0.15,
};

export interface QualityInput {
  durationSec: number;
  fps: number | null;
  totalFrames: number;
  framesWithPose: number;
  multiPersonFrames: number;
  poseConfidence: number;
  bodyVisibility: number;
  usableFrames: number;
  meanSubjectHeight: number | null; // fraction of frame height
  edgeCutRatio: number | null; // fraction of pose frames with landmarks touching the edge
  meanLuminance: number | null; // 0..1
}
export interface QualityIssue {
  code: string;
  severity: "blocking" | "warning";
  message: string;
  advice: string;
}

export function evaluateQuality(q: QualityInput, t = QUALITY_THRESHOLDS): { status: "pass" | "warn" | "fail"; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  const add = (code: string, severity: QualityIssue["severity"], message: string, advice: string) =>
    issues.push({ code, severity, message, advice });
  if (q.durationSec < t.minDurationSec)
    add("short_duration", "blocking", `Video is only ${q.durationSec.toFixed(1)} s long.`, "Record at least several walking cycles (≥ 5 s).");
  if (q.fps != null && q.fps < t.minFps)
    add("low_fps", "blocking", `Frame rate is ${q.fps.toFixed(0)} fps.`, "Use a camera setting of at least 24–30 fps.");
  else if (q.fps != null && q.fps < t.warnFps)
    add("low_fps", "warning", `Frame rate is ${q.fps.toFixed(0)} fps.`, "Use 30 fps for more precise event timing.");
  const unreadable = q.totalFrames ? 1 - q.framesWithPose / q.totalFrames : 1;
  if (unreadable > t.maxUnreadableRatio)
    add("no_person_frames", unreadable > 0.7 ? "blocking" : "warning", `No person detected in ${Math.round(unreadable * 100)}% of frames.`, "Keep the subject in view for the whole recording.");
  const multi = q.framesWithPose ? q.multiPersonFrames / q.framesWithPose : 0;
  if (multi > t.maxMultiPersonRatio)
    add("multiple_people", multi > 0.5 ? "blocking" : "warning", `More than one person visible in ${Math.round(multi * 100)}% of frames.`, "Only the subject should be in view while recording.");
  if (q.poseConfidence < t.minPoseConfidence)
    add("low_confidence", "blocking", "Pose landmarks have low confidence.", "Improve lighting and contrast between subject and background.");
  else if (q.poseConfidence < t.warnPoseConfidence)
    add("low_confidence", "warning", "Pose landmark confidence is moderate.", "Better lighting or a plainer background will help.");
  if (q.bodyVisibility < t.minBodyVisibility)
    add("obscured", "blocking", "Upper or lower body is hidden in most frames.", "Remove obstacles and keep head to feet in view.");
  else if (q.bodyVisibility < t.warnBodyVisibility)
    add("obscured", "warning", "Parts of the body are hidden in some frames.", "Keep legs and feet clearly visible.");
  if (q.meanSubjectHeight != null && q.meanSubjectHeight < t.minSubjectHeight)
    add("too_far", "warning", "Subject appears small in the frame.", "Move the camera closer so the person fills more of the frame.");
  if (q.edgeCutRatio != null && q.edgeCutRatio > t.maxEdgeCutRatio)
    add("cut_off", "warning", "Body is cut off at the frame edge in many frames.", "Step back or widen the view so head and feet stay inside the frame.");
  if (q.meanLuminance != null && q.meanLuminance < t.minLuminance)
    add("dark", "warning", "Recording is very dark.", "Add light in front of the subject.");
  if (q.usableFrames < t.minUsableFrames)
    add("few_usable_frames", "blocking", `Only ${q.usableFrames} usable frames were found.`, "Record a longer, well-lit video with the full body visible.");
  const status = issues.some((i) => i.severity === "blocking") ? "fail" : issues.length ? "warn" : "pass";
  return { status, issues };
}
