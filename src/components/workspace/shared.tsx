import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, AlertTriangle, Info } from "lucide-react";
import { PARAMETER_DEFINITIONS } from "@/lib/gait-engine/parameters";
import { STATUS_LABEL } from "@/lib/video-config";

export const inputCls = "mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary";
export const btnPrimary = "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed";
export const btnGhost = "inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50";

export function PageShell({ title, eyebrow, back, children, actions }: { title: string; eyebrow: string; back?: { to: string; label: string; params?: Record<string, string> }; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-28 pb-20">
      {back && (
        <Link to={back.to as "/"} params={back.params as never} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">{eyebrow}</div>
          <h1 className="mt-1 font-display text-3xl font-semibold">{title}</h1>
        </div>
        {actions}
      </div>
      <div className="mt-8 space-y-6">{children}</div>
    </div>
  );
}

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl glass gradient-border p-5 sm:p-6">
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-display text-lg font-semibold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {label}</div>;
}
export function ErrorBox({ message }: { message: string }) {
  return <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"><AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" /> {message}</div>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</div>;
}
export function Notice({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0 text-warning" /> <div>{children}</div></div>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "completed" ? "bg-success/15 text-success" :
    status === "completed_with_warnings" ? "bg-warning/15 text-warning" :
    status === "failed" || status === "cancelled" ? "bg-destructive/15 text-destructive" :
    "bg-primary/15 text-cyan";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{(STATUS_LABEL as Record<string, string>)[status] ?? status.replace(/_/g, " ")}</span>;
}

export interface ParamRow { key: string; value: number | null; status: string; n?: number; reason?: string }

/** Shared parameter table: units, status and definition tooltips from the engine registry. */
export function ParameterTable({ params }: { params: ParamRow[] }) {
  if (!params.length) return <Empty>No gait parameters were stored for this analysis.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="py-2 pr-3">Parameter</th><th className="py-2 pr-3">Value</th><th className="py-2 pr-3">Unit</th><th className="py-2 pr-3">Status</th><th className="py-2">n</th></tr>
        </thead>
        <tbody>
          {params.map((p) => {
            const d = PARAMETER_DEFINITIONS.find((x) => x.key === p.key);
            return (
              <tr key={p.key} className="border-t border-border/50">
                <td className="py-2 pr-3"><abbr title={d ? `${d.definition}\nFormula: ${d.formula}\nValidation: ${d.validation}` : undefined} className="no-underline cursor-help">{d?.name ?? p.key}</abbr></td>
                <td className="py-2 pr-3 font-mono">{p.status === "unavailable" || p.value == null ? <span className="text-muted-foreground" title={p.reason}>unavailable</span> : Number(p.value.toFixed(3))}</td>
                <td className="py-2 pr-3 text-muted-foreground">{d?.unit ?? ""}</td>
                <td className="py-2 pr-3 text-xs">{p.status}{p.reason && p.status === "unavailable" ? ` — ${p.reason}` : ""}</td>
                <td className="py-2 text-muted-foreground">{p.n ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const BONES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 31], [24, 26], [26, 28], [28, 32], [27, 29], [28, 30]];

/** Video playback with the stored pose skeleton drawn over the matching frame. */
export function VideoWithPose({ url, frames }: { url: string; frames: { t: number; lm: number[] | null }[] | null }) {
  const v = useRef<HTMLVideoElement>(null);
  const c = useRef<HTMLCanvasElement>(null);
  const [overlay, setOverlay] = useState(true);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const video = v.current, canvas = c.current;
      if (video && canvas) {
        canvas.width = video.clientWidth; canvas.height = video.clientHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (overlay && frames?.length && video.videoWidth) {
          let best = frames[0];
          for (const f of frames) if (Math.abs(f.t - video.currentTime) < Math.abs(best.t - video.currentTime)) best = f;
          if (best.lm && Math.abs(best.t - video.currentTime) < 0.25) {
            const s = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
            const ox = (canvas.width - video.videoWidth * s) / 2, oy = (canvas.height - video.videoHeight * s) / 2;
            const pt = (i: number) => [ox + best.lm![i * 4] * video.videoWidth * s, oy + best.lm![i * 4 + 1] * video.videoHeight * s, best.lm![i * 4 + 3]];
            ctx.strokeStyle = "rgba(56,189,248,0.9)"; ctx.lineWidth = 2;
            for (const [a, b] of BONES) { const [x1, y1, va] = pt(a); const [x2, y2, vb] = pt(b); if (va > 0.3 && vb > 0.3) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); } }
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [frames, overlay]);
  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-background/60">
        <video ref={v} src={url} controls playsInline className="w-full max-h-[420px]" />
        <canvas ref={c} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
      </div>
      <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} disabled={!frames?.length} />
        {frames?.length ? "Show pose overlay" : "Pose overlay not available (no stored landmarks)"}
      </label>
    </div>
  );
}

export function useConfirm() {
  return (message: string) => window.confirm(message);
}
