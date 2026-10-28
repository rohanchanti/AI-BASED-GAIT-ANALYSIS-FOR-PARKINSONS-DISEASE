import type { DashboardRun } from "@/lib/dashboard-data";
import type { EngineOutput } from "@/lib/gait-engine/parameters";
import { PARAMETER_DEFINITIONS } from "@/lib/gait-engine/parameters";
import { visitComparison } from "@/lib/visit-comparison";

const KEYS = ["cadence", "stepTime", "strideTime", "strideTimeCV", "stepTimeSymmetry"];

function value(run: DashboardRun, key: string) {
  const engine = run.gait_results?.engine_output as unknown as EngineOutput | null;
  const p = engine?.parameters?.find((x) => x.key === key);
  if (!p || p.value == null) return "Not available";
  const unit = p.unit || PARAMETER_DEFINITIONS.find((d) => d.key === key)?.unit || "";
  return `${p.value} ${unit === "—" ? "" : unit}`.trim();
}

const label = (r: DashboardRun) => `${new Date(r.completed_at ?? r.started_at).toLocaleDateString()} · ${r.analysis_code ?? r.id.slice(0, 8)}`;

export function VisitComparison({ selected, runs }: { selected: DashboardRun | undefined; runs: DashboardRun[] }) {
  if (!selected?.recordings?.subject_id) return null;
  const { comparable, mismatched } = visitComparison(selected, runs);
  if (comparable.length === 0 && mismatched.length === 0) return null;
  const cols = [selected, ...comparable];

  return (
    <section className="glass rounded-2xl p-6 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-cyan">Visit comparison</div>
        <p className="mt-1 text-xs text-muted-foreground">Visits of this subject are compared only when protocol, camera view and pipeline version match.</p>
      </div>

      {comparable.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-left"><th className="py-2 pr-3">Parameter</th>{cols.map((r, i) => <th key={r.id} className="pr-3">{i === 0 ? "This visit" : label(r)}</th>)}</tr>
            </thead>
            <tbody>
              {KEYS.map((k) => (
                <tr key={k} className="border-t border-border/40">
                  <td className="py-2 pr-3">{PARAMETER_DEFINITIONS.find((d) => d.key === k)?.name ?? k}</td>
                  {cols.map((r) => <td key={r.id} className="pr-3 font-mono">{value(r, k)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No other visit of this subject has matching recording settings.</p>
      )}

      {mismatched.length > 0 && (
        <div role="alert" className="rounded-xl border border-warning/50 bg-warning/10 p-3 text-xs">
          <div className="font-medium text-warning">Not compared</div>
          <ul className="mt-1 list-disc pl-4 text-muted-foreground space-y-0.5">
            {mismatched.map(({ run, fields }) => (
              <li key={run.id}>{label(run)}: different or missing {fields.join(", ")}.</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
