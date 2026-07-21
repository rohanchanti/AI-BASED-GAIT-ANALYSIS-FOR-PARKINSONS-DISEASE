import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About · NeuroStride AI" },
      { name: "description", content: "A final-year engineering project combining biomedical engineering, deep learning and computer vision for early Parkinson's screening." },
      { property: "og:title", content: "About · NeuroStride AI" },
      { property: "og:description", content: "A research prototype combining biomedical engineering and AI for Parkinson's screening." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan">About the project</div>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold">
        AI meets biomedical engineering
      </h1>
      <p className="mt-4 text-muted-foreground">
        NeuroStride AI is a next-generation research platform designed for early, non-invasive
        screening of Parkinson&apos;s Disease. It fuses computer vision, deep learning, and
        biomechanical modeling into a single, elegant workflow — accessible from any browser.
      </p>
      <div className="mt-8 space-y-6">
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">Motivation</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Parkinson&apos;s Disease is often diagnosed late, once symptoms are severe. Video-based
            gait and facial analysis offer a low-cost, at-home, and objective way to flag
            subtle motor changes years before clinical presentation.
          </p>
        </div>
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">Architecture</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The platform is built as a modular pipeline: frontend (React + TanStack Start),
            AI processing (pose estimation, face mesh, feature extraction, ML prediction),
            report generation (PDF with clinical comparison), and a secure backend
            (authenticated storage, RLS-protected user data).
          </p>
        </div>
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">Future work</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Voice analysis, spiral drawing, finger-tapping, smartwatch IMU fusion, brain MRI
            integration, and an LLM-powered clinical explanation assistant.
          </p>
        </div>
      </div>
    </section>
  );
}
