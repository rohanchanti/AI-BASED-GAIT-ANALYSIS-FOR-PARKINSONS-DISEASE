import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  Waves,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  FEATURE_NAMES,
  getFeatureStats,
  getSampleRow,
  loadDataset,
  predictVoice,
  trainModel,
  type TrainedModel,
} from "@/lib/voice-model";

export const Route = createFileRoute("/_authenticated/voice-analysis")({
  ssr: false,
  component: VoiceAnalysisPage,
  head: () => ({
    meta: [
      { title: "Voice Biomarker Analysis · NeuroStride AI" },
      {
        name: "description",
        content:
          "Real-time Parkinson's screening from 22 acoustic voice biomarkers using a Random Forest model trained on the UCI Parkinson's dataset.",
      },
    ],
  }),
});

function VoiceAnalysisPage() {
  const [model, setModel] = useState<TrainedModel | null>(null);
  const [training, setTraining] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [prediction, setPrediction] = useState<{
    label: 0 | 1;
    probability: number;
  } | null>(null);

  const stats = useMemo(() => getFeatureStats(), []);
  const dataset = useMemo(() => loadDataset(), []);

  useEffect(() => {
    // Train asynchronously so the UI can paint first
    setTraining(true);
    const t = setTimeout(() => {
      const m = trainModel();
      setModel(m);
      setTraining(false);
      // preload with healthy sample
      const sample = getSampleRow("healthy");
      const init: Record<string, string> = {};
      FEATURE_NAMES.forEach((n, i) => (init[n] = String(sample[i])));
      setValues(init);
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const loadSample = (kind: "healthy" | "parkinsons") => {
    const row = getSampleRow(kind);
    const next: Record<string, string> = {};
    FEATURE_NAMES.forEach((n, i) => (next[n] = String(row[i])));
    setValues(next);
    setPrediction(null);
  };

  const runPrediction = () => {
    const features = FEATURE_NAMES.map((n) => Number(values[n]));
    if (features.some((v) => Number.isNaN(v))) return;
    setPrediction(predictVoice(features));
  };

  const reset = () => {
    setValues({});
    setPrediction(null);
  };

  const importanceData = useMemo(
    () =>
      (model?.featureImportance ?? []).slice(0, 10).map((f) => ({
        name: f.name.replace("MDVP:", "").replace("Shimmer:", "S:").replace("Jitter:", "J:"),
        importance: +(f.importance * 100).toFixed(2),
      })),
    [model],
  );

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-16 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan flex items-center gap-2">
              <Waves className="h-3.5 w-3.5" /> Voice biomarker engine
            </div>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold">
              Real-time <span className="gradient-text">Parkinson's</span> voice screening
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Random Forest classifier trained live in your browser on the UCI Parkinson's
              dataset (Little et al., 2007). Enter 22 acoustic biomarkers or load a sample to
              get a real-time prediction.
            </p>
          </div>
          <div className="rounded-2xl glass gradient-border p-4 min-w-[240px]">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Model status
            </div>
            {training || !model ? (
              <div className="mt-1 flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-cyan animate-pulse" />
                Training Random Forest…
              </div>
            ) : (
              <>
                <div className="mt-1 flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Ready · 100 trees
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Metric label="Accuracy" value={`${(model.metrics.accuracy * 100).toFixed(1)}%`} />
                  <Metric label="F1" value={model.metrics.f1.toFixed(3)} />
                  <Metric label="Precision" value={model.metrics.precision.toFixed(3)} />
                  <Metric label="Recall" value={model.metrics.recall.toFixed(3)} />
                </div>
              </>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Feature form */}
          <section className="lg:col-span-2 rounded-3xl glass gradient-border p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-display text-lg font-semibold flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Acoustic biomarkers
                </div>
                <div className="text-xs text-muted-foreground">
                  22 MDVP / Jitter / Shimmer / non-linear features
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => loadSample("healthy")}
                  className="rounded-lg border border-success/40 text-success px-3 py-2 text-xs hover:bg-success/10"
                >
                  Load healthy sample
                </button>
                <button
                  onClick={() => loadSample("parkinsons")}
                  className="rounded-lg border border-danger/40 text-danger px-3 py-2 text-xs hover:bg-danger/10"
                >
                  Load PD sample
                </button>
                <button
                  onClick={reset}
                  className="rounded-lg border border-border text-muted-foreground px-3 py-2 text-xs hover:text-foreground inline-flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {FEATURE_NAMES.map((name, i) => {
                const s = stats[i];
                return (
                  <label key={name} className="block">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-medium text-foreground/90 truncate">
                        {name}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {s.min.toFixed(3)}–{s.max.toFixed(3)}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={values[name] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [name]: e.target.value }))
                      }
                      placeholder={s.mean.toFixed(4)}
                      className="mt-1 w-full rounded-lg bg-background/60 border border-border/70 px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-primary/40"
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={runPrediction}
                disabled={training || !model}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50 glow-primary"
              >
                <Sparkles className="h-4 w-4" />
                Run prediction
              </button>
            </div>
          </section>

          {/* Prediction panel */}
          <aside className="rounded-3xl glass gradient-border p-6 flex flex-col">
            <div className="font-display text-lg font-semibold">Prediction</div>
            <div className="text-xs text-muted-foreground">
              Live inference from the trained Random Forest
            </div>

            {!prediction ? (
              <div className="mt-8 flex-1 grid place-items-center text-center text-sm text-muted-foreground">
                <div>
                  <Activity className="h-8 w-8 text-cyan/70 mx-auto mb-3" />
                  Enter voice biomarkers and press <br />
                  <span className="text-foreground">Run prediction</span>.
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div
                  className={`rounded-2xl border p-5 text-center ${
                    prediction.label === 1
                      ? "border-danger/50 bg-danger/5"
                      : "border-success/50 bg-success/5"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {prediction.label === 1 ? (
                      <AlertTriangle className="h-5 w-5 text-danger" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    )}
                    <span
                      className={`font-display text-xl font-semibold ${
                        prediction.label === 1 ? "text-danger" : "text-success"
                      }`}
                    >
                      {prediction.label === 1
                        ? "Parkinson's indicators detected"
                        : "No Parkinson's indicators"}
                    </span>
                  </div>
                  <div className="mt-4 font-display text-5xl font-bold gradient-text tabular-nums">
                    {(prediction.probability * 100).toFixed(1)}%
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Estimated probability of Parkinson's (positive class)
                  </div>

                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${
                        prediction.label === 1
                          ? "bg-gradient-to-r from-warning to-danger"
                          : "bg-gradient-to-r from-cyan to-success"
                      }`}
                      style={{ width: `${prediction.probability * 100}%` }}
                    />
                  </div>
                </div>

                {model && (
                  <div className="rounded-xl border border-border/60 p-4">
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                      Confusion matrix (hold-out)
                    </div>
                    <div className="grid grid-cols-3 text-xs text-center">
                      <div />
                      <div className="text-muted-foreground">Pred 0</div>
                      <div className="text-muted-foreground">Pred 1</div>
                      <div className="text-muted-foreground text-left">Actual 0</div>
                      <div className="py-1 text-success">{model.metrics.trueNeg}</div>
                      <div className="py-1 text-danger">{model.metrics.falsePos}</div>
                      <div className="text-muted-foreground text-left">Actual 1</div>
                      <div className="py-1 text-danger">{model.metrics.falseNeg}</div>
                      <div className="py-1 text-success">{model.metrics.truePos}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>

        {/* Feature importance + dataset info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 rounded-3xl glass gradient-border p-6">
            <div className="font-display text-lg font-semibold">Top predictive biomarkers</div>
            <div className="text-xs text-muted-foreground">
              Permutation importance on the hold-out set — higher means the feature contributes
              more to the prediction.
            </div>
            <div className="mt-6 h-72">
              {importanceData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={importanceData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      type="number"
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fontSize: 11 }}
                      unit="%"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      stroke="rgba(255,255,255,0.6)"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(5,8,22,0.9)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="importance" radius={[0, 6, 6, 0]}>
                      {importanceData.map((_, i) => (
                        <Cell key={i} fill={`hsl(${190 + i * 10}, 90%, 55%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <aside className="rounded-3xl glass gradient-border p-6">
            <div className="font-display text-lg font-semibold">Dataset</div>
            <div className="text-xs text-muted-foreground">
              UCI Machine Learning Repository · Parkinsons
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Metric label="Total samples" value={String(dataset.rows.length)} />
              <Metric label="Features" value="22" />
              <Metric
                label="PD samples"
                value={String(dataset.rows.filter((r) => r.status === 1).length)}
              />
              <Metric
                label="Healthy"
                value={String(dataset.rows.filter((r) => r.status === 0).length)}
              />
              {model && (
                <>
                  <Metric label="Train / Test" value={`${model.metrics.trainSize}/${model.metrics.testSize}`} />
                  <Metric label="Trees" value="100" />
                </>
              )}
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
              Little MA, McSharry PE, Roberts SJ, Costello DAE, Moroz IM (2007), "Exploiting
              Nonlinear Recurrence and Fractal Scaling Properties for Voice Disorder Detection",
              BioMedical Engineering OnLine 6:23.
            </p>
          </aside>
        </div>

        <p className="text-[11px] text-muted-foreground text-center max-w-3xl mx-auto">
          Research/educational tool. Not a medical device — predictions are not a substitute for
          professional diagnosis by a qualified neurologist.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono tabular-nums text-sm">{value}</div>
    </div>
  );
}
