import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from "recharts";
import {
  Activity, Sparkles, User, LogOut,
  FileDown, FileJson, FileSpreadsheet, ImageDown, Printer,
  CheckCircle2, Footprints, ScanFace, Mic2, CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { saveReport, listReports } from "@/lib/reports.functions";
import type { AnalysisResult, ClinicalStatus, ParameterRow } from "@/lib/mock-analysis";
import { exportCSV, exportJSON, exportPDF, exportPNG } from "@/lib/export-report";
import { readPoseAnalysis } from "@/lib/pose-session";
import { PoseAnalysisSection } from "@/components/gait/PoseAnalysisSection";
import { GaitVisualization } from "@/components/gait/GaitVisualization";
import { AnalysisOverview } from "@/components/research/AnalysisOverview";
import { VideoQualityPanel } from "@/components/research/VideoQualityPanel";
import { ResearchDisclaimer } from "@/components/research/ResearchDisclaimer";
import { AIAnalysisResults } from "@/components/research/AIAnalysisResults";
import { FacialAnalysisResults } from "@/components/facial/FacialAnalysisResults";
import type { PoseAnalysis } from "@/types/gait";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Research Dashboard — NeuroStride AI" },
      {
        name: "description",
        content:
          "Quantitative gait and movement biomarkers, data-quality metrics, and reproducibility metadata for a completed NeuroStride analysis.",
      },
      { property: "og:title", content: "Research Dashboard — NeuroStride AI" },
      {
        property: "og:description",
        content:
          "Quantitative gait and movement biomarkers, data-quality metrics, and reproducibility metadata for a completed NeuroStride analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

type Stored = {
  result: AnalysisResult;
  patient_name: string;
  patient_id?: string;
  patient_age?: string;
  patient_gender?: string;
  media_kind: "gait" | "facial";
  media_name: string;
  analysis_id?: string;
  analysis_timestamp?: string;
};

type HistoryReport = {
  id: string;
  kind: string;
  mode: string;
  probability: number;
  confidence: number;
  risk_level: string;
  patient_name: string | null;
  created_at: string;
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
  const [pose, setPose] = useState<PoseAnalysis | null>(null);
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
    setPose(readPoseAnalysis());
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("latestResult");
    if (raw) {
      try {
        const s = JSON.parse(raw) as Stored;
        setStored(s);
        if (s.patient_name) setPatientName(s.patient_name);
        if (s.patient_age) setAge(s.patient_age);
        if (s.patient_gender) setGender(s.patient_gender);
      } catch { /* ignore */ }
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
            <div className="text-xs uppercase tracking-[0.2em] text-cyan">Research Dashboard</div>
            <h1 className="truncate font-display text-2xl sm:text-3xl font-semibold">
              Movement Analysis Results
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

      <DashboardOverview
        stored={stored}
        history={(historyQuery.data ?? []) as HistoryReport[]}
        loading={historyQuery.isLoading}
      />

      {!stored && !savedId && <EmptyState />}

      {stored && (
        <div ref={reportRef} className="mt-8 space-y-4">
          <ResearchDisclaimer />

          <AnalysisOverview
            identity={{
              analysisId: stored.analysis_id ?? null,
              subjectId: stored.patient_id ?? null,
              sessionId: null,
              analysisTimestamp: stored.analysis_timestamp ?? null,
              mediaName: stored.media_name,
              mode: stored.result.mode,
            }}
            pose={pose}
          />

          {stored.result.kind === "gait" && <VideoQualityPanel pose={pose} />}

          {/* Model output row */}
          {stored.result.kind === "gait" && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GaugeCard
              label="Gait model output"
              value={stored.result.summary.parkinsonsRisk}
              caption={`${stored.result.riskLevel} — PD-associated gait features`}
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
                <div className="text-xs uppercase tracking-[0.2em] text-cyan">Model output</div>
                <div className="mt-2 font-display text-2xl font-semibold">
                  {stored.result.summary.severity}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Model confidence {(stored.result.summary.confidence * 100).toFixed(1)}%
                  {stored.result.qualityScore != null
                    ? ` · Data quality ${stored.result.qualityScore.toFixed(0)}%`
                    : ""}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  Uncalibrated model output, not a probability of Parkinson&apos;s disease. Face-only
                  and multimodal model outputs are not available — those pipelines are not configured.
                </p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <StatBadge n={stored.result.summary.counts.normal} label="Normal" color="success" />
                <StatBadge n={stored.result.summary.counts.borderline} label="Borderline" color="warning" />
                <StatBadge n={stored.result.summary.counts.abnormal} label="Abnormal" color="danger" />
              </div>
            </div>
          </div>}


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
                {(() => {
                  const patient = { name: patientName, patientId: stored.patient_id, age, gender };
                  return <>
                    <ExportBtn
                      onClick={() =>
                        exportPDF(stored.result, patient, {
                          analysisId: stored.analysis_id ?? null,
                          analysisTimestamp: stored.analysis_timestamp ?? null,
                          mediaName: stored.media_name ?? null,
                        })
                      }
                      icon={Printer}
                      label="PDF"
                    />
                    <ExportBtn onClick={onExportPNG} icon={ImageDown} label="PNG" />
                    <ExportBtn onClick={() => exportCSV(stored.result, patient)} icon={FileSpreadsheet} label="CSV" />
                    <ExportBtn onClick={() => exportJSON(stored.result, patient)} icon={FileJson} label="JSON" />
                  </>;
                })()}
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
          {stored.result.kind === "gait" && <ClinicalSummaryCard result={stored.result} />}

          {/* AI Analysis Results presentation section */}
          {stored.result.kind === "gait" && <div className="glass rounded-2xl p-6">
            <AIAnalysisResults
              result={stored.result}
              pose={pose}
              analysisId={stored.analysis_id ?? null}
              analysisTimestamp={stored.analysis_timestamp ?? null}
            />
          </div>}

          {stored.result.kind === "facial" && (
            <div className="glass rounded-2xl p-6">
              <FacialAnalysisResults result={stored.result} />
            </div>
          )}

          {/* Charts row */}
          {stored.result.kind === "gait" && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
          </div>}

          {/* Gait results visualization */}
          {stored.result.kind === "gait" && <div className="glass rounded-2xl p-6">
            <GaitVisualization result={stored.result} pose={pose} />
          </div>}

          {/* MediaPipe pose analysis (real landmark geometry) */}
          {stored.result.kind === "gait" && pose && (
            <div className="glass rounded-2xl p-6 overflow-x-auto">
              <PoseAnalysisSection
                analysis={pose}
                pixelAvailable
                pixelSummary={{
                  cadence: stored.result.parameters.find((p) => p.key === "cadence")?.patient,
                  symmetry: stored.result.parameters.find((p) => p.key === "walking_sym")?.patient,
                  stability: stored.result.parameters.find((p) => p.key === "stability")?.patient,
                }}
              />
            </div>
          )}

          {/* Clinical comparison table */}
          {stored.result.kind === "gait" && <div className="glass rounded-2xl p-6 overflow-x-auto">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan mb-3">Clinical Comparison</div>
            <ClinicalTable rows={stored.result.parameters} />
          </div>}

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
            {stored.result.model && !stored.result.model.validated && (
              <p className="mt-3">
                <strong className="text-foreground/80">Model status:</strong> the risk score was produced by{" "}
                {stored.result.model.id} v{stored.result.model.version} — a transparent{" "}
                {stored.result.model.method} that aggregates deviations from healthy reference ranges. It has
                not been trained or validated on clinically labelled Parkinson's data, so it is a research
                screening indicator, not a diagnostic probability.
              </p>
            )}
            <p className="mt-3">
              <strong className="text-foreground/80">Units:</strong> distance and speed values are expressed
              in real-world units only when a calibration reference (subject height or a known in-frame
              distance) was supplied; otherwise they are relative image-space estimates.
            </p>
          </div>
        </div>
      )}

    </section>
  );
}

/* ---------------- subcomponents ---------------- */

function DashboardOverview({
  stored,
  history,
  loading,
}: {
  stored: Stored | null;
  history: HistoryReport[];
  loading: boolean;
}) {
  const gaitReport = history.find((report) => report.kind === "gait");
  const facialReport = history.find((report) => report.kind === "facial");
  const latestGait = stored?.result.kind === "gait" ? stored : gaitReport;
  const latestFacial = stored?.result.kind === "facial" ? stored : facialReport;
  const realTrend = [...history]
    .reverse()
    .slice(-8)
    .map((report, index) => ({
      label: new Date(report.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      score: Math.round(Number(report.probability) * 100),
      order: index + 1,
    }));
  const isDemoTrend = !loading && realTrend.length === 0;
  const trendData = isDemoTrend
    ? [
        { label: "Session 1", score: 42, order: 1 },
        { label: "Session 2", score: 38, order: 2 },
        { label: "Session 3", score: 35, order: 3 },
        { label: "Session 4", score: 31, order: 4 },
      ]
    : realTrend;
  const latestReport = history[0];
  const metricCount = stored?.result.parameters.length ?? 0;
  const completedCount = history.length + (stored ? 1 : 0);
  const quality = stored?.result.qualityScore;
  const currentStatus = stored
    ? `${stored.result.parameters.filter((parameter) => parameter.status !== "normal").length} features outside reference range`
    : latestReport
      ? `Latest saved ${latestReport.kind} analysis: ${latestReport.risk_level}`
      : "No completed analyses are available yet.";

  return (
    <div className="mt-8 space-y-4 print:hidden">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">Dashboard overview</div>
          <h2 className="mt-1 font-display text-xl font-semibold">Analysis activity</h2>
        </div>
        <a
          href="/#analyze"
          className="hidden sm:inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary hover:brightness-110"
        >
          Start New Analysis
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewMetric label="Completed analyses" value={String(completedCount)} />
        <OverviewMetric label="Latest modality" value={stored?.result.kind === "gait" ? "Gait" : stored?.result.kind === "facial" ? "Facial" : latestReport ? titleCase(latestReport.kind) : "Not available"} />
        <OverviewMetric label="Key metrics available" value={metricCount ? String(metricCount) : "Not available"} />
        <OverviewMetric label="Current data quality" value={quality != null ? `${quality.toFixed(0)}%` : "Not available"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan">Latest Results</div>
              <div className="mt-1 text-sm text-muted-foreground">Most recent result available for each modality</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <LatestResultCard
              icon={Footprints}
              modality="Gait"
              available={Boolean(latestGait)}
              detail={formatLatestDetail(latestGait)}
            />
            <LatestResultCard
              icon={ScanFace}
              modality="Facial"
              available={Boolean(latestFacial)}
              detail={formatLatestDetail(latestFacial)}
            />
            <LatestResultCard
              icon={Mic2}
              modality="Voice"
              available={false}
              detail="Voice results are not stored in dashboard history"
            />
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">Analysis Summary</div>
          <div className="mt-4 flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15">
              <Activity className="h-4 w-4 text-cyan" />
            </div>
            <div>
              <div className="text-sm font-medium">{stored ? "Current session complete" : latestReport ? "Saved analysis activity" : "Ready for analysis"}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{currentStatus}</p>
            </div>
          </div>
          <p className="mt-4 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground">
            Findings describe measured movement characteristics for research screening and do not provide a medical diagnosis.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan">Historical Trend</div>
              <div className="mt-1 text-xs text-muted-foreground">Analysis score across saved sessions</div>
            </div>
            {isDemoTrend && <DemoBadge />}
          </div>
          {loading ? (
            <div className="grid h-44 place-items-center text-sm text-muted-foreground">Loading history…</div>
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <LineChart data={trendData} margin={{ top: 18, right: 12, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94A3B8", fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, "Analysis score"]} />
                <Line type="monotone" dataKey="score" stroke="#22D3EE" strokeWidth={2} dot={{ fill: "#22D3EE", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass rounded-2xl p-5 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan">Recent Analyses</div>
              <div className="mt-1 text-xs text-muted-foreground">Latest saved research sessions</div>
            </div>
          </div>
          {loading && <div className="py-8 text-center text-sm text-muted-foreground">Loading analyses…</div>}
          {!loading && history.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No saved analyses yet. Complete and save an analysis to build history.</div>
          )}
          {history.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="pb-2 text-left">Analysis ID</th>
                    <th className="pb-2 text-left">Date</th>
                    <th className="pb-2 text-left">Modality</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 5).map((report) => (
                    <tr key={report.id} className="border-t border-border/50">
                      <td className="py-3 font-mono text-xs">{shortAnalysisId(report.id)}</td>
                      <td className="py-3 text-xs text-muted-foreground">{new Date(report.created_at).toLocaleDateString()}</td>
                      <td className="py-3">{titleCase(report.kind)}</td>
                      <td className="py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/5 px-2 py-0.5 text-xs text-success">
                          <CheckCircle2 className="h-3 w-3" /> Complete
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-xl font-semibold">{value}</div>
    </div>
  );
}

function LatestResultCard({
  icon: Icon,
  modality,
  available,
  detail,
}: {
  icon: React.ElementType;
  modality: string;
  available: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-cyan" />
        </div>
        <span className={`text-[10px] uppercase tracking-wider ${available ? "text-success" : "text-muted-foreground"}`}>
          {available ? "Available" : "Not available"}
        </span>
      </div>
      <div className="mt-3 font-medium">{modality}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</div>
    </div>
  );
}

function DemoBadge() {
  return (
    <span className="rounded-full border border-warning/50 bg-warning/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-warning">
      Demo Data
    </span>
  );
}

function formatLatestDetail(item: Stored | HistoryReport | undefined) {
  if (!item) return "No saved result for this modality";
  if ("result" in item) {
    return `${item.result.parameters.length} measured features · ${item.analysis_timestamp ? new Date(item.analysis_timestamp).toLocaleDateString() : "Current session"}`;
  }
  return `${new Date(item.created_at).toLocaleDateString()} · ${titleCase(item.mode)} protocol`;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shortAnalysisId(id: string) {
  return `NS-${id.slice(0, 8).toUpperCase()}`;
}

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
