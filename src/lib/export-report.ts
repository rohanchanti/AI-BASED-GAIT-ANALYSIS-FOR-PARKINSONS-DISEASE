import type { AnalysisResult } from "./mock-analysis";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type PatientInfo = {
  name?: string;
  patientId?: string;
  age?: string;
  gender?: string;
};

const HEADING_SIZE = 18;
const BODY_SIZE = 14;
const FONT = "times";

export function exportJSON(result: AnalysisResult, patient?: PatientInfo) {
  const payload = {
    generated_at: new Date().toISOString(),
    patient: patient ?? null,
    mode: result.mode,
    kind: result.kind,
    probability: result.probability,
    confidence: result.confidence,
    risk_level: result.riskLevel,
    summary: result.summary,
    parameters: result.parameters,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  triggerDownload(blob, filename(result, "json"));
}

export function exportCSV(result: AnalysisResult, patient?: PatientInfo) {
  const meta: (string | number)[][] = [
    ["NeuroStride AI — Clinical Gait Analysis Report"],
    ["Generated", new Date().toLocaleString()],
    ["Patient Name", patient?.name ?? ""],
    ["Patient ID", patient?.patientId ?? ""],
    ["Age", patient?.age ?? ""],
    ["Gender", patient?.gender ?? ""],
    ["Analysis Mode", result.mode],
    ["Analysis Type", result.kind],
    ["Parkinson's Risk", `${(result.probability * 100).toFixed(1)}%`],
    ["Risk Level", result.riskLevel],
    ["AI Confidence", `${(result.confidence * 100).toFixed(1)}%`],
    [],
  ];
  const header = [
    "Parameter", "Patient", "Unit",
    "Reference Min", "Reference Max", "Standard",
    "Deviation %", "Status", "Interpretation",
  ];
  const rows = result.parameters.map((p) => [
    p.name, p.patient, p.unit,
    p.range[0], p.range[1], p.standard,
    p.deviationPct, p.status, p.interpretation,
  ]);
  const csv = [...meta, header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  triggerDownload(blob, filename(result, "csv"));
}

export async function exportPNG(node: HTMLElement, result: AnalysisResult) {
  const dataUrl = await toPng(node, {
    backgroundColor: "#050816",
    pixelRatio: 2,
    cacheBust: true,
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename(result, "png");
  a.click();
}

export function exportPDF(result: AnalysisResult, patient?: PatientInfo) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  doc.setFont(FONT, "bold");
  doc.setFontSize(HEADING_SIZE);
  doc.text("NeuroStride AI", margin, y);
  doc.setFontSize(BODY_SIZE);
  doc.setFont(FONT, "normal");
  y += 20;
  doc.text("Clinical Gait Analysis Report", margin, y);

  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageW - margin, margin, { align: "right" });
  doc.setTextColor(0);
  doc.setFontSize(BODY_SIZE);

  y += 22;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 24;

  // Patient section
  section(doc, "Patient Information", y);
  y += 26;
  const patientRows: [string, string][] = [
    ["Name", patient?.name || "—"],
    ["Patient ID", patient?.patientId || "—"],
    ["Age", patient?.age || "—"],
    ["Gender", patient?.gender || "—"],
    ["Analysis Type", result.kind === "gait" ? "Gait analysis" : "Facial analysis"],
    ["Analysis Mode", result.mode],
  ];
  autoTable(doc, {
    startY: y,
    body: patientRows,
    theme: "grid",
    styles: { font: FONT, fontSize: BODY_SIZE, cellPadding: 6, textColor: 20, lineColor: 200 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 140, fillColor: [244, 246, 250] },
      1: { cellWidth: pageW - margin * 2 - 140 },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 24;

  // Assessment summary
  y = ensureSpace(doc, y, 120, margin);
  section(doc, "Assessment Summary", y);
  y += 26;
  const s = result.summary;
  const summaryRows: [string, string][] = [
    ["Parkinson's Risk Score", `${(result.probability * 100).toFixed(1)}%`],
    ["Risk Level", capitalize(result.riskLevel)],
    ["Disease Severity", s.severity],
    ["Overall Gait Health", `${s.overallGaitHealth}/100`],
    ["Balance Score", `${s.balanceScore}%`],
    ["Fall Risk", `${s.fallRiskScore}%`],
    ["AI Confidence", `${(result.confidence * 100).toFixed(1)}%`],
    ["Parameters Normal / Borderline / Abnormal",
      `${s.counts.normal} / ${s.counts.borderline} / ${s.counts.abnormal}`],
  ];
  autoTable(doc, {
    startY: y,
    body: summaryRows,
    theme: "grid",
    styles: { font: FONT, fontSize: BODY_SIZE, cellPadding: 6, textColor: 20, lineColor: 200 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 260, fillColor: [244, 246, 250] },
      1: { cellWidth: pageW - margin * 2 - 260 },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  // Clinical recommendation paragraph
  y = ensureSpace(doc, y, 80, margin);
  section(doc, "Clinical Recommendation", y);
  y += 26;
  doc.setFont(FONT, "normal");
  doc.setFontSize(BODY_SIZE);
  const recLines = doc.splitTextToSize(s.recommendation, pageW - margin * 2);
  doc.text(recLines, margin, y);
  y += recLines.length * 18 + 20;

  // Clinical comparison table
  y = ensureSpace(doc, y, 120, margin);
  section(doc, "Clinical Parameter Comparison", y);
  y += 12;
  autoTable(doc, {
    startY: y + 6,
    head: [["Parameter", "Patient", "Reference", "Unit", "Dev %", "Status"]],
    body: result.parameters.map((p) => [
      p.name,
      String(p.patient),
      `${p.range[0]}–${p.range[1]}`,
      p.unit,
      `${p.deviationPct}%`,
      capitalize(p.status),
    ]),
    theme: "grid",
    headStyles: {
      font: FONT, fontStyle: "bold", fontSize: BODY_SIZE,
      fillColor: [30, 41, 82], textColor: 255, halign: "left",
    },
    styles: {
      font: FONT, fontSize: BODY_SIZE, cellPadding: 5, textColor: 20, lineColor: 210, valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 170 },
      1: { halign: "right", cellWidth: 60 },
      2: { halign: "right", cellWidth: 80 },
      3: { cellWidth: 55 },
      4: { halign: "right", cellWidth: 55 },
      5: { cellWidth: 75 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const v = String(data.cell.raw).toLowerCase();
        if (v === "normal") data.cell.styles.textColor = [22, 128, 62];
        else if (v === "borderline") data.cell.styles.textColor = [161, 98, 7];
        else if (v === "abnormal") data.cell.styles.textColor = [176, 32, 32];
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  // Domain assessments
  y = ensureSpace(doc, y, 120, margin);
  section(doc, "Domain Assessments", y);
  y += 26;
  autoTable(doc, {
    startY: y,
    body: [
      ["Balance", s.assessments.balance],
      ["Stability", s.assessments.stability],
      ["Symmetry", s.assessments.symmetry],
      ["Mobility", s.assessments.mobility],
      ["Fall Risk", s.assessments.fallRisk],
    ],
    theme: "grid",
    styles: { font: FONT, fontSize: BODY_SIZE, cellPadding: 6, textColor: 20, lineColor: 200 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 130, fillColor: [244, 246, 250] },
      1: { cellWidth: pageW - margin * 2 - 130 },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 24;

  // Disclaimer
  y = ensureSpace(doc, y, 120, margin);
  section(doc, "Clinical Reference & Disclaimer", y);
  y += 24;
  doc.setFont(FONT, "normal");
  doc.setFontSize(BODY_SIZE);
  const disclaimer =
    "Healthy adult gait reference values are derived from internationally accepted clinical gait analysis literature, rehabilitation guidelines, and validated biomechanical research aligned with World Health Organization guidance. These values are intended for clinical comparison and educational decision support only. This AI system is not a substitute for diagnosis, treatment, or medical advice from a qualified neurologist or healthcare professional. All results should be interpreted alongside a comprehensive clinical examination.";
  const dLines = doc.splitTextToSize(disclaimer, pageW - margin * 2);
  doc.text(dLines, margin, y);

  // Footer with page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont(FONT, "italic");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`NeuroStride AI · Page ${i} of ${total}`, pageW / 2, pageH - 20, { align: "center" });
    doc.setTextColor(0);
  }

  doc.save(filename(result, "pdf"));
}

function section(doc: jsPDF, title: string, y: number) {
  doc.setFont(FONT, "bold");
  doc.setFontSize(HEADING_SIZE);
  doc.text(title, 48, y);
  doc.setDrawColor(30, 41, 82);
  doc.setLineWidth(1);
  doc.line(48, y + 6, doc.internal.pageSize.getWidth() - 48, y + 6);
  doc.setFont(FONT, "normal");
  doc.setFontSize(BODY_SIZE);
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number) {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function filename(r: AnalysisResult, ext: string) {
  const d = new Date().toISOString().slice(0, 10);
  return `neurostride_${r.kind}_${r.mode}_${d}.${ext}`;
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
