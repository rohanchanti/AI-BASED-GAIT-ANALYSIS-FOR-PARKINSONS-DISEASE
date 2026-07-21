import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, FlaskConical, Cpu, Waves } from "lucide-react";

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

      <div className="mt-10 glass rounded-2xl p-6 text-sm text-muted-foreground">
        <strong className="text-foreground">Medical disclaimer.</strong> NeuroStride AI is a
        research prototype and does not provide medical advice, diagnosis, or treatment.
        Always seek the advice of a qualified clinician for questions regarding a medical
        condition.
      </div>
    </section>
  );
}
