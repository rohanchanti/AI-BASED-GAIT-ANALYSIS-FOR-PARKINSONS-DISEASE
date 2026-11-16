export interface TimingRow {
  dataset_id: string;
  record_id: string;
  group_name: string | null;
  stride_mean_s: number | null;
  stride_cv_pct: number | null;
  status: string;
  note: string | null;
}
export interface GroupStat { group: string; records: number; meanStride: number | null; medianCv: number | null }
export interface DatasetSummary { id: string; name: string; records: number; unreliable: number; groups: GroupStat[]; notes: { record: string; note: string }[] }

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export const isGaitdb = (name: string) => /\bgaitdb\b/i.test(name);

function groupStats(rows: TimingRow[]): GroupStat[] {
  const by = new Map<string, TimingRow[]>();
  for (const r of rows) {
    const g = r.group_name ?? "unspecified";
    by.set(g, [...(by.get(g) ?? []), r]);
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, rs]) => ({
    group,
    records: rs.length,
    meanStride: mean(rs.map((r) => num(r.stride_mean_s)).filter((v): v is number => v !== null)),
    medianCv: median(rs.map((r) => num(r.stride_cv_pct)).filter((v): v is number => v !== null)),
  }));
}

export function summarizeDataset(id: string, name: string, rows: TimingRow[]): DatasetSummary {
  return {
    id, name, records: rows.length,
    unreliable: rows.filter((r) => r.status === "unreliable").length,
    groups: groupStats(rows),
    notes: rows.filter((r) => r.note && r.note.trim()).map((r) => ({ record: r.record_id, note: r.note!.trim() })),
  };
}

/** Combined per-group statistics across datasets, always excluding gaitdb. */
export function combinedSummary(datasets: { name: string; rows: TimingRow[] }[]) {
  const rows = datasets.filter((d) => !isGaitdb(d.name)).flatMap((d) => d.rows);
  return { records: rows.length, unreliable: rows.filter((r) => r.status === "unreliable").length, groups: groupStats(rows) };
}
