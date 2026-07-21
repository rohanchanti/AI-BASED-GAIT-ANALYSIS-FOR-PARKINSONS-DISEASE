import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listReports, deleteReport } from "@/lib/reports.functions";
import { toast } from "sonner";
import { Trash2, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const list = useServerFn(listReports);
  const del = useServerFn(deleteReport);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["reports"], queryFn: () => list() });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Report deleted");
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl glass gradient-border">
          <FileText className="h-5 w-5 text-cyan" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">Archive</div>
          <h1 className="font-display text-3xl font-semibold">Reports</h1>
        </div>
      </div>

      <div className="mt-8 glass rounded-2xl">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {data && data.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">No reports saved yet.</p>
            <a href="/#analyze" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary">
              Start an analysis
            </a>
          </div>
        )}
        <ul className="divide-y divide-border/60">
          {data?.map((r) => (
            <li key={r.id} className="flex items-center gap-4 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 text-xs font-semibold">
                {(Number(r.probability) * 100).toFixed(0)}%
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {r.patient_name || "Unnamed patient"} · {r.kind === "gait" ? "Gait analysis" : "Facial analysis"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · Mode: {r.mode} · Risk: {r.risk_level} ·
                  Confidence {(Number(r.confidence) * 100).toFixed(0)}%
                </div>
              </div>
              <button
                onClick={() => remove.mutate(r.id)}
                className="rounded-lg border border-border p-2 text-muted-foreground hover:text-danger hover:border-danger/50"
                aria-label="Delete report"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
