import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { listReports, deleteReport } from "@/lib/reports.functions";
import { exportPNG } from "@/lib/export-report";
import { generateMockAnalysis } from "@/lib/mock-analysis";
import { toast } from "sonner";
import { logAccess } from "@/lib/audit.functions";
import { supabase } from "@/integrations/supabase/client";
import { dashboardQueryOptions } from "@/lib/dashboard-data";
import { savedReportContent, savedReportPdf } from "@/lib/saved-analysis-pdf";
import { dataDictionaryCsv, deidentifiedCsv, deidentifiedJson, deidentifiedRows } from "@/lib/saved-analysis-export";

function downloadText(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
import { Trash2, FileText, Eye, Download, Footprints, ScanFace, Mic2, CalendarDays, UserRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Analysis Reports — NeuroStride AI" },
      { name: "description", content: "Review saved NeuroStride movement-analysis reports and a clearly labeled multimodal demonstration report." },
      { property: "og:title", content: "Analysis Reports — NeuroStride AI" },
      { property: "og:description", content: "Review saved NeuroStride movement-analysis reports and a clearly labeled multimodal demonstration report." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const list = useServerFn(listReports);
  const del = useServerFn(deleteReport);
  const qc = useQueryClient();
  const audit = useServerFn(logAccess);
  const logExport = (entity: "analysis_runs" | "data_dictionary", entityId: string | null, format: "pdf" | "csv" | "json") =>
    audit({ data: { action: "export", entity, entityId, format } }).catch(() => {});
  const [showDemoReport, setShowDemoReport] = useState(false);
  const demoReportRef = useRef<HTMLDivElement>(null);
  const demoGait = useMemo(() => generateMockAnalysis("gait", "normal", "DEMO-001-gait-report"), []);
  const demoFace = useMemo(() => generateMockAnalysis("facial", "quick", "DEMO-001-face-report"), []);

  const { data, isLoading } = useQuery({ queryKey: ["reports"], queryFn: () => list() });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  const saved = useQuery({ ...dashboardQueryOptions(me ?? ""), enabled: !!me });
  const savedRuns = (saved.data?.runs ?? []).filter((r) => r.gait_results && ["complete", "completed", "completed_with_warnings"].includes(r.status));

  function exportSaved(runId: string, kind: "csv" | "json") {
    const records = saved.data;
    const run = records?.runs.find((r) => r.id === runId);
    if (!records || !run) return;
    const visit = records.visits.find((v) => v.id === run.recordings?.visit_id);
    const subject = records.subjects.find((s) => s.id === (run.recordings?.subject_id ?? visit?.subject_id));
    const base = `neurostride-${subject?.subject_code ?? "uncoded"}-${run.analysis_code ?? run.id.slice(0, 8)}`;
    logExport("analysis_runs", run.id, kind);
    if (kind === "csv") downloadText(deidentifiedCsv(deidentifiedRows(run, visit, subject)), `${base}.csv`, "text/csv;charset=utf-8");
    else downloadText(JSON.stringify(deidentifiedJson(run, visit, subject), null, 2), `${base}.json`, "application/json");
  }

  function downloadSavedPdf(runId: string) {
    const records = saved.data;
    const run = records?.runs.find((r) => r.id === runId);
    if (!records || !run) return;
    const visit = records.visits.find((v) => v.id === run.recordings?.visit_id);
    const subject = records.subjects.find((s) => s.id === (run.recordings?.subject_id ?? visit?.subject_id));
    try {
      const content = savedReportContent(run, visit, subject);
      logExport("analysis_runs", run.id, "pdf");
      savedReportPdf(content).save(`neurostride-${content.codedId}-${content.date}.pdf`);
    } catch {
      toast.error("PDF could not be generated");
    }
  }
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Report deleted");
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  async function exportDemoReport() {
    if (!demoReportRef.current) return;
    try {
      await exportPNG(demoReportRef.current, demoGait);
      toast.success("Demo report exported");
    } catch {
      toast.error("Report export failed");
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl glass gradient-border">
          <FileText className="h-5 w-5 text-cyan" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">Archive</div>
          <h1 className="font-display text-3xl font-semibold">Reports</h1>
        </div>
      </div>

      <div className="mt-8 glass gradient-border rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold">Representative Analysis Report</h2>
              <DemoBadge />
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              A demonstration of the existing gait, facial, and voice reporting presentation. All values in this sample are example data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowDemoReport((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:border-primary/50"
            >
              <Eye className="h-4 w-4" /> {showDemoReport ? "Hide Report" : "View Report"}
            </button>
            <button
              onClick={exportDemoReport}
              disabled={!showDemoReport}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              title={showDemoReport ? "Export the visible report as PNG" : "View the report before exporting"}
            >
              <Download className="h-4 w-4" /> Download / Export
            </button>
          </div>
        </div>

        {showDemoReport && (
          <div ref={demoReportRef} className="mt-6 space-y-4 rounded-xl border border-border/60 bg-background/40 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-5">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan">NeuroStride AI</div>
                <h3 className="mt-1 font-display text-2xl font-semibold">Multimodal Analysis Report</h3>
              </div>
              <DemoBadge />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ReportFact icon={UserRound} label="Patient / Subject ID" value="DEMO-001" />
              <ReportFact icon={CalendarDays} label="Analysis date" value={new Date().toLocaleDateString()} />
              <ReportFact icon={FileText} label="Modalities analyzed" value="Gait · Facial · Voice" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <ModalityReport
                icon={Footprints}
                title="Gait Results"
                metrics={demoGait.parameters.slice(0, 4).map((parameter) => ({
                  label: parameter.name,
                  value: parameter.patient == null ? "Not available" : `${parameter.patient} ${parameter.unit}`,
                }))}
              />
              <ModalityReport
                icon={ScanFace}
                title="Facial Results"
                metrics={demoFace.parameters.slice(0, 4).map((parameter) => ({
                  label: parameter.name,
                  value: parameter.patient == null ? "Not available" : `${parameter.patient} ${parameter.unit}`,
                }))}
              />
              <ModalityReport
                icon={Mic2}
                title="Voice Results"
                metrics={[
                  { label: "Fundamental frequency", value: "119.99 Hz" },
                  { label: "Pitch variation", value: "0.74% jitter" },
                  { label: "Amplitude variation", value: "4.39% shimmer" },
                  { label: "Temporal variation", value: "0.42 RPDE" },
                ]}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <div className="rounded-xl border border-border/60 p-4 lg:col-span-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan">Selected Feature Profile</div>
                  <DemoBadge />
                </div>
                <div className="mt-3 h-52">
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">Not available</div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-5 lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan">AI-Generated Interpretation</div>
                  <DemoBadge />
                </div>
                <p className="mt-4 text-sm leading-relaxed text-foreground/80">
                  This example illustrates how gait timing, facial movement, and acoustic features can be summarized together. The displayed pattern contains sample variations from reference values and is provided only to demonstrate the reporting format.
                </p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  No clinical conclusion should be drawn from these demonstration measurements.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Limitations / disclaimer:</strong>{" "}
              This system is intended for research and screening support and is not a standalone diagnostic system.
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 glass rounded-2xl p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Saved analyses</h2>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="mt-1 text-sm text-muted-foreground">Download a PDF, or de-identified CSV/JSON (coded ID only, no names). Automated outputs are not a diagnosis.</p>
          <button onClick={() => { logExport("data_dictionary", null, "csv"); downloadText(dataDictionaryCsv(), "data_dictionary.csv", "text/csv;charset=utf-8"); }} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary/50">
            <Download className="h-3.5 w-3.5" /> data_dictionary.csv
          </button>
        </div>
        {saved.isLoading || !me ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : savedRuns.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No completed analyses saved yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {savedRuns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>{r.analysis_code ?? r.id.slice(0, 8)} · {new Date(r.completed_at ?? r.started_at).toLocaleDateString()} · {r.recordings?.protocol ?? r.analysis_mode ?? "Protocol not recorded"}</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => downloadSavedPdf(r.id)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary/50">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                  <button onClick={() => exportSaved(r.id, "csv")} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary/50">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                  <button onClick={() => exportSaved(r.id, "json")} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary/50">
                    <Download className="h-3.5 w-3.5" /> JSON
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 glass rounded-2xl">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {data && data.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">No reports saved yet.</p>
            <a href="/#analyze" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary">
              Start an analysis
            </a>
          </div>
        )}
        <ul className="divide-y divide-border/60">
          {data?.map((r) => (
            <li key={r.id} className="flex items-center gap-4 p-4">
              <div className="grid min-h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/5 text-center text-[10px] font-semibold">
                {r.kind === "gait" || r.probability == null ? "Not available" : `${(Number(r.probability) * 100).toFixed(0)}%`}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {r.patient_name || "Unnamed patient"} · {r.kind === "gait" ? "Gait analysis" : "Facial analysis"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · Mode: {r.mode} · Risk: {r.kind === "gait" ? "Not available" : r.risk_level} ·
                  Confidence {r.kind === "gait" || r.confidence == null ? "Not available" : `${(Number(r.confidence) * 100).toFixed(0)}%`}
                </div>
              </div>
              <button
                onClick={() => remove.mutate(r.id)}
                className="rounded-lg border border-border p-2 text-muted-foreground hover:text-danger hover:border-danger/50"
                aria-label="Delete report"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DemoBadge() {
  return (
    <span className="inline-flex rounded-full border border-warning/50 bg-warning/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-warning">
      Demo Data
    </span>
  );
}

function ReportFact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-cyan" /> {label}
      </div>
      <div className="mt-2 font-medium">{value}</div>
    </div>
  );
}

function ModalityReport({
  icon: Icon,
  title,
  metrics,
}: {
  icon: React.ElementType;
  title: string;
  metrics: { label: string; value: string }[];
}) {
  return (
    <section className="rounded-xl border border-border/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-cyan" />
          <h4 className="font-medium">{title}</h4>
        </div>
        <DemoBadge />
      </div>
      <dl className="mt-4 space-y-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-baseline justify-between gap-3 border-t border-border/40 pt-2 first:border-0 first:pt-0">
            <dt className="text-xs text-muted-foreground">{metric.label}</dt>
            <dd className="text-right font-mono text-xs text-foreground/90">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
