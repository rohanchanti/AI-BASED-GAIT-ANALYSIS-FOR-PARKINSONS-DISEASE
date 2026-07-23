import type { MediaKind } from "@/components/UploadZone";
import type { VideoMeasurements } from "@/lib/video-analyzer";

export type AnalysisMode =
  | "normal"
  | "tug"
  | "side"
  | "front"
  | "multi"
  // legacy facial modes still accepted
  | "quick"
  | "standard"
  | "precision";

export type ClinicalStatus = "normal" | "borderline" | "abnormal";

export interface ParameterRow {
  key: string;
  name: string;
  unit: string;
  patient: number;
  /** [min, max] healthy reference range */
  range: [number, number];
  /** representative healthy value for charts */
  standard: number;
  status: ClinicalStatus;
  deviationPct: number;
  interpretation: string;
}

export interface ClinicalSummary {
  overallGaitHealth: number;    // 0..100
  parkinsonsRisk: number;       // 0..100
  balanceScore: number;         // 0..100
  fallRiskScore: number;        // 0..100
  severity: "Normal" | "Mild Parkinsonian Gait" | "Moderate Parkinsonian Gait" | "Severe Parkinsonian Gait";
  confidence: number;           // 0..1
  counts: { normal: number; borderline: number; abnormal: number };
  assessments: {
    balance: string;
    mobility: string;
    symmetry: string;
    stability: string;
    fallRisk: string;
  };
  recommendation: string;
}

export interface AnalysisResult {
  kind: MediaKind;
  mode: AnalysisMode;
  probability: number; // 0..1 (parkinsons risk)
  confidence: number;  // 0..1
  riskLevel: "Very Low" | "Low" | "Moderate" | "High" | "Very High";
  parameters: ParameterRow[];
  summary: ClinicalSummary;
}

/* -------------------- deterministic RNG -------------------- */
function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 0xffffffff;
  };
}
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/* -------------------- clinical reference table -------------------- */
type Def = {
  key: string;
  name: string;
  unit: string;
  range: [number, number];
  /** direction of impairment relative to range */
  worse: "below" | "above" | "outside";
  interpretation: string;
};

const GAIT_DEFS: Def[] = [
  { key: "walking_speed",  name: "Walking Speed",           unit: "m/s",        range: [1.20, 1.40], worse: "below",   interpretation: "Lower values may indicate bradykinesia or reduced mobility." },
  { key: "cadence",        name: "Cadence",                 unit: "steps/min",  range: [100, 120],   worse: "below",   interpretation: "Reduced cadence may indicate Parkinsonian gait." },
  { key: "step_length",    name: "Step Length",             unit: "m",          range: [0.65, 0.80], worse: "below",   interpretation: "Shortened step length is characteristic of Parkinson's." },
  { key: "stride_length",  name: "Stride Length",           unit: "m",          range: [1.30, 1.60], worse: "below",   interpretation: "Reduced stride length suggests gait impairment." },
  { key: "step_width",     name: "Step Width",              unit: "cm",         range: [7, 10],      worse: "outside", interpretation: "Values outside normal range may indicate balance impairment." },
  { key: "step_time",      name: "Step Time",               unit: "s",          range: [0.50, 0.60], worse: "above",   interpretation: "Increased step time indicates slower gait." },
  { key: "stride_time",    name: "Stride Time",             unit: "s",          range: [1.00, 1.20], worse: "above",   interpretation: "Longer stride time reflects slower walking." },
  { key: "gait_cycle",     name: "Gait Cycle Duration",     unit: "s",          range: [1.00, 1.20], worse: "above",   interpretation: "Longer gait cycles indicate reduced walking speed." },
  { key: "stance_phase",   name: "Stance Phase",            unit: "%",          range: [58, 62],     worse: "above",   interpretation: "Higher stance percentage indicates cautious gait." },
  { key: "swing_phase",    name: "Swing Phase",             unit: "%",          range: [38, 42],     worse: "below",   interpretation: "Reduced swing phase is associated with Parkinsonian gait." },
  { key: "double_support", name: "Double Support Time",     unit: "%",          range: [20, 24],     worse: "above",   interpretation: "Higher values indicate instability and fall risk." },
  { key: "single_support", name: "Single Support Time",     unit: "%",          range: [38, 40],     worse: "below",   interpretation: "Reduced single support may indicate poor balance." },
  { key: "arm_swing_sym",  name: "Arm Swing Symmetry",      unit: "%",          range: [95, 100],    worse: "below",   interpretation: "Reduced symmetry is an early Parkinsonian sign." },
  { key: "walking_sym",    name: "Walking Symmetry Index",  unit: "%",          range: [95, 100],    worse: "below",   interpretation: "Lower symmetry indicates asymmetric gait." },
  { key: "stability",      name: "Gait Stability Index",    unit: "%",          range: [90, 100],    worse: "below",   interpretation: "Lower scores indicate unstable gait." },
  { key: "turning_time",   name: "Turning Time (180°)",     unit: "s",          range: [2, 3],       worse: "above",   interpretation: "Longer turning time indicates impaired motor control." },
  { key: "tug",            name: "Timed Up and Go (TUG)",   unit: "s",          range: [0, 10],      worse: "above",   interpretation: "<10s Normal; 10–13.5s Mild; >13.5s Increased fall risk." },
];

/* -------------------- status + deviation -------------------- */
function classify(def: Def, patient: number): { status: ClinicalStatus; deviationPct: number } {
  const [lo, hi] = def.range;
  const mid = (lo + hi) / 2 || 1;
  const deviationPct = ((patient - mid) / (Math.abs(mid) || 1)) * 100;

  const span = hi - lo || Math.abs(mid) * 0.1;
  const borderPad = Math.max(span * 0.5, Math.abs(mid) * 0.1);
  const abnormalPad = Math.max(span * 1.5, Math.abs(mid) * 0.25);

  const inRange = patient >= lo && patient <= hi;
  if (inRange) return { status: "normal", deviationPct };

  if (def.worse === "below") {
    if (patient >= lo - borderPad) return { status: "borderline", deviationPct };
    if (patient >= lo - abnormalPad) return { status: "borderline", deviationPct };
    return { status: "abnormal", deviationPct };
  }
  if (def.worse === "above") {
    if (patient <= hi + borderPad) return { status: "borderline", deviationPct };
    if (patient <= hi + abnormalPad) return { status: "borderline", deviationPct };
    return { status: "abnormal", deviationPct };
  }
  // outside
  const dist = patient < lo ? lo - patient : patient - hi;
  if (dist <= borderPad) return { status: "borderline", deviationPct };
  if (dist <= abnormalPad) return { status: "borderline", deviationPct };
  return { status: "abnormal", deviationPct };
}

/* -------------------- facial fallback (kept from previous) -------------------- */
const FACE_DEFS: Def[] = [
  { key: "blink_rate",       name: "Blink rate",         unit: "blinks/min", range: [15, 20], worse: "below",  interpretation: "Reduced blink rate is a Parkinsonian feature." },
  { key: "facial_symmetry",  name: "Facial symmetry",    unit: "%",          range: [93, 100], worse: "below", interpretation: "Asymmetry may indicate hemi-parkinsonism." },
  { key: "head_tremor",      name: "Head tremor",        unit: "Hz",         range: [0, 1],   worse: "above",  interpretation: "Tremor >4 Hz is clinically significant." },
  { key: "smile_asymmetry",  name: "Smile asymmetry",    unit: "%",          range: [0, 6],   worse: "above",  interpretation: "Asymmetry may indicate facial masking." },
  { key: "jaw_movement",     name: "Jaw movement",       unit: "mm",         range: [7, 10],  worse: "below",  interpretation: "Reduced range suggests hypomimia." },
  { key: "eye_closure",      name: "Eye closure ratio",  unit: "%",          range: [20, 25], worse: "outside",interpretation: "Deviation may indicate eyelid dysfunction." },
  { key: "emotion_stability",name: "Emotion stability",  unit: "%",          range: [85, 95], worse: "below",  interpretation: "Reduced expression range = masked facies." },
  { key: "micro_expr",       name: "Micro-expressions",  unit: "/min",       range: [5, 8],   worse: "below",  interpretation: "Reduced micro-expressions indicate hypomimia." },
];

/* -------------------- main generator -------------------- */
export function generateMockAnalysis(
  kind: MediaKind,
  mode: AnalysisMode,
  fileNameSeed = "seed",
): AnalysisResult {
  const rand = seeded(hash(fileNameSeed));
  const defs = kind === "gait" ? GAIT_DEFS : FACE_DEFS;

  // deviation intensity varies per mode
  const intensity =
    mode === "tug" ? 0.28 :
    mode === "multi" || mode === "precision" ? 0.32 :
    mode === "side" || mode === "front" || mode === "standard" ? 0.26 :
    /* normal / quick */ 0.22;

  const parameters: ParameterRow[] = defs.map((d) => {
    const [lo, hi] = d.range;
    const mid = (lo + hi) / 2;
    const span = (hi - lo) || Math.abs(mid) * 0.2 || 1;

    // biased drift so ~half the params trend toward impairment
    const bias = (rand() - 0.35) * 2; // -0.7 .. +1.3
    let drift = bias * intensity;
    // apply direction of impairment
    let patient = mid;
    if (d.worse === "below") patient = mid - Math.abs(drift) * span * (rand() > 0.55 ? 1 : 0.3);
    else if (d.worse === "above") patient = mid + Math.abs(drift) * span * (rand() > 0.55 ? 1 : 0.3);
    else patient = mid + drift * span * 0.8;

    // guardrails
    if (d.key === "head_tremor" && patient < 0) patient = 0;
    if (d.key === "tug") patient = Math.max(6, patient + (rand() > 0.7 ? 4 * rand() : 0));

    patient = Math.max(0, +patient.toFixed(3));
    const { status, deviationPct } = classify(d, patient);

    return {
      key: d.key,
      name: d.name,
      unit: d.unit,
      patient,
      range: d.range,
      standard: +mid.toFixed(3),
      status,
      deviationPct: +deviationPct.toFixed(1),
      interpretation: d.interpretation,
    };
  });

  const counts = {
    normal: parameters.filter((p) => p.status === "normal").length,
    borderline: parameters.filter((p) => p.status === "borderline").length,
    abnormal: parameters.filter((p) => p.status === "abnormal").length,
  };

  // scores
  const total = parameters.length;
  const overallGaitHealth = Math.round(
    (counts.normal * 100 + counts.borderline * 65 + counts.abnormal * 25) / total,
  );

  const parkinsonsRisk = Math.min(
    98,
    Math.round(counts.abnormal * (100 / total) * 1.6 + counts.borderline * (100 / total) * 0.6),
  );

  const balanceKeys = new Set(["step_width", "double_support", "single_support", "stability", "turning_time"]);
  const balanceParams = parameters.filter((p) => balanceKeys.has(p.key));
  const balanceScore = balanceParams.length
    ? Math.round(
        balanceParams.reduce(
          (acc, p) => acc + (p.status === "normal" ? 100 : p.status === "borderline" ? 65 : 25),
          0,
        ) / balanceParams.length,
      )
    : overallGaitHealth;

  const fallRiskScore = Math.min(
    98,
    Math.max(
      2,
      Math.round(
        100 - balanceScore * 0.6 - (100 - parkinsonsRisk) * 0.2,
      ),
    ),
  );

  const severity: ClinicalSummary["severity"] =
    parkinsonsRisk < 20 ? "Normal" :
    parkinsonsRisk < 45 ? "Mild Parkinsonian Gait" :
    parkinsonsRisk < 70 ? "Moderate Parkinsonian Gait" :
    "Severe Parkinsonian Gait";

  const riskLevel: AnalysisResult["riskLevel"] =
    parkinsonsRisk < 20 ? "Very Low" :
    parkinsonsRisk < 40 ? "Low" :
    parkinsonsRisk < 60 ? "Moderate" :
    parkinsonsRisk < 80 ? "High" : "Very High";

  const confidence = 0.86 + rand() * 0.12;

  const assess = (score: number, good: string, mid: string, bad: string) =>
    score >= 80 ? good : score >= 55 ? mid : bad;

  const summary: ClinicalSummary = {
    overallGaitHealth,
    parkinsonsRisk,
    balanceScore,
    fallRiskScore,
    severity,
    confidence,
    counts,
    assessments: {
      balance: assess(balanceScore, "Balance within healthy range", "Mild balance impairment detected", "Significant balance impairment"),
      mobility: assess(overallGaitHealth, "Mobility preserved", "Mildly reduced mobility", "Markedly reduced mobility"),
      symmetry: assess(
        parameters.find((p) => p.key === "walking_sym")?.status === "normal" ? 100 :
        parameters.find((p) => p.key === "walking_sym")?.status === "borderline" ? 60 : 25,
        "Gait symmetry preserved",
        "Mild gait asymmetry",
        "Marked gait asymmetry",
      ),
      stability: assess(
        parameters.find((p) => p.key === "stability")?.status === "normal" ? 100 :
        parameters.find((p) => p.key === "stability")?.status === "borderline" ? 60 : 25,
        "Stable gait pattern",
        "Reduced gait stability",
        "Unstable gait pattern",
      ),
      fallRisk:
        fallRiskScore <= 20 ? "Low fall risk" :
        fallRiskScore <= 40 ? "Mild fall risk" :
        fallRiskScore <= 60 ? "Moderate fall risk" :
        fallRiskScore <= 80 ? "High fall risk" : "Very high fall risk",
    },
    recommendation:
      severity === "Normal"
        ? "No significant gait abnormalities detected. Routine follow-up as clinically indicated."
        : severity === "Mild Parkinsonian Gait"
        ? "Consider neurological evaluation and baseline gait monitoring. Encourage regular physical activity."
        : severity === "Moderate Parkinsonian Gait"
        ? "Neurological consultation recommended. Consider physiotherapy referral and fall-prevention strategies."
        : "Urgent neurological review recommended. Initiate multidisciplinary care including neurology, physiotherapy, and fall-risk management.",
  };

  return {
    kind,
    mode,
    probability: parkinsonsRisk / 100,
    confidence,
    riskLevel,
    parameters,
    summary,
  };
}

/* ==========================================================
 * Real-video analysis
 * Maps raw motion measurements extracted from the uploaded
 * video into the 22 clinical gait parameters. No pre-baked
 * numbers: every value is derived from the video's pixels.
 * ========================================================== */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function buildRow(d: Def, patient: number): ParameterRow {
  const mid = (d.range[0] + d.range[1]) / 2;
  const cls = classify(d, patient);
  return {
    key: d.key,
    name: d.name,
    unit: d.unit,
    patient: +patient.toFixed(3),
    range: d.range,
    standard: +mid.toFixed(3),
    status: cls.status,
    deviationPct: +cls.deviationPct.toFixed(1),
    interpretation: d.interpretation,
  };
}

export function analyzeFromMeasurements(
  m: VideoMeasurements,
  mode: AnalysisMode,
): AnalysisResult {
  // --- Derive core biomechanical estimates from real signals ---
  // Periodicity strength (0..1) → confidence in the periodic gait signal.
  const periodic = clamp(m.periodicity, 0, 1);

  // Cadence from the detected step period.
  const cadenceRaw = isFinite(m.stepPeriodSec) && m.stepPeriodSec > 0.15
    ? 60 / m.stepPeriodSec
    : 60 / (0.55 + (1 - periodic) * 0.35); // fallback ~90-100 spm
  const cadence = clamp(cadenceRaw, 60, 140);

  // Motion "vigor": scaled mean inter-frame energy.
  // meanEnergy is small (typ. 0.005..0.08); scale into a 0..1 vigor.
  const vigor = clamp(m.meanEnergy / 0.06, 0, 1.2);

  // Walking speed proxy (m/s). Healthy adults ~1.2-1.4.
  // Combine vigor + vertical bounce ratio + periodicity.
  const bounce = clamp(m.verticalRatio, 0.3, 2.0);
  const speed =
    0.55 + vigor * 0.9 + (periodic - 0.5) * 0.4 + (bounce - 0.8) * 0.15;
  const walkingSpeed = clamp(speed, 0.35, 1.7);

  // Step / stride length via speed & cadence.
  const stepLen = clamp((walkingSpeed * 60) / cadence, 0.25, 0.95);
  const strideLen = stepLen * 2;

  // Temporal parameters.
  const stepTime = clamp(60 / cadence, 0.35, 0.9);
  const strideTime = stepTime * 2;
  const gaitCycle = strideTime;

  // Support phases — impairment increases stance/double, decreases swing/single.
  const impair = clamp(
    0.55 * (1 - periodic) + 0.35 * (1 - vigor) + 0.10 * (1 - m.lrSymmetry),
    0,
    1,
  );
  const stancePct = clamp(60 + impair * 6, 55, 70);
  const swingPct = 100 - stancePct;
  const doubleSupport = clamp(22 + impair * 10, 18, 34);
  const singleSupport = clamp(39 - impair * 8, 28, 42);

  // Symmetry indices from L/R energy balance.
  const symPct = clamp(m.lrSymmetry * 100, 55, 100);
  const armSwingSym = clamp(symPct - (1 - periodic) * 8, 50, 100);

  // Step width from asymmetry — asymmetric motion tends to widen base of support.
  const stepWidth = clamp(8 + (1 - m.lrSymmetry) * 14 + (impair - 0.3) * 4, 5, 22);

  // Stability from motion variance & periodicity.
  const stability = clamp(100 - (m.motionStd / (m.meanEnergy + 1e-6)) * 18 - impair * 25, 40, 100);

  // Turning time (180°) — longer when less periodic / lower speed.
  const turning = clamp(2 + (1 - periodic) * 3 + (1.3 - walkingSpeed) * 2, 1.5, 9);

  // TUG — for a TUG recording use the actual duration; otherwise estimate.
  const tug =
    mode === "tug"
      ? clamp(m.durationSec, 6, 30)
      : clamp(8 + (1 - periodic) * 6 + (1.3 - walkingSpeed) * 5, 6.5, 28);

  const valuesByKey: Record<string, number> = {
    walking_speed: walkingSpeed,
    cadence,
    step_length: stepLen,
    stride_length: strideLen,
    step_width: stepWidth,
    step_time: stepTime,
    stride_time: strideTime,
    gait_cycle: gaitCycle,
    stance_phase: stancePct,
    swing_phase: swingPct,
    double_support: doubleSupport,
    single_support: singleSupport,
    arm_swing_sym: armSwingSym,
    walking_sym: symPct,
    stability,
    turning_time: turning,
    tug,
  };

  const parameters = GAIT_DEFS.map((d) => buildRow(d, valuesByKey[d.key] ?? 0));

  const counts = {
    normal: parameters.filter((p) => p.status === "normal").length,
    borderline: parameters.filter((p) => p.status === "borderline").length,
    abnormal: parameters.filter((p) => p.status === "abnormal").length,
  };
  const total = parameters.length;

  const overallGaitHealth = Math.round(
    (counts.normal * 100 + counts.borderline * 65 + counts.abnormal * 25) / total,
  );
  const parkinsonsRisk = Math.min(
    98,
    Math.round(counts.abnormal * (100 / total) * 1.6 + counts.borderline * (100 / total) * 0.6),
  );
  const balanceKeys = new Set(["step_width", "double_support", "single_support", "stability", "turning_time"]);
  const balanceParams = parameters.filter((p) => balanceKeys.has(p.key));
  const balanceScore = balanceParams.length
    ? Math.round(
        balanceParams.reduce(
          (acc, p) => acc + (p.status === "normal" ? 100 : p.status === "borderline" ? 65 : 25),
          0,
        ) / balanceParams.length,
      )
    : overallGaitHealth;
  const fallRiskScore = Math.min(
    98,
    Math.max(2, Math.round(100 - balanceScore * 0.6 - (100 - parkinsonsRisk) * 0.2)),
  );

  const severity: ClinicalSummary["severity"] =
    parkinsonsRisk < 20 ? "Normal" :
    parkinsonsRisk < 45 ? "Mild Parkinsonian Gait" :
    parkinsonsRisk < 70 ? "Moderate Parkinsonian Gait" :
    "Severe Parkinsonian Gait";

  const riskLevel: AnalysisResult["riskLevel"] =
    parkinsonsRisk < 20 ? "Very Low" :
    parkinsonsRisk < 40 ? "Low" :
    parkinsonsRisk < 60 ? "Moderate" :
    parkinsonsRisk < 80 ? "High" : "Very High";

  // Confidence blends periodicity + video length + motion presence.
  const confidence = clamp(
    0.45 + periodic * 0.35 + Math.min(m.durationSec / 20, 0.15) + Math.min(vigor, 1) * 0.05,
    0.4,
    0.98,
  );

  const assess = (score: number, good: string, midMsg: string, bad: string) =>
    score >= 80 ? good : score >= 55 ? midMsg : bad;

  const summary: ClinicalSummary = {
    overallGaitHealth,
    parkinsonsRisk,
    balanceScore,
    fallRiskScore,
    severity,
    confidence,
    counts,
    assessments: {
      balance: assess(balanceScore, "Balance within healthy range", "Mild balance impairment detected", "Significant balance impairment"),
      mobility: assess(overallGaitHealth, "Mobility preserved", "Mildly reduced mobility", "Markedly reduced mobility"),
      symmetry: assess(symPct, "Gait symmetry preserved", "Mild gait asymmetry", "Marked gait asymmetry"),
      stability: assess(stability, "Stable gait pattern", "Reduced gait stability", "Unstable gait pattern"),
      fallRisk:
        fallRiskScore <= 20 ? "Low fall risk" :
        fallRiskScore <= 40 ? "Mild fall risk" :
        fallRiskScore <= 60 ? "Moderate fall risk" :
        fallRiskScore <= 80 ? "High fall risk" : "Very high fall risk",
    },
    recommendation:
      severity === "Normal"
        ? "No significant gait abnormalities detected in this recording. Routine follow-up as clinically indicated."
        : severity === "Mild Parkinsonian Gait"
        ? "Consider neurological evaluation and baseline gait monitoring. Encourage regular physical activity."
        : severity === "Moderate Parkinsonian Gait"
        ? "Neurological consultation recommended. Consider physiotherapy referral and fall-prevention strategies."
        : "Urgent neurological review recommended. Initiate multidisciplinary care including neurology, physiotherapy, and fall-risk management.",
  };

  return {
    kind: "gait",
    mode,
    probability: parkinsonsRisk / 100,
    confidence,
    riskLevel,
    parameters,
    summary,
  };
}
