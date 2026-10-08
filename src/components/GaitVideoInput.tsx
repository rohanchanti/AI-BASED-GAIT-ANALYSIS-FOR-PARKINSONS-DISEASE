import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Video, FolderOpen, Circle, Square, RotateCcw, Play, X, ShieldCheck, Check, UserRound } from "lucide-react";
import type { DetectedFile } from "@/components/UploadZone";

export type SubjectInfo = {
  subjectName: string;
  subjectId: string;
  age: string;
  sex: string;
  condition: string;
  notes: string;
};

const req = "This field is required.";
export const subjectSchema = z.object({
  subjectName: z.string().trim().min(1, req).max(100, "Must be under 100 characters."),
  subjectId: z.string().trim().min(1, req).max(50, "Must be under 50 characters."),
  age: z
    .string()
    .trim()
    .min(1, req)
    .regex(/^\d{1,3}$/, "Enter a whole number between 1 and 120.")
    .refine((v) => Number(v) >= 1 && Number(v) <= 120, "Enter a whole number between 1 and 120."),
  sex: z.enum(["Male", "Female", "Other", "Prefer not to say"], { message: req }),
  condition: z.string().trim().min(1, req).max(200, "Must be under 200 characters."),
  notes: z.string().trim().min(1, req).max(1000, "Must be under 1000 characters."),
});

const FIELD_ORDER: (keyof SubjectInfo)[] = ["subjectName", "subjectId", "age", "sex", "condition", "notes"];

interface Props {
  onAnalyze: (d: DetectedFile, subject: SubjectInfo) => void;
}

const ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";
const isVideo = (f: File) => /^video\/(mp4|webm|quicktime)$/.test(f.type) || /\.(mp4|webm|mov)$/i.test(f.name);

const GUIDELINES = [
  "Keep the full body visible.",
  "Use adequate lighting.",
  "Keep the camera stable.",
  "Avoid objects blocking the subject.",
  "Record multiple walking cycles.",
  "Keep the walking path visible.",
];

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary";

export function GaitVideoInput({ onAnalyze }: Props) {
  const [mode, setMode] = useState<"live" | "upload">("upload");
  const [video, setVideo] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubjectState] = useState<SubjectInfo>({ subjectName: "", subjectId: "", age: "", sex: "", condition: "", notes: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SubjectInfo, string>>>({});
  const fieldRefs = useRef<Partial<Record<keyof SubjectInfo, HTMLElement | null>>>({});
  const setSubject = (next: SubjectInfo) => {
    setFieldErrors((errs) => {
      const copy = { ...errs };
      for (const k of FIELD_ORDER) if (next[k] !== subject[k]) delete copy[k];
      return copy;
    });
    setSubjectState(next);
  };

  // live state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const liveRef = useRef<HTMLVideoElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  function clearVideo() {
    setVideo((v) => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
  }
  function stopCamera() {
    setStream((s) => {
      s?.getTracks().forEach((t) => t.stop());
      return null;
    });
  }

  async function startCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not supported in this browser.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      setStream(s);
    } catch {
      setError("Camera permission was denied or no camera is available.");
    }
  }

  function selectMode(m: "live" | "upload") {
    if (m === mode) return;
    clearVideo();
    setError(null);
    if (m === "upload") stopCamera();
    setMode(m);
    if (m === "live") void startCamera();
  }

  useEffect(() => {
    if (liveRef.current) liveRef.current.srcObject = stream;
  }, [stream, video]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  function startRecording() {
    if (!stream || typeof MediaRecorder === "undefined") {
      setError("Recording is not supported in this browser.");
      return;
    }
    const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      const mime = (rec.mimeType || "video/webm").split(";")[0];
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const file = new File(chunks.current, `live-recording-${Date.now()}.${ext}`, { type: mime });
      setVideo({ file, url: URL.createObjectURL(file) });
    };
    recRef.current = rec;
    setElapsed(0);
    rec.start(250);
    setRecording(true);
  }

  function stopRecording() {
    recRef.current?.stop();
    setRecording(false);
  }

  function retake() {
    clearVideo();
    setElapsed(0);
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!isVideo(f)) {
      setError("Unsupported format. Please choose an MP4, WebM or MOV video.");
      return;
    }
    setError(null);
    clearVideo();
    setVideo({ file: f, url: URL.createObjectURL(f) });
  }

  function analyze() {
    if (!video) return;
    stopCamera();
    onAnalyze({ file: video.file, kind: "gait", previewUrl: video.url }, subject);
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
          <Video className="h-4 w-4" /> Live Recording
        </button>
        <button type="button" role="tab" aria-selected={mode === "upload"} className={tab(mode === "upload")} onClick={() => selectMode("upload")}>
          <FolderOpen className="h-4 w-4" /> Upload Video
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          {mode === "live" ? (
            <>
              {!video && (
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/60 aspect-video">
                  {stream ? (
                    <video ref={liveRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center p-4 text-center text-sm text-muted-foreground">
                      <div>
                        Camera preview unavailable.
                        <button type="button" onClick={startCamera} className="mt-3 block mx-auto rounded-lg border border-border px-4 py-2 text-foreground hover:border-primary">
                          Enable camera
                        </button>
                      </div>
                    </div>
                  )}
                  {stream && (
                    <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-lg bg-background/80 px-2.5 py-1 text-xs font-mono">
                      <span className={`h-2 w-2 rounded-full ${recording ? "bg-destructive animate-pulse" : "bg-muted-foreground"}`} />
                      {recording ? "REC" : "LIVE"} {fmt(elapsed)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!video && !recording && (
                  <button type="button" disabled={!stream} onClick={startRecording} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-50">
                    <Circle className="h-4 w-4" /> Start Recording
                  </button>
                )}
                {recording && (
                  <button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground">
                    <Square className="h-4 w-4" /> Stop Recording
                  </button>
                )}
                {video && (
                  <button type="button" onClick={retake} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:border-primary">
                    <RotateCcw className="h-4 w-4" /> Retake
                  </button>
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
                <span className="mt-1 text-xs text-muted-foreground">MP4, WebM or MOV</span>
                <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            )
          )}

          {video && (
            <div className="space-y-3">
              <video src={video.url} controls playsInline className="w-full rounded-2xl border border-border/60 bg-background/60 aspect-video" />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{video.file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(video.file.size / 1024 / 1024).toFixed(2)} MB · {video.file.type || "video"}
                    {mode === "live" && ` · ${fmt(elapsed)}`}
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
              <UserRound className="h-4 w-4 text-cyan" /> Subject Information <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block"><span className="text-xs text-muted-foreground">Subject ID</span>
                <input className={inputCls} value={subject.subjectId} onChange={(e) => setSubject({ ...subject, subjectId: e.target.value })} placeholder="e.g. S-014" /></label>
              <label className="block"><span className="text-xs text-muted-foreground">Age</span>
                <input type="number" min={0} max={120} className={inputCls} value={subject.age} onChange={(e) => setSubject({ ...subject, age: e.target.value })} /></label>
              <label className="block"><span className="text-xs text-muted-foreground">Sex</span>
                <select className={inputCls} value={subject.sex} onChange={(e) => setSubject({ ...subject, sex: e.target.value })}>
                  <option value="">Not specified</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                </select></label>
              <label className="block sm:col-span-3"><span className="text-xs text-muted-foreground">Recording condition</span>
                <input className={inputCls} value={subject.condition} onChange={(e) => setSubject({ ...subject, condition: e.target.value })} placeholder="e.g. indoor corridor, self-selected pace" /></label>
              <label className="block sm:col-span-3"><span className="text-xs text-muted-foreground">Notes</span>
                <textarea rows={2} className={inputCls} value={subject.notes} onChange={(e) => setSubject({ ...subject, notes: e.target.value })} /></label>
            </div>
          </fieldset>

          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/30 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-cyan" />
            Only upload or record subjects with appropriate consent. Video data should be handled according to your institutional and research requirements.
          </div>

          <button type="button" disabled={!video || recording} onClick={analyze} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground glow-primary hover:brightness-110 disabled:opacity-50">
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
