import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Activity, Brain, Download, Sparkles, User, LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { saveReport, listReports } from "@/lib/reports.functions";
import type { AnalysisResult } from "@/lib/mock-analysis";
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

function DashboardPage() {
  const [stored, setStored] = useState<Stored | null>(null);
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();

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

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl glass gradient-border">
            <Activity className="h-5 w-5 text-cyan" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan">Command center</div>
            <h1 className="truncate font-display text-2xl sm:text-3xl font-semibold">
              NeuroStride Dashboard
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

      {!stored && !savedId && (
        <EmptyState />
      )}

      {stored && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Prediction gauge */}
          <div className="glass gradient-border rounded-2xl p-6 lg:col-span-1">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan">Prediction</div>
            <ProbabilityGauge value={stored.result.probability} />
            <div className="mt-2 text-center">
              <div className="font-display text-xl font-semibold">{stored.result.riskLevel} risk</div>
              <div className="text-xs text-muted-foreground">
                Confidence {(stored.result.confidence * 100).toFixed(1)}% ·{" "}
                {stored.media_kind === "gait" ? "Gait" : "Facial"} · {stored.result.mode}
              </div>
            </div>
          </div>

          {/* Patient / save */}
          <div className="glass rounded-2xl p-6 lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan">Patient information</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Patient name" value={patientName} onChange={setPatientName} placeholder="Optional" />
              <Field label="Age" value={age} onChange={setAge} placeholder="e.g. 62" type="number" />
              <Field label="Gender" value={gender} onChange={setGender} placeholder="e.g. Female" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-muted-foreground">
                Media: <span className="text-foreground/80">{stored.media_name}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="rounded-lg border border-border px-4 py-2 text-sm inline-flex items-center gap-2 hover:text-foreground text-muted-foreground"
                >
                  <Download className="h-4 w-4" /> Print / PDF
                </button>
                <button
                  onClick={onSave}
                  disabled={saving || !!savedId}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 glow-primary disabled:opacity-60"
                >
                  {savedId ? "Saved ✓" : saving ? "Saving…" : "Save report"}
                </button>
              </div>
            </div>
          </div>

          {/* Radar chart */}
          <div className="glass rounded-2xl p-6 lg:col-span-1 min-h-[360px]">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan mb-2">Parameter radar</div>
            <ParamRadar result={stored.result} />
          </div>

          {/* Bar chart */}
          <div className="glass rounded-2xl p-6 lg:col-span-2 min-h-[360px]">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan mb-2">Patient vs standard</div>
            <ParamBar result={stored.result} />
          </div>

          {/* Parameter table */}
          <div className="glass rounded-2xl p-6 lg:col-span-3 overflow-x-auto">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan mb-3">Clinical comparison</div>
            <ParamTable result={stored.result} />
          </div>
        </div>
      )}

      {/* History */}
      <div className="mt-10">
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

function EmptyState() {
  return (
    <div className="mt-10 glass gradient-border rounded-3xl p-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 grid place-items-center glow-primary">
        <Sparkles className="h-6 w-6 text-cyan" />
      </div>
      <h2 className="mt-4 font-display text-2xl font-semibold">No analysis loaded</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Go back to the home page and upload a walking or facial recording to see results here.
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

function ProbabilityGauge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const angle = value * 360;
  return (
    <div className="relative mx-auto mt-4 h-52 w-52">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from -90deg, oklch(0.68 0.19 255) 0deg, oklch(0.82 0.15 200) ${angle * 0.4}deg, oklch(0.68 0.22 300) ${angle}deg, oklch(0.28 0.04 265 / 0.4) ${angle}deg 360deg)`,
        }}
      />
      <div className="absolute inset-3 rounded-full bg-background grid place-items-center">
        <div className="text-center">
          <div className="font-display text-5xl font-bold gradient-text">{pct}%</div>
          <div className="text-xs text-muted-foreground mt-1">Parkinson&apos;s probability</div>
        </div>
      </div>
    </div>
  );
}

function ParamRadar({ result }: { result: AnalysisResult }) {
  const data = useMemo(
    () =>
      result.parameters.slice(0, 8).map((p) => ({
        name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
        patient: Math.min(150, (p.patient / (p.standard || 1)) * 100),
        standard: 100,
      })),
    [result],
  );
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 10 }} />
        <PolarRadiusAxis tick={false} axisLine={false} />
        <Radar dataKey="standard" stroke="#22D3EE" fill="#22D3EE" fillOpacity={0.08} />
        <Radar dataKey="patient" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.35} />
        <Tooltip contentStyle={tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function ParamBar({ result }: { result: AnalysisResult }) {
  const data = result.parameters.slice(0, 8).map((p) => ({
    name: p.name,
    patient: p.patient,
    standard: p.standard,
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="standard" fill="#3B82F6" radius={[6, 6, 0, 0]} />
        <Bar dataKey="patient"  fill="#8B5CF6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "rgba(11,17,32,0.9)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#F8FAFC",
  fontSize: 12,
};

function ParamTable({ result }: { result: AnalysisResult }) {
  return (
    <table className="w-full text-sm min-w-[560px]">
      <thead className="text-xs uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="text-left py-2">Parameter</th>
          <th className="text-right py-2">Standard</th>
          <th className="text-right py-2">Patient</th>
          <th className="text-right py-2">Δ</th>
          <th className="text-right py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {result.parameters.map((p) => {
          const diff = p.patient - p.standard;
          const color =
            p.status === "normal" ? "text-success" :
            p.status === "borderline" ? "text-warning" : "text-danger";
          return (
            <tr key={p.name} className="border-t border-border/40">
              <td className="py-2">{p.name} <span className="text-muted-foreground text-xs">({p.unit})</span></td>
              <td className="py-2 text-right text-muted-foreground">{p.standard}</td>
              <td className="py-2 text-right">{p.patient}</td>
              <td className={`py-2 text-right ${diff >= 0 ? "text-cyan" : "text-purple"}`}>
                {diff > 0 ? "+" : ""}{diff.toFixed(2)}
              </td>
              <td className={`py-2 text-right capitalize ${color}`}>{p.status}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Unused import guard for Brain (kept for icon parity in future)
void Brain;
