import { jsPDF } from "jspdf";
import type { DashboardRun, DashboardSubject, DashboardVisit } from "@/lib/dashboard-data";
import type { EngineOutput, ParamStatus } from "@/lib/gait-engine/parameters";
import { PARAMETER_DEFINITIONS } from "@/lib/gait-engine/parameters";

export const REPORT_DISCLAIMER = "Automated outputs are not a diagnosis.";

export type SavedReportContent = {
  codedId: string;
  date: string;
  protocol: string;
  conditions: string;
  pipelineVersion: string;
  measurements: { name: string; value: string; status: string }[];
  limitations: string[];
  disclaimer: string;
};

const NA = "Not recorded";
const statusLabel = (s: ParamStatus) => (s === "experimental" ? "unreliable" : s);

/** Builds report content strictly from saved database records; no names, no invented values. */
export function savedReportContent(run: DashboardRun, visit?: DashboardVisit, subject?: DashboardSubject): SavedReportContent {
  const rec = run.recordings;
  const engine = run.gait_results?.engine_output as unknown as (EngineOutput & { quality?: { warnings?: string[] } }) | null;
  const qr = run.quality_report as { issues?: { message?: string }[] } | null;
  const measurements = (engine?.parameters ?? []).map((p) => {
    const unit = p.unit || PARAMETER_DEFINITIONS.find((d) => d.key === p.key)?.unit || "";
    const name = PARAMETER_DEFINITIONS.find((d) => d.key === p.key)?.name ?? p.key;
    const value = p.value == null ? "Not available" : `${p.value}${unit && unit !== "—" ? ` ${unit}` : ""}`;
    return { name, value, status: statusLabel(p.status) };
  });
  const limitations = [
    ...(qr?.issues ?? []).map((i) => i.message).filter((m): m is string => !!m),
    ...(engine?.quality?.warnings ?? []),
    ...(engine?.parameters ?? []).filter((p) => p.value == null && p.reason).map((p) => `${PARAMETER_DEFINITIONS.find((d) => d.key === p.key)?.name ?? p.key}: ${p.reason}`),
  ];
  const conditions = [visit?.recording_condition, visit?.medication_state && `Medication: ${visit.medication_state}`, rec?.camera_view && `Camera view: ${rec.camera_view}`]
    .filter(Boolean).join(" · ");
  return {
    codedId: subject?.subject_code ?? NA,
    date: new Date(run.completed_at ?? run.started_at).toISOString().slice(0, 10),
    protocol: rec?.protocol ?? visit?.protocol ?? run.analysis_mode ?? NA,
    conditions: conditions || NA,
    pipelineVersion: run.pipeline_version ?? NA,
    measurements,
    limitations: [...new Set(limitations)],
    disclaimer: REPORT_DISCLAIMER,
  };
}

export function savedReportPdf(c: SavedReportContent) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), m = 48;
  let y = m;
  const space = (n: number) => { if (y + n > H - m) { doc.addPage(); y = m; } };
  const heading = (t: string) => { space(40); y += 10; doc.setFont("times", "bold"); doc.setFontSize(18); doc.text(t, m, y); y += 22; doc.setFont("times", "normal"); doc.setFontSize(14); };
  const line = (t: string) => { for (const l of doc.splitTextToSize(t, W - 2 * m)) { space(18); doc.text(l, m, y); y += 18; } };

  heading("NeuroStride AI — Analysis Report");
  line(`Coded ID: ${c.codedId}`);
  line(`Date: ${c.date}`);
  line(`Protocol: ${c.protocol}`);
  line(`Conditions: ${c.conditions}`);
  line(`Pipeline version: ${c.pipelineVersion}`);

  heading("Measurements");
  if (!c.measurements.length) line("No saved measurements for this analysis.");
  const cols = [m, m + 230, m + 380];
  doc.setFont("times", "bold"); space(18);
  ["Parameter", "Value", "Status"].forEach((h, i) => doc.text(h, cols[i], y)); y += 18;
  doc.setFont("times", "normal");
  for (const r of c.measurements) {
    const name = doc.splitTextToSize(r.name, 220) as string[];
    space(18 * name.length);
    doc.text(name, cols[0], y); doc.text(r.value, cols[1], y); doc.text(r.status, cols[2], y);
    y += 18 * name.length;
  }

  heading("Quality limitations");
  if (!c.limitations.length) line("No quality limitations were recorded.");
  c.limitations.forEach((l) => line(`• ${l}`));

  heading("Disclaimer");
  line(c.disclaimer);
  return doc;
}
