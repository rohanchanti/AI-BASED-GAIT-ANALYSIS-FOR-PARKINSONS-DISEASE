import type { AnalysisResult } from "./mock-analysis";
import { toPng } from "html-to-image";

export function exportJSON(result: AnalysisResult, patient?: { name?: string; age?: string; gender?: string }) {
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

export function exportCSV(result: AnalysisResult) {
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
  const csv = [header, ...rows]
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

export function exportPDF() {
  window.print();
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
