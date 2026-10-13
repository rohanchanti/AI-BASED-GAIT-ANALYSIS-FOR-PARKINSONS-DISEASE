import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, UserPlus } from "lucide-react";
import { listPatients, createPatient } from "@/lib/clinical.functions";
import { PageShell, Card, Loading, ErrorBox, Empty, inputCls, btnPrimary, btnGhost } from "@/components/workspace/shared";

export const Route = createFileRoute("/_authenticated/clinical/")({
  head: () => ({
    meta: [
      { title: "Patients — Clinical Assessment" },
      { name: "description", content: "Search patients and open visit history." },
      { property: "og:title", content: "Patients — Clinical Assessment" },
      { property: "og:description", content: "Search patients and open visit history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Patients,
});

type Sort = "recent" | "code" | "name";

function Patients() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [sex, setSex] = useState("");
  const [creating, setCreating] = useState(false);
  const fn = useServerFn(listPatients);
  const q = useQuery({ queryKey: ["patients", search], queryFn: () => fn({ data: { search } }) });
  const rows = useMemo(() => {
    const r = [...((q.data ?? []) as any[])].filter((p) => !sex || p.sex === sex);
    if (sort === "code") r.sort((a, b) => a.subject_code.localeCompare(b.subject_code));
    if (sort === "name") r.sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));
    return r;
  }, [q.data, sort, sex]);
  return (
    <PageShell eyebrow="Clinical Assessment" title="Patients" back={{ to: "/workspace", label: "Workspace" }}
      actions={<button className={btnPrimary} onClick={() => setCreating((v) => !v)}><UserPlus className="h-4 w-4" /> New patient</button>}>
      {creating && <NewPatient onDone={() => setCreating(false)} />}
      <Card>
        <div className="flex flex-wrap gap-3">
          <label className="relative flex-1 min-w-[220px]">
            <span className="sr-only">Search patients</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or Subject ID" className={inputCls + " !mt-0 pl-9"} />
          </label>
          <select aria-label="Filter by sex" value={sex} onChange={(e) => setSex(e.target.value)} className={inputCls + " !mt-0 w-auto"}>
            <option value="">All sexes</option><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option>
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={inputCls + " !mt-0 w-auto"}>
            <option value="recent">Recently updated</option><option value="code">Subject ID</option><option value="name">Name</option>
          </select>
        </div>
        <div className="mt-4">
          {q.isLoading ? <Loading /> : q.error ? <ErrorBox message={(q.error as Error).message} /> : !rows.length ? <Empty>No patients found. Create a patient record to begin.</Empty> : (
            <ul className="divide-y divide-border/50">
              {rows.map((p) => (
                <li key={p.id}>
                  <Link to="/clinical/patients/$id" params={{ id: p.id }} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-white/5 rounded-lg px-2">
                    <div><div className="font-medium">{p.display_name}</div><div className="text-xs text-muted-foreground">{p.subject_code} · {p.age ?? "?"} y · {p.sex ?? "?"}</div></div>
                    <div className="text-xs text-muted-foreground">{p.visits?.length ?? 0} visit(s)</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </PageShell>
  );
}

export function NewPatient({ onDone }: { onDone: () => void }) {
  const fn = useServerFn(createPatient);
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", subjectId: "", age: "", sex: "", heightCm: "", weightKg: "", clinicalHistory: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = "This field is required.";
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(f.subjectId.trim())) er.subjectId = "Use letters, numbers, dot, dash or underscore.";
    if (!/^\d{1,3}$/.test(f.age) || +f.age < 1 || +f.age > 120) er.age = "Enter a whole number between 1 and 120.";
    if (!f.sex) er.sex = "This field is required.";
    setErrs(er);
    if (Object.keys(er).length) { document.getElementById(`np-${Object.keys(er)[0]}`)?.focus(); return; }
    setBusy(true);
    try {
      const r = await fn({ data: { name: f.name.trim(), subjectId: f.subjectId.trim(), age: +f.age, sex: f.sex as "Male", heightCm: f.heightCm ? +f.heightCm : null, weightKg: f.weightKg ? +f.weightKg : null, clinicalHistory: f.clinicalHistory.trim() || null } });
      toast.success("Patient created");
      onDone();
      nav({ to: "/clinical/patients/$id", params: { id: r.id } });
    } catch (x) { toast.error((x as Error).message); } finally { setBusy(false); }
  }
  const field = (k: keyof typeof f, label: string, el: React.ReactNode) => (
    <label className="block"><span className="text-xs text-muted-foreground">{label}</span>{el}{errs[k] && <span className="mt-1 block text-xs text-destructive">{errs[k]}</span>}</label>
  );
  return (
    <Card title="New patient record">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
        {field("name", "Patient Name *", <input id="np-name" className={inputCls} value={f.name} onChange={set("name")} placeholder="e.g. John Doe" />)}
        {field("subjectId", "Subject ID *", <input id="np-subjectId" className={inputCls} value={f.subjectId} onChange={set("subjectId")} placeholder="e.g. PD-0012" />)}
        {field("age", "Age *", <input id="np-age" inputMode="numeric" className={inputCls} value={f.age} onChange={set("age")} />)}
        {field("sex", "Sex *", <select id="np-sex" className={inputCls} value={f.sex} onChange={set("sex")}><option value="">Select…</option><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option></select>)}
        {field("heightCm", "Height (cm) — optional", <input type="number" className={inputCls} value={f.heightCm} onChange={set("heightCm")} />)}
        {field("weightKg", "Weight (kg) — optional, sensitive", <input type="number" className={inputCls} value={f.weightKg} onChange={set("weightKg")} />)}
        <div className="sm:col-span-2">{field("clinicalHistory", "Relevant clinical history — optional, sensitive", <textarea rows={3} className={inputCls} value={f.clinicalHistory} onChange={set("clinicalHistory")} />)}</div>
        <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onDone}>Cancel</button><button className={btnPrimary} disabled={busy}>{busy ? "Saving…" : "Create patient"}</button></div>
      </form>
    </Card>
  );
}
