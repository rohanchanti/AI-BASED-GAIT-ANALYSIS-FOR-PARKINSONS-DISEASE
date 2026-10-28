import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ClinicianInterpretation({ runId }: { runId: string | undefined }) {
  const qc = useQueryClient();
  const key = ["clinician-interpretations", runId];
  const [comments, setComments] = useState("");
  const [interpretation, setInterpretation] = useState("");
  const list = useQuery({
    queryKey: key, enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await supabase.from("clinician_interpretations").select("*").eq("run_id", runId!).order("created_at", { ascending: false });
      if (error) throw new Error("Interpretations could not be loaded");
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clinician_interpretations").insert({
        run_id: runId!, comments: comments.trim() || null, interpretation: interpretation.trim(), supersedes: list.data?.[0]?.id ?? null,
      });
      if (error) throw new Error("Interpretation could not be saved");
    },
    onSuccess: () => { setComments(""); setInterpretation(""); toast.success("Clinician interpretation saved"); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(e.message),
  });
  if (!runId) return null;
  const [latest, ...earlier] = list.data ?? [];

  return (
    <section className="glass rounded-2xl p-6 space-y-4 mt-6" aria-labelledby="clin-int">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-cyan">Clinician interpretation</div>
        <h3 id="clin-int" className="font-display text-xl font-semibold">Clinician interpretation</h3>
        <p className="mt-1 text-xs text-muted-foreground">Written by a clinician and saved separately from the automated results. Automated outputs are not a diagnosis.</p>
      </div>

      {list.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : latest ? (
        <div className="rounded-xl border border-border/60 p-4 text-sm space-y-2">
          <div className="text-xs text-muted-foreground">Latest · {new Date(latest.created_at).toLocaleString()}</div>
          <p className="whitespace-pre-wrap">{latest.interpretation}</p>
          {latest.comments && <p className="whitespace-pre-wrap text-muted-foreground"><b className="text-foreground">Comments:</b> {latest.comments}</p>}
        </div>
      ) : <p className="text-sm text-muted-foreground">No clinician interpretation yet.</p>}

      {earlier.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer text-foreground">Earlier versions ({earlier.length})</summary>
          <ul className="mt-2 space-y-2">
            {earlier.map((e) => <li key={e.id} className="border-t border-border/40 pt-2"><div>{new Date(e.created_at).toLocaleString()}</div><p className="whitespace-pre-wrap">{e.interpretation}</p>{e.comments && <p>Comments: {e.comments}</p>}</li>)}
          </ul>
        </details>
      )}

      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (interpretation.trim()) save.mutate(); }}>
        <label className="block text-sm">Interpretation
          <Textarea className="mt-1" value={interpretation} maxLength={5000} onChange={(e) => setInterpretation(e.target.value)} required />
        </label>
        <label className="block text-sm">Comments (optional)
          <Textarea className="mt-1" value={comments} maxLength={5000} onChange={(e) => setComments(e.target.value)} />
        </label>
        <Button type="submit" disabled={!interpretation.trim() || save.isPending}>{latest ? "Save new version" : "Save interpretation"}</Button>
      </form>
    </section>
  );
}
