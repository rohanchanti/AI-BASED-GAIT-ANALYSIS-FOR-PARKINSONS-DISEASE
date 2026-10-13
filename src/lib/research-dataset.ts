/** Dataset import parsing/validation and research export building. Pure functions. */

export const REQUIRED_DATASET_COLUMNS = ["participant_code"] as const;
const IDENTIFYING = ["name", "full_name", "patient_name", "first_name", "last_name", "email", "phone", "address", "dob", "date_of_birth", "mrn"];

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
  if (!lines.length) return [];
  const split = (l: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') {
        if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q;
      } else if (c === "," && !q) { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => {
    const v = split(l);
    return Object.fromEntries(head.map((h, i) => [h, v[i] ?? ""]));
  });
}

export interface DatasetValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  rowCount: number;
  columns: string[];
  missing: Record<string, number>;
  participants: number;
}

export function validateDataset(rows: Record<string, unknown>[]): DatasetValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  if (!rows.length) errors.push("The file contains no data rows.");
  for (const c of REQUIRED_DATASET_COLUMNS) if (rows.length && !columns.includes(c)) errors.push(`Required column "${c}" is missing.`);
  const ident = columns.filter((c) => IDENTIFYING.includes(c.toLowerCase()));
  if (ident.length) errors.push(`Identifying columns are not allowed in research datasets: ${ident.join(", ")}.`);
  const missing: Record<string, number> = {};
  for (const c of columns) missing[c] = rows.filter((r) => r[c] == null || String(r[c]).trim() === "").length;
  const blankCodes = missing["participant_code"] ?? 0;
  if (blankCodes) errors.push(`${blankCodes} row(s) have no participant_code.`);
  const codes = rows.map((r) => String(r["participant_code"] ?? "").trim()).filter(Boolean);
  const bad = codes.filter((c) => !/^[A-Za-z0-9._-]{1,64}$/.test(c));
  if (bad.length) errors.push(`${bad.length} participant code(s) contain invalid characters.`);
  for (const [c, n] of Object.entries(missing)) if (n && c !== "participant_code") warnings.push(`${n} missing value(s) in "${c}".`);
  return { ok: errors.length === 0, errors, warnings, rowCount: rows.length, columns, missing, participants: new Set(codes).size };
}

/** SHA-256 hex of the raw file text — records exactly which file version was imported. */
export async function checksum(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function toCsv(rows: Record<string, unknown>[]): string {
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export interface ResearchBundle {
  project: { id: string; project_code: string; title: string; status: string; inclusion_criteria: string | null; exclusion_criteria: string | null; protocol: unknown };
  participants: { participant_code: string; included: boolean; exclusion_reason: string | null; split: string | null }[];
  datasets: { name: string; source: string; version: string; checksum: string; row_count: number; validation: unknown }[];
  experiments: { name: string; status: string; preprocessing: unknown; features: unknown; notes: string | null; versions: unknown; results: unknown; created_at: string }[];
  measurements: { participant_code: string; run_id: string; parameter_key: string; value: number | null; unit: string; status: string }[];
  annotations: { participant_code: string; run_id: string | null; parameter_key: string; value: number; unit: string; method: string }[];
}

/** Everything a reproducible research report must contain. Contains coded IDs only. */
export function buildResearchReport(b: ResearchBundle, versions: Record<string, unknown>, generatedAt = new Date().toISOString()) {
  const excluded = b.participants.filter((p) => !p.included);
  const missingMeasurements = b.measurements.filter((m) => m.value == null).length;
  const validated = b.project.status === "validated";
  return {
    studyId: b.project.project_code,
    title: b.project.title,
    findingStatus: validated ? "Validated (as recorded by the project owner)" : "Exploratory — not validated",
    generatedAt,
    datasets: b.datasets.map((d) => ({ name: d.name, source: d.source, version: d.version, sha256: d.checksum, rows: d.row_count })),
    participantCount: b.participants.length,
    includedCount: b.participants.length - excluded.length,
    exclusionCount: excluded.length,
    exclusions: excluded.map((p) => ({ participant: p.participant_code, reason: p.exclusion_reason })),
    splits: ["train", "validation", "test"].map((s) => ({ split: s, participants: b.participants.filter((p) => p.split === s).length })),
    criteria: { inclusion: b.project.inclusion_criteria, exclusion: b.project.exclusion_criteria },
    protocol: b.project.protocol,
    missingData: { measurementsTotal: b.measurements.length, measurementsUnavailable: missingMeasurements },
    experiments: b.experiments,
    softwareVersions: versions,
    validationMethodology: "Agreement of video-derived parameters against operator-entered ground truth: MAE, bias, Bland–Altman 95% limits, RMSE; percentile bootstrap 95% CI (n ≥ 8); ICC(2,1) (n ≥ 10). Participant-level splits.",
    limitations: [
      "Ground truth is as entered by project staff; its own accuracy is not verified by the platform.",
      "Small samples produce wide or unavailable confidence intervals.",
      "Monocular video without calibration yields relative spatial units only.",
      "Not a diagnostic device; results are for research only.",
    ],
  };
}
