import type { DashboardRun } from "@/lib/dashboard-data";

const DONE = ["complete", "completed", "completed_with_warnings"];

export type ComparisonField = "subject" | "protocol" | "camera view" | "pipeline version";

/** Returns the fields that prevent comparing two runs; empty means comparable. Missing values never match. */
export function comparisonMismatches(a: DashboardRun, b: DashboardRun): ComparisonField[] {
  const pairs: [ComparisonField, unknown, unknown][] = [
    ["subject", a.recordings?.subject_id, b.recordings?.subject_id],
    ["protocol", a.recordings?.protocol, b.recordings?.protocol],
    ["camera view", a.recordings?.camera_view, b.recordings?.camera_view],
    ["pipeline version", a.pipeline_version, b.pipeline_version],
  ];
  return pairs.filter(([, x, y]) => x == null || y == null || x !== y).map(([f]) => f);
}

/** Other completed runs of the same subject, split into comparable and mismatched. */
export function visitComparison(selected: DashboardRun, runs: DashboardRun[]) {
  const sameSubject = runs.filter((r) => r.id !== selected.id && DONE.includes(r.status) && r.gait_results
    && r.recordings?.subject_id && r.recordings.subject_id === selected.recordings?.subject_id);
  const comparable: DashboardRun[] = [];
  const mismatched: { run: DashboardRun; fields: ComparisonField[] }[] = [];
  for (const run of sameSubject) {
    const fields = comparisonMismatches(selected, run);
    if (fields.length === 0) comparable.push(run); else mismatched.push({ run, fields });
  }
  return { comparable, mismatched };
}
