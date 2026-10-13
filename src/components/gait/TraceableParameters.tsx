import { Fragment, useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PARAMETER_DEFINITIONS, type EngineOutput, type ParamStatus } from "@/lib/gait-engine/parameters";

type Stored = EngineOutput & {
  quality?: {
    framesProcessed: number; usableFrames: number; usablePercent: number; missingLandmarkRate: number; usableCycles: number;
    poseConfidence: { median: number | null; p10: number | null; p90: number | null; note: string };
    eventConfidence: number | null; eventConfidenceNote: string; warnings: string[]; uncertainty: string;
  };
  eventMethod?: { name: string; description: string; thresholds: string; minimumQuality: string; limitations: string };
};

const BADGE: Record<ParamStatus, string> = {
  measured: "border-success/40 text-success",
  estimated: "border-cyan/40 text-cyan",
  experimental: "border-primary/40 text-primary",
  unavailable: "border-border text-muted-foreground",
};

export function TraceableParameters() {
  const [e, setE] = useState<Stored | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("latestEngine");
      setE(raw ? JSON.parse(raw) : null);
    } catch {
      setE(null);
    }
  }, []);
  if (!e) return null;
  const defs = new Map(PARAMETER_DEFINITIONS.map((d) => [d.key, d]));
  const series = e.stepSeries ?? [];
  const chart = series.map((s) => ({ t: s.t, left: s.side === "left" ? s.stepTime : null, right: s.side === "right" ? s.stepTime : null }));
  const q = e.quality;

  return (
    <section className="glass rounded-2xl p-6 space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-cyan">Traceable gait engine · {e.version}</div>
        <h3 className="font-display text-xl font-semibold">Video-derived gait parameters</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Calculated from this recording's detected events. Events are algorithmic estimates, not ground truth. No reference ranges are shown: none are documented for this video method and population.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="text-left"><th className="py-2 pr-3">Parameter</th><th className="pr-3">Value</th><th className="pr-3">Status</th><th className="pr-3">n</th><th>Validation / reason</th></tr>
          </thead>
          <tbody>
            {e.parameters.map((p) => {
              const d = defs.get(p.key);
              return (
                <Fragment key={p.key}>
                  <tr className="border-t border-border/40 align-top">
                    <td className="py-2 pr-3">
                      <button type="button" className="text-left hover:text-primary" onClick={() => setOpen(open === p.key ? null : p.key)} aria-expanded={open === p.key}>
                        {d?.name ?? p.key}
                      </button>
                    </td>
                    <td className="pr-3 font-mono">{p.value == null ? "—" : `${p.value} ${d?.unit ?? ""}`}</td>
                    <td className="pr-3"><span className={`rounded-full border px-2 py-0.5 text-[11px] ${BADGE[p.status]}`}>{p.status}</span></td>
                    <td className="pr-3">{p.n}</td>
                    <td className="text-xs text-muted-foreground">{p.reason ?? d?.validation}</td>
                  </tr>
                  {open === p.key && d && (
                    <tr>
                      <td colSpan={5} className="pb-3 text-xs text-muted-foreground">
                        <div><b>Definition:</b> {d.definition}</div>
                        <div><b>Formula:</b> {d.formula}</div>
                        <div><b>Inputs:</b> {d.inputs} · <b>Minimum:</b> {d.minimum}</div>
                        <div><b>Validation:</b> {d.validation} · <b>Failure modes:</b> {d.failureModes}</div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {series.length >= 3 ? (
        <div>
          <div className="text-sm font-medium">Step time per step (left vs right)</div>
          <div className="h-56 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeOpacity={0.1} />
                <XAxis dataKey="t" type="number" unit=" s" tick={{ fontSize: 11 }} />
                <YAxis unit=" s" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line dataKey="left" connectNulls stroke="var(--color-primary)" dot />
                <Line dataKey="right" connectNulls stroke="var(--color-cyan, var(--color-accent))" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Step-time chart unavailable: fewer than 3 valid steps were detected.</p>
      )}

      {q && (
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-border/60 p-3">Frames processed: <b>{q.framesProcessed}</b><br />Usable: <b>{q.usableFrames}</b> ({q.usablePercent}%)<br />Missing-landmark rate: <b>{(q.missingLandmarkRate * 100).toFixed(1)}%</b></div>
          <div className="rounded-xl border border-border/60 p-3">Usable gait cycles: <b>{q.usableCycles}</b><br />Pose confidence median (p10–p90): <b>{q.poseConfidence.median ?? "—"}</b> ({q.poseConfidence.p10 ?? "—"}–{q.poseConfidence.p90 ?? "—"})<br /><span className="text-muted-foreground">{q.poseConfidence.note}</span></div>
          <div className="rounded-xl border border-border/60 p-3">Event confidence: <b>{q.eventConfidence ?? "—"}</b><br /><span className="text-muted-foreground">{q.eventConfidenceNote}</span><br /><span className="text-muted-foreground">{q.uncertainty}</span></div>
        </div>
      )}

      {e.eventMethod && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer text-foreground">Event-detection method and limitations</summary>
          <p className="mt-2"><b>{e.eventMethod.name}.</b> {e.eventMethod.description}</p>
          <p className="mt-1"><b>Thresholds:</b> {e.eventMethod.thresholds}</p>
          <p className="mt-1"><b>Minimum quality:</b> {e.eventMethod.minimumQuality}</p>
          <p className="mt-1"><b>Limitations:</b> {e.eventMethod.limitations}</p>
          <p className="mt-1">Events: {e.counts.initialContacts} initial contacts, {e.counts.toeOffs} toe-offs; {e.counts.rejectedEvents} rejected.</p>
        </details>
      )}
    </section>
  );
}
