import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PARAMETER_DEFINITIONS } from "@/lib/gait-engine/parameters";

const FONT = "times";
function doc() {
  const d = new jsPDF({ unit: "pt", format: "a4" });
  d.setFont(FONT, "normal");
  return d;
}
function heading(d: jsPDF, text: string, y: number) {
  d.setFont(FONT, "bold"); d.setFontSize(18); d.text(text, 40, y); d.setFont(FONT, "normal"); d.setFontSize(12);
  return y + 22;
}
const nextY = (d: jsPDF) => ((d as any).lastAutoTable?.finalY ?? 60) + 24;
const table = (d: jsPDF, y: number, head: string[], body: (string | number)[][]) =>
  autoTable(d, { startY: y, head: [head], body: body.map((r) => r.map(String)), styles: { font: FONT, fontSize: 10 }, headStyles: { fillColor: [15, 23, 42] }, margin: { left: 40, right: 40 } });

/** Structured clinical decision-support report built from a stored report snapshot. */
export function clinicalReportPdf(c: any): jsPDF {
  const d = doc();
  let y = heading(d, "Clinical Gait Assessment — Decision-Support Report", 50);
  const s = c.visit?.subjects ?? {};
  table(d, y, ["Field", "Value"], [
    ["Patient name", s.display_name ?? ""], ["Subject ID", s.subject_code ?? ""], ["Age", s.age ?? ""], ["Sex", s.sex ?? ""],
    ["Visit ID", c.visit?.visit_code ?? ""], ["Visit date", c.visit?.visit_date?.slice(0, 10) ?? ""],
    ["Recording condition", c.visit?.recording_condition ?? ""], ["Medication state", c.visit?.medication_state ?? "not recorded"], ["Notes", c.visit?.notes ?? ""],
    ["Protocol / trial", `${c.recording?.protocol ?? ""} / ${c.recording?.trial_number ?? ""}`], ["Analysis run", c.run?.id ?? ""], ["Run status", c.run?.status ?? ""],
  ]);
  y = heading(d, "Measurements", nextY(d));
  table(d, y, ["Parameter", "Value", "Unit", "Status", "n"], (c.parameters ?? []).map((p: any) => {
    const def = PARAMETER_DEFINITIONS.find((x) => x.key === p.key);
    return [def?.name ?? p.key, p.status === "unavailable" || p.value == null ? "unavailable" : Number(p.value.toFixed(3)), def?.unit ?? "", p.status + (p.reason ? ` (${p.reason})` : ""), p.n ?? ""];
  }));
  y = heading(d, "Timed protocol", nextY(d));
  const t = c.timedResult;
  table(d, y, ["Result", "Value"], [[t ? t.label : "Not applicable", t ? (t.verified ? `${t.value} ${t.unit} (${t.formula})` : `Not verified — ${t.reason}`) : "This protocol is not timed."]]);
  y = heading(d, "Data quality and warnings", nextY(d));
  const q = c.quality ?? {};
  table(d, y, ["Item", "Value"], [
    ["Usable frames", q.usablePercent != null ? `${q.usablePercent}%` : "n/a"], ["Usable gait cycles", q.usableCycles ?? "n/a"],
    ["Median pose confidence", q.poseConfidence?.median ?? "n/a"], ["Warnings", (q.warnings ?? []).join("; ") || "none"], ["Uncertainty", q.uncertainty ?? "not established"],
  ]);
  y = heading(d, "Clinician review", nextY(d));
  table(d, y, ["Date", "Decision", "Notes", "Correction of"], (c.reviews ?? []).map((r: any) => [r.created_at?.slice(0, 16).replace("T", " "), r.decision, r.notes ?? "", r.supersedes ? "earlier review" : ""]).concat((c.reviews ?? []).length ? [] : [["—", "pending", "No review recorded", ""]]));
  y = heading(d, "Software versions", nextY(d));
  table(d, y, ["Component", "Version"], Object.entries({ ...(c.run?.versions ?? {}) }).map(([k, v]) => [k, String(v ?? "n/a")]));
  y = nextY(d);
  d.setFontSize(10);
  d.text(d.splitTextToSize(c.disclaimer ?? "", 515), 40, Math.min(y, 800));
  return d;
}

/** Reproducible research report. Coded participant IDs only. */
export function researchReportPdf(r: any, experiments: any[]): jsPDF {
  const d = doc();
  let y = heading(d, `Research Report — ${r.studyId}`, 50);
  table(d, y, ["Field", "Value"], [
    ["Title", r.title], ["Finding status", r.findingStatus], ["Generated", r.generatedAt],
    ["Participants", r.participantCount], ["Included", r.includedCount], ["Excluded", r.exclusionCount],
    ["Inclusion criteria", r.criteria.inclusion ?? "not set"], ["Exclusion criteria", r.criteria.exclusion ?? "not set"],
    ["Protocol", JSON.stringify(r.protocol ?? {})],
    ["Missing data", `${r.missingData.measurementsUnavailable} of ${r.missingData.measurementsTotal} measurements unavailable`],
    ["Splits", r.splits.map((s: any) => `${s.split}: ${s.participants}`).join(", ")],
  ]);
  y = heading(d, "Datasets", nextY(d));
  table(d, y, ["Name", "Source", "Version", "Rows", "SHA-256"], r.datasets.map((x: any) => [x.name, x.source, x.version, x.rows, x.sha256.slice(0, 16) + "…"]));
  y = heading(d, "Feature definitions", nextY(d));
  table(d, y, ["Feature", "Unit", "Formula"], PARAMETER_DEFINITIONS.map((p) => [p.name, p.unit, p.formula]));
  y = heading(d, "Evaluation", nextY(d));
  const rows: (string | number)[][] = [];
  for (const e of experiments)
    for (const p of e.results?.perParameter ?? []) {
      const a = p.agreement;
      rows.push([e.name, p.name, a.n, a.status === "ok" ? `MAE ${a.mae.toFixed(3)}${a.maeCI ? ` [${a.maeCI[0].toFixed(3)}, ${a.maeCI[1].toFixed(3)}]` : ""}; bias ${a.bias.toFixed(3)}; LoA ${a.loaLower.toFixed(3)}…${a.loaUpper.toFixed(3)}${a.icc != null ? `; ICC ${a.icc.toFixed(3)}` : ""}` : `insufficient data (${a.reason})`]);
    }
  table(d, y, ["Experiment", "Parameter", "Pairs", "Result"], rows.length ? rows : [["—", "—", 0, "No evaluation has been run."]]);
  y = heading(d, "Methods and versions", nextY(d));
  table(d, y, ["Item", "Value"], [["Validation methodology", r.validationMethodology], ...Object.entries(r.softwareVersions ?? {}).map(([k, v]) => [k, String(v)]), ...experiments.slice(0, 5).map((e) => [`Preprocessing (${e.name})`, JSON.stringify(e.preprocessing)])]);
  y = heading(d, "Limitations", nextY(d));
  table(d, y, ["#", "Limitation"], r.limitations.map((l: string, i: number) => [i + 1, l]));
  return d;
}
