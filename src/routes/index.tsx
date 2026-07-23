import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Activity, Brain, Cpu, LineChart, Shield, Sparkles, FlaskConical } from "lucide-react";
import heroNebula from "@/assets/hero-nebula.jpg";
import { UploadZone, type DetectedFile } from "@/components/UploadZone";
import { AnalysisModePicker, type AnalysisMode } from "@/components/AnalysisModePicker";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import type { AnalysisResult } from "@/lib/mock-analysis";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

type Stage = "idle" | "mode" | "processing" | "done";

function LandingPage() {
  const [detected, setDetected] = useState<DetectedFile | null>(null);
  const [mode, setMode] = useState<AnalysisMode | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const navigate = useNavigate();

  function onDetected(d: DetectedFile) {
    setDetected(d);
    setStage("mode");
  }

  function onPickMode(m: AnalysisMode) {
    setMode(m);
    setStage("processing");
  }

  function onComplete(result: AnalysisResult) {
    if (!detected) return;
    sessionStorage.setItem(
      "latestResult",
      JSON.stringify({
        result,
        patient_name: "",
        media_kind: detected.kind,
        media_name: detected.file.name,
      }),
    );
    setStage("done");
    toast.success("Analysis complete", { description: "Sign in to save & view the full dashboard." });
    navigate({ to: "/dashboard" });
  }

  function onAnalysisError(message: string) {
    toast.error("Analysis failed", { description: message });
    setStage("idle");
    setDetected(null);
    setMode(null);
  }

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={heroNebula}
            alt=""
            width={1920}
            height={1080}
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-cyan">
              <Sparkles className="h-3.5 w-3.5" />
              AI research station · Parkinson&apos;s screening
            </div>
            <h1 className="mt-6 font-display text-4xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
              AI-powered <span className="gradient-text">Parkinson&apos;s Disease</span> detection
              <span className="block text-foreground/80 text-3xl sm:text-4xl lg:text-5xl mt-3">
                using Computer Vision &amp; Deep Learning
              </span>
            </h1>
            <p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground">
              Upload a walking video or facial recording and receive an AI-generated assessment
              with clinical biomechanical parameters, interactive charts, and a downloadable
              medical-style report.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#analyze"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:brightness-110 glow-primary transition"
              >
                Start analysis <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to="/research"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm hover:border-primary/60 hover:text-foreground transition"
              >
                View research
              </Link>
            </div>

            {/* Stat pills */}
            <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
              {[
                { k: "27+", v: "clinical parameters" },
                { k: "3", v: "analysis modes" },
                { k: "2", v: "AI pipelines" },
                { k: "&lt;10 min", v: "to full report" },
              ].map((s) => (
                <div key={s.v} className="glass rounded-xl px-4 py-3 text-left">
                  <div className="font-display text-2xl font-semibold gradient-text" dangerouslySetInnerHTML={{ __html: s.k }} />
                  <div className="text-xs text-muted-foreground mt-1">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* UPLOAD */}
      <section id="analyze" className="mx-auto max-w-5xl px-4 sm:px-6 -mt-4 pb-24 scroll-mt-24">
        <UploadZone onDetected={onDetected} />
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">Onboard systems</div>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl font-semibold">
            An AI research station in your browser
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every pipeline is modular and swappable — designed for future models across voice,
            spiral drawing, tremor sensors, and multimodal fusion.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Activity, title: "Gait pipeline", body: "Frame extraction → pose estimation → joint angles → stride features → ML prediction." },
            { icon: Brain,    title: "Facial pipeline", body: "Face mesh, blink rate, rigidity, head tremor, and micro-expression analysis." },
            { icon: LineChart,title: "Clinical comparison", body: "Every parameter compared to standard reference values with status flags." },
            { icon: Cpu,      title: "Three analysis modes", body: "Quick, Standard, or Precision — trade time for accuracy on demand." },
            { icon: FlaskConical, title: "Research-grade reports", body: "Downloadable PDF with parameter tables, charts, pose overlays, and disclaimers." },
            { icon: Shield,   title: "Private by default", body: "End-to-end encrypted uploads, RLS-protected storage, and per-user access." },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 hover:glow-primary transition">
              <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center">
                <f.icon className="h-5 w-5 text-cyan" />
              </div>
              <div className="mt-4 font-display text-lg font-semibold">{f.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {stage === "mode" && (
        <AnalysisModePicker
          onSelect={onPickMode}
          onCancel={() => {
            setDetected(null);
            setStage("idle");
          }}
        />
      )}
      {stage === "processing" && detected && mode && (
        <ProcessingScreen
          kind={detected.kind}
          mode={mode}
          file={detected.file}
          onComplete={onComplete}
          onError={onAnalysisError}
        />
      )}
    </>
  );
}
