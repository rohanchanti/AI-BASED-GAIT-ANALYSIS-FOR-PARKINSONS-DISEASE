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
  AudioLines,
  ClipboardList,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
          "Research-oriented voice-characteristic analysis from 22 supplied acoustic biomarkers using a Random Forest model trained on the UCI Parkinson's dataset.",
      },
      { property: "og:title", content: "Voice Biomarker Analysis · NeuroStride AI" },
      {
        property: "og:description",
        content: "Research-oriented analysis of supplied acoustic voice biomarkers and observed voice characteristics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [sampleSource, setSampleSource] = useState<"healthy" | "parkinsons" | null>(null);

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
      setSampleSource("healthy");
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const loadSample = (kind: "healthy" | "parkinsons") => {
    const row = getSampleRow(kind);
    const next: Record<string, string> = {};
    FEATURE_NAMES.forEach((n, i) => (next[n] = String(row[i])));
    setValues(next);
    setSampleSource(kind);
    setPrediction(null);
  };

  const runPrediction = () => {
    const features = FEATURE_NAMES.map((n) => Number(values[n]));
    if (features.some((v) => Number.isNaN(v))) return;
    setPrediction(predictVoice(features));
  };

  const reset = () => {
    setValues({});
    setSampleSource(null);
    setPrediction(null);
  };

  const setFeatureValue = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setSampleSource(null);
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

  const measurementGroups = useMemo(() => {
    const read = (name: (typeof FEATURE_NAMES)[number]) => Number(values[name]);
    const format = (value: number, digits = 3) =>
      Number.isFinite(value) ? value.toFixed(digits) : "Not available";

    return [
      {
        label: "Fundamental frequency",
        value: `${format(read("MDVP:Fo(Hz)"), 2)} Hz`,
        detail: `Observed range ${format(read("MDVP:Flo(Hz)"), 2)}–${format(read("MDVP:Fhi(Hz)"), 2)} Hz`,
      },
      {
        label: "Pitch variation",
        value: `${format(read("MDVP:Jitter(%)"), 4)}%`,
        detail: `Absolute jitter ${format(read("MDVP:Jitter(Abs)"), 6)}`,
      },
      {
        label: "Amplitude variation",
        value: format(read("MDVP:Shimmer"), 4),
        detail: `Shimmer ${format(read("MDVP:Shimmer(dB)"), 3)} dB`,
      },
      {
        label: "Temporal / nonlinear variation",
        value: `RPDE ${format(read("RPDE"), 3)}`,
        detail: `DFA ${format(read("DFA"), 3)} · PPE ${format(read("PPE"), 3)}`,
      },
    ];
  }, [values]);

  const voiceProfile = useMemo(() => {
    const keys = ["MDVP:Fo(Hz)", "MDVP:Jitter(%)", "MDVP:Shimmer", "HNR", "RPDE", "DFA", "PPE"] as const;
    return keys.map((key) => {
      const stat = stats.find((item) => item.name === key);
      const value = Number(values[key]);
      const span = stat ? stat.max - stat.min : 0;
      const normalized = stat && Number.isFinite(value) && span > 0
        ? Math.max(0, Math.min(100, ((value - stat.min) / span) * 100))
        : 0;
      return {
        name: key.replace("MDVP:", "").replace("(Hz)", ""),
        value: Number(normalized.toFixed(1)),
      };
    });
  }, [stats, values]);

  const observedCharacteristics = useMemo(() => {
    const comparisons = [
      { key: "MDVP:Fo(Hz)", label: "fundamental frequency" },
      { key: "MDVP:Jitter(%)", label: "pitch variation" },
      { key: "MDVP:Shimmer", label: "amplitude variation" },
      { key: "HNR", label: "harmonic-to-noise ratio" },
    ] as const;
    return comparisons.map(({ key, label }) => {
      const stat = stats.find((item) => item.name === key);
      const value = Number(values[key]);
      if (!stat || !Number.isFinite(value)) return `${label}: not available`;
      const difference = value - stat.mean;
      const tolerance = Math.max((stat.max - stat.min) * 0.1, Math.abs(stat.mean) * 0.05);
      const position = Math.abs(difference) <= tolerance ? "near" : difference > 0 ? "above" : "below";
      return `${label}: ${position} the dataset mean`;
    });
  }, [stats, values]);

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-16 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan flex items-center gap-2">
              <Waves className="h-3.5 w-3.5" /> Voice biomarker engine
            </div>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold">
              Voice <span className="gradient-text">characteristic analysis</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Enter 22 precomputed acoustic biomarkers or load a clearly labeled example, then
              use the research model to examine voice-pattern characteristics. Audio upload and
              recording are not available in the current analysis system.
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

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="Voice analysis workflow">
          {[
            { step: "1", title: "Provide measurements", body: "Enter acoustic biomarkers or load an example dataset row." },
            { step: "2", title: "Analyze Voice", body: "Apply the existing research classifier to the supplied values." },
            { step: "3", title: "Review findings", body: "Inspect measurements, observed characteristics, and interpretation." },
          ].map((item) => (
            <div key={item.step} className="glass rounded-2xl border border-border/60 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-cyan">
                  {item.step}
                </span>
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Feature form */}
          <section className="lg:col-span-2 rounded-3xl glass gradient-border p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-display text-lg font-semibold flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Voice measurements
                </div>
                <div className="text-xs text-muted-foreground">
                  22 supplied MDVP, jitter, shimmer, and nonlinear acoustic features
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => loadSample("healthy")}
                  className="rounded-lg border border-success/40 text-success px-3 py-2 text-xs hover:bg-success/10"
                >
                  Load healthy example
                </button>
                <button
                  onClick={() => loadSample("parkinsons")}
                  className="rounded-lg border border-danger/40 text-danger px-3 py-2 text-xs hover:bg-danger/10"
                >
                  Load Parkinson's example
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
                      onChange={(e) => setFeatureValue(name, e.target.value)}
                      placeholder={s.mean.toFixed(4)}
                      className="mt-1 w-full rounded-lg bg-background/60 border border-border/70 px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-primary/70 focus:ring-1 focus:ring-primary/40"
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {sampleSource ? (
                  <span className="rounded-full border border-warning/40 bg-warning/5 px-2.5 py-1 text-warning">
                    DEMO / EXAMPLE DATA · {sampleSource === "healthy" ? "healthy" : "Parkinson's"} dataset sample
                  </span>
                ) : (
                  <span className="rounded-full border border-border px-2.5 py-1">Supplied measurements</span>
                )}
              </div>
              <button
                onClick={runPrediction}
                disabled={training || !model}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50 glow-primary"
              >
                <Sparkles className="h-4 w-4" />
                Analyze Voice
              </button>
            </div>
          </section>

          {/* Prediction panel */}
          <aside className="rounded-3xl glass gradient-border p-6 flex flex-col">
            <div className="font-display text-lg font-semibold">AI Interpretation</div>
            <div className="text-xs text-muted-foreground">
              Research classification from the existing Random Forest model
            </div>

            {!prediction ? (
              <div className="mt-8 flex-1 grid place-items-center text-center text-sm text-muted-foreground">
                <div>
                  <Activity className="h-8 w-8 text-cyan/70 mx-auto mb-3" />
                  Provide voice measurements and select <br />
                  <span className="text-foreground">Analyze Voice</span>.
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
                        ? "Pattern closer to the positive research class"
                        : "Pattern closer to the comparison research class"}
                    </span>
                  </div>
                  <div className="mt-4 font-display text-5xl font-bold gradient-text tabular-nums">
                    {(prediction.probability * 100).toFixed(1)}%
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Uncalibrated model score for the positive research class
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

                <div className="rounded-xl border border-border/60 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Research interpretation
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/85">
                    The supplied acoustic feature pattern is more similar to the model's {prediction.label === 1 ? "positive" : "comparison"} training class. This reflects statistical similarity within the UCI dataset, not a clinical finding or diagnosis.
                  </p>
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

        <section className="rounded-3xl glass gradient-border p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-lg font-semibold flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Available voice measurements
              </div>
              <p className="text-xs text-muted-foreground">Values currently supplied to the analysis model.</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${sampleSource ? "border-warning/40 bg-warning/5 text-warning" : "border-border text-muted-foreground"}`}>
              {sampleSource ? "Demo / example data" : "Supplied measurements"}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {measurementGroups.map((measurement) => (
              <div key={measurement.label} className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{measurement.label}</div>
                <div className="mt-2 font-mono text-lg tabular-nums">{measurement.value}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{measurement.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-3xl glass gradient-border p-6">
            <div className="font-display text-lg font-semibold flex items-center gap-2">
              <AudioLines className="h-5 w-5 text-cyan" /> Voice feature profile
            </div>
            <p className="text-xs text-muted-foreground">
              Relative position within the UCI dataset range. This is not an audio waveform.
            </p>
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={voiceProfile} margin={{ left: 4, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, "Dataset-range position"]}
                    contentStyle={{ background: "rgba(5,8,22,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--cyan))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-3xl glass gradient-border p-6">
            <div className="font-display text-lg font-semibold">Observed Voice Characteristics</div>
            <p className="text-xs text-muted-foreground">Descriptive comparison with this research dataset only.</p>
            <div className="mt-5 space-y-3">
              {observedCharacteristics.map((characteristic) => (
                <div key={characteristic} className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm">
                  <Waves className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
                  <span className="capitalize">{characteristic}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Speech duration and absolute voice intensity are not shown because the current system does not calculate them.
            </p>
          </section>
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
          Research and decision-support tool. This analysis describes acoustic characteristics and
          model similarity only; it does not diagnose Parkinson's disease or any other condition.
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
