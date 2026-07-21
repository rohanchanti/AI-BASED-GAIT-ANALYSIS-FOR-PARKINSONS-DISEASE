import type { MediaKind } from "@/components/UploadZone";
import type { AnalysisMode } from "@/components/AnalysisModePicker";

export type ClinicalStatus = "normal" | "borderline" | "abnormal";

export interface ParameterRow {
  name: string;
  unit: string;
  standard: number;
  patient: number;
  status: ClinicalStatus;
}

export interface AnalysisResult {
  kind: MediaKind;
  mode: AnalysisMode;
  probability: number; // 0..1
  confidence: number;  // 0..1
  riskLevel: "Normal" | "Low" | "Moderate" | "High" | "Very High";
  parameters: ParameterRow[];
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 0xffffffff;
  };
}

function classify(std: number, pt: number): ClinicalStatus {
  const diff = Math.abs(pt - std) / std;
  if (diff < 0.1) return "normal";
  if (diff < 0.25) return "borderline";
  return "abnormal";
}

const GAIT_TEMPLATE: Omit<ParameterRow, "patient" | "status">[] = [
  { name: "Cadence", unit: "steps/min", standard: 110 },
  { name: "Walking speed", unit: "m/s", standard: 1.4 },
  { name: "Stride length", unit: "m", standard: 1.35 },
  { name: "Step width", unit: "cm", standard: 10 },
  { name: "Stride time", unit: "s", standard: 1.05 },
  { name: "Double support", unit: "% cycle", standard: 20 },
  { name: "Arm swing", unit: "°", standard: 40 },
  { name: "Hip angle", unit: "°", standard: 30 },
  { name: "Knee angle", unit: "°", standard: 60 },
  { name: "Ankle angle", unit: "°", standard: 25 },
  { name: "Foot clearance", unit: "cm", standard: 3.5 },
  { name: "Gait symmetry", unit: "%", standard: 96 },
];

const FACE_TEMPLATE: Omit<ParameterRow, "patient" | "status">[] = [
  { name: "Blink rate", unit: "blinks/min", standard: 17 },
  { name: "Facial symmetry", unit: "%", standard: 95 },
  { name: "Head tremor", unit: "Hz", standard: 0 },
  { name: "Smile asymmetry", unit: "%", standard: 4 },
  { name: "Jaw movement", unit: "mm", standard: 8 },
  { name: "Eye closure ratio", unit: "%", standard: 22 },
  { name: "Emotion stability", unit: "%", standard: 88 },
  { name: "Micro-expressions", unit: "/min", standard: 6 },
];

export function generateMockAnalysis(
  kind: MediaKind,
  mode: AnalysisMode,
  fileNameSeed = "seed",
): AnalysisResult {
  let seed = 0;
  for (let i = 0; i < fileNameSeed.length; i++) seed = (seed * 31 + fileNameSeed.charCodeAt(i)) >>> 0;
  const rand = seeded(seed || 1);

  const template = kind === "gait" ? GAIT_TEMPLATE : FACE_TEMPLATE;
  const deviation = mode === "precision" ? 0.35 : mode === "standard" ? 0.3 : 0.25;

  const parameters: ParameterRow[] = template.map((p) => {
    const drift = (rand() - 0.35) * deviation;
    const patient = Math.max(0, +(p.standard * (1 + drift)).toFixed(2));
    return { ...p, patient, status: classify(p.standard || 1, patient || 0.0001) };
  });

  const abnormal = parameters.filter((p) => p.status === "abnormal").length;
  const borderline = parameters.filter((p) => p.status === "borderline").length;
  const probability = Math.min(
    0.97,
    Math.max(0.05, (abnormal * 0.11 + borderline * 0.05 + rand() * 0.08)),
  );
  const confidence = 0.78 + rand() * 0.2;

  const riskLevel: AnalysisResult["riskLevel"] =
    probability < 0.15
      ? "Normal"
      : probability < 0.35
      ? "Low"
      : probability < 0.6
      ? "Moderate"
      : probability < 0.8
      ? "High"
      : "Very High";

  return { kind, mode, probability, confidence, riskLevel, parameters };
}
