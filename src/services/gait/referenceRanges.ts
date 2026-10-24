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

export const GAIT_REFERENCES: ReferenceEntry[] = [];

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
