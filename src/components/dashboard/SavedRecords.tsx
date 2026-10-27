import { Button } from "@/components/ui/button";
import type { DashboardRun, DashboardSubject, DashboardVisit } from "@/lib/dashboard-data";
import { STATUS_LABEL } from "@/lib/video-config";

export function SavedRecords({ subjects, visits, runs, selected, onSelect }: {
  subjects: DashboardSubject[]; visits: DashboardVisit[]; runs: DashboardRun[];
  selected?: string; onSelect: (id: string) => void;
}) {
  const subjectName = (id: string | null | undefined) => subjects.find((s) => s.id === id)?.subject_code ?? "Not available";
  return <div className="mt-8 space-y-8 print:hidden">
    <section aria-labelledby="saved-subjects"><h2 id="saved-subjects" className="font-display text-xl font-semibold">Subjects</h2>
      {!subjects.length ? <p className="py-6 text-sm text-muted-foreground">No subjects yet.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">Subject ID</th><th>Name</th><th>Age</th><th>Sex</th></tr></thead><tbody>{subjects.map((s) => <tr key={s.id} className="border-t border-border"><td className="py-3">{s.subject_code}</td><td>{s.display_name ?? "Not available"}</td><td>{s.age ?? "Not available"}</td><td>{s.sex ?? "Not available"}</td></tr>)}</tbody></table></div>}
    </section>
    <section aria-labelledby="saved-visits"><h2 id="saved-visits" className="font-display text-xl font-semibold">Visits</h2>
      {!visits.length ? <p className="py-6 text-sm text-muted-foreground">No visits yet.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">Visit</th><th>Subject</th><th>Date</th><th>Recording condition</th></tr></thead><tbody>{visits.map((v) => <tr key={v.id} className="border-t border-border"><td className="py-3">{v.visit_code ?? v.id}</td><td>{subjectName(v.subject_id)}</td><td>{new Date(v.visit_date).toLocaleDateString()}</td><td>{v.recording_condition ?? "Not available"}</td></tr>)}</tbody></table></div>}
    </section>
    <section aria-labelledby="saved-analyses"><h2 id="saved-analyses" className="font-display text-xl font-semibold">Analyses</h2>
      {!runs.length ? <p className="py-6 text-sm text-muted-foreground">No analyses yet.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">Analysis</th><th>Subject / visit</th><th>Date</th><th>Status</th><th>Result</th></tr></thead><tbody>{runs.map((r) => <tr key={r.id} className="border-t border-border"><td className="py-3 font-mono text-xs">{r.analysis_code ?? r.id}</td><td>{subjectName(r.recordings?.subject_id)} / {visits.find((v) => v.id === r.recordings?.visit_id)?.visit_code ?? "Not available"}</td><td>{new Date(r.started_at).toLocaleDateString()}</td><td>{STATUS_LABEL[r.status] ?? r.status}{r.error_message && <p className="max-w-xs text-xs text-muted-foreground">{r.error_message}</p>}</td><td><Button variant={selected === r.id ? "secondary" : "outline"} size="sm" onClick={() => onSelect(r.id)} aria-label={`View analysis ${r.analysis_code ?? r.id}`}>View</Button></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}