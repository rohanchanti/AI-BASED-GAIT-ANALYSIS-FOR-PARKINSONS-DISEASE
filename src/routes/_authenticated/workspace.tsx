import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Stethoscope, FlaskConical, Lock } from "lucide-react";
import { getMyRoles } from "@/lib/clinical.functions";
import { PageShell, Loading, ErrorBox, Notice } from "@/components/workspace/shared";

export const Route = createFileRoute("/_authenticated/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — NeuroStride AI" },
      { name: "description", content: "Choose Clinical Assessment or Research Analysis." },
      { property: "og:title", content: "Workspace — NeuroStride AI" },
      { property: "og:description", content: "Choose Clinical Assessment or Research Analysis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const fn = useServerFn(getMyRoles);
  const q = useQuery({ queryKey: ["my-roles"], queryFn: () => fn() });
  const roles = q.data?.roles ?? [];
  const clinical = roles.includes("clinician") || roles.includes("admin");
  const research = roles.includes("researcher") || roles.includes("admin");
  const cards = [
    { to: "/clinical", icon: Stethoscope, title: "Clinical Assessment", allowed: clinical, need: "clinician", desc: "Patients, visits, consent, recording, review and structured decision-support reports." },
    { to: "/research-projects", icon: FlaskConical, title: "Research Analysis", allowed: research, need: "researcher", desc: "Projects, coded participants, datasets, ground truth, evaluation and reproducible exports." },
  ] as const;
  return (
    <PageShell eyebrow="Workspace" title="Choose a mode">
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox message={(q.error as Error).message} /> : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((c) => {
              const Icon = c.icon;
              const body = (
                <div className={`h-full rounded-2xl glass gradient-border p-6 transition ${c.allowed ? "hover:-translate-y-1" : "opacity-60"}`}>
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15">{c.allowed ? <Icon className="h-5 w-5 text-cyan" /> : <Lock className="h-5 w-5 text-muted-foreground" />}</div>
                    <h2 className="font-display text-xl font-semibold">{c.title}</h2>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{c.desc}</p>
                  {!c.allowed && <p className="mt-3 text-xs text-warning">Requires the {c.need} role. Ask an administrator for access.</p>}
                </div>
              );
              return c.allowed ? <Link key={c.to} to={c.to} className="block">{body}</Link> : <div key={c.to} aria-disabled>{body}</div>;
            })}
          </div>
          <Notice>Your roles: {roles.length ? roles.join(", ") : "none assigned"}. Outputs are research and decision-support information for qualified review. The platform does not diagnose Parkinson's disease.</Notice>
        </>
      )}
    </PageShell>
  );
}
