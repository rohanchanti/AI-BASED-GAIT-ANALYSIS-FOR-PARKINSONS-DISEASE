import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, FlaskConical, Cpu, Waves } from "lucide-react";
import { loadDataset, trainModel } from "@/lib/voice-model";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "Research · NeuroStride AI" },
      { name: "description", content: "The clinical rationale, models, and pipelines behind NeuroStride AI's Parkinson's screening from gait and facial video." },
      { property: "og:title", content: "Research · NeuroStride AI" },
      { property: "og:description", content: "The clinical rationale, models, and pipelines behind NeuroStride AI." },
    ],
  }),
  component: ResearchPage,
});

interface VoiceEvaluation {
  samples: number;
  positives: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  specificity: number | null;
  trainSize: number;
  testSize: number;
}

function EvalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold text-foreground/90">{value}</div>
    </div>
  );
}

function ValidationDatasetSection() {
  const [voiceEval, setVoiceEval] = useState<VoiceEvaluation | null>(null);

  useEffect(() => {
    try {
      const ds = loadDataset();
      const positives = ds.y.filter((v) => v === 1).length;
      const m = trainModel().metrics;
      const specDen = m.trueNeg + m.falsePos;
      setVoiceEval({
        samples: ds.X.length,
        positives,
        accuracy: m.accuracy,
        precision: m.precision,
        recall: m.recall,
        f1: m.f1,
        specificity: specDen > 0 ? m.trueNeg / specDen : null,
        trainSize: m.trainSize,
        testSize: m.testSize,
      });
    } catch {
      setVoiceEval(null);
    }
  }, []);

  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <section className="mt-10">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan">Validation & Dataset</div>
      <h2 className="mt-2 font-display text-2xl font-semibold">Dataset and model evaluation</h2>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dataset & source */}
        <div className="glass rounded-2xl p-6">
          <h3 className="font-display text-lg font-semibold">Dataset & source</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The voice module is trained on the publicly available UCI Parkinson's
            dataset of recorded sustained-vowel acoustic measurements.
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Samples</dt>
              <dd className="font-medium">{voiceEval ? voiceEval.samples : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Positive class (Parkinson's)</dt>
              <dd className="font-medium">{voiceEval ? `${voiceEval.positives} of ${voiceEval.samples}` : "—"}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Modalities used</div>
            <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
              <li><span className="text-foreground/90">Gait video</span> — pose-based measurements; no ground-truth validation yet.</li>
              <li><span className="text-foreground/90">Facial video</span> — module in preparation; not yet analysed.</li>
              <li><span className="text-foreground/90">Voice</span> — acoustic biomarkers from the UCI dataset.</li>
            </ul>
          </div>
        </div>

        {/* Model evaluation */}
        <div className="glass rounded-2xl p-6">
          <h3 className="font-display text-lg font-semibold">Model evaluation</h3>
          {voiceEval ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Random-forest voice classifier, evaluated on a held-out test split of{" "}
                {voiceEval.testSize} samples ({voiceEval.trainSize} training samples).
              </p>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <EvalMetric label="Accuracy" value={pct(voiceEval.accuracy)} />
                <EvalMetric label="Precision" value={pct(voiceEval.precision)} />
                <EvalMetric label="Recall (Sensitivity)" value={pct(voiceEval.recall)} />
                <EvalMetric label="F1-score" value={pct(voiceEval.f1)} />
                <EvalMetric
                  label="Specificity"
                  value={voiceEval.specificity != null ? pct(voiceEval.specificity) : "Not available"}
                />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Validation metrics will be added after experimental evaluation.
            </p>
          )}
          <div className="mt-4 border-t border-white/10 pt-3 text-sm text-muted-foreground">
            <span className="text-foreground/90">Gait and facial:</span> Validation metrics will be
            added after experimental evaluation.
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            These are in-browser evaluation results on the research dataset — not clinical
            performance.
          </p>
        </div>
      </div>

      {/* Limitations */}
      <div className="mt-4 glass rounded-2xl p-6">
        <h3 className="font-display text-lg font-semibold">Limitations</h3>
        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground/90">Dataset size.</strong> The voice dataset is
            small and imbalanced; gait analysis has no ground-truth validation set yet.
          </li>
          <li>
            <strong className="text-foreground/90">Generalization.</strong> Unvalidated models may
            not generalize to other populations, equipment, or recording setups.
          </li>
          <li>
            <strong className="text-foreground/90">Recording conditions.</strong> Gait measurements
            depend on camera angle, lighting, distance, and video resolution.
          </li>
          <li>
            <strong className="text-foreground/90">Research-stage status.</strong> This is a
            research/decision-support tool; outputs are not a medical diagnosis.
          </li>
        </ul>
      </div>
    </section>
  );
}

function ResearchPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan">Whitepaper</div>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold">Research foundations</h1>
      <p className="mt-4 text-muted-foreground max-w-2xl">
        NeuroStride AI combines validated biomechanical markers of Parkinsonian gait with
        modern computer-vision-based facial analysis. Every parameter is grounded in
        peer-reviewed clinical literature.
      </p>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: BookOpen, title: "Clinical markers", body: "Cadence, stride length, double-support time and gait symmetry are established indicators of Parkinsonian gait." },
          { icon: FlaskConical, title: "Facial biomarkers", body: "Reduced blink rate (hypomimia), facial rigidity, and micro-expression flattening correlate with PD severity." },
          { icon: Cpu, title: "Model stack", body: "MediaPipe / OpenPose for skeleton extraction, ArcFace + FaceMesh for facial landmarks, gradient-boosted classifier for prediction." },
          { icon: Waves, title: "Multimodal roadmap", body: "Planned extensions: voice tremor, spiral drawing, IMU/smartwatch fusion, and LLM-generated clinician summaries." },
        ].map((c) => (
          <div key={c.title} className="glass rounded-2xl p-6">
            <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
              <c.icon className="h-5 w-5 text-cyan" />
            </div>
            <div className="mt-3 font-display text-lg font-semibold">{c.title}</div>
            <p className="text-sm text-muted-foreground mt-1">{c.body}</p>
          </div>
        ))}
      </div>

      <ValidationDatasetSection />

      <div className="mt-10 glass rounded-2xl p-6 text-sm text-muted-foreground">
        <strong className="text-foreground">Medical disclaimer.</strong> NeuroStride AI is a
        research prototype and does not provide medical advice, diagnosis, or treatment.
        Always seek the advice of a qualified clinician for questions regarding a medical
        condition.
      </div>
    </section>
  );
}
