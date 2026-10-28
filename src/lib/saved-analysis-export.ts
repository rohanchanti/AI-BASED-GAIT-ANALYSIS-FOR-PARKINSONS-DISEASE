import type { DashboardRun, DashboardSubject, DashboardVisit } from "@/lib/dashboard-data";
import type { EngineOutput } from "@/lib/gait-engine/parameters";
import { PARAMETER_DEFINITIONS } from "@/lib/gait-engine/parameters";
import { REPORT_DISCLAIMER, savedReportContent } from "@/lib/saved-analysis-pdf";

export const CSV_COLUMNS = ["coded_id", "analysis_id", "date", "protocol", "conditions", "pipeline_version", "parameter_key", "parameter", "value", "unit", "status", "method"] as const;

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";

/** De-identified rows: coded subject ID only; names and free-text notes are never included. */
export function deidentifiedRows(run: DashboardRun, visit?: DashboardVisit, subject?: DashboardSubject) {
  const c = savedReportContent(run, visit, subject);
  const engine = run.gait_results?.engine_output as unknown as EngineOutput | null;
  return (engine?.parameters ?? []).map((p) => {
    const d = PARAMETER_DEFINITIONS.find((x) => x.key === p.key);
    return {
      coded_id: c.codedId, analysis_id: run.analysis_code ?? run.id, date: c.date, protocol: c.protocol,
      conditions: c.conditions, pipeline_version: c.pipelineVersion, parameter_key: p.key, parameter: d?.name ?? p.key,
      value: p.value, unit: p.unit || d?.unit || "", status: p.status === "experimental" ? "unreliable" : p.status,
      method: p.method || d?.formula || "",
    };
  });
}

export function deidentifiedCsv(rows: ReturnType<typeof deidentifiedRows>) {
  return toCsv([[...CSV_COLUMNS], ...rows.map((r) => CSV_COLUMNS.map((k) => r[k]))]);
}

const COLUMN_DOCS: Record<(typeof CSV_COLUMNS)[number], [string, string]> = {
  coded_id: ["—", "Participant code entered at acquisition; no names are exported"],
  analysis_id: ["—", "Saved analysis run code"],
  date: ["YYYY-MM-DD", "Analysis completion date (UTC)"],
  protocol: ["—", "Recording protocol saved with the recording"],
  conditions: ["—", "Recording condition, medication state and camera view saved with the visit"],
  pipeline_version: ["—", "Analysis pipeline version saved on the run"],
  parameter_key: ["—", "Stable parameter identifier"],
  parameter: ["—", "Parameter display name"],
  value: ["see unit", "Stored engine value; empty when unavailable"],
  unit: ["—", "Unit of the value"],
  status: ["—", "measured / estimated / unavailable / unreliable"],
  method: ["—", "Calculation method stored with the value"],
};

export function dataDictionaryCsv() {
  return toCsv([
    ["name", "type", "unit", "calculation_method"],
    ...CSV_COLUMNS.map((c) => [c, "column", ...COLUMN_DOCS[c]]),
    ...PARAMETER_DEFINITIONS.map((d) => [d.key, "parameter", d.unit, d.formula]),
  ]);
}

export function deidentifiedJson(run: DashboardRun, visit?: DashboardVisit, subject?: DashboardSubject) {
  const c = savedReportContent(run, visit, subject);
  return {
    coded_id: c.codedId, analysis_id: run.analysis_code ?? run.id, date: c.date, protocol: c.protocol,
    conditions: c.conditions, pipeline_version: c.pipelineVersion,
    measurements: deidentifiedRows(run, visit, subject).map(({ parameter_key, parameter, value, unit, status, method }) => ({ key: parameter_key, name: parameter, value, unit, status, method })),
    quality_limitations: c.limitations, disclaimer: REPORT_DISCLAIMER,
  };
}
