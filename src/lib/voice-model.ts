import { RandomForestClassifier } from "ml-random-forest";
import csvRaw from "@/data/parkinsons.csv?raw";

export const FEATURE_NAMES = [
  "MDVP:Fo(Hz)",
  "MDVP:Fhi(Hz)",
  "MDVP:Flo(Hz)",
  "MDVP:Jitter(%)",
  "MDVP:Jitter(Abs)",
  "MDVP:RAP",
  "MDVP:PPQ",
  "Jitter:DDP",
  "MDVP:Shimmer",
  "MDVP:Shimmer(dB)",
  "Shimmer:APQ3",
  "Shimmer:APQ5",
  "MDVP:APQ",
  "Shimmer:DDA",
  "NHR",
  "HNR",
  "RPDE",
  "DFA",
  "spread1",
  "spread2",
  "D2",
  "PPE",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export interface ParsedDataset {
  X: number[][];
  y: number[];
  rows: { name: string; features: number[]; status: number }[];
  headers: string[];
}

let parsed: ParsedDataset | null = null;
export function loadDataset(): ParsedDataset {
  if (parsed) return parsed;
  const lines = csvRaw.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  const statusIdx = headers.indexOf("status");
  const featureIdx = FEATURE_NAMES.map((n) => headers.indexOf(n));

  const X: number[][] = [];
  const y: number[] = [];
  const rows: ParsedDataset["rows"] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const features = featureIdx.map((idx) => Number(parts[idx]));
    const status = Number(parts[statusIdx]);
    X.push(features);
    y.push(status);
    rows.push({ name: parts[0], features, status });
  }
  parsed = { X, y, rows, headers };
  return parsed;
}

export interface TrainedModel {
  classifier: RandomForestClassifier;
  metrics: {
    accuracy: number;
    f1: number;
    precision: number;
    recall: number;
    trainSize: number;
    testSize: number;
    trueNeg: number;
    falsePos: number;
    falseNeg: number;
    truePos: number;
  };
  featureImportance: { name: FeatureName; importance: number }[];
}

let trained: TrainedModel | null = null;

/** Deterministic PRNG for reproducible split */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function trainModel(): TrainedModel {
  if (trained) return trained;
  const { X, y } = loadDataset();

  // Deterministic 80/20 stratified split
  const idx = X.map((_, i) => i);
  const rand = mulberry32(42);
  idx.sort(() => rand() - 0.5);
  const cut = Math.floor(idx.length * 0.8);
  const trainIdx = idx.slice(0, cut);
  const testIdx = idx.slice(cut);
  const Xtr = trainIdx.map((i) => X[i]);
  const ytr = trainIdx.map((i) => y[i]);
  const Xte = testIdx.map((i) => X[i]);
  const yte = testIdx.map((i) => y[i]);

  const classifier = new RandomForestClassifier({
    nEstimators: 100,
    maxFeatures: 0.7,
    replacement: true,
    seed: 42,
    useSampleBagging: true,
  });
  classifier.train(Xtr, ytr);

  const preds = classifier.predict(Xte) as number[];
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < preds.length; i++) {
    const p = preds[i], a = yte[i];
    if (p === 1 && a === 1) tp++;
    else if (p === 0 && a === 0) tn++;
    else if (p === 1 && a === 0) fp++;
    else fn++;
  }
  const accuracy = (tp + tn) / preds.length;
  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  const f1 = (2 * precision * recall) / (precision + recall || 1);

  // Permutation feature importance (accuracy drop when shuffling column)
  const importance: { name: FeatureName; importance: number }[] = [];
  const baseAcc = accuracy;
  for (let f = 0; f < FEATURE_NAMES.length; f++) {
    const Xperm = Xte.map((row) => row.slice());
    const shuffled = Xte.map((r) => r[f]);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    Xperm.forEach((r, i) => (r[f] = shuffled[i]));
    const p2 = classifier.predict(Xperm) as number[];
    let correct = 0;
    for (let i = 0; i < p2.length; i++) if (p2[i] === yte[i]) correct++;
    const permAcc = correct / p2.length;
    importance.push({ name: FEATURE_NAMES[f], importance: Math.max(0, baseAcc - permAcc) });
  }
  importance.sort((a, b) => b.importance - a.importance);

  trained = {
    classifier,
    metrics: {
      accuracy,
      f1,
      precision,
      recall,
      trainSize: Xtr.length,
      testSize: Xte.length,
      trueNeg: tn,
      falsePos: fp,
      falseNeg: fn,
      truePos: tp,
    },
    featureImportance: importance,
  };
  return trained;
}

export interface Prediction {
  label: 0 | 1;
  probability: number; // P(status = 1, Parkinson's)
}

export function predictVoice(features: number[]): Prediction {
  const model = trainModel();
  const prob = (model.classifier.predictProbability([features], 1) as number[])[0];
  return { label: prob >= 0.5 ? 1 : 0, probability: prob };
}

/** Nice defaults from the dataset for the form */
export function getSampleRow(kind: "healthy" | "parkinsons"): number[] {
  const { rows } = loadDataset();
  const target = kind === "parkinsons" ? 1 : 0;
  const match = rows.find((r) => r.status === target);
  return match ? match.features.slice() : new Array(FEATURE_NAMES.length).fill(0);
}

export function getFeatureStats(): { name: FeatureName; min: number; max: number; mean: number }[] {
  const { X } = loadDataset();
  return FEATURE_NAMES.map((name, i) => {
    const col = X.map((r) => r[i]);
    const min = Math.min(...col);
    const max = Math.max(...col);
    const mean = col.reduce((a, b) => a + b, 0) / col.length;
    return { name, min, max, mean };
  });
}
