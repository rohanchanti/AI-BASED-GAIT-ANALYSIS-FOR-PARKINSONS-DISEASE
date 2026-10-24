/**
 * Parkinson's screening risk architecture.
 *
 * The pipeline is explicitly separated into four stages so no stage can be
 * mistaken for another:
 *
 *   1. extracted gait features          (GaitFeatureVector — measurements)
 *   2. derived abnormality scores       (deviation of each feature from its
 *                                        healthy reference range)
 *   3. model prediction                 (GaitRiskModel.predict)
 *   4. displayed risk / probability     (RiskPrediction, always carrying the
 *                                        model id, version and `validated` flag)
 *
 * The default model is a TRANSPARENT HEURISTIC, not a trained classifier:
 * `validated: false`, `method: "heuristic"`. It must be presented as a
 * research/screening indicator, never as a diagnosis. `registerRiskModel`
 * exists so a genuinely trained + validated model can be dropped in later
 * without touching call sites. No training data, accuracy figures or clinical
 * performance numbers are fabricated anywhere in this module.
 */
import type { ModelInfo } from "@/types/gait";

export interface GaitFeatureVector {
  /** feature key → measured value (null when not measurable) */
  values: Record<string, number | null>;
  /** feature key → abnormality contribution 0..1 (0 = within reference) */
  abnormality: Record<string, number>;
  /** 0..1 overall analysis quality, used to scale prediction confidence */
  quality: number;
  /** number of complete gait cycles the features were aggregated over */
  cycles: number;
}

export interface RiskPrediction {
  /** 0..1 screening probability */
  probability: number | null;
  /** 0..100 risk score (probability × 100, kept for the existing UI contract) */
  score: number | null;
  level: "Very Low" | "Low" | "Moderate" | "High" | "Very High" | "Not available";
  /** 0..1 confidence in the prediction, driven by data quality */
  confidence: number | null;
  model: ModelInfo;
  /** top contributing features, most influential first */
  contributors: { key: string; contribution: number }[];
}

export interface GaitRiskModel extends ModelInfo {
  predict: (f: GaitFeatureVector) => RiskPrediction;
}

const HEURISTIC_INFO: ModelInfo = {
  id: "gait-abnormality-heuristic", version: "2.0.0", method: "heuristic", validated: false,
  note: "Not available — no validated gait risk model is configured.",
};
export const heuristicRiskModel: GaitRiskModel = {
  ...HEURISTIC_INFO,
  predict() {
    return { probability: null, score: null, level: "Not available", confidence: null, model: HEURISTIC_INFO, contributors: [] };
  },
};

/* ------------------------- model registry ------------------------- */

let activeModel: GaitRiskModel = heuristicRiskModel;

/** Swap in a trained + validated model when one exists. */
export function registerRiskModel(model: GaitRiskModel) {
  activeModel = model;
}

export function getRiskModel(): GaitRiskModel {
  return activeModel;
}

/* ------------------------- severity staging ------------------------- */

export type SeverityLabel =
  | "Normal"
  | "Mild Parkinsonian Gait"
  | "Moderate Parkinsonian Gait"
  | "Severe Parkinsonian Gait"
  | "Not available";

export interface SeverityPrediction {
  label: SeverityLabel;
  confidence: number | null;
  model: ModelInfo;
}

const SEVERITY_INFO: ModelInfo = {
  id: "gait-severity-staging-heuristic",
  version: "2.0.0",
  method: "heuristic",
  validated: false,
  note:
    "Experimental research estimate derived from the abnormality score. No validated severity labels (e.g. UPDRS / Hoehn-Yahr) were used for training or evaluation.",
};

export function classifySeverity(score: number, confidence: number): SeverityPrediction {
  return { label: "Not available", confidence: null, model: SEVERITY_INFO };
}
