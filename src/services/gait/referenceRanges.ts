/**
 * Structured reference-value store.
 *
 * Healthy-adult reference ranges used by the clinical comparison table are
 * declared here in one place instead of being scattered through calculation
 * code, together with the literature domain they come from.
 *
 * IMPORTANT — no fabrication policy:
 * Demographic (age / sex / height) stratified normative ranges are NOT invented
 * here. `DEMOGRAPHIC_MODIFIERS` is intentionally empty; the resolver returns
 * the general adult range and reports `stratified: false` until real published
 * stratified normative data are supplied. Adding an entry to that table is the
 * only supported way to enable stratification.
 */

export type WorseDirection = "below" | "above" | "outside";

export interface ReferenceEntry {
  key: string;
  name: string;
  unit: string;
  range: [number, number];
  worse: WorseDirection;
  /** true when the value requires spatial calibration to be physically valid */
  requiresCalibration: boolean;
  source: string;
  interpretation: string;
}

const LIT = "Clinical gait-analysis literature / rehabilitation guidelines (healthy adult)";

export const GAIT_REFERENCES: ReferenceEntry[] = [
  { key: "walking_speed",  name: "Walking Speed",          unit: "m/s",       range: [1.2, 1.4],  worse: "below",   requiresCalibration: true,  source: LIT, interpretation: "Lower values may indicate bradykinesia or reduced mobility." },
  { key: "cadence",        name: "Cadence",                unit: "steps/min", range: [100, 120],  worse: "below",   requiresCalibration: false, source: LIT, interpretation: "Reduced cadence may indicate Parkinsonian gait." },
  { key: "step_length",    name: "Step Length",            unit: "m",         range: [0.65, 0.8], worse: "below",   requiresCalibration: true,  source: LIT, interpretation: "Shortened step length is characteristic of Parkinson's." },
  { key: "stride_length",  name: "Stride Length",          unit: "m",         range: [1.3, 1.6],  worse: "below",   requiresCalibration: true,  source: LIT, interpretation: "Reduced stride length suggests gait impairment." },
  { key: "step_width",     name: "Step Width",             unit: "cm",        range: [7, 10],     worse: "outside", requiresCalibration: true,  source: LIT, interpretation: "Values outside normal range may indicate balance impairment." },
  { key: "step_time",      name: "Step Time",              unit: "s",         range: [0.5, 0.6],  worse: "above",   requiresCalibration: false, source: LIT, interpretation: "Increased step time indicates slower gait." },
  { key: "stride_time",    name: "Stride Time",            unit: "s",         range: [1.0, 1.2],  worse: "above",   requiresCalibration: false, source: LIT, interpretation: "Longer stride time reflects slower walking." },
  { key: "gait_cycle",     name: "Gait Cycle Duration",    unit: "s",         range: [1.0, 1.2],  worse: "above",   requiresCalibration: false, source: LIT, interpretation: "Longer gait cycles indicate reduced walking speed." },
  { key: "stance_phase",   name: "Stance Phase",           unit: "%",         range: [58, 62],    worse: "above",   requiresCalibration: false, source: LIT, interpretation: "Higher stance percentage indicates cautious gait." },
  { key: "swing_phase",    name: "Swing Phase",            unit: "%",         range: [38, 42],    worse: "below",   requiresCalibration: false, source: LIT, interpretation: "Reduced swing phase is associated with Parkinsonian gait." },
  { key: "double_support", name: "Double Support Time",    unit: "%",         range: [20, 24],    worse: "above",   requiresCalibration: false, source: LIT, interpretation: "Higher values indicate instability and fall risk." },
  { key: "single_support", name: "Single Support Time",    unit: "%",         range: [38, 40],    worse: "below",   requiresCalibration: false, source: LIT, interpretation: "Reduced single support may indicate poor balance." },
  { key: "arm_swing_sym",  name: "Arm Swing Symmetry",     unit: "%",         range: [95, 100],   worse: "below",   requiresCalibration: false, source: LIT, interpretation: "Reduced symmetry is an early Parkinsonian sign." },
  { key: "walking_sym",    name: "Walking Symmetry Index", unit: "%",         range: [95, 100],   worse: "below",   requiresCalibration: false, source: LIT, interpretation: "Lower symmetry indicates asymmetric gait." },
  { key: "stability",      name: "Gait Stability Index",   unit: "%",         range: [90, 100],   worse: "below",   requiresCalibration: false, source: LIT, interpretation: "Lower scores indicate unstable gait." },
  { key: "turning_time",   name: "Turning Time (180°)",    unit: "s",         range: [2, 3],      worse: "above",   requiresCalibration: false, source: LIT, interpretation: "Longer turning time indicates impaired motor control." },
  { key: "tug",            name: "Timed Up and Go (TUG)",  unit: "s",         range: [0, 10],     worse: "above",   requiresCalibration: false, source: LIT, interpretation: "<10s Normal; 10–13.5s Mild; >13.5s Increased fall risk." },
];

export interface Demographics {
  ageYears?: number;
  sex?: "male" | "female" | "other";
  heightMeters?: number;
  condition?: string;
}

export interface DemographicModifier {
  key: string;
  applies: (d: Demographics) => boolean;
  range: [number, number];
  source: string;
}

/**
 * Empty by design — see the no-fabrication note above. Populate only with
 * ranges taken from a citable stratified normative dataset.
 */
export const DEMOGRAPHIC_MODIFIERS: DemographicModifier[] = [];

export interface ResolvedReference extends ReferenceEntry {
  /** true when a demographic-specific range was applied */
  stratified: boolean;
}

export function resolveReference(
  key: string,
  demo: Demographics = {},
): ResolvedReference | null {
  const base = GAIT_REFERENCES.find((r) => r.key === key);
  if (!base) return null;
  const mod = DEMOGRAPHIC_MODIFIERS.find((m) => m.key === key && m.applies(demo));
  if (!mod) return { ...base, stratified: false };
  return { ...base, range: mod.range, source: mod.source, stratified: true };
}

export function referenceMidpoint(r: Pick<ReferenceEntry, "range">): number {
  return (r.range[0] + r.range[1]) / 2;
}
