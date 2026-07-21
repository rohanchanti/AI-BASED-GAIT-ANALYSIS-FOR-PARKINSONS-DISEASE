import { useEffect, useState } from "react";
import type { MediaKind } from "./UploadZone";
import type { AnalysisMode } from "./AnalysisModePicker";

const GAIT_STAGES = [
  "Validating video",
  "Extracting frames",
  "Detecting human",
  "Pose estimation",
  "Skeleton tracking",
  "Computing joint angles",
  "Detecting stride cycles",
  "Feature extraction",
  "Running ML model",
  "Comparing clinical norms",
  "Generating report",
];
const FACE_STAGES = [
  "Detecting face",
  "Face alignment",
  "Building face mesh",
  "Blink rate analysis",
  "Facial rigidity",
  "Head tremor detection",
  "Micro-expression analysis",
  "Feature extraction",
  "Running deep-learning model",
  "Generating report",
];

const DURATION: Record<AnalysisMode, number> = { quick: 6000, standard: 10000, precision: 14000 };

interface Props {
  kind: MediaKind;
  mode: AnalysisMode;
  onComplete: () => void;
}

export function ProcessingScreen({ kind, mode, onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const stages = kind === "gait" ? GAIT_STAGES : FACE_STAGES;
  const duration = DURATION[mode];

  useEffect(() => {
    const t0 = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(onComplete, 350);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, onComplete]);

  const stageIndex = Math.min(stages.length - 1, Math.floor(progress * stages.length));
  const eta = Math.max(0, Math.ceil(((1 - progress) * duration) / 1000));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-background/85 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-3xl glass gradient-border p-8 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan">
          {kind === "gait" ? "Gait pipeline" : "Facial pipeline"} · {mode}
        </div>

        {/* Neural graphic */}
        <div className="mx-auto mt-6 h-40 w-full max-w-md">
          <NeuralNet progress={progress} />
        </div>

        <div className="mt-6 font-display text-4xl sm:text-5xl font-bold gradient-text">
          {Math.round(progress * 100)}%
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          ~{eta}s remaining · {stages[stageIndex]}…
        </div>

        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-cyan to-purple transition-[width] duration-150 glow-primary"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <ul className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2 text-left">
          {stages.map((s, i) => (
            <li
              key={s}
              className={`text-xs rounded-md px-2 py-1.5 border transition ${
                i < stageIndex
                  ? "border-success/40 text-success bg-success/5"
                  : i === stageIndex
                  ? "border-primary/60 text-foreground bg-primary/10"
                  : "border-border/60 text-muted-foreground"
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function NeuralNet({ progress }: { progress: number }) {
  const layers = [
    [0.15, 0.4, 0.65, 0.9],
    [0.1, 0.35, 0.6, 0.85],
    [0.2, 0.5, 0.8],
    [0.3, 0.7],
  ];
  const x = [0.1, 0.37, 0.64, 0.9];
  return (
    <svg viewBox="0 0 400 160" className="w-full h-full">
      {layers.slice(0, -1).map((layer, li) =>
        layer.map((y1) =>
          layers[li + 1].map((y2, j) => (
            <line
              key={`${li}-${y1}-${j}`}
              x1={x[li] * 400}
              y1={y1 * 160}
              x2={x[li + 1] * 400}
              y2={y2 * 160}
              stroke="url(#g)"
              strokeWidth={1}
              opacity={0.3 + progress * 0.6}
              className="neural-flow"
            />
          )),
        ),
      )}
      {layers.map((layer, li) =>
        layer.map((y, i) => (
          <circle
            key={`n-${li}-${i}`}
            cx={x[li] * 400}
            cy={y * 160}
            r={4}
            fill="url(#g)"
            className="twinkle"
            style={{ animationDelay: `${(li + i) * 0.2}s` }}
          />
        )),
      )}
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="0.5" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
    </svg>
  );
}
