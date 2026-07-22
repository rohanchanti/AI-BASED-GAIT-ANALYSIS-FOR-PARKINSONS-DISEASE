import { Footprints, Timer, Camera, Video, Layers } from "lucide-react";

export type AnalysisMode =
  | "normal"
  | "tug"
  | "side"
  | "front"
  | "multi"
  | "quick"
  | "standard"
  | "precision";

const modes: {
  id: AnalysisMode;
  icon: typeof Footprints;
  title: string;
  time: string;
  desc: string;
  accent: string;
}[] = [
  {
    id: "normal",
    icon: Footprints,
    title: "Normal Walking Test",
    time: "≈ 1 min",
    desc: "Standard steady-state gait assessment.",
    accent: "cyan",
  },
  {
    id: "tug",
    icon: Timer,
    title: "Timed Up and Go (TUG)",
    time: "≈ 1 min",
    desc: "Chair-rise, walk, turn, return — fall-risk screen.",
    accent: "primary",
  },
  {
    id: "side",
    icon: Camera,
    title: "Side View Analysis",
    time: "≈ 2 min",
    desc: "Sagittal-plane joint kinematics.",
    accent: "purple",
  },
  {
    id: "front",
    icon: Video,
    title: "Front View Analysis",
    time: "≈ 2 min",
    desc: "Coronal-plane symmetry & step width.",
    accent: "cyan",
  },
  {
    id: "multi",
    icon: Layers,
    title: "Multi-Angle Analysis",
    time: "≈ 3 min",
    desc: "Highest precision — fuses all planes.",
    accent: "primary",
  },
];

interface Props {
  onSelect: (m: AnalysisMode) => void;
  onCancel?: () => void;
}

export function AnalysisModePicker({ onSelect, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl rounded-3xl glass gradient-border p-6 sm:p-8 max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan">Choose analysis mode</div>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-semibold">
              Select clinical gait protocol
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Each mode adapts calculations to the recording setup.
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

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <p className="mt-3 text-sm text-muted-foreground">{m.desc}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition">
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
