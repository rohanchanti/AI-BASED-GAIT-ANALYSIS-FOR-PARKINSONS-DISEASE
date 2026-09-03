import { AlertTriangle } from "lucide-react";

export const RESEARCH_DISCLAIMER =
  "This system is intended for research and decision-support purposes only. AI-derived measurements are not a medical diagnosis and should be interpreted alongside clinical assessment.";

export function ResearchDisclaimer({ variant = "banner" }: { variant?: "banner" | "inline" }) {
  if (variant === "inline") {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground/80">Research use only:</strong> {RESEARCH_DISCLAIMER}
      </p>
    );
  }
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground/90">Research &amp; decision-support tool. </span>
        {RESEARCH_DISCLAIMER}
      </p>
    </div>
  );
}
