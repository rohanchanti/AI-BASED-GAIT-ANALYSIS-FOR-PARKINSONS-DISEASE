import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Activity, Brain, Cpu, LineChart, Shield, Sparkles, FlaskConical, UploadCloud, FileText, Mic, FileVideo, Gauge } from "lucide-react";
import heroNebula from "@/assets/hero-nebula.jpg";
import { UploadZone, type DetectedFile } from "@/components/UploadZone";
import { AnalysisModePicker, type AnalysisMode } from "@/components/AnalysisModePicker";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { PatientForm, type PatientInfo } from "@/components/PatientForm";
import { ResearchDisclaimer } from "@/components/research/ResearchDisclaimer";
import { ANALYSIS_VERSIONS, nextAnalysisId } from "@/lib/analysis-version";
import type { AnalysisResult } from "@/lib/mock-analysis";
import { toast } from "sonner";

const TITLE = "NeuroStride AI — AI-Assisted Multimodal Parkinsonian Movement Analysis";
const DESCRIPTION =
  "Quantitative analysis of gait, facial movement, and motor biomarkers from video for research and clinical decision-support applications.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

type Stage = "idle" | "patient" | "mode" | "processing" | "done";


function LandingPage() {
  const [detected, setDetected] = useState<DetectedFile | null>(null);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [mode, setMode] = useState<AnalysisMode | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const navigate = useNavigate();

  function onDetected(d: DetectedFile) {
    setDetected(d);
    setStage("patient");
  }

  function onPatientSubmit(p: PatientInfo) {
    setPatient(p);
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
        patient_name: patient?.name ?? "",
        patient_id: patient?.patientId ?? "",
        patient_age: patient?.age ?? "",
        patient_gender: patient?.gender ?? "",
        media_kind: detected.kind,
        media_name: detected.file.name,
        analysis_id: nextAnalysisId(),
        analysis_timestamp: new Date().toISOString(),
        versions: ANALYSIS_VERSIONS,
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
    setPatient(null);
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
              Research platform · quantitative movement analysis
            </div>
            <h1 className="mt-6 font-display text-4xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
              AI-Assisted <span className="gradient-text">Multimodal Parkinsonian</span> Movement Analysis
            </h1>
            <p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground">
              Quantitative analysis of gait, facial movement, and motor biomarkers from video for
              research and clinical decision-support applications.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#analyze"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:brightness-110 glow-primary transition"
              >
                <UploadCloud className="h-5 w-5" />
                Start New Analysis
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to="/research"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm hover:border-primary/60 hover:text-foreground transition"
              >
                Scientific basis
              </Link>
            </div>

            {/* Workflow step strip */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs sm:text-sm">
              {[
                { n: "1", label: "Upload / Record Data" },
                { n: "2", label: "AI Analysis" },
                { n: "3", label: "View Results" },
                { n: "4", label: "Generate Report" },
              ].map((s, i) => (
                <span key={s.n} className="inline-flex items-center gap-2">
                  {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
                  <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/20 font-display text-[10px] font-bold text-cyan">{s.n}</span>
                    <span className="text-foreground/80">{s.label}</span>
                  </span>
                </span>
              ))}
            </div>

            <div className="mt-8 mx-auto max-w-2xl text-left">
              <ResearchDisclaimer />
            </div>

            {/* Stat pills */}
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
              {[
                { k: "27+", v: "quantitative parameters" },
                { k: "33", v: "tracked pose landmarks" },
                { k: "5", v: "acquisition protocols" },
                { k: "CSV · JSON · PDF", v: "research export" },
              ].map((s) => (
                <div key={s.v} className="glass rounded-xl px-4 py-3 text-left">
                  <div className="font-display text-2xl font-semibold gradient-text">{s.k}</div>
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
          <div className="text-xs uppercase tracking-[0.2em] text-cyan">Platform modules</div>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl font-semibold">
            A quantitative movement-analysis workbench
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every stage is modular and swappable, so models can be replaced without redesigning the
            interface. Measurements that the pipeline cannot compute are reported as not available
            rather than estimated.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Activity, title: "Markerless gait pipeline", body: "Frame sampling → 33-landmark pose estimation → temporal filtering → joint angles → stride biomarkers." },
            { icon: Brain,    title: "Facial movement module", body: "Facial landmark tracking and hypomimia-related features — pipeline in preparation, reported as not available until configured." },
            { icon: LineChart,title: "Reference comparison", body: "Parameters compared against separately stored reference ranges with explicit provenance." },
            { icon: Cpu,      title: "Acquisition protocols", body: "Normal walk, Timed Up and Go, side, front, and multi-angle recordings." },
            { icon: FlaskConical, title: "Reproducible outputs", body: "Every analysis records model, feature-pipeline, and pose-estimator versions alongside CSV/JSON/PDF export." },
            { icon: Shield,   title: "Private by default", body: "Encrypted uploads, row-level-security storage, and per-account access." },

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

      {stage === "patient" && (
        <PatientForm
          onSubmit={onPatientSubmit}
          onCancel={() => {
            setDetected(null);
            setStage("idle");
          }}
        />
      )}
      {stage === "mode" && (
        <AnalysisModePicker
          onSelect={onPickMode}
          onCancel={() => {
            setDetected(null);
            setPatient(null);
            setStage("idle");
          }}
        />
      )}
      {stage === "processing" && detected && mode && (
        <ProcessingScreen
          subjectHeightMeters={
            patient?.heightCm && Number(patient.heightCm) > 80
              ? Number(patient.heightCm) / 100
              : undefined
          }
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
