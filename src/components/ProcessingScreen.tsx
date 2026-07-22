import { useEffect, useState } from "react";
import type { MediaKind } from "./UploadZone";
import type { AnalysisMode } from "./AnalysisModePicker";
import { Activity } from "lucide-react";

const DURATION: Record<AnalysisMode, number> = {
  normal: 6000,
  tug: 6000,
  side: 8000,
  front: 8000,
  multi: 11000,
  quick: 5000,
  standard: 8000,
  precision: 11000,
};

interface Props {
  kind: MediaKind;
  mode: AnalysisMode;
  onComplete: () => void;
}

const LABEL: Record<AnalysisMode, string> = {
  normal: "Normal Walking Test",
  tug: "Timed Up and Go",
  side: "Side View Analysis",
  front: "Front View Analysis",
  multi: "Multi-Angle Analysis",
  quick: "Quick Analysis",
  standard: "Standard Analysis",
  precision: "Precision Analysis",
};

export function ProcessingScreen({ kind, mode, onComplete }: Props) {
  const [uploadPct, setUploadPct] = useState(0);
  const [analysisPct, setAnalysisPct] = useState(0);
  const [phase, setPhase] = useState<"upload" | "analyze" | "done">("upload");
  const duration = DURATION[mode] ?? 8000;

  // simulated upload
  useEffect(() => {
    const start = performance.now();
    const dur = 1600;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setUploadPct(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setPhase("analyze");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // analysis progress (silent)
  useEffect(() => {
    if (phase !== "analyze") return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setAnalysisPct(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setPhase("done");
        setTimeout(onComplete, 500);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, duration, onComplete]);

  const pct = phase === "upload" ? uploadPct : analysisPct;
  const label =
    phase === "upload"
      ? "Uploading media…"
      : phase === "analyze"
      ? "Analysis in progress"
      : "Analysis complete";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-background/85 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-3xl glass gradient-border p-8 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan">
          {kind === "gait" ? "Clinical Gait Analysis" : "Facial Analysis"} · {LABEL[mode] ?? mode}
        </div>

        <div className="mx-auto mt-8 h-24 w-24 rounded-full bg-primary/10 grid place-items-center glow-primary">
          <Activity className="h-10 w-10 text-cyan animate-pulse" />
        </div>

        <div className="mt-8 font-display text-5xl font-bold gradient-text">
          {Math.round(pct * 100)}%
        </div>
        <div className="mt-2 text-sm text-muted-foreground">{label}</div>

        <div className="mt-6 h-2.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-cyan to-purple transition-[width] duration-150 glow-primary"
            style={{ width: `${pct * 100}%` }}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
          <div className={`rounded-lg border p-2 ${phase === "upload" ? "border-primary/60 text-foreground" : "border-success/40 text-success"}`}>
            {phase === "upload" ? "Uploading" : "Upload complete"}
          </div>
          <div className={`rounded-lg border p-2 ${
            phase === "analyze" ? "border-primary/60 text-foreground"
            : phase === "done" ? "border-success/40 text-success"
            : "border-border/60 text-muted-foreground"
          }`}>
            {phase === "done" ? "Analysis complete" : "Analyzing"}
          </div>
        </div>
      </div>
    </div>
  );
}
