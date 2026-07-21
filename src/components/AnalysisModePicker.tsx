import { Zap, Rocket, Microscope, Check } from "lucide-react";

export type AnalysisMode = "quick" | "standard" | "precision";

const modes: {
  id: AnalysisMode;
  icon: typeof Zap;
  title: string;
  time: string;
  bullets: string[];
  accent: string;
}[] = [
  {
    id: "quick",
    icon: Zap,
    title: "Quick Analysis",
    time: "≈ 1 minute",
    bullets: ["Every 20th frame", "Fast pose estimation", "Basic parameters", "Instant screening"],
    accent: "cyan",
  },
  {
    id: "standard",
    icon: Rocket,
    title: "Standard Analysis",
    time: "≈ 5 minutes",
    bullets: ["5-frame windows", "Improved pose tracking", "Clinical comparison", "Balanced accuracy"],
    accent: "primary",
  },
  {
    id: "precision",
    icon: Microscope,
    title: "Precision Analysis",
    time: "≈ 10 minutes",
    bullets: ["Frame-by-frame", "Noise removal & filtering", "Joint refinement", "Research-grade report"],
    accent: "purple",
  },
];

interface Props {
  onSelect: (m: AnalysisMode) => void;
  onCancel?: () => void;
}

export function AnalysisModePicker({ onSelect, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl rounded-3xl glass gradient-border p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan">Choose analysis mode</div>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-semibold">
              How deep should the AI go?
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              You can rerun with a different mode at any time from Reports.
            </p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="group relative text-left rounded-2xl border border-border/70 bg-card/40 p-5 transition-all hover:-translate-y-1 hover:border-primary/60 hover:glow-primary"
              >
                <div className={`h-11 w-11 rounded-xl grid place-items-center bg-${m.accent}/15`}>
                  <Icon className={`h-5 w-5 text-${m.accent}`} />
                </div>
                <div className="mt-4 font-display text-lg font-semibold">{m.title}</div>
                <div className="text-xs text-muted-foreground">{m.time}</div>
                <ul className="mt-4 space-y-2">
                  {m.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 mt-0.5 text-success shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition">
                  Start →
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
