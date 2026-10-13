import { useEffect, useRef, useState } from "react";
import type { MediaKind } from "./UploadZone";
import type { AnalysisMode } from "./AnalysisModePicker";
import { Activity, AlertTriangle, RotateCcw, X } from "lucide-react";
import { analyzeVideoFile } from "@/lib/video-analyzer";
import { runPoseGaitAnalysis } from "@/services/pose/gaitAnalysisService";
import { persistPoseAnalysis, toStorable } from "@/lib/pose-session";
import { analyzeFromMeasurements, generateMockAnalysis, type AnalysisResult } from "@/lib/mock-analysis";
import { supabase } from "@/integrations/supabase/client";
import {
  createAnalysisJob,
  createUploadUrl,
  verifyUpload,
  updateJobStatus,
  saveJobResults,
} from "@/lib/jobs.functions";
import { uploadWithRetry, assessRecording, UploadCancelled } from "@/lib/job-runner";
import { protocolById, type QualityIssue } from "@/lib/video-config";

export interface JobRequest {
  /** Create a new server job (first submission). */
  create?: Parameters<typeof createAnalysisJob>[0]["data"];
  /** Re-process an existing job whose file is already stored. */
  resumeRunId?: string;
  protocol: string;
}

interface Props {
  kind: MediaKind;
  mode: AnalysisMode;
  file: File;
  subjectHeightMeters?: number;
  job?: JobRequest;
  onComplete: (result: AnalysisResult, meta?: { runId: string | null; warnings: QualityIssue[] }) => void;
  onError?: (message: string) => void;
}

const LABEL: Record<AnalysisMode, string> = {
  normal: "Straight-line Walking",
  tug: "Timed Up and Go",
  side: "Side View Analysis",
  front: "Front View Analysis",
  multi: "Multi-Angle Analysis",
  quick: "Quick Analysis",
  standard: "Standard Analysis",
  precision: "Precision Analysis",
};

type Phase = "upload" | "analyze" | "failed";

export function ProcessingScreen({ kind, mode, file, subjectHeightMeters, job, onComplete, onError }: Props) {
  const [uploadPct, setUploadPct] = useState(0);
  const [analysisPct, setAnalysisPct] = useState(0);
  const [phase, setPhase] = useState<Phase>("upload");
  const [failure, setFailure] = useState<{ message: string; issues: QualityIssue[]; retryable: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ctrlRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(job?.resumeRunId ?? null);
  const startedFor = useRef(-1);

  useEffect(() => {
    if (startedFor.current === attempt) return;
    startedFor.current = attempt;
    const controller = new AbortController();
    ctrlRef.current = controller;
    let cancelled = false;
    const signal = controller.signal;
    const protocol = protocolById(job?.protocol ?? "straight");

    const status = async (s: Parameters<typeof updateJobStatus>[0]["data"]) => {
      if (!runIdRef.current) return;
      try {
        await updateJobStatus({ data: { ...s, runId: runIdRef.current } });
      } catch {
        /* status write is best-effort mid-run */
      }
    };

    (async () => {
      try {
        // ---------- Upload + server verification (signed-in only) ----------
        const { data: sess } = await supabase.auth.getSession();
        const tracked = kind === "gait" && !!job && !!sess.session;
        if (tracked && job.resumeRunId && attempt === 0) {
          await status({ status: "processing", stage: "frame_decoding", progress: 0.05, retry: true });
          setUploadPct(1);
        } else if (tracked) {
          if (!runIdRef.current && job.create) {
            const created = await createAnalysisJob({ data: job.create });
            runIdRef.current = created.runId;
          }
          const runId = runIdRef.current!;
          const { path, token } = await createUploadUrl({ data: { runId } });
          await uploadWithRetry(path, token, file, (p) => !cancelled && setUploadPct(p), signal);
          setUploadPct(1);
          const v = await verifyUpload({ data: { runId } });
          if (!v.ok) {
            setFailure({ message: v.error, issues: [], retryable: false });
            setPhase("failed");
            return;
          }
        } else {
          if (kind === "gait") setNotice("Not signed in — the video is analysed on this device only and is not stored or tracked.");
          setUploadPct(1);
        }
        if (cancelled) return;
        setPhase("analyze");

        // ---------- Analysis ----------
        let result: AnalysisResult;
        const warnings: QualityIssue[] = [];
        if (kind === "gait") {
          let lastBeat = 0;
          const beat = (stage: string, p: number) => {
            const now = Date.now();
            if (now - lastBeat > 10000) {
              lastBeat = now;
              void status({ status: "processing", stage, progress: p });
            }
          };
          const measurements = await analyzeVideoFile(
            file,
            (p) => {
              if (!cancelled) setAnalysisPct(p * 0.3);
              beat("frame_decoding", 0.05 + p * 0.25);
            },
            signal,
          );
          result = analyzeFromMeasurements(measurements, mode);
          let pose;
          try {
            pose = await runPoseGaitAnalysis(
              file,
              { subjectHeightMeters },
              (p) => {
                if (!cancelled) setAnalysisPct(0.3 + p.progress * 0.65);
                beat(p.stage === "EXTRACTING_LANDMARKS" ? "pose_detection" : "feature_calculation", 0.3 + p.progress * 0.6);
              },
              signal,
            );
          } catch (e) {
            if (signal.aborted) throw e;
            pose = null;
          }
          if (cancelled) return;
          if (!pose) {
            const msg = "Pose detection could not run on this video. It may be corrupted or use an unsupported codec.";
            persistPoseAnalysis(null);
            if (runIdRef.current)
              await saveJobResults({ data: { runId: runIdRef.current, status: "failed", qualityReport: null, protocolChecks: [], video: { durationSec: null, width: null, height: null, fps: null }, error: msg } }).catch(() => {});
            setFailure({ message: msg, issues: [], retryable: true });
            setPhase("failed");
            return;
          }
          const assessment = assessRecording(pose, protocol);
          const store = toStorable(pose);
          const posePayload = JSON.parse(JSON.stringify({ metrics: store.metrics, quality: store.quality, validation: store.validation, events: (store.events ?? []).slice(0, 2000) }));
          const video = { durationSec: pose.video.durationSec, width: pose.video.width, height: pose.video.height, fps: null };
          const qualityReport = JSON.parse(JSON.stringify({ status: assessment.status, issues: assessment.issues, input: assessment.input }));
          if (assessment.status === "fail") {
            persistPoseAnalysis(null);
            if (runIdRef.current)
              await saveJobResults({ data: { runId: runIdRef.current, status: "failed", qualityReport, protocolChecks: assessment.checks, video, error: "Recording did not meet minimum data quality." } });
            setFailure({ message: "The recording does not meet the minimum quality needed for reliable gait measurements.", issues: assessment.issues, retryable: false });
            setPhase("failed");
            return;
          }
          persistPoseAnalysis(pose);
          result = { ...result, qualityScore: pose.quality?.overall ?? null };
          warnings.push(...assessment.issues);
          if (runIdRef.current)
            await saveJobResults({
              data: {
                runId: runIdRef.current,
                status: assessment.status === "warn" ? "completed_with_warnings" : "completed",
                qualityReport,
                protocolChecks: assessment.checks,
                video,
                result: JSON.parse(JSON.stringify(result)),
                pose: posePayload,
              },
            });
        } else {
          for (let i = 0; i <= 20; i++) {
            if (cancelled) return;
            setAnalysisPct(i / 20);
            await new Promise((r) => setTimeout(r, 60));
          }
          result = generateMockAnalysis("facial", mode, file.name);
        }
        if (cancelled) return;
        setAnalysisPct(1);
        onComplete(result, { runId: runIdRef.current, warnings });
      } catch (err) {
        if (cancelled && !(err instanceof UploadCancelled)) return;
        if (signal.aborted || err instanceof UploadCancelled) {
          await status({ status: "cancelled", error: "Cancelled by user." });
          onError?.("Analysis cancelled.");
          return;
        }
        const msg = err instanceof Error ? err.message : "Analysis failed";
        await status({ status: "failed", error: msg });
        setFailure({ message: msg, issues: [], retryable: true });
        setPhase("failed");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Abort work if the screen is left.
  useEffect(() => () => ctrlRef.current?.abort(), []);

  function cancel() {
    ctrlRef.current?.abort();
  }

  async function retry() {
    if (runIdRef.current) {
      try {
        const r = await updateJobStatus({ data: { runId: runIdRef.current, status: "queued", retry: true } });
        if (!r.ok) {
          setFailure((f) => (f ? { ...f, message: r.error ?? "This job can no longer be retried.", retryable: false } : f));
          return;
        }
      } catch {
        /* fall through and retry anyway */
      }
    }
    setFailure(null);
    setUploadPct(0);
    setAnalysisPct(0);
    setPhase("upload");
    setAttempt((a) => a + 1);
  }

  const pct = phase === "upload" ? uploadPct : analysisPct;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-background/85 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-3xl glass gradient-border p-8 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan">
          {kind === "gait" ? "Clinical Gait Analysis" : "Facial Analysis"} · {LABEL[mode] ?? mode}
        </div>

        {phase === "failed" && failure ? (
          <div className="mt-6 text-left">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Analysis could not be completed</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{failure.message}</p>
            {failure.issues.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm">
                {failure.issues.map((i, k) => (
                  <li key={k} className={`rounded-lg border p-3 ${i.severity === "blocking" ? "border-destructive/40" : "border-border/60"}`}>
                    <div className="font-medium">{i.message}</div>
                    <div className="text-xs text-muted-foreground">How to fix: {i.advice}</div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              {failure.retryable && (
                <button type="button" onClick={retry} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary">
                  <RotateCcw className="h-4 w-4" /> Retry
                </button>
              )}
              <button type="button" onClick={() => onError?.(failure.message)} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm">
                Back to recording
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-8 h-24 w-24 rounded-full bg-primary/10 grid place-items-center glow-primary">
              <Activity className="h-10 w-10 text-cyan animate-pulse" />
            </div>
            <div className="mt-8 font-display text-5xl font-bold gradient-text">{Math.round(pct * 100)}%</div>
            <div className="mt-2 text-sm text-muted-foreground">{phase === "upload" ? "Uploading video…" : "Analysis in progress"}</div>
            <div className="mt-6 h-2.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-gradient-to-r from-primary via-cyan to-purple transition-[width] duration-150 glow-primary" style={{ width: `${pct * 100}%` }} />
            </div>
            {notice && <p className="mt-4 text-xs text-muted-foreground">{notice}</p>}
            <button type="button" onClick={cancel} className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:border-destructive">
              <X className="h-4 w-4" /> Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
