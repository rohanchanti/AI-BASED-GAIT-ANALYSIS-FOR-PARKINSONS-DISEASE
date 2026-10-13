import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Video, FileText } from "lucide-react";
import { getVisit, addReview, addProtocolTiming, createClinicalReport, getClinicalReport, finalizeVisit, getRunMedia } from "@/lib/clinical.functions";
import { canGenerateReport, timedProtocolResult, REVIEW_DECISIONS } from "@/lib/clinical-rules";
import { protocolById } from "@/lib/video-config";
import { clinicalReportPdf } from "@/lib/workspace-pdf";
import { PageShell, Card, Loading, ErrorBox, Empty, Notice, StatusBadge, ParameterTable, VideoWithPose, inputCls, btnPrimary, btnGhost, useConfirm } from "@/components/workspace/shared";

export const Route = createFileRoute("/_authenticated/clinical/visits/$id")({
  head: () => ({
    meta: [
      { title: "Visit — Clinical Assessment" },
      { name: "description", content: "Visit recordings, results, review and report." },
      { property: "og:title", content: "Visit — Clinical Assessment" },
      { property: "og:description", content: "Visit recordings, results, review and report." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisitPage,
});

const STEPS = ["Visit & consent", "Record / upload", "Quality & processing", "Clinician review", "Report", "Saved"];

function VisitPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getVisit);
  const q = useQuery({ queryKey: ["visit", id], queryFn: () => fn({ data: { id } }) });
  if (q.isLoading) return <PageShell eyebrow="Visit" title="Loading…"><Loading /></PageShell>;
  if (q.error) return <PageShell eyebrow="Visit" title="Unavailable" back={{ to: "/clinical", label: "Patients" }}><ErrorBox message={(q.error as Error).message} /></PageShell>;
  const d = q.data as any;
  const v = d.visit, s = v.subjects;
  const runs = d.recordings.flatMap((r: any) => (r.analysis_runs ?? []).map((a: any) => ({ ...a, rec: r })));
  const done = runs.some((r: any) => canGenerateReport(r.status));
  const reviewed = d.reviews.some((r: any) => r.decision === "reviewed");
  const step = v.status === "closed" ? 6 : d.reports.length ? 5 : reviewed ? 5 : done ? 4 : runs.length ? 3 : 2;
  const isResearch = s.workflow === "research";
  return (
    <PageShell eyebrow={`${isResearch ? "Research session" : "Visit"} · ${v.visit_code}`} title={`${s.display_name} — ${v.visit_date.slice(0, 10)}`}
      back={isResearch ? { to: "/research-projects", label: "Research projects" } : { to: "/clinical/patients/$id", params: { id: s.id }, label: "Patient profile" }}
      actions={v.status !== "closed" ? <Link to="/" search={{ visit: v.id }} hash="analyze" className={btnPrimary}><Video className="h-4 w-4" /> Record or upload trial</Link> : <span className="text-sm text-muted-foreground">Visit saved{v.is_baseline ? " · baseline" : ""}</span>}>
      <ol className="flex flex-wrap gap-2 text-xs" aria-label="Workflow progress">
        {STEPS.map((x, i) => <li key={x} className={`rounded-full px-3 py-1 ${i + 1 < step ? "bg-success/15 text-success" : i + 1 === step ? "bg-primary/20 text-cyan" : "bg-white/5 text-muted-foreground"}`}>{i + 1}. {x}</li>)}
      </ol>
      <Card title="Session">
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          {[["Subject ID", s.subject_code], ["Age / Sex", `${s.age ?? "?"} / ${s.sex ?? "?"}`], ["Protocol", v.protocol ? protocolById(v.protocol).label : "—"], ["Recording condition", v.recording_condition], ["Medication", v.medication_state ?? "not recorded"], ["Consent", v.consents ? `granted · v${v.consents.document_version}` : isResearch ? "managed in research project" : "not recorded"], ["Scores", Object.entries(v.clinical_scores ?? {}).map(([k, x]) => `${k}: ${x}`).join(", ") || "—"], ["Notes", v.notes]].map(([k, val]) => (
            <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="break-words">{val}</dd></div>
          ))}
        </dl>
      </Card>
      {!runs.length ? <Card title="Trials"><Empty>No recordings yet. Use “Record or upload trial” — the subject details from this visit are pre-filled.</Empty></Card> :
        runs.map((r: any) => <RunCard key={r.id} run={r} data={d} visitId={v.id} closed={v.status === "closed"} />)}
      {!isResearch && <Finalize visitId={v.id} closed={v.status === "closed"} hasReport={d.reports.length > 0} />}
    </PageShell>
  );
}

function RunCard({ run, data, visitId, closed }: { run: any; data: any; visitId: string; closed: boolean }) {
  const qc = useQueryClient();
  const res = data.results.find((x: any) => x.run_id === run.id);
  const params = res?.engine_output?.parameters ?? [];
  const reviews = data.reviews.filter((x: any) => x.run_id === run.id);
  const reports = data.reports.filter((x: any) => x.run_id === run.id);
  const timing = data.timings.filter((x: any) => x.run_id === run.id).slice(-1)[0];
  const timed = timedProtocolResult({ protocol: run.rec.protocol, startSec: timing ? +timing.start_sec : null, endSec: timing ? +timing.end_sec : null, distanceM: timing?.distance_m != null ? +timing.distance_m : null, videoDurationSec: run.rec.duration_sec });
  const issues = (run.quality_report?.issues ?? []) as { severity?: string; message?: string; advice?: string }[];
  const reportable = canGenerateReport(run.status);
  const mkReport = useServerFn(createClinicalReport);
  const getRep = useServerFn(getClinicalReport);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["visit", visitId] });
  async function generate() {
    setBusy(true);
    try {
      const r = await mkReport({ data: { visitId, runId: run.id } });
      clinicalReportPdf(r.content).save(`clinical-report-${data.visit.visit_code}-trial${run.rec.trial_number ?? 1}.pdf`);
      toast.success("Report generated and stored");
      refresh();
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }
  async function download(id: string) {
    const r = await getRep({ data: { id } });
    clinicalReportPdf((r as any).content).save(`clinical-report-${id.slice(0, 8)}.pdf`);
  }
  return (
    <Card title={`Trial ${run.rec.trial_number ?? 1} · ${protocolById(run.rec.protocol ?? "straight").label}`} right={<StatusBadge status={run.status} />}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">Run {run.id.slice(0, 8)} · started {run.started_at?.slice(0, 16).replace("T", " ")} · {run.rec.source} · {run.rec.duration_sec ? `${Number(run.rec.duration_sec).toFixed(1)} s` : "duration unknown"} · fps {run.rec.fps ?? "not available"}</div>
          {run.status === "failed" && <ErrorBox message={`Processing failed: ${run.error_message ?? "unknown error"}. No report can be generated from this trial.`} />}
          {issues.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Quality warnings</h3>
              <ul className="mt-1 space-y-1 text-xs">{issues.map((i, k) => <li key={k} className={i.severity === "fail" ? "text-destructive" : "text-warning"}>• {i.message}{i.advice ? ` — ${i.advice}` : ""}</li>)}</ul>
            </div>
          )}
          {Array.isArray(run.rec.protocol_checks) && run.rec.protocol_checks.length > 0 && (
            <div><h3 className="text-sm font-medium">Protocol checks</h3><ul className="mt-1 text-xs text-muted-foreground">{run.rec.protocol_checks.map((c: any, k: number) => <li key={k}>{c.name}: {c.result} — {c.detail}</li>)}</ul></div>
          )}
          {res?.quality && <div className="text-xs text-muted-foreground">Usable frames {res.quality.usablePercent}% · cycles {res.quality.usableCycles} · median pose confidence {res.quality.poseConfidence?.median ?? "n/a"} (model confidence, not accuracy)</div>}
          <MediaPanel runId={run.id} />
        </div>
        <div className="space-y-4">
          <ParameterTable params={params} />
          {timed && <TimingPanel run={run} timed={timed} onSaved={refresh} closed={closed} />}
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Reviews runId={run.id} reviews={reviews} onSaved={refresh} disabled={!reportable} />
        <div>
          <h3 className="text-sm font-medium">Reports</h3>
          {!reportable && <p className="mt-1 text-xs text-muted-foreground">Report blocked: this trial is “{run.status}”. Only completed analyses can be reported.</p>}
          {reportable && !reviews.length && <p className="mt-1 text-xs text-warning">No clinician review yet — the report will show the review as pending.</p>}
          <button className={btnPrimary + " mt-2"} onClick={generate} disabled={!reportable || busy}><FileText className="h-4 w-4" /> {busy ? "Generating…" : "Generate report (PDF)"}</button>
          <ul className="mt-3 space-y-1 text-xs">{reports.map((r: any) => <li key={r.id}><button className="text-cyan hover:underline" onClick={() => download(r.id)}>Report {r.created_at.slice(0, 16).replace("T", " ")}</button></li>)}</ul>
        </div>
      </div>
    </Card>
  );
}

function MediaPanel({ runId }: { runId: string }) {
  const [on, setOn] = useState(false);
  const fn = useServerFn(getRunMedia);
  const q = useQuery({ queryKey: ["media", runId], queryFn: () => fn({ data: { runId } }), enabled: on, staleTime: 5 * 60_000 });
  if (!on) return <button className={btnGhost} onClick={() => setOn(true)}><Video className="h-4 w-4" /> Play video</button>;
  if (q.isLoading) return <Loading label="Loading video…" />;
  if (q.error) return <ErrorBox message={(q.error as Error).message} />;
  if (!q.data?.url) return <Empty>The stored video is no longer available.</Empty>;
  return <VideoWithPose url={q.data.url} frames={q.data.frames} />;
}

function TimingPanel({ run, timed, onSaved, closed }: { run: any; timed: ReturnType<typeof timedProtocolResult>; onSaved: () => void; closed: boolean }) {
  const fn = useServerFn(addProtocolTiming);
  const is10 = run.rec.protocol === "10mwt";
  const [f, setF] = useState({ start: "", end: "", distance: is10 ? "10" : "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fn({ data: { runId: run.id, startSec: Number(f.start), endSec: Number(f.end), distanceM: is10 ? Number(f.distance) : null } });
      toast.success("Timing recorded");
      onSaved();
    } catch (x) { toast.error((x as Error).message); }
  }
  if (!timed) return null;
  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="text-sm font-medium">{timed.label}</h3>
      <p className="mt-1 text-sm">{timed.verified ? <><span className="font-mono text-lg">{timed.value}</span> {timed.unit} <span className="text-xs text-muted-foreground">({timed.formula}, operator-marked)</span></> : <span className="text-muted-foreground">Not verified — {timed.reason}</span>}</p>
      {!closed && (
        <form onSubmit={save} className="mt-3 grid grid-cols-3 gap-2">
          <label className="block"><span className="text-[11px] text-muted-foreground">{is10 ? "Cross 0 m mark (s)" : "Rise starts (s)"}</span><input type="number" step="0.01" required className={inputCls} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
          <label className="block"><span className="text-[11px] text-muted-foreground">{is10 ? "Cross 10 m mark (s)" : "Seated again (s)"}</span><input type="number" step="0.01" required className={inputCls} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
          {is10 ? <label className="block"><span className="text-[11px] text-muted-foreground">Timed distance (m)</span><input type="number" step="0.1" required className={inputCls} value={f.distance} onChange={(e) => setF({ ...f, distance: e.target.value })} /></label> : <div />}
          <div className="col-span-3 flex justify-between items-center"><span className="text-[11px] text-muted-foreground">Read times from the video player above.</span><button className={btnGhost}>Save marks</button></div>
        </form>
      )}
    </div>
  );
}

function Reviews({ runId, reviews, onSaved, disabled }: { runId: string; reviews: any[]; onSaved: () => void; disabled: boolean }) {
  const fn = useServerFn(addReview);
  const [decision, setDecision] = useState<(typeof REVIEW_DECISIONS)[number]>("reviewed");
  const [notes, setNotes] = useState("");
  const [supersedes, setSupersedes] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) return toast.error("Enter review notes.");
    try {
      await fn({ data: { runId, decision, notes: notes.trim(), supersedes } });
      setNotes(""); setSupersedes(null);
      toast.success(supersedes ? "Correction added; the original review is kept" : "Review saved");
      onSaved();
    } catch (x) { toast.error((x as Error).message); }
  }
  const superseded = new Set(reviews.map((r) => r.supersedes).filter(Boolean));
  return (
    <div>
      <h3 className="text-sm font-medium">Clinician review</h3>
      <ul className="mt-2 space-y-2 text-xs">
        {!reviews.length && <li className="text-muted-foreground">Review status: pending</li>}
        {reviews.map((r) => (
          <li key={r.id} className={`rounded-lg border border-border p-2 ${superseded.has(r.id) ? "opacity-60 line-through" : ""}`}>
            <div className="flex justify-between"><span className="font-medium">{r.decision.replace("_", " ")}</span><span className="text-muted-foreground">{r.created_at.slice(0, 16).replace("T", " ")}</span></div>
            <div>{r.notes}</div>
            {r.supersedes && <div className="text-muted-foreground">Correction of an earlier review</div>}
            {!superseded.has(r.id) && <button className="mt-1 text-cyan hover:underline" onClick={() => { setSupersedes(r.id); setNotes(r.notes); setDecision(r.decision); }}>Correct</button>}
          </li>
        ))}
      </ul>
      <form onSubmit={save} className="mt-3 space-y-2">
        {supersedes && <div className="text-xs text-warning">Correcting a review — the original stays in the history. <button type="button" className="underline" onClick={() => setSupersedes(null)}>Cancel</button></div>}
        <select aria-label="Review decision" className={inputCls} value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)} disabled={disabled}>
          <option value="reviewed">Reviewed</option><option value="needs_repeat">Needs repeat recording</option><option value="pending">Pending</option>
        </select>
        <textarea aria-label="Review notes" rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Annotations for this trial" disabled={disabled} />
        <button className={btnGhost} disabled={disabled}>{supersedes ? "Save correction" : "Add review"}</button>
      </form>
    </div>
  );
}

function Finalize({ visitId, closed, hasReport }: { visitId: string; closed: boolean; hasReport: boolean }) {
  const fn = useServerFn(finalizeVisit);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [baseline, setBaseline] = useState(false);
  if (closed) return null;
  async function save() {
    if (!confirm(`Save and close this visit${baseline ? " as the follow-up baseline" : ""}? No further trials can be added.`)) return;
    try { await fn({ data: { visitId, baseline } }); toast.success("Visit saved"); qc.invalidateQueries({ queryKey: ["visit", visitId] }); }
    catch (x) { toast.error((x as Error).message); }
  }
  return (
    <Card title="Save visit">
      {!hasReport && <Notice>Generate at least one report before saving the visit.</Notice>}
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={baseline} onChange={(e) => setBaseline(e.target.checked)} /> Use this visit as the follow-up baseline</label>
      <button className={btnPrimary + " mt-3"} disabled={!hasReport} onClick={save}>Save visit</button>
    </Card>
  );
}
