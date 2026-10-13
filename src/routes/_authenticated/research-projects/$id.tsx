import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getProject, updateProject, addParticipant, updateParticipant, startParticipantSession, importDataset, addAnnotation, runExperiment, logResearchExport } from "@/lib/research.functions";
import { parseCsv, checksum, toCsv, buildResearchReport } from "@/lib/research-dataset";
import { researchReportPdf } from "@/lib/workspace-pdf";
import { PARAMETER_DEFINITIONS } from "@/lib/gait-engine/parameters";
import { PROTOCOLS } from "@/lib/video-config";
import { ANALYSIS_VERSIONS } from "@/lib/analysis-version";
import { PageShell, Card, Loading, ErrorBox, Empty, Notice, StatusBadge, inputCls, btnPrimary, btnGhost } from "@/components/workspace/shared";

export const Route = createFileRoute("/_authenticated/research-projects/$id")({
  head: () => ({
    meta: [
      { title: "Research project — NeuroStride AI" },
      { name: "description", content: "Protocol, participants, data, evaluation and exports." },
      { property: "og:title", content: "Research project — NeuroStride AI" },
      { property: "og:description", content: "Protocol, participants, data, evaluation and exports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectPage,
});

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function ProjectPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getProject);
  const q = useQuery({ queryKey: ["research-project", id], queryFn: () => fn({ data: { id } }) });
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["research-project", id] });
  if (q.isLoading) return <PageShell eyebrow="Research project" title="Loading…"><Loading /></PageShell>;
  if (q.error) return <PageShell eyebrow="Research project" title="Unavailable" back={{ to: "/research-projects", label: "Projects" }}><ErrorBox message={(q.error as Error).message} /></PageShell>;
  const b = q.data as any;
  return (
    <PageShell eyebrow={`Research · ${b.project.project_code}`} title={b.project.title} back={{ to: "/research-projects", label: "Projects" }}>
      <Notice>Coded participants only. Do not enter names or other identifying information. Findings are {b.project.status === "validated" ? "marked validated by the project owner" : "exploratory"}.</Notice>
      <ProtocolCard b={b} onSaved={refresh} />
      <Participants b={b} onSaved={refresh} />
      <Datasets b={b} onSaved={refresh} />
      <Runs b={b} />
      <Annotations b={b} onSaved={refresh} />
      <Experiments b={b} onSaved={refresh} />
      <Exports b={b} />
    </PageShell>
  );
}

function ProtocolCard({ b, onSaved }: { b: any; onSaved: () => void }) {
  const fn = useServerFn(updateProject);
  const p = b.project.protocol ?? {};
  const [f, setF] = useState({ inclusion: b.project.inclusion_criteria ?? "", exclusion: b.project.exclusion_criteria ?? "", status: b.project.status, recordingProtocol: p.recordingProtocol ?? "straight", cameraView: p.cameraView ?? "side", walkingDistanceM: p.walkingDistanceM != null ? String(p.walkingDistanceM) : "", trials: String(p.trialsPerParticipant ?? 1), measurementProtocol: p.measurementProtocol ?? "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fn({ data: { id: b.project.id, inclusion: f.inclusion || null, exclusion: f.exclusion || null, status: f.status, protocol: { recordingProtocol: f.recordingProtocol, cameraView: f.cameraView, walkingDistanceM: f.walkingDistanceM ? Number(f.walkingDistanceM) : null, trialsPerParticipant: Number(f.trials), measurementProtocol: f.measurementProtocol } } });
      toast.success("Study protocol saved"); onSaved();
    } catch (x) { toast.error((x as Error).message); }
  }
  return (
    <Card title="1. Study protocol">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="text-xs text-muted-foreground">Recording protocol</span><select className={inputCls} value={f.recordingProtocol} onChange={(e) => setF({ ...f, recordingProtocol: e.target.value })}>{PROTOCOLS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
        <label className="block"><span className="text-xs text-muted-foreground">Camera view</span><select className={inputCls} value={f.cameraView} onChange={(e) => setF({ ...f, cameraView: e.target.value })}><option value="side">Side</option><option value="front">Front</option></select></label>
        <label className="block"><span className="text-xs text-muted-foreground">Trials per participant</span><input type="number" min={1} max={20} className={inputCls} value={f.trials} onChange={(e) => setF({ ...f, trials: e.target.value })} /></label>
        <label className="block"><span className="text-xs text-muted-foreground">Walking distance (m)</span><input type="number" step="0.1" className={inputCls} value={f.walkingDistanceM} onChange={(e) => setF({ ...f, walkingDistanceM: e.target.value })} /></label>
        <label className="block"><span className="text-xs text-muted-foreground">Finding status</span><select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="exploratory">Exploratory</option><option value="validated">Validated</option><option value="archived">Archived</option></select></label>
        <div />
        <label className="block sm:col-span-3"><span className="text-xs text-muted-foreground">Measurement protocol / reference method</span><textarea rows={2} className={inputCls} value={f.measurementProtocol} onChange={(e) => setF({ ...f, measurementProtocol: e.target.value })} /></label>
        <label className="block"><span className="text-xs text-muted-foreground">Inclusion criteria</span><textarea rows={2} className={inputCls} value={f.inclusion} onChange={(e) => setF({ ...f, inclusion: e.target.value })} /></label>
        <label className="block sm:col-span-2"><span className="text-xs text-muted-foreground">Exclusion criteria</span><textarea rows={2} className={inputCls} value={f.exclusion} onChange={(e) => setF({ ...f, exclusion: e.target.value })} /></label>
        <div className="sm:col-span-3 flex justify-end"><button className={btnPrimary}>Save protocol</button></div>
      </form>
    </Card>
  );
}

function Participants({ b, onSaved }: { b: any; onSaved: () => void }) {
  const add = useServerFn(addParticipant);
  const upd = useServerFn(updateParticipant);
  const start = useServerFn(startParticipantSession);
  const nav = useNavigate();
  const [f, setF] = useState({ code: "", age: "", sex: "", included: true, reason: "" });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await add({ data: { projectId: b.project.id, code: f.code.trim(), age: f.age ? Number(f.age) : null, sex: (f.sex || null) as any, included: f.included, exclusionReason: f.included ? null : f.reason } });
      setF({ code: "", age: "", sex: "", included: true, reason: "" }); onSaved();
    } catch (x) { toast.error((x as Error).message); }
  }
  async function change(p: any, patch: any) {
    const next = { included: p.included, exclusionReason: p.exclusion_reason, split: p.split, ...patch };
    if (!next.included && !next.exclusionReason) { const r = prompt("Exclusion reason"); if (!r) return; next.exclusionReason = r; }
    try { await upd({ data: { id: p.id, ...next } }); onSaved(); } catch (x) { toast.error((x as Error).message); }
  }
  async function record(p: any) {
    const condition = prompt("Recording condition", "indoor corridor, self-selected pace"); if (!condition) return;
    const notes = prompt("Session notes", `Research session for ${p.participant_code}`); if (!notes) return;
    try { const r = await start({ data: { participantId: p.id, recordingCondition: condition, notes } }); nav({ to: "/", search: { visit: r.visitId }, hash: "analyze" }); }
    catch (x) { toast.error((x as Error).message); }
  }
  return (
    <Card title="2. Coded participants">
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-6">
        <input aria-label="Participant code" required className={inputCls + " sm:col-span-2"} placeholder="Code, e.g. P001" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        <input aria-label="Age" type="number" min={1} max={120} className={inputCls} placeholder="Age" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} />
        <select aria-label="Sex" className={inputCls} value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}><option value="">Sex…</option><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option></select>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.included} onChange={(e) => setF({ ...f, included: e.target.checked })} /> Included</label>
        <button className={btnGhost}>Register</button>
        {!f.included && <input aria-label="Exclusion reason" required className={inputCls + " sm:col-span-6"} placeholder="Exclusion reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />}
      </form>
      {!b.participants.length ? <Empty>No participants registered.</Empty> : (
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="py-2">Code</th><th>Included</th><th>Split</th><th>Exclusion reason</th><th /></tr></thead>
          <tbody>{b.participants.map((p: any) => (
            <tr key={p.id} className="border-t border-border/50">
              <td className="py-2 font-mono">{p.participant_code}</td>
              <td><input type="checkbox" aria-label="Included" checked={p.included} onChange={(e) => change(p, { included: e.target.checked, exclusionReason: e.target.checked ? null : p.exclusion_reason })} /></td>
              <td><select aria-label="Split" className={inputCls + " py-1"} value={p.split ?? ""} onChange={(e) => change(p, { split: e.target.value || null })}><option value="">—</option><option value="train">Train</option><option value="validation">Validation</option><option value="test">Test</option></select></td>
              <td className="text-xs text-muted-foreground">{p.exclusion_reason ?? ""}</td>
              <td className="text-right"><button className="text-xs text-cyan hover:underline" onClick={() => record(p)}>Record / upload</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Splits are assigned per participant, so all of one participant's trials stay in the same split.</p>
    </Card>
  );
}

function Datasets({ b, onSaved }: { b: any; onSaved: () => void }) {
  const fn = useServerFn(importDataset);
  const [meta, setMeta] = useState({ name: "", source: "", version: "1.0" });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function onFile(file: File) {
    if (!meta.name.trim() || !meta.source.trim()) return toast.error("Enter dataset name and source first.");
    setBusy(true); setErrors([]);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const r = await fn({ data: { projectId: b.project.id, name: meta.name.trim(), source: meta.source.trim(), version: meta.version.trim(), checksum: await checksum(text), rows } });
      if (!r.ok) setErrors(r.validation.errors); else { toast.success(`Imported ${r.validation.rowCount} rows`); onSaved(); }
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <Card title="3. Dataset import & metadata validation">
      <div className="grid gap-2 sm:grid-cols-4">
        <input aria-label="Dataset name" className={inputCls} placeholder="Dataset name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
        <input aria-label="Source" className={inputCls} placeholder="Source / licence" value={meta.source} onChange={(e) => setMeta({ ...meta, source: e.target.value })} />
        <input aria-label="Version" className={inputCls} placeholder="Version" value={meta.version} onChange={(e) => setMeta({ ...meta, version: e.target.value })} />
        <label className={btnGhost + " cursor-pointer justify-center"}>{busy ? "Validating…" : "Choose CSV"}<input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">CSV must contain a participant_code column. Files with identifying columns (name, email, phone, address, date of birth…) are rejected.</p>
      {errors.length > 0 && <ErrorBox message={errors.join(" ")} />}
      {!b.datasets.length ? <Empty>No datasets imported.</Empty> : (
        <ul className="mt-3 space-y-1 text-xs">{b.datasets.map((d: any) => <li key={d.id}>{d.name} v{d.version} · {d.source} · {d.row_count} rows · sha256 {d.checksum.slice(0, 12)}… {d.validation?.warnings?.length ? <span className="text-warning">· {d.validation.warnings.join(" ")}</span> : null}</li>)}</ul>
      )}
    </Card>
  );
}

function Runs({ b }: { b: any }) {
  return (
    <Card title="4. Processing, quality & analysis runs">
      {!b.runs.length ? <Empty>No recordings yet. Use “Record / upload” on a participant.</Empty> : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="py-2">Participant</th><th>Session</th><th>Trial</th><th>Status</th><th>Usable frames</th><th>Cycles</th><th>Versions</th></tr></thead>
          <tbody>{b.runs.map((r: any) => (
            <tr key={r.runId} className="border-t border-border/50"><td className="py-2 font-mono">{r.participant_code}</td><td><Link to="/clinical/visits/$id" params={{ id: r.visitId ?? "" }} className="hidden" />{r.visitCode}</td><td>{r.trial ?? 1}</td><td><StatusBadge status={r.status} /></td><td>{r.quality ? `${r.quality.usablePercent}%` : "—"}</td><td>{r.quality?.usableCycles ?? "—"}</td><td className="text-xs text-muted-foreground">{r.versions.model} / {r.versions.features}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
  );
}

function Annotations({ b, onSaved }: { b: any; onSaved: () => void }) {
  const fn = useServerFn(addAnnotation);
  const [f, setF] = useState({ participantId: "", runId: "", key: PARAMETER_DEFINITIONS[0].key, value: "", method: "" });
  const runs = b.runs.filter((r: any) => r.participantId === f.participantId);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await fn({ data: { projectId: b.project.id, participantId: f.participantId, runId: f.runId || null, parameterKey: f.key, value: Number(f.value), method: f.method.trim() } }); setF({ ...f, value: "" }); onSaved(); }
    catch (x) { toast.error((x as Error).message); }
  }
  return (
    <Card title="5. Ground-truth annotations">
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-6">
        <select aria-label="Participant" required className={inputCls} value={f.participantId} onChange={(e) => setF({ ...f, participantId: e.target.value, runId: "" })}><option value="">Participant…</option>{b.participants.map((p: any) => <option key={p.id} value={p.id}>{p.participant_code}</option>)}</select>
        <select aria-label="Run" className={inputCls} value={f.runId} onChange={(e) => setF({ ...f, runId: e.target.value })}><option value="">Latest run</option>{runs.map((r: any) => <option key={r.runId} value={r.runId}>{r.visitCode} t{r.trial ?? 1}</option>)}</select>
        <select aria-label="Parameter" className={inputCls} value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })}>{PARAMETER_DEFINITIONS.map((d) => <option key={d.key} value={d.key}>{d.name} ({d.unit})</option>)}</select>
        <input aria-label="Reference value" required type="number" step="any" className={inputCls} placeholder="Value" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        <input aria-label="Reference method" required minLength={2} className={inputCls} placeholder="Method, e.g. GAITRite" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} />
        <button className={btnGhost}>Add</button>
      </form>
      {!b.annotations.length ? <Empty>No reference measurements entered.</Empty> : (
        <ul className="mt-3 space-y-1 text-xs">{b.annotations.map((a: any) => <li key={a.id}>{a.participant_code} · {PARAMETER_DEFINITIONS.find((d) => d.key === a.parameter_key)?.name ?? a.parameter_key} = {a.value} {a.unit} · {a.method}</li>)}</ul>
      )}
    </Card>
  );
}

function Experiments({ b, onSaved }: { b: any; onSaved: () => void }) {
  const fn = useServerFn(runExperiment);
  const [f, setF] = useState({ name: "", split: "all" as "all" | "train" | "validation" | "test", features: [] as string[], notes: "" });
  const [busy, setBusy] = useState(false);
  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!f.features.length) return toast.error("Select at least one parameter.");
    setBusy(true);
    try { const r = await fn({ data: { projectId: b.project.id, name: f.name.trim(), split: f.split, features: f.features, preprocessing: { smoothing: "Savitzky–Golay (engine default)", qualityGate: "video-config thresholds" }, notes: f.notes || undefined } }); toast.success(r.status === "evaluated" ? "Evaluation complete" : "Insufficient paired data for metrics"); onSaved(); }
    catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }
  const fmt = (x: number | undefined | null) => (x == null ? "—" : x.toFixed(3));
  return (
    <Card title="6. Evaluation">
      <form onSubmit={run} className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <input aria-label="Experiment name" required className={inputCls} placeholder="Experiment name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <select aria-label="Split" className={inputCls} value={f.split} onChange={(e) => setF({ ...f, split: e.target.value as any })}><option value="all">All included</option><option value="train">Train</option><option value="validation">Validation</option><option value="test">Test</option></select>
          <input aria-label="Notes" className={inputCls} placeholder="Experiment notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-2">{PARAMETER_DEFINITIONS.map((d) => <label key={d.key} className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs"><input type="checkbox" checked={f.features.includes(d.key)} onChange={(e) => setF({ ...f, features: e.target.checked ? [...f.features, d.key] : f.features.filter((k) => k !== d.key) })} />{d.name}</label>)}</div>
        <button className={btnPrimary} disabled={busy}>{busy ? "Evaluating…" : "Run evaluation"}</button>
      </form>
      {!b.experiments.length ? <Empty>No evaluations yet.</Empty> : b.experiments.map((x: any) => (
        <div key={x.id} className="mt-4 rounded-xl border border-border p-3">
          <div className="flex justify-between text-sm"><span className="font-medium">{x.name}</span><span className="text-xs text-muted-foreground">{x.status} · {x.created_at.slice(0, 16).replace("T", " ")} · split {x.results?.split}</span></div>
          <div className="overflow-x-auto"><table className="mt-2 w-full text-xs">
            <thead className="text-left text-muted-foreground"><tr><th>Parameter</th><th>n</th><th>MAE</th><th>MAE 95% CI</th><th>Bias</th><th>LoA</th><th>RMSE</th><th>ICC(2,1)</th></tr></thead>
            <tbody>{(x.results?.perParameter ?? []).map((p: any) => { const a = p.agreement; return (
              <tr key={p.key} className="border-t border-border/50"><td className="py-1">{p.name} ({p.unit})</td><td>{a.n}</td>{a.status !== "ok" ? <td colSpan={6} className="text-muted-foreground">{a.reason}</td> : <><td>{fmt(a.mae)}</td><td>{a.maeCI ? `${fmt(a.maeCI[0])}–${fmt(a.maeCI[1])}` : "n < 8"}</td><td>{fmt(a.bias)}</td><td>{fmt(a.loaLower)} – {fmt(a.loaUpper)}</td><td>{fmt(a.rmse)}</td><td>{a.icc == null ? "n < 10" : fmt(a.icc)}</td></>}</tr>
            ); })}</tbody>
          </table></div>
        </div>
      ))}
      <p className="mt-2 text-xs text-muted-foreground">No classifier is evaluated here; sensitivity/specificity are not shown because no validated classifier with reference labels exists.</p>
    </Card>
  );
}

function Exports({ b }: { b: any }) {
  const log = useServerFn(logResearchExport);
  const report = () => buildResearchReport(b, ANALYSIS_VERSIONS);
  const code = b.project.project_code;
  async function go(format: "csv" | "json" | "pdf") {
    const r = report();
    if (format === "csv") download(`${code}-measurements.csv`, toCsv(b.measurements), "text/csv");
    if (format === "json") download(`${code}-report.json`, JSON.stringify({ ...r, measurements: b.measurements, annotations: b.annotations }, null, 2), "application/json");
    if (format === "pdf") researchReportPdf(r, b.experiments).save(`${code}-report.pdf`);
    await log({ data: { projectId: b.project.id, format } }).catch(() => {});
  }
  return (
    <Card title="7. Reproducible exports">
      <div className="flex flex-wrap gap-2"><button className={btnGhost} onClick={() => go("csv")}>CSV measurements</button><button className={btnGhost} onClick={() => go("json")}>JSON report</button><button className={btnGhost} onClick={() => go("pdf")}>PDF report</button></div>
      <p className="mt-2 text-xs text-muted-foreground">Exports contain coded participant IDs, dataset checksums, software versions and evaluation settings only.</p>
    </Card>
  );
}
