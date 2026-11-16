import { describe, it, expect } from "vitest";
import { combinedSummary, summarizeDataset, type TimingRow } from "./reference-timing";
const r = (g: string, s: number | null, cv: number | null, status = "estimated", note: string | null = null): TimingRow =>
  ({ dataset_id: "d", record_id: g + s, group_name: g, stride_mean_s: s, stride_cv_pct: cv, status, note });
describe("reference timing summaries", () => {
  it("computes per-group mean stride, median CV and unreliable count", () => {
    const s = summarizeDataset("d", "gaitndd", [r("PD", 1, 2), r("PD", 2, 4), r("PD", null, 10, "unreliable", "short")]);
    expect(s.records).toBe(3);
    expect(s.unreliable).toBe(1);
    expect(s.groups[0]).toEqual({ group: "PD", records: 3, meanStride: 1.5, medianCv: 4 });
    expect(s.notes).toEqual([{ record: "PDnull", note: "short" }]);
  });
  it("excludes gaitdb from combined statistics", () => {
    const c = combinedSummary([
      { name: "PhysioNet Gait in Aging and Disease (gaitdb, teaching collection)", rows: [r("PD", 9, 9)] },
      { name: "PhysioNet Gait Dynamics in Neuro-Degenerative Disease (gaitndd)", rows: [r("PD", 1, 3)] },
    ]);
    expect(c.records).toBe(1);
    expect(c.groups[0].meanStride).toBe(1);
  });
});
