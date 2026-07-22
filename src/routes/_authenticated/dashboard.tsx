import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Activity, Sparkles, User, LogOut,
  FileDown, FileJson, FileSpreadsheet, ImageDown, Printer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { saveReport, listReports } from "@/lib/reports.functions";
import type { AnalysisResult, ClinicalStatus, ParameterRow } from "@/lib/mock-analysis";
import { exportCSV, exportJSON, exportPDF, exportPNG } from "@/lib/export-report";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Stored = {
  result: AnalysisResult;
  patient_name: string;
  media_kind: "gait" | "facial";
  media_name: string;
};

const STATUS_COLOR: Record<ClinicalStatus, string> = {
  normal: "text-success",
  borderline: "text-warning",
  abnormal: "text-danger",
};
const STATUS_DOT: Record<ClinicalStatus, string> = {
  normal: "bg-success",
  borderline: "bg-warning",
  abnormal: "bg-danger",
};
const STATUS_HEX: Record<ClinicalStatus, string> = {
  normal: "#22C55E",
  borderline: "#F59E0B",
  abnormal: "#EF4444",
};

function DashboardPage() {
  const [stored, setStored] = useState<Stored | null>(null);
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);

  const save = useServerFn(saveReport);
  const list = useServerFn(listReports);

  const historyQuery = useQuery({
    queryKey: ["reports"],
    queryFn: () => list(),
  });

  useEffect(() => {
    const raw = sessionStorage.getItem("latestResult");
    if (raw) {
      try { setStored(JSON.parse(raw) as Stored); } catch { /* ignore */ }
    }
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function onSave() {
    if (!stored) return;
    setSaving(true);
    try {
      const { id } = await save({
        data: {
          kind: stored.result.kind,
          mode: stored.result.mode,
          probability: stored.result.probability,
          confidence: stored.result.confidence,
          risk_level: stored.result.riskLevel,
          patient_name: patientName || undefined,
          age: age ? parseInt(age, 10) : undefined,
          gender: gender || undefined,
          parameters: stored.result.parameters,
          media_name: stored.media_name,
          summary: stored.result.summary as unknown as Record<string, unknown>,
        },
      });
      setSavedId(id);
      historyQuery.refetch();
      sessionStorage.removeItem("latestResult");
      toast.success("Report saved to your history");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  async function onExportPNG() {
    if (!reportRef.current || !stored) return;
    try {
      await exportPNG(reportRef.current, stored.result);
      toast.success("PNG exported");
    } catch {
      toast.error("PNG export failed");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl glass gradient-border">
            <Activity className="h-5 w-5 text-cyan" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan">Clinical Dashboard</div>
            <h1 className="truncate font-display text-2xl sm:text-3xl font-semibold">
              NeuroStride Assessment
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2 rounded-lg glass px-3 py-2 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            {email ?? "…"}
          </div>
          <button onClick={onLogout} className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      {!stored && !savedId && <EmptyState />}

      {stored && (
        <div ref={reportRef} className="mt-8 space-y-4">
          {/* Top row: risk gauge + health score + severity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GaugeCard
              label="Parkinson's Risk"
              value={stored.result.summary.parkinsonsRisk}
              caption={stored.result.riskLevel + " risk"}
              hue="risk"
            />
            <GaugeCard
              label="Overall Gait Health"
              value={stored.result.summary.overallGaitHealth}
              caption={stored.result.summary.severity}
              hue="health"
            />
            <div className="glass gradient-border rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan">Assessment</div>
                <div className="mt-2 font-display text-2xl font-semibold">
                  {stored.result.summary.severity}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  AI Confidence {(stored.result.summary.confidence * 100).toFixed(1)}%
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <StatBadge n={stored.result.summary.counts.normal} label="Normal" color="success" />
                <StatBadge n={stored.result.summary.counts.borderline} label="Borderline" color="warning" />
                <StatBadge n={stored.result.summary.counts.abnormal} label="Abnormal" color="danger" />
              </div>
            </div>
          </div>

          {/* Patient info + export toolbar */}
          <div className="glass rounded-2xl p-6 print:hidden">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan">Patient information</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Patient name / ID" value={patientName} onChange={setPatientName} placeholder="Optional" />
              <Field label="Age" value={age} onChange={setAge} placeholder="e.g. 62" type="number" />
              <Field label="Gender" value={gender} onChange={setGender} placeholder="e.g. Female" />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Media: <span className="text-foreground/80">{stored.media_name}</span> · Mode: <span className="text-foreground/80">{stored.result.mode}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <ExportBtn onClick={exportPDF} icon={Printer} label="PDF" />
                <ExportBtn onClick={onExportPNG} icon={ImageDown} label="PNG" />
                <ExportBtn onClick={() => exportCSV(stored.result)} icon={FileSpreadsheet} label="CSV" />
                <ExportBtn onClick={() => exportJSON(stored.result, { name: patientName, age, gender })} icon={FileJson} label="JSON" />
                <button
                  onClick={onSave}
                  disabled={saving || !!savedId}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 glow-primary disabled:opacity-60 inline-flex items-center gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  {savedId ? "Saved ✓" : saving ? "Saving…" : "Save report"}
                </button>
              </div>
            </div>
          </div>

          {/* AI Clinical Summary */}
          <ClinicalSummaryCard result={stored.result} />

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-6 lg:col-span-1 min-h-[320px]">
              <div className="text-xs uppercase tracking-[0.2em] text-cyan mb-2">Parameter Distribution</div>
              <StatusPie result={stored.result} />
            </div>
            <div className="glass rounded-2xl p-6 lg:col-span-2 min-h-[320px]">
              <div className="text-xs uppercase tracking-[0.2em] text-cyan mb-2">Patient vs Healthy Standard</div>
              <ParamBar result={stored.result} />
            </div>
            <div className="glass rounded-2xl p-6 lg:col-span-3 min-h-[380px]">
              <div className="text-xs uppercase tracking-[0.2em] text-cyan mb-2">Radar — normalized to healthy = 100</div>
              <ParamRadar result={stored.result} />
            </div>
          </div>

          {/* Clinical comparison table */}
          <div className="glass rounded-2xl p-6 overflow-x-auto">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan mb-3">Clinical Comparison</div>
            <ClinicalTable rows={stored.result.parameters} />
          </div>

          {/* Reference + disclaimer */}
          <div className="glass rounded-2xl p-6 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground/80">Clinical reference:</strong> Healthy adult gait reference values are
              derived from internationally accepted clinical gait analysis literature, rehabilitation guidelines, and
              validated biomechanical research. Where applicable, rehabilitation practices align with World Health
              Organization (WHO) guidance. These values are intended solely for clinical comparison and educational
              decision support and do not constitute a definitive medical diagnosis.
            </p>
            <p className="mt-3">
              <strong className="text-foreground/80">Disclaimer:</strong> This AI system is designed as a clinical
              decision-support and educational tool. It is not a substitute for diagnosis, treatment, or medical advice
              from a qualified neurologist or healthcare professional. All results should be interpreted alongside a
              comprehensive clinical examination.
            </p>
          </div>
        </div>
      )}

      {/* History */}
      <div className="mt-10 print:hidden">
        <h2 className="font-display text-xl font-semibold mb-3">Recent reports</h2>
        <div className="glass rounded-2xl p-4">
          {historyQuery.isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {historyQuery.data && historyQuery.data.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No saved reports yet.</div>
          )}
          <ul className="divide-y divide-border/60">
            {historyQuery.data?.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-2 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.patient_name || "Unnamed patient"} · {r.kind === "gait" ? "Gait" : "Facial"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} · {r.mode} · {r.risk_level}
                  </div>
                </div>
                <div className="text-sm gradient-text font-semibold">
                  {(Number(r.probability) * 100).toFixed(0)}%
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------- subcomponents ---------------- */

function EmptyState() {
  return (
    <div className="mt-10 glass gradient-border rounded-3xl p-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 grid place-items-center glow-primary">
        <Sparkles className="h-6 w-6 text-cyan" />
      </div>
      <h2 className="mt-4 font-display text-2xl font-semibold">No analysis loaded</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Go back to the home page and upload a walking video to see clinical results here.
      </p>
      <a href="/#analyze" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary hover:brightness-110">
        Start analysis
      </a>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (s: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function ExportBtn({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 inline-flex items-center gap-1.5"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function StatBadge({ n, label, color }: { n: number; label: string; color: "success" | "warning" | "danger" }) {
  return (
    <div className={`rounded-lg border border-${color}/40 bg-${color}/5 p-2`}>
      <div className={`font-display text-2xl font-semibold text-${color}`}>{n}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function GaugeCard({
  label, value, caption, hue,
}: { label: string; value: number; caption: string; hue: "risk" | "health" }) {
  const pct = Math.round(value);
  const angle = (pct / 100) * 360;
  const grad =
    hue === "risk"
      ? `conic-gradient(from -90deg, #22C55E 0deg, #F59E0B ${angle * 0.5}deg, #EF4444 ${angle}deg, oklch(0.28 0.04 265 / 0.35) ${angle}deg 360deg)`
      : `conic-gradient(from -90deg, oklch(0.68 0.19 255) 0deg, oklch(0.82 0.15 200) ${angle * 0.5}deg, #22C55E ${angle}deg, oklch(0.28 0.04 265 / 0.35) ${angle}deg 360deg)`;
  return (
    <div className="glass gradient-border rounded-2xl p-6">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan">{label}</div>
      <div className="relative mx-auto mt-4 h-44 w-44">
        <div className="absolute inset-0 rounded-full" style={{ background: grad }} />
        <div className="absolute inset-3 rounded-full bg-background grid place-items-center">
          <div className="text-center">
            <div className="font-display text-4xl font-bold gradient-text">{pct}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
          </div>
        </div>
      </div>
      <div className="mt-3 text-center text-sm text-foreground/80">{caption}</div>
    </div>
  );
}

function ClinicalSummaryCard({ result }: { result: AnalysisResult }) {
  const s = result.summary;
  return (
    <div className="glass rounded-2xl p-6">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan">AI Clinical Summary</div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricPill label="Balance Score" value={`${s.balanceScore}%`} sub={s.assessments.balance} />
        <MetricPill label="Fall Risk" value={`${s.fallRiskScore}%`} sub={s.assessments.fallRisk} />
        <MetricPill label="Mobility" value={`${s.overallGaitHealth}/100`} sub={s.assessments.mobility} />
        <MetricPill label="Symmetry" value={s.assessments.symmetry.split(" ").slice(0, 2).join(" ")} sub={s.assessments.stability} />
      </div>
      <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <div className="text-xs uppercase tracking-wider text-cyan mb-1">Clinical recommendation</div>
        {s.recommendation}
      </div>
    </div>
  );
}

function MetricPill({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-semibold mt-0.5">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function ClinicalTable({ rows }: { rows: ParameterRow[] }) {
  return (
    <table className="w-full text-sm min-w-[820px]">
      <thead className="text-xs uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="text-left py-2">Parameter</th>
          <th className="text-right py-2">Patient</th>
          <th className="text-right py-2">Healthy Range</th>
          <th className="py-2 text-left pl-4">Range progress</th>
          <th className="text-right py-2">Deviation</th>
          <th className="text-center py-2">Status</th>
          <th className="text-left py-2 pl-4">Clinical interpretation</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => {
          const [lo, hi] = p.range;
          const span = Math.max(hi - lo, Math.abs((lo + hi) / 2) * 0.4 || 1);
          const min = lo - span;
          const max = hi + span;
          const pos = Math.max(0, Math.min(100, ((p.patient - min) / (max - min)) * 100));
          const rangeStart = ((lo - min) / (max - min)) * 100;
          const rangeEnd = ((hi - min) / (max - min)) * 100;
          return (
            <tr key={p.key} className="border-t border-border/40 align-top">
              <td className="py-3 pr-2">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.unit}</div>
              </td>
              <td className="py-3 text-right font-mono">{p.patient}</td>
              <td className="py-3 text-right text-muted-foreground font-mono">
                {lo}–{hi}
              </td>
              <td className="py-3 pl-4 w-56">
                <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="absolute inset-y-0 bg-success/30"
                    style={{ left: `${rangeStart}%`, width: `${rangeEnd - rangeStart}%` }}
                  />
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-3 w-1 rounded-full ${STATUS_DOT[p.status]}`}
                    style={{ left: `calc(${pos}% - 2px)` }}
                  />
                </div>
              </td>
              <td className={`py-3 text-right font-mono ${p.deviationPct >= 0 ? "text-cyan" : "text-purple"}`}>
                {p.deviationPct > 0 ? "+" : ""}{p.deviationPct.toFixed(1)}%
              </td>
              <td className="py-3 text-center">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs capitalize ${
                  p.status === "normal" ? "border-success/50 text-success bg-success/5" :
                  p.status === "borderline" ? "border-warning/50 text-warning bg-warning/5" :
                  "border-danger/50 text-danger bg-danger/5"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
                  {p.status === "normal" ? "🟢 Normal" : p.status === "borderline" ? "🟡 Borderline" : "🔴 Abnormal"}
                </span>
              </td>
              <td className={`py-3 pl-4 text-xs ${STATUS_COLOR[p.status]}`}>
                {p.interpretation}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "rgba(11,17,32,0.9)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#F8FAFC",
  fontSize: 12,
};

function ParamRadar({ result }: { result: AnalysisResult }) {
  const data = useMemo(
    () =>
      result.parameters.map((p) => {
        const mid = (p.range[0] + p.range[1]) / 2 || 1;
        const norm = Math.min(180, Math.max(0, (p.patient / mid) * 100));
        return {
          name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name,
          patient: +norm.toFixed(1),
          standard: 100,
        };
      }),
    [result],
  );
  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={data}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 10 }} />
        <PolarRadiusAxis tick={false} axisLine={false} />
        <Radar name="Healthy" dataKey="standard" stroke="#22D3EE" fill="#22D3EE" fillOpacity={0.08} />
        <Radar name="Patient" dataKey="patient" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.35} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ color: "#94A3B8", fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function ParamBar({ result }: { result: AnalysisResult }) {
  const data = result.parameters.map((p) => ({
    name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
    patient: p.patient,
    standard: p.standard,
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
        <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ color: "#94A3B8", fontSize: 12 }} />
        <Bar name="Healthy standard" dataKey="standard" fill="#3B82F6" radius={[6, 6, 0, 0]} />
        <Bar name="Patient" dataKey="patient" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function StatusPie({ result }: { result: AnalysisResult }) {
  const c = result.summary.counts;
  const data = [
    { name: "Normal", value: c.normal, s: "normal" as ClinicalStatus },
    { name: "Borderline", value: c.borderline, s: "borderline" as ClinicalStatus },
    { name: "Abnormal", value: c.abnormal, s: "abnormal" as ClinicalStatus },
  ];
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
          {data.map((d) => <Cell key={d.name} fill={STATUS_HEX[d.s]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ color: "#94A3B8", fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
