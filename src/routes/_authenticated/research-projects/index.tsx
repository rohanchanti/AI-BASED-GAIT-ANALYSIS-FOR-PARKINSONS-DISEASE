import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { listProjects, createProject } from "@/lib/research.functions";
import { PageShell, Card, Loading, ErrorBox, Empty, inputCls, btnPrimary, btnGhost } from "@/components/workspace/shared";

export const Route = createFileRoute("/_authenticated/research-projects/")({
  head: () => ({
    meta: [
      { title: "Research projects — NeuroStride AI" },
      { name: "description", content: "Coded research projects, datasets and evaluations." },
      { property: "og:title", content: "Research projects — NeuroStride AI" },
      { property: "og:description", content: "Coded research projects, datasets and evaluations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Projects,
});

function Projects() {
  const fn = useServerFn(listProjects);
  const q = useQuery({ queryKey: ["research-projects"], queryFn: () => fn() });
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const rows = useMemo(() => ((q.data ?? []) as any[]).filter((p) => `${p.project_code} ${p.title}`.toLowerCase().includes(search.toLowerCase())), [q.data, search]);
  return (
    <PageShell eyebrow="Research Analysis" title="Research projects" back={{ to: "/workspace", label: "Workspace" }} actions={<button className={btnPrimary} onClick={() => setCreating(true)}>New project</button>}>
      {creating && <NewProject onCancel={() => setCreating(false)} />}
      <Card title="Projects" right={<input aria-label="Search projects" className={inputCls + " w-56"} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />}>
        {q.isLoading ? <Loading /> : q.error ? <ErrorBox message={(q.error as Error).message} /> : !rows.length ? <Empty>No research projects yet.</Empty> : (
          <ul className="divide-y divide-border/50">
            {rows.map((p) => (
              <li key={p.id}><Link to="/research-projects/$id" params={{ id: p.id }} className="flex justify-between rounded-lg px-2 py-3 hover:bg-white/5">
                <div><div className="font-medium">{p.title}</div><div className="text-xs text-muted-foreground">{p.project_code} · {p.status} · {p.research_participants?.length ?? 0} participants</div></div>
                <span className="text-xs text-muted-foreground">{p.updated_at.slice(0, 10)}</span>
              </Link></li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}

function NewProject({ onCancel }: { onCancel: () => void }) {
  const fn = useServerFn(createProject);
  const nav = useNavigate();
  const [f, setF] = useState({ code: "", title: "", description: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { const r = await fn({ data: { code: f.code.trim(), title: f.title.trim(), description: f.description || undefined } }); nav({ to: "/research-projects/$id", params: { id: r.id } }); }
    catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <Card title="New research project">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="text-xs text-muted-foreground">Project ID *</span><input required className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="e.g. GAIT-PILOT-01" /></label>
        <label className="block"><span className="text-xs text-muted-foreground">Title *</span><input required minLength={3} className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="block sm:col-span-2"><span className="text-xs text-muted-foreground">Description</span><textarea rows={2} className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onCancel}>Cancel</button><button className={btnPrimary} disabled={busy}>Create</button></div>
      </form>
    </Card>
  );
}
