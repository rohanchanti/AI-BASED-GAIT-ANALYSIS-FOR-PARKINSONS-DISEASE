/**
 * PhysioNet "Gait in Parkinson's Disease" (gaitpdb, v1.0.0) — reference-data utilities.
 * Modality: vertical ground-reaction force from 8 sensors under each foot, 100 Hz. NOT video.
 * Features derived here are force-based reference features and must not be treated as
 * equivalent to video-derived pose features without a validated cross-modal method.
 */
import { mean, sd } from "./parameters";

export const GAITPDB_META = {
  name: "Gait in Parkinson's Disease (gaitpdb)",
  url: "https://physionet.org/content/gaitpdb/1.0.0/",
  license: "Open Data Commons Attribution License v1.0",
  citation:
    "Goldberger AL et al. PhysioBank, PhysioToolkit, and PhysioNet. Circulation 2000;101(23):e215–e220. Dataset contributors: Hausdorff JM, Yogev G, Frenkel-Toledo S, et al.",
  modality: "Vertical ground reaction force (N), 8 sensors per foot",
  samplingHz: 100,
  fileFormat: "Text, 19 columns: time (s), L1–L8, R1–R8, total left, total right",
  fileNaming: "{Study}{Pt|Co}{NN}_{walk}.txt — Study ∈ Ga, Ju, Si; Pt = Parkinson's, Co = control",
  annotations: "Group label and demographics in demographics file; no frame-level event annotations",
  domainShift: [
    "Force sensors measure contact directly; video infers contact from ankle kinematics.",
    "Recordings are ~2 minutes of level walking (some dual-task), not short camera clips.",
    "Population: older adults with idiopathic PD and age-matched controls from three Israeli studies.",
  ],
} as const;

export interface GaitpdbRecord {
  fileName: string;
  participantId: string;
  study: string;
  group: "PD" | "Control";
  trial: string;
}

export function parseGaitpdbFileName(fileName: string): GaitpdbRecord | null {
  const m = /^(Ga|Ju|Si)(Pt|Co)(\d{2})_(\d{2}|10)\.txt$/.exec(fileName);
  if (!m) return null;
  return { fileName, participantId: `${m[1]}${m[2]}${m[3]}`, study: m[1], group: m[2] === "Pt" ? "PD" : "Control", trial: m[4] };
}

export interface ForceSignal { t: number[]; left: number[]; right: number[] }

export function parseGaitpdbText(text: string): ForceSignal {
  const t: number[] = [], left: number[] = [], right: number[] = [];
  for (const line of text.split(/\r?\n/)) {
    const c = line.trim().split(/\s+/).map(Number);
    if (c.length < 19 || c.some((v) => !Number.isFinite(v))) continue;
    t.push(c[0]); left.push(c[17]); right.push(c[18]);
  }
  if (t.length < 10) throw new Error("File does not contain gaitpdb force rows.");
  return { t, left, right };
}

/**
 * Documented preprocessing: 5-sample moving average, then contact threshold =
 * max(20 N, 5% of the foot's 95th-percentile force); contact onset = upward crossing.
 */
export function forceContacts(t: number[], f: number[]) {
  const sm = f.map((_, i) => {
    const s = f.slice(Math.max(0, i - 2), i + 3);
    return s.reduce((a, b) => a + b, 0) / s.length;
  });
  const sorted = [...sm].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(0.95 * (sorted.length - 1))];
  const thr = Math.max(20, 0.05 * p95);
  const onsets: number[] = [];
  const offs: number[] = [];
  for (let i = 1; i < sm.length; i++) {
    if (sm[i - 1] < thr && sm[i] >= thr) onsets.push(t[i]);
    if (sm[i - 1] >= thr && sm[i] < thr) offs.push(t[i]);
  }
  return { onsets, offs, threshold: thr };
}

/** Force-based reference features (stride time, stance, swing) per foot. */
export function forceReferenceFeatures(sig: ForceSignal) {
  const out: Record<string, { mean: number; cv: number; n: number } | null> = {};
  for (const side of ["left", "right"] as const) {
    const { onsets, offs } = forceContacts(sig.t, sig[side]);
    const stride: number[] = [], stance: number[] = [], swing: number[] = [];
    for (let i = 0; i < onsets.length - 1; i++) {
      const d = onsets[i + 1] - onsets[i];
      if (d < 0.4 || d > 2.5) continue;
      stride.push(d);
      const off = offs.find((o) => o > onsets[i] && o < onsets[i + 1]);
      if (off) { stance.push(off - onsets[i]); swing.push(onsets[i + 1] - off); }
    }
    const agg = (a: number[]) => (a.length >= 3 ? { mean: mean(a), cv: (100 * sd(a)) / mean(a), n: a.length } : null);
    out[`${side}StrideTime`] = agg(stride);
    out[`${side}StanceTime`] = agg(stance);
    out[`${side}SwingTime`] = agg(swing);
  }
  return out;
}

/** Only these features are comparable across force and video modalities (temporal, contact-based). */
export const CROSS_MODAL_COMPARABLE = ["strideTime", "strideTimeCV"] as const;
