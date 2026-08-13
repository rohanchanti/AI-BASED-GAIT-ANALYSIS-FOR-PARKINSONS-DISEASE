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
  probability: number;
  /** 0..100 risk score (probability × 100, kept for the existing UI contract) */
  score: number;
  level: "Very Low" | "Low" | "Moderate" | "High" | "Very High";
  /** 0..1 confidence in the prediction, driven by data quality */
  confidence: number;
  model: ModelInfo;
  /** top contributing features, most influential first */
  contributors: { key: string; contribution: number }[];
}

export interface GaitRiskModel extends ModelInfo {
  predict: (f: GaitFeatureVector) => RiskPrediction;
}

function level(score: number): RiskPrediction["level"] {
  return score < 20 ? "Very Low" : score < 40 ? "Low" : score < 60 ? "Moderate" : score < 80 ? "High" : "Very High";
}

const HEURISTIC_INFO: ModelInfo = {
  id: "gait-abnormality-heuristic",
  version: "2.0.0",
  method: "heuristic",
  validated: false,
  note:
    "Research/experimental heuristic. The score is a weighted aggregation of deviations from published healthy-adult gait reference ranges. It has not been trained or validated against clinically labelled Parkinson's data and is not a diagnosis.",
};

/**
 * Weighted abnormality aggregation. Features known from the literature to be
 * most affected in Parkinsonian gait receive a higher weight; everything else
 * defaults to 1. Weights are declared, not learned — hence `validated: false`.
 */
const FEATURE_WEIGHTS: Record<string, number> = {
  walking_speed: 1.6,
  step_length: 1.6,
  stride_length: 1.4,
  cadence: 1.3,
  arm_swing_sym: 1.4,
  walking_sym: 1.3,
  double_support: 1.3,
  swing_phase: 1.2,
  stability: 1.2,
  turning_time: 1.1,
};

export const heuristicRiskModel: GaitRiskModel = {
  ...HEURISTIC_INFO,
  predict(f) {
    const entries = Object.entries(f.abnormality);
    let weighted = 0;
    let weightSum = 0;
    for (const [key, a] of entries) {
      const w = FEATURE_WEIGHTS[key] ?? 1;
      weighted += Math.max(0, Math.min(1, a)) * w;
      weightSum += w;
    }
    const raw = weightSum ? weighted / weightSum : 0;
    // Mild logistic shaping keeps mid-range deviations from saturating at 100.
    const probability = Math.max(0.01, Math.min(0.98, 1 / (1 + Math.exp(-(raw - 0.35) * 5.5))));
    const score = Math.round(probability * 100);

    // Confidence is data-driven: quality of the pose signal and how many
    // cycles the features were averaged over.
    const cycleFactor = Math.min(1, f.cycles / 6);
    const confidence = Math.max(
      0.2,
      Math.min(0.95, 0.25 + f.quality * 0.55 + cycleFactor * 0.2),
    );

    const contributors = entries
      .map(([key, a]) => ({ key, contribution: +(a * (FEATURE_WEIGHTS[key] ?? 1)).toFixed(3) }))
      .sort((x, y) => y.contribution - x.contribution)
      .slice(0, 5);

    return {
      probability: +probability.toFixed(4),
      score,
      level: level(score),
      confidence: +confidence.toFixed(3),
      model: HEURISTIC_INFO,
      contributors,
    };
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
  | "Severe Parkinsonian Gait";

export interface SeverityPrediction {
  label: SeverityLabel;
  confidence: number;
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
  const label: SeverityLabel =
    score < 20
      ? "Normal"
      : score < 45
      ? "Mild Parkinsonian Gait"
      : score < 70
      ? "Moderate Parkinsonian Gait"
      : "Severe Parkinsonian Gait";
  return { label, confidence, model: SEVERITY_INFO };
}
