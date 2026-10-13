import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getPatient, createVisit, updatePatient, getVisit } from "@/lib/clinical.functions";
import { PROTOCOLS } from "@/lib/video-config";
import { PARAMETER_DEFINITIONS } from "@/lib/gait-engine/parameters";
import { compareParameters } from "@/lib/clinical-rules";
import { PageShell, Card, Loading, ErrorBox, Empty, Notice, StatusBadge, inputCls, btnPrimary, btnGhost } from "@/components/workspace/shared";

export const Route = createFileRoute("/_authenticated/clinical/patients/$id")({
  head: () => ({
    meta: [
      { title: "Patient profile — Clinical Assessment" },
      { name: "description", content: "Patient details, visits and comparisons." },
      { property: "og:title", content: "Patient profile — Clinical Assessment" },
      { property: "og:description", content: "Patient details, visits and comparisons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatientPage,
});

function PatientPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getPatient);
  const q = useQuery({ queryKey: ["patient", id], queryFn: () => fn({ data: { id } }) });
  const [newVisit, setNewVisit] = useState(false);
  const [editing, setEditing] = useState(false);
  if (q.isLoading) return <PageShell eyebrow="Patient" title="Loading…"><Loading /></PageShell>;
  if (q.error) return <PageShell eyebrow="Patient" title="Unavailable" back={{ to: "/clinical", label: "Patients" }}><ErrorBox message={(q.error as Error).message} /></PageShell>;
  const { subject: s, visits, consents, history } = q.data as any;
  return (
    <PageShell eyebrow={`Patient · ${s.subject_code}`} title={s.display_name} back={{ to: "/clinical", label: "Patients" }}
      actions={<button className={btnPrimary} onClick={() => setNewVisit(true)}>New visit</button>}>
      {newVisit && <NewVisit subject={s} onCancel={() => setNewVisit(false)} />}
      <Card title="Patient details" right={<button className={btnGhost} onClick={() => setEditing((v) => !v)}>{editing ? "Close" : "Correct details"}</button>}>
        {editing ? <Correction s={s} onDone={() => setEditing(false)} /> : (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            {[["Subject ID", s.subject_code], ["Age", s.age], ["Sex", s.sex], ["Height", s.height_cm ? `${s.height_cm} cm` : "—"], ["Weight", s.weight_kg ? `${s.weight_kg} kg` : "—"], ["Clinical history", s.clinical_history || "—"]].map(([k, v]) => (
              <div key={k as string}><dt className="text-xs text-muted-foreground">{k}</dt><dd>{String(v ?? "—")}</dd></div>
            ))}
          </dl>
        )}
      </Card>
      <Card title="Visit history">
        {!visits.length ? <Empty>No visits yet. Start a new visit to record an assessment.</Empty> : (
          <ul className="divide-y divide-border/50">
            {visits.map((v: any) => {
              const runs = (v.recordings ?? []).flatMap((r: any) => (r.analysis_runs ?? []).map((a: any) => ({ ...a, trial: r.trial_number })));
              return (
                <li key={v.id}>
                  <Link to="/clinical/visits/$id" params={{ id: v.id }} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3 hover:bg-white/5">
                    <div>
                      <div className="font-medium">{v.visit_code} {v.is_baseline && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-cyan">Baseline</span>}</div>
                      <div className="text-xs text-muted-foreground">{v.visit_date.slice(0, 10)} · {v.protocol ?? "—"} · {v.recording_condition} · {v.status}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">{runs.length ? runs.map((r: any) => <StatusBadge key={r.id} status={r.status} />) : <span className="text-xs text-muted-foreground">no trials</span>}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {visits.length >= 2 && <Compare visits={visits} />}
      <Card title="Consent records">
        {!consents.length ? <Empty>No consent recorded yet.</Empty> : (
          <ul className="text-sm space-y-1">{consents.map((c: any) => <li key={c.id}>{c.recorded_at.slice(0, 10)} · {c.consent_type} · {c.granted ? "granted" : "declined"} · v{c.document_version}{c.withdrawn_at ? " · withdrawn" : ""}</li>)}</ul>
        )}
      </Card>
      <Card title="Correction history">
        {!history.length ? <Empty>No corrections recorded.</Empty> : (
          <ul className="text-xs space-y-2">{history.map((h: any, i: number) => <li key={i}><span className="text-muted-foreground">{h.created_at.slice(0, 16).replace("T", " ")}</span> · {h.action} {h.details?.reason ? `— ${h.details.reason}` : ""} {h.details?.changed ? <code className="ml-1">{Object.entries(h.details.changed).map(([k, v]: any) => `${k}: ${v.from ?? "∅"} → ${v.to ?? "∅"}`).join("; ")}</code> : null}</li>)}</ul>
        )}
      </Card>
    </PageShell>
  );
}

function Correction({ s, onDone }: { s: any; onDone: () => void }) {
  const fn = useServerFn(updatePatient);
  const qc = useQueryClient();
  const [f, setF] = useState({ name: s.display_name ?? "", age: String(s.age ?? ""), sex: s.sex ?? "", heightCm: s.height_cm ? String(s.height_cm) : "", weightKg: s.weight_kg ? String(s.weight_kg) : "", clinicalHistory: s.clinical_history ?? "", reason: "" });
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.reason.trim().length < 3) return toast.error("Enter a reason for the correction.");
    setBusy(true);
    try {
      await fn({ data: { id: s.id, name: f.name.trim(), age: Number(f.age), sex: f.sex, heightCm: f.heightCm ? +f.heightCm : null, weightKg: f.weightKg ? +f.weightKg : null, clinicalHistory: f.clinicalHistory.trim() || null, reason: f.reason } });
      toast.success("Correction saved to the audit history");
      qc.invalidateQueries({ queryKey: ["patient", s.id] });
      onDone();
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }
  const inp = (k: keyof typeof f, label: string, type = "text") => <label className="block"><span className="text-xs text-muted-foreground">{label}</span><input type={type} className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
      {inp("name", "Patient Name *")}{inp("age", "Age *", "number")}
      <label className="block"><span className="text-xs text-muted-foreground">Sex *</span><select className={inputCls} value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option></select></label>
      {inp("heightCm", "Height (cm)", "number")}{inp("weightKg", "Weight (kg)", "number")}{inp("clinicalHistory", "Clinical history")}
      <div className="sm:col-span-3">{inp("reason", "Reason for correction *")}</div>
      <div className="sm:col-span-3 flex justify-end"><button className={btnPrimary} disabled={busy}>Save correction</button></div>
    </form>
  );
}

function NewVisit({ subject, onCancel }: { subject: any; onCancel: () => void }) {
  const fn = useServerFn(createVisit);
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ protocol: "straight", condition: "", notes: "", medication: "", updrs: "", hy: "", consent: false, docVersion: "1.0", recordedBy: "" });
  const [busy, setBusy] = useState(false);
  const proto = PROTOCOLS.find((p) => p.id === f.protocol)!;
  async function submit() {
    if (!f.condition.trim() || !f.notes.trim()) { setStep(2); return toast.error("Recording condition and notes are required."); }
    if (!f.consent || !f.recordedBy.trim()) { setStep(3); return toast.error("Consent must be obtained and recorded before recording."); }
    setBusy(true);
    try {
      const scores: Record<string, number | string> = {};
      if (f.updrs) scores["MDS-UPDRS III"] = Number(f.updrs);
      if (f.hy) scores["Hoehn & Yahr"] = f.hy;
      const r = await fn({ data: { subjectId: subject.id, protocol: f.protocol, recordingCondition: f.condition.trim(), notes: f.notes.trim(), medicationState: f.medication || null, clinicalScores: scores, consent: { granted: true, documentVersion: f.docVersion, recordedBy: f.recordedBy.trim() } } });
      toast.success(`Visit ${r.code} created`);
      nav({ to: "/clinical/visits/$id", params: { id: r.id } });
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }
  const steps = ["Protocol", "Session details", "Consent"];
  return (
    <Card title="New visit">
      <ol className="mb-4 flex gap-2 text-xs" aria-label="Progress">{steps.map((s, i) => <li key={s} className={`rounded-full px-3 py-1 ${step === i + 1 ? "bg-primary/20 text-cyan" : "bg-white/5 text-muted-foreground"}`}>{i + 1}. {s}</li>)}</ol>
      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {PROTOCOLS.map((p) => (
            <label key={p.id} className={`cursor-pointer rounded-xl border p-4 ${f.protocol === p.id ? "border-primary bg-primary/5" : "border-border"}`}>
              <input type="radio" name="proto" className="sr-only" checked={f.protocol === p.id} onChange={() => setF({ ...f, protocol: p.id })} />
              <div className="font-medium">{p.label}</div>
              <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">{p.instructions.map((i) => <li key={i}>{i}</li>)}</ul>
            </label>
          ))}
          {(f.protocol === "tug" || f.protocol === "10mwt") && <div className="sm:col-span-2"><Notice>A {proto.label} result is only reported after you mark start and stop on the recorded video{f.protocol === "10mwt" ? " and confirm the 10 m timed distance" : ""}. It is never inferred from the video alone.</Notice></div>}
        </div>
      )}
      {step === 2 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 text-xs text-muted-foreground">Patient: {subject.display_name} · {subject.subject_code} · {subject.age} y · {subject.sex} (from the patient record)</div>
          <label className="block"><span className="text-xs text-muted-foreground">Recording Condition *</span><input className={inputCls} value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} placeholder="e.g. indoor corridor, self-selected pace" /></label>
          <label className="block"><span className="text-xs text-muted-foreground">Medication state — optional</span><select className={inputCls} value={f.medication} onChange={(e) => setF({ ...f, medication: e.target.value })}><option value="">Not recorded</option><option>ON</option><option>OFF</option><option>Unknown</option></select></label>
          <label className="block sm:col-span-2"><span className="text-xs text-muted-foreground">Notes *</span><textarea rows={3} className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Enter relevant observations or recording notes" /></label>
          <label className="block"><span className="text-xs text-muted-foreground">MDS-UPDRS Part III — optional</span><input type="number" min={0} max={132} className={inputCls} value={f.updrs} onChange={(e) => setF({ ...f, updrs: e.target.value })} /></label>
          <label className="block"><span className="text-xs text-muted-foreground">Hoehn &amp; Yahr stage — optional</span><select className={inputCls} value={f.hy} onChange={(e) => setF({ ...f, hy: e.target.value })}><option value="">Not recorded</option>{["1", "1.5", "2", "2.5", "3", "4", "5"].map((x) => <option key={x}>{x}</option>)}</select></label>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-1" /> The patient (or legal representative) gave informed consent for video recording and storage for clinical assessment.</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-xs text-muted-foreground">Consent document version *</span><input className={inputCls} value={f.docVersion} onChange={(e) => setF({ ...f, docVersion: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-muted-foreground">Consent recorded by *</span><input className={inputCls} value={f.recordedBy} onChange={(e) => setF({ ...f, recordedBy: e.target.value })} placeholder="Clinician name" /></label>
          </div>
          <Notice>This consent covers clinical use only. It does not authorise using the recording for research or model training.</Notice>
        </div>
      )}
      <div className="mt-5 flex justify-between">
        <button className={btnGhost} onClick={step === 1 ? onCancel : () => setStep(step - 1)}>{step === 1 ? "Cancel" : "Back"}</button>
        {step < 3 ? <button className={btnPrimary} onClick={() => setStep(step + 1)}>Next</button> : <button className={btnPrimary} disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create visit"}</button>}
      </div>
    </Card>
  );
}

function latestParams(v: any) {
  const runs = (v.recordings ?? []).flatMap((r: any) => r.analysis_runs ?? []).filter((a: any) => a.status === "completed" || a.status === "completed_with_warnings");
  const run = runs.sort((a: any, b: any) => String(b.completed_at).localeCompare(String(a.completed_at)))[0];
  const res = run ? v.results.find((r: any) => r.run_id === run.id) : null;
  return { run, params: res?.engine_output?.parameters ?? [], quality: res?.quality ?? null };
}

function Compare({ visits }: { visits: any[] }) {
  const [a, setA] = useState(visits[visits.length - 1].id);
  const [b, setB] = useState(visits[0].id);
  const fn = useServerFn(getVisit);
  const qa = useQuery({ queryKey: ["visit", a], queryFn: () => fn({ data: { id: a } }) });
  const qb = useQuery({ queryKey: ["visit", b], queryFn: () => fn({ data: { id: b } }) });
  const ready = qa.data && qb.data;
  const A = ready ? latestParams({ ...(qa.data as any).visit, recordings: (qa.data as any).recordings, results: (qa.data as any).results }) : null;
  const B = ready ? latestParams({ ...(qb.data as any).visit, recordings: (qb.data as any).recordings, results: (qb.data as any).results }) : null;
  const diffs = A && B ? compareParameters(A.params, B.params) : [];
  const va = (qa.data as any)?.visit, vb = (qb.data as any)?.visit;
  return (
    <Card title="Compare visits">
      <div className="flex flex-wrap gap-3 text-sm">
        {[[a, setA, "Earlier"], [b, setB, "Later"]].map(([val, set, label]: any) => (
          <label key={label} className="block"><span className="text-xs text-muted-foreground">{label}</span><select className={inputCls} value={val} onChange={(e) => set(e.target.value)}>{visits.map((v) => <option key={v.id} value={v.id}>{v.visit_code} · {v.visit_date.slice(0, 10)}</option>)}</select></label>
        ))}
      </div>
      {!ready ? <Loading /> : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            {[[va, A], [vb, B]].map(([v, X]: any, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="font-medium">{v.visit_code}</div>
                <div className="text-muted-foreground">Condition: {v.recording_condition} · Medication: {v.medication_state ?? "not recorded"} · Protocol: {v.protocol ?? "—"}</div>
                <div className="text-muted-foreground">Quality: {X.quality ? `${X.quality.usablePercent}% usable frames, ${X.quality.usableCycles} cycles, median pose confidence ${X.quality.poseConfidence?.median ?? "n/a"}` : "no completed analysis"}</div>
              </div>
            ))}
          </div>
          {va.recording_condition !== vb.recording_condition || va.medication_state !== vb.medication_state || va.protocol !== vb.protocol ? <Notice>Recording conditions differ between these visits. Differences may reflect setup rather than the patient.</Notice> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="py-2">Parameter</th><th>Earlier</th><th>Later</th><th>Difference</th><th>%</th></tr></thead>
              <tbody>{diffs.map((d) => { const def = PARAMETER_DEFINITIONS.find((x) => x.key === d.key); return (
                <tr key={d.key} className="border-t border-border/50"><td className="py-2">{def?.name ?? d.key} <span className="text-xs text-muted-foreground">{def?.unit}</span></td><td>{d.a ?? "—"}</td><td>{d.b ?? "—"}</td><td className="font-mono">{d.diff ?? <span className="text-xs text-muted-foreground">{d.note}</span>}</td><td>{d.pct ?? ""}</td></tr>
              ); })}</tbody>
            </table>
          </div>
          <Notice>Differences are shown without interpretation. No measurement-specific minimal detectable change has been established for this pipeline, so changes are not labelled as improvement or deterioration.</Notice>
        </div>
      )}
    </Card>
  );
}
