/**
 * Reusable research-platform primitives.
 *
 * Rule enforced here: a value that cannot be measured is rendered as
 * "Not available" — never as an estimate, placeholder number, or guess.
 */
import type { ReactNode } from "react";

export function NotAvailable({ reason }: { reason?: string }) {
  return (
    <span
      className="text-muted-foreground/70 italic"
      title={reason ?? "This value is not produced by the current analysis pipeline."}
    >
      Not available
    </span>
  );
}

/** A labelled read-only value with optional unit / confidence / description. */
export function MetricValue({
  label,
  value,
  unit,
  confidence,
  description,
}: {
  label: string;
  value: ReactNode | null | undefined;
  unit?: string;
  confidence?: number | null;
  description?: string;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-base font-semibold text-foreground/90 break-words">
        {empty ? <NotAvailable /> : value}
        {!empty && unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span> : null}
      </div>
      {confidence != null && (
        <div className="mt-0.5">
          <ConfidenceIndicator value={confidence} />
        </div>
      )}
      {description && <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</div>}
    </div>
  );
}

function scoreTone(pct: number) {
  if (pct >= 85) return { bar: "bg-success", text: "text-success" };
  if (pct >= 65) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-danger", text: "text-danger" };
}

/** 0..100 confidence, shown as a compact inline chip. */
export function ConfidenceIndicator({ value }: { value: number | null | undefined }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-[11px] text-muted-foreground/70 italic">confidence not available</span>;
  }
  const pct = Math.max(0, Math.min(100, value));
  const tone = scoreTone(pct);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="inline-block h-1.5 w-12 rounded-full bg-white/10 overflow-hidden align-middle">
        <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={tone.text}>{pct.toFixed(0)}%</span>
      <span>confidence</span>
    </span>
  );
}

/** 0..100 quality metric, shown as a labelled horizontal bar. */
export function QualityBar({
  label,
  value,
  note,
}: {
  label: string;
  value: number | null | undefined;
  note?: string;
}) {
  const has = value != null && Number.isFinite(value);
  const pct = has ? Math.max(0, Math.min(100, value as number)) : 0;
  const tone = scoreTone(pct);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={has ? `font-medium ${tone.text}` : ""}>
          {has ? `${pct.toFixed(0)}%` : <NotAvailable reason={note} />}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuenow={has ? Math.round(pct) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {has && <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />}
      </div>
      {note && has && <div className="mt-1 text-[10px] text-muted-foreground">{note}</div>}
    </div>
  );
}

/** Section wrapper matching the existing glass card language. */
export function ResearchCard({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass rounded-2xl p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] text-cyan">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
