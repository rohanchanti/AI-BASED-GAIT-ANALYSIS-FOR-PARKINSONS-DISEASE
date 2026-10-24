import { cloneElement as cloneEl, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { subjectInformationSchema, ACQUISITION_CONSENT_TEXT, ACQUISITION_CONSENT_VERSION } from "@/lib/subject-information";
import { saveSubjectInformation } from "@/lib/subject-information.functions";
import { supabase } from "@/integrations/supabase/client";
import { Video, FolderOpen, Circle, Square, RotateCcw, Play, X, ShieldCheck, Check, UserRound, Pause, ClipboardList } from "lucide-react";
import { ACCEPT_ATTR, checkVideoFile, PROTOCOLS, protocolById, VIDEO_LIMITS, type ProtocolId } from "@/lib/video-config";
import type { DetectedFile } from "@/components/UploadZone";

export type SubjectInfo = {
  subjectName: string;
  subjectId: string;
  age: string;
  sex: string;
  condition: string;
  notes: string;
};

export const subjectSchema = subjectInformationSchema;

const FIELD_ORDER: (keyof SubjectInfo)[] = ["subjectName", "subjectId", "age", "sex", "condition", "notes"];

export interface RecordingMeta {
  subjectRecordId?: string;
  consentId?: string;
  protocol: ProtocolId;
  trialNumber: number;
  walkingDistanceM: number | null;
  deviations: string;
  source: "live" | "upload";
}

interface Props {
  /** Pre-filled subject/protocol from an existing visit; fields stay editable but are shown as linked. */
  initial?: { subject: SubjectInfo; protocol?: ProtocolId; label?: string };
  visitId?: string;
  onAnalyze: (d: DetectedFile, subject: SubjectInfo, meta: RecordingMeta) => void;
  busy?: boolean;
}

const DRAFT_KEY = "ns-gait-draft";

const ACCEPT = ACCEPT_ATTR;
const MAX_SECONDS = VIDEO_LIMITS.maxRecordSeconds;
const UNSUPPORTED_MSG = "Live camera recording is not supported by this browser. Please upload a video instead.";
const DENIED_MSG = "Camera access was denied. Please allow camera permission in your browser settings.";
const NO_RECORDER_MSG = "Video recording is not supported by this browser. Please upload a video instead.";

const GUIDELINES = [
  "Place the camera at approximately waist/hip height.",
  "Keep the full body visible.",
  "Ensure the walking path is visible.",
  "Use adequate lighting.",
  "Keep the camera stable.",
  "Walk at a natural/self-selected pace.",
  "Record from the selected viewing direction.",
];

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary";

export function GaitVideoInput({ onAnalyze, busy, initial, visitId }: Props) {
  const saveSubject = useServerFn(saveSubjectInformation);
  const submittingRef = useRef(false);
  const savedSubjectRef = useRef<{ id: string; subject: string; consentId?: string } | null>(null);
  const [consentGranted, setConsentGranted] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<ProtocolId>("straight");
  const [trial, setTrial] = useState("1");
  const [distance, setDistance] = useState("");
  const [deviations, setDeviations] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [paused, setPaused] = useState(false);
  const [insecure, setInsecure] = useState(false);
  const [mode, setMode] = useState<"live" | "upload">("live");
  const [video, setVideo] = useState<{ file: File; url: string; duration?: number } | null>(null);
  const [videoValid, setVideoValid] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubjectState] = useState<SubjectInfo>({ subjectName: "", subjectId: "", age: "", sex: "", condition: "", notes: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SubjectInfo, string>>>({});
  const fieldRefs = useRef<Partial<Record<keyof SubjectInfo, HTMLElement | null>>>({});
  const draftLoaded = useRef(false);
  useEffect(() => {
    if (!busy) setSubmitted(false);
  }, [busy]);
  useEffect(() => {
    setInsecure(!window.isSecureContext);
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
      if (d?.subject) setSubjectState({ ...d.subject });
      if (d?.protocol) setProtocol(d.protocol);
      if (d?.trial) setTrial(String(d.trial));
      if (d?.distance != null) setDistance(String(d.distance));
      if (d?.deviations) setDeviations(d.deviations);
    } catch { /* ignore */ }
    draftLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!initial) return;
    setSubjectState({ ...initial.subject });
    if (initial.protocol) setProtocol(initial.protocol);
  }, []);
  useEffect(() => {
    if (!draftLoaded.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ subject, protocol, trial, distance, deviations }));
    } catch { /* ignore */ }
  }, [subject, protocol, trial, distance, deviations]);
  const setSubject = (next: SubjectInfo) => {
    setFieldErrors((errs) => {
      const copy = { ...errs };
      for (const k of FIELD_ORDER) if (next[k] !== subject[k]) delete copy[k];
      return copy;
    });
    setSubjectState(next);
  };

  // existing-subject picker (owner-scoped by row security)
  type SubjectRow = { id: string; subject_code: string; display_name: string | null; age: number | null; sex: string | null };
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<SubjectRow[]>([]);
  const [selected, setSelected] = useState<SubjectRow | null>(null);
  useEffect(() => {
    const q = search.trim();
    if (!q || selected) { setMatches([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const safe = q.replace(/[%_,()]/g, "");
      const { data } = await supabase.from("subjects").select("id, subject_code, display_name, age, sex")
        .or(`subject_code.ilike.%${safe}%,display_name.ilike.%${safe}%`).order("subject_code").limit(10);
      if (!cancelled) setMatches((data ?? []) as SubjectRow[]);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, selected]);
  const pickSubject = (m: SubjectRow) => {
    setSelected(m);
    setSearch("");
    savedSubjectRef.current = null;
    setSubject({ ...subject, subjectName: m.display_name ?? "", subjectId: m.subject_code, age: m.age != null ? String(m.age) : "", sex: m.sex ?? "" });
  };
  const clearSelected = () => {
    setSelected(null);
    savedSubjectRef.current = null;
    setSubject({ ...subject, subjectName: "", subjectId: "", age: "", sex: "" });
  };

  // live state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [hasMultipleCams, setHasMultipleCams] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const liveRef = useRef<HTMLVideoElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  function clearVideo() {
    setVideo((v) => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
    setVideoValid(false);
    setConfirmed(false);
  }
  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (liveRef.current) liveRef.current.srcObject = null;
    setStream(null);
  }

  async function startCamera(face?: "user" | "environment", devId?: string) {
    if (!face) {
      // Prefer the rear camera on phones/tablets (better for filming another person walking).
      face = window.matchMedia?.("(pointer: coarse)").matches ? "environment" : "user";
      setFacing(face);
    }
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setUnsupported(true);
      setError(UNSUPPORTED_MSG);
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setUnsupported(true);
      setError(NO_RECORDER_MSG);
      return;
    }
    stopCamera();
    setRequesting(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: devId
          ? { deviceId: { exact: devId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: face }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = s;
      setStream(s);
      try {
        const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        setDevices(all);
        setHasMultipleCams(all.length > 1);
        setDeviceId(s.getVideoTracks()[0]?.getSettings().deviceId ?? "");
      } catch {
        /* ignore */
      }
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(
        name === "NotFoundError" || name === "OverconstrainedError"
          ? "No camera was detected on this device."
          : name === "NotReadableError"
            ? "The camera is in use by another app or could not be started."
            : name === "SecurityError" || !window.isSecureContext
              ? "Camera access requires a secure (HTTPS) connection."
              : DENIED_MSG,
      );
    } finally {
      setRequesting(false);
    }
  }

  function switchCamera() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    void startCamera(next);
  }

  function selectMode(m: "live" | "upload") {
    if (m === mode) return;
    if (recording) stopRecording();
    clearVideo();
    setError(null);
    stopCamera();
    setMode(m);
    // Camera turns on only after an explicit click on "Open Camera".
  }

  useEffect(() => {
    if (liveRef.current) liveRef.current.srcObject = stream;
  }, [stream, video]);

  useEffect(() => {
    if (!recording || paused) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording, paused]);

  useEffect(() => {
    if (recording && elapsed >= MAX_SECONDS) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, recording]);

  useEffect(() => {
    if (!video && !recording) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [video, recording]);

  // Release camera when leaving the component.
  useEffect(
    () => () => {
      if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function startRecording() {
    if (!stream || typeof MediaRecorder === "undefined") {
      setError(NO_RECORDER_MSG);
      return;
    }
    const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    } catch {
      setError(UNSUPPORTED_MSG);
      return;
    }
    chunks.current = [];
    setError(null);
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      setPaused(false);
      stopCamera();
      const mime = (rec.mimeType || "video/webm").split(";")[0];
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const file = new File(chunks.current, `live-recording-${Date.now()}.${ext}`, { type: mime });
      if (!file.size || chunks.current.length === 0) {
        setError("Recording failed — no video data was captured. Please record again.");
        return;
      }
      setVideo({ file, url: URL.createObjectURL(file) });
      setVideoValid(false);
      setConfirmed(false);
    };
    recRef.current = rec;
    setElapsed(0);
    rec.start(250);
    setRecording(true);
  }

  function togglePause() {
    const r = recRef.current;
    if (!r || typeof r.pause !== "function") return;
    if (r.state === "recording") { r.pause(); setPaused(true); }
    else if (r.state === "paused") { r.resume(); setPaused(false); }
  }

  function stopRecording() {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setRecording(false);
  }

  function retake() {
    clearVideo();
    setElapsed(0);
    void startCamera(facing, deviceId || undefined);
  }

  function confirmVideo() {
    if (!video || !video.file.size || !videoValid) {
      setError("This recording is empty or could not be read. Please record again.");
      return;
    }
    if (elapsed < 1 && !(video.duration && video.duration >= 1)) {
      setError("The recording is too short. Please record at least a few walking steps.");
      return;
    }
    setError(null);
    setConfirmed(true);
  }

  function onPreviewMeta(el: HTMLVideoElement) {
    const d = el.duration;
    if (Number.isFinite(d) && d > 0) setVideo((v) => (v ? { ...v, duration: d } : v));
    setVideoValid(true);
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    const bad = checkVideoFile(f);
    if (bad) {
      setError(bad);
      return;
    }
    setError(null);
    clearVideo();
    setVideo({ file: f, url: URL.createObjectURL(f) });
  }

  async function analyze() {
    if (!video || submitted || busy || submittingRef.current) return;
    if (!consentGranted) { setConsentError("Consent is required before analysis."); return; }
    const parsed = subjectSchema.safeParse(subject);
    if (!parsed.success) {
      const errs: Partial<Record<keyof SubjectInfo, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof SubjectInfo;
        if (!errs[k]) errs[k] = issue.message;
      }
      setFieldErrors(errs);
      const first = FIELD_ORDER.find((k) => errs[k]);
      if (first) fieldRefs.current[first]?.focus();
      toast.error("Please correct the subject information.");
      return;
    }
    const t = Number(trial);
    const dist = distance.trim() ? Number(distance) : null;
    if (!Number.isInteger(t) || t < 1 || t > 50) { setError("Trial number must be a whole number from 1 to 50."); return; }
    if (dist != null && (!Number.isFinite(dist) || dist <= 0 || dist > 100)) { setError("Walking distance must be between 0 and 100 m, or left empty."); return; }
    if (video.duration != null && video.duration < VIDEO_LIMITS.minDurationSec) { setError(`The video is shorter than ${VIDEO_LIMITS.minDurationSec} seconds. Record several walking cycles.`); return; }
    setSubmitted(true);
    submittingRef.current = true;
    let subjectRecordId: string;
    let consentId: string;
    try {
      const fingerprint = JSON.stringify(parsed.data);
      const previous = savedSubjectRef.current;
      if (previous?.subject === fingerprint && previous.consentId) {
        subjectRecordId = previous.id;
        consentId = previous.consentId;
      }
      else {
        const saved = await saveSubject({ data: {
          subject: parsed.data, visitId,
          subjectRecordId: selected && !visitId ? selected.id : previous?.subject === fingerprint ? previous.id : undefined,
          consent: { granted: true, version: ACQUISITION_CONSENT_VERSION },
        } });
        if (!saved.success) {
          if ("subjectRecordId" in saved && saved.subjectRecordId) savedSubjectRef.current = { id: saved.subjectRecordId, subject: fingerprint };
          if (saved.field) {
            setFieldErrors({ [saved.field]: saved.message });
            fieldRefs.current[saved.field]?.focus();
          } else setError(saved.message);
          toast.error(saved.message);
          setSubmitted(false);
          return;
        }
        subjectRecordId = saved.subjectRecordId;
        consentId = saved.consentId;
        savedSubjectRef.current = { id: subjectRecordId, subject: fingerprint, consentId };
        toast.success("Subject information and consent saved.");
      }
    } catch {
      const message = "Subject information could not be saved. Please sign in and try again.";
      setError(message);
      toast.error(message);
      setSubmitted(false);
      return;
    } finally { submittingRef.current = false; }
    stopCamera();
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    onAnalyze({ file: video.file, kind: "gait", previewUrl: video.url }, parsed.data as SubjectInfo, {
      subjectRecordId, consentId, protocol, trialNumber: t, walkingDistanceM: dist, deviations, source: mode,
    });
  }

  function field(key: keyof SubjectInfo, label: string, span: string, control: React.ReactElement<any>) {
    const err = fieldErrors[key];
    const id = `subject-${key}`;
    return (
      <div className={`block ${span}`}>
        <label htmlFor={id} className="text-xs text-muted-foreground">
          {label} {key !== "notes" && <span className="text-destructive">*</span>}
        </label>
        {cloneEl(control, {
          id,
          required: key !== "notes",
          "aria-required": key !== "notes",
          "aria-invalid": !!err,
          "aria-describedby": err ? `${id}-err` : undefined,
          ref: (el: HTMLElement | null) => {
            fieldRefs.current[key] = el;
          },
          className: `${inputCls} ${err ? "border-destructive" : ""}`,
        })}
        {err && <p id={`${id}-err`} className="mt-1 text-xs text-destructive">{err}</p>}
      </div>
    );
  }

  const tab = (active: boolean) =>
    `flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
      active ? "bg-primary text-primary-foreground glow-primary" : "border border-border/60 text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="mb-6 rounded-3xl gradient-border glass p-5 sm:p-8">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan">Movement / gait input</div>
      <h3 className="mt-1 font-display text-2xl font-semibold">Record live or upload a walking video</h3>

      <div className="mt-5 flex flex-col sm:flex-row gap-3" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "live"} className={tab(mode === "live")} onClick={() => selectMode("live")}>
          <Video className="h-4 w-4" /> 📷 Record Live Video
        </button>
        <button type="button" role="tab" aria-selected={mode === "upload"} className={tab(mode === "upload")} onClick={() => selectMode("upload")}>
          <FolderOpen className="h-4 w-4" /> 📁 Upload Existing Video
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          {mode === "live" ? (
            <>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {video ? "Recorded Video" : "Live Camera Recording"}
              </div>
              <div className="text-xs text-muted-foreground">
                Status:{" "}
                <span className="text-foreground">
                  {recording ? (paused ? "Paused" : "Recording") : video ? "Recording finished — review below" : requesting ? "Requesting permission…" : stream ? "Camera ready" : "Camera off"}
                </span>
              </div>
              {insecure && (
                <div className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">
                  Camera access needs a secure (HTTPS) page and your permission. Open the app over https:// to record.
                </div>
              )}
              {!video && stream && devices.length > 1 && !recording && (
                <label className="block text-xs text-muted-foreground">
                  Camera
                  <select className={inputCls} value={deviceId} onChange={(e) => { setDeviceId(e.target.value); void startCamera(facing, e.target.value); }}>
                    {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
                  </select>
                </label>
              )}
              {!video && (
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/60 aspect-video">
                  {stream ? (
                    <video ref={liveRef} autoPlay muted playsInline className="h-full w-full object-contain" />
                  ) : (
                    <div className="grid h-full place-items-center p-4 text-center text-sm text-muted-foreground">
                      {requesting ? (
                        <div className="animate-pulse">Requesting camera permission…</div>
                      ) : unsupported ? (
                        <div>{UNSUPPORTED_MSG}</div>
                      ) : (
                        <div>
                          Camera is off. It only starts when you click Open Camera.
                          <button type="button" onClick={() => void startCamera()} className="mt-3 flex mx-auto items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground glow-primary">
                            <Video className="h-4 w-4" /> Open Camera
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {stream && (
                    <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-lg bg-background/80 px-2.5 py-1 text-xs font-mono">
                      <span className={`h-2 w-2 rounded-full ${recording ? "bg-destructive animate-pulse" : "bg-muted-foreground"}`} />
                      {recording ? (paused ? "⏸ Paused" : "🔴 Recording") : "Camera ready"} {fmt(elapsed)} / {fmt(MAX_SECONDS)}
                    </div>
                  )}
                  {stream && !recording && hasMultipleCams && (
                    <button type="button" onClick={switchCamera} className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg bg-background/80 px-2.5 py-1 text-xs hover:text-primary">
                      <RotateCcw className="h-3 w-3" /> Switch Camera
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!video && !recording && stream && (
                  <button type="button" onClick={startRecording} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary">
                    <Circle className="h-4 w-4" /> Start Recording
                  </button>
                )}
                {recording && typeof MediaRecorder !== "undefined" && typeof MediaRecorder.prototype.pause === "function" && (
                  <button type="button" onClick={togglePause} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:border-primary">
                    {paused ? <><Circle className="h-4 w-4" /> Resume</> : <><Pause className="h-4 w-4" /> Pause</>}
                  </button>
                )}
                {recording && (
                  <button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground">
                    <Square className="h-4 w-4" /> Stop Recording
                  </button>
                )}
                {video && (
                  <>
                    <button type="button" onClick={retake} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:border-primary">
                      <RotateCcw className="h-4 w-4" /> Record Again
                    </button>
                    <button type="button" disabled={confirmed || !videoValid} onClick={confirmVideo} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-60">
                      <Check className="h-4 w-4" /> {confirmed ? "Video selected" : "Use This Video"}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            !video && (
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  pickFile(e.dataTransfer.files?.[0]);
                }}
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center hover:border-primary transition"
              >
                <FolderOpen className="h-8 w-8 text-cyan" />
                <span className="mt-3 text-sm font-medium">Choose or drop a walking video</span>
                <span className="mt-1 text-xs text-muted-foreground">MP4, WebM or MOV · up to {VIDEO_LIMITS.maxBytes / 1048576} MB</span>
                <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            )
          )}

          {video && (
            <div className="space-y-3">
              <video src={video.url} controls playsInline onLoadedMetadata={(e) => onPreviewMeta(e.currentTarget)} onError={() => { setVideoValid(false); setError("This video could not be read by your browser. It may be empty, corrupted or in an unsupported format — please record again or choose an MP4/WebM file."); }} className="w-full rounded-2xl border border-border/60 bg-background/60 aspect-video object-contain" />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{video.file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(video.file.size / 1024 / 1024).toFixed(2)} MB · {video.file.type || "video"}
                    {` · ${fmt(video.duration ? Math.round(video.duration) : elapsed)}`}
                  </div>
                </div>
                {mode === "upload" && (
                  <div className="flex gap-2">
                    <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary">
                      Replace
                      <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                    </label>
                    <button type="button" onClick={clearVideo} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-destructive">
                      <X className="h-3 w-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

          <fieldset className="rounded-2xl border border-border/60 p-4">
            <legend className="flex items-center gap-2 px-1 text-sm font-medium">
              <ClipboardList className="h-4 w-4 text-cyan" /> Recording Protocol
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block text-xs text-muted-foreground sm:col-span-3">
                Protocol
                <select className={inputCls} value={protocol} onChange={(e) => setProtocol(e.target.value as ProtocolId)}>
                  {PROTOCOLS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <ul className="sm:col-span-3 space-y-1 text-xs text-muted-foreground">
                {protocolById(protocol).instructions.map((i) => <li key={i} className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-cyan" />{i}</li>)}
                <li className="text-[11px]">Expected camera angle: {protocolById(protocol).expectedView ?? "any (front or side)"} · minimum {protocolById(protocol).minDurationSec} s</li>
              </ul>
              <label className="block text-xs text-muted-foreground">
                Trial number
                <input type="text" inputMode="numeric" className={inputCls} value={trial} onChange={(e) => setTrial(e.target.value.replace(/\D/g, "").slice(0, 2))} />
              </label>
              <label className="block text-xs text-muted-foreground sm:col-span-2">
                Walking distance (m, if known)
                <input type="text" inputMode="decimal" className={inputCls} value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^\d.]/g, "").slice(0, 6))} placeholder="e.g. 6" />
              </label>
              <label className="block text-xs text-muted-foreground sm:col-span-3">
                Protocol deviations (optional)
                <input type="text" className={inputCls} value={deviations} maxLength={1000} onChange={(e) => setDeviations(e.target.value)} placeholder="e.g. used walking aid, stopped once" />
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-border/60 p-4">
            <legend className="flex items-center gap-2 px-1 text-sm font-medium">
              <UserRound className="h-4 w-4 text-cyan" /> Subject Information <span className="text-destructive">*</span>
            </legend>
            {!visitId && (
              <div className="mb-3 relative">
                {selected ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                    <span>Existing subject selected: <strong>{selected.subject_code}</strong>{selected.display_name ? ` — ${selected.display_name}` : ""}. A new visit will be created for this subject.</span>
                    <button type="button" className="text-xs underline text-muted-foreground hover:text-foreground" onClick={clearSelected}>Use a new subject instead</button>
                  </div>
                ) : (
                  <label className="block text-xs text-muted-foreground">Find an existing subject (optional)
                    <input type="search" className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by participant ID or name" aria-label="Find an existing subject" />
                  </label>
                )}
                {!selected && search.trim().length > 0 && (
                  <ul role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover text-sm shadow-lg">
                    {matches.length === 0 ? <li className="px-3 py-2 text-muted-foreground">No matching subjects.</li> : matches.map((m) => (
                      <li key={m.id}>
                        <button type="button" role="option" aria-selected={false} className="w-full px-3 py-2 text-left hover:bg-accent" onClick={() => pickSubject(m)}>
                          <span className="font-medium">{m.subject_code}</span>{m.display_name ? ` — ${m.display_name}` : ""}<span className="text-muted-foreground">{m.age != null ? ` · ${m.age} y` : ""}{m.sex ? ` · ${m.sex}` : ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {field("subjectName", "Subject Name", "", <input type="text" className={inputCls} value={subject.subjectName} readOnly={!!selected} onChange={(e) => setSubject({ ...subject, subjectName: e.target.value })} placeholder="e.g. John Doe" maxLength={100} />)}
              {field("subjectId", "Participant ID", "", <input type="text" className={inputCls} value={subject.subjectId} readOnly={!!selected} onChange={(e) => setSubject({ ...subject, subjectId: e.target.value })} placeholder="e.g. S-014" maxLength={50} />)}
              {field("age", "Age", "", <input type="text" inputMode="numeric" className={inputCls} value={subject.age} onChange={(e) => setSubject({ ...subject, age: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="18–110" />)}
              {field("sex", "Sex", "sm:col-span-3", (
                <select className={inputCls} value={subject.sex} onChange={(e) => setSubject({ ...subject, sex: e.target.value })}>
                  <option value="" disabled>Select…</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option>
                </select>
              ))}
              {field("condition", "Recording Condition", "sm:col-span-3", <input type="text" className={inputCls} value={subject.condition} onChange={(e) => setSubject({ ...subject, condition: e.target.value })} placeholder="e.g. indoor corridor, self-selected walking pace" maxLength={200} />)}
              {field("notes", "Notes (optional)", "sm:col-span-3", <textarea rows={2} className={inputCls} value={subject.notes} onChange={(e) => setSubject({ ...subject, notes: e.target.value })} placeholder="Enter relevant observations or recording notes" maxLength={1000} />)}
            </div>
          </fieldset>

          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/30 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-cyan" />
            Only upload or record subjects with appropriate consent. Video data should be handled according to your institutional and research requirements.
          </div>

          <div className="text-xs text-muted-foreground">
            <label className="flex items-start gap-2" htmlFor="subject-consent">
              <input id="subject-consent" type="checkbox" required checked={consentGranted} aria-invalid={!!consentError} aria-describedby="subject-consent-version" onChange={(e) => { setConsentGranted(e.target.checked); setConsentError(null); }} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
              <span>{ACQUISITION_CONSENT_TEXT} <span className="text-destructive">*</span></span>
            </label>
            <p id="subject-consent-version" className="mt-1">Consent version: {ACQUISITION_CONSENT_VERSION}</p>
            {consentError && <p className="mt-1 text-destructive">{consentError}</p>}
          </div>

          <button type="button" disabled={!consentGranted || !video || recording || !videoValid || (mode === "live" && !confirmed) || submitted || busy} onClick={analyze} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground glow-primary hover:brightness-110 disabled:opacity-50">
            <Play className="h-4 w-4" /> {mode === "live" ? "Analyze Recording" : "Analyze Video"}
          </button>
        </div>

        <aside className="rounded-2xl border border-border/60 p-4 h-fit">
          <div className="text-sm font-medium">For reliable gait analysis</div>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            {GUIDELINES.map((g) => (
              <li key={g} className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-cyan" />{g}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
