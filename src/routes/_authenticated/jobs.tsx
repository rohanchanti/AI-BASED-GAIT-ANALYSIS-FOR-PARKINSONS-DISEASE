import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw, X, Eye, RefreshCw } from "lucide-react";
import { listJobs, updateJobStatus, getJobFileUrl, getJobResult } from "@/lib/jobs.functions";
import { ProcessingScreen, type JobRequest } from "@/components/ProcessingScreen";
import { STATUS_LABEL, TERMINAL, isStale, protocolById, type JobStatus } from "@/lib/video-config";
import { ANALYSIS_VERSIONS } from "@/lib/analysis-version";
import { POSE_SESSION_KEY } from "@/lib/pose-session";
import type { AnalysisResult } from "@/lib/mock-analysis";

const TITLE = "Analysis Jobs — NeuroStride AI";
const DESC = "Track the status of uploaded gait recordings, retry interrupted analyses and open completed results.";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JobsPage,
});

const tone = (s: string, stale: boolean) =>
  stale
    ? "border-destructive/40 text-destructive"
    : s === "completed" || s === "complete"
      ? "border-success/40 text-success"
      : s === "completed_with_warnings"
        ? "border-cyan/40 text-cyan"
        : s === "failed" || s === "cancelled"
          ? "border-destructive/40 text-destructive"
          : "border-primary/40 text-foreground";

function JobsPage() {
  const list = useServerFn(listJobs);
  const update = useServerFn(updateJobStatus);
  const fileUrl = useServerFn(getJobFileUrl);
  const result = useServerFn(getJobResult);
  const navigate = useNavigate();
  const [rerun, setRerun] = useState<{ file: File; job: JobRequest; mode: string; subject: Record<string, any> } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["jobs"], queryFn: () => list(), refetchInterval: 15000 });

  async function cancel(id: string) {
    const r = await update({ data: { runId: id, status: "cancelled", error: "Cancelled by user." } });
    if (!r.ok) toast.error(`Cannot cancel a job that is ${STATUS_LABEL[r.status] ?? r.status}.`);
    q.refetch();
  }

  async function retry(job: Record<string, any>) {
    setBusyId(job.id);
    try {
      const { url, recording } = await fileUrl({ data: { runId: job.id } });
      const res = await fetch(url);
      if (!res.ok) throw new Error("The stored video could not be downloaded.");
      const blob = await res.blob();
      const file = new File([blob], recording.original_filename ?? "recording", { type: recording.mime_type ?? blob.type });
      if (job.status === "processing" || job.status === "uploading") {
        await update({ data: { runId: job.id, status: "failed", error: "Interrupted (no heartbeat)." } });
      }
      const proto = protocolById(recording.protocol ?? "straight");
      setRerun({ file, job: { resumeRunId: job.id, protocol: proto.id }, mode: proto.mode, subject: recording });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusyId(null);
    }
  }

  async function view(job: Record<string, any>) {
    setBusyId(job.id);
    try {
      const [r, f] = await Promise.all([result({ data: { runId: job.id } }), fileUrl({ data: { runId: job.id } }).catch(() => null)]);
      if (!r?.result_payload) throw new Error("No stored results for this job.");
      const rec = f?.recording ?? {};
      const subj = rec.visits?.subjects ?? {};
      storeResult(r.result_payload as AnalysisResult, job, rec, subj);
      sessionStorage.setItem(
        POSE_SESSION_KEY,
        JSON.stringify({ method: "mediapipe-pose", generatedAt: job.completed_at, video: null, metrics: r.pose_metrics, angles: [], events: r.events ?? [], quality: r.quality, validation: r.validation }),
      );
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open results");
    } finally {
      setBusyId(null);
    }
  }

  function storeResult(res: AnalysisResult, job: Record<string, any>, rec: Record<string, any>, subj: Record<string, any>) {
    sessionStorage.setItem(
      "latestResult",
      JSON.stringify({
        result: res,
        patient_name: subj.display_name ?? "",
        patient_id: subj.subject_code ?? "",
        patient_age: subj.age != null ? String(subj.age) : "",
        patient_gender: subj.sex ?? "",
        recording_condition: rec.visits?.recording_condition ?? "",
        notes: rec.visits?.notes ?? "",
        media_kind: "gait",
        media_name: rec.original_filename ?? "",
        analysis_id: job.id.slice(0, 8).toUpperCase(),
        analysis_timestamp: job.completed_at ?? new Date().toISOString(),
        versions: ANALYSIS_VERSIONS,
        run_id: job.id,
      }),
    );
  }

  const jobs = q.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">Processing</div>
          <h1 className="font-display text-3xl font-semibold">Analysis jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Status is saved on the server, so it survives page refreshes. Jobs without activity for 2 minutes are marked interrupted.</p>
        </div>
        <button type="button" onClick={() => q.refetch()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {q.isLoading && <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Loading jobs…</div>}
        {q.isError && <div className="glass rounded-2xl p-6 text-sm text-destructive">Could not load jobs.</div>}
        {!q.isLoading && jobs.length === 0 && (
          <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">No tracked analyses yet. Record or upload a walking video on the home page while signed in.</div>
        )}
        {jobs.map((j) => {
          const stale = isStale(j.status, j.heartbeat_at);
          const rec = j.recordings ?? {};
          const issues = (j.quality_report?.issues ?? []) as { message: string; advice: string; severity: string }[];
          const terminal = TERMINAL.includes(j.status as JobStatus);
          return (
            <div key={j.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {rec.visits?.subjects?.subject_code ?? "—"} · {protocolById(rec.protocol ?? "straight").label} · Trial {rec.trial_number ?? 1}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(j.started_at).toLocaleString()} · {rec.source === "live" ? "Live recording" : "Uploaded"} · {rec.original_filename}
                    {rec.duration_sec ? ` · ${Number(rec.duration_sec).toFixed(1)} s` : ""} · attempts {j.attempts + 1}
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${tone(j.status, stale)}`}>
                  {stale ? "Interrupted" : STATUS_LABEL[j.status] ?? j.status}
                  {!terminal && !stale ? ` · ${Math.round(Number(j.progress) * 100)}%` : ""}
                </span>
              </div>
              {j.error_message && <p className="mt-2 text-xs text-destructive">{j.error_message}</p>}
              {issues.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs">
                  {issues.map((i, k) => (
                    <li key={k} className={i.severity === "blocking" ? "text-destructive" : "text-muted-foreground"}>
                      • {i.message} — {i.advice}
                    </li>
                  ))}
                </ul>
              )}
              {Array.isArray(rec.protocol_checks) && rec.protocol_checks.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {rec.protocol_checks.map((c: { name: string; result: string; detail: string }) => (
                    <span key={c.name} title={c.detail} className="rounded-md border border-border/60 px-2 py-0.5">
                      {c.name}: {c.result === "pass" ? "checked ✓" : c.result === "fail" ? "not met" : "not verified"}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {(j.status === "completed" || j.status === "completed_with_warnings") && (
                  <button type="button" disabled={busyId === j.id} onClick={() => view(j)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
                    <Eye className="h-3.5 w-3.5" /> View results
                  </button>
                )}
                {(j.status === "failed" || j.status === "cancelled" || stale) && j.attempts < 3 && (
                  <button type="button" disabled={busyId === j.id} onClick={() => retry(j)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary disabled:opacity-60">
                    <RotateCcw className="h-3.5 w-3.5" /> {busyId === j.id ? "Preparing…" : "Retry"}
                  </button>
                )}
                {!terminal && (
                  <button type="button" onClick={() => cancel(j.id)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-destructive">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {rerun && (
        <ProcessingScreen
          kind="gait"
          mode={rerun.mode as "normal"}
          file={rerun.file}
          job={rerun.job}
          onComplete={(res, meta) => {
            const rec = rerun.subject;
            storeResult(res, { id: meta?.runId ?? rerun.job.resumeRunId!, completed_at: new Date().toISOString() }, rec, rec.visits?.subjects ?? {});
            setRerun(null);
            navigate({ to: "/dashboard" });
          }}
          onError={(m) => {
            toast.error(m);
            setRerun(null);
            q.refetch();
          }}
        />
      )}
    </div>
  );
}
