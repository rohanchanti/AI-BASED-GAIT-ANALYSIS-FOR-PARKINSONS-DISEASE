/**
 * Research-grade validation layer.
 *
 * Pure metric implementations that can later be pointed at real ground-truth
 * data (instrumented walkway, force plates, clinician-labelled diagnoses).
 * Nothing here produces numbers on its own: every function requires paired
 * ground-truth input, so the UI can only display validation results when real
 * validation data exist. No placeholder accuracy values are defined anywhere.
 */

export interface AgreementResult {
  n: number;
  mae: number;
  rmse: number;
  /** mean signed error (predicted − reference) */
  bias: number;
  /** Pearson correlation coefficient */
  correlation: number;
  /** Bland-Altman limits of agreement (bias ± 1.96 SD of the differences) */
  limitsOfAgreement: [number, number];
}

/** Continuous-measurement agreement analysis. */
export function evaluateAgreement(
  predicted: number[],
  reference: number[],
): AgreementResult | null {
  const n = Math.min(predicted.length, reference.length);
  if (n < 2) return null;
  const diffs: number[] = [];
  for (let i = 0; i < n; i++) diffs.push(predicted[i] - reference[i]);
  const bias = diffs.reduce((a, b) => a + b, 0) / n;
  const mae = diffs.reduce((a, b) => a + Math.abs(b), 0) / n;
  const rmse = Math.sqrt(diffs.reduce((a, b) => a + b * b, 0) / n);
  const sd = Math.sqrt(diffs.reduce((s, d) => s + (d - bias) ** 2, 0) / (n - 1));
  return {
    n,
    mae: +mae.toFixed(4),
    rmse: +rmse.toFixed(4),
    bias: +bias.toFixed(4),
    correlation: +pearson(predicted.slice(0, n), reference.slice(0, n)).toFixed(4),
    limitsOfAgreement: [+(bias - 1.96 * sd).toFixed(4), +(bias + 1.96 * sd).toFixed(4)],
  };
}

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return NaN;
  const ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n;
  const mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da === 0 || db === 0 ? NaN : num / Math.sqrt(da * db);
}

export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface ClassificationResult extends ConfusionMatrix {
  n: number;
  accuracy: number;
  precision: number;
  /** = sensitivity */
  recall: number;
  specificity: number;
  f1: number;
  rocAuc: number | null;
}

/**
 * Binary classification metrics. `scores` (optional) are continuous model
 * outputs used for ROC-AUC; without them AUC is null rather than guessed.
 */
export function evaluateClassification(
  predictedLabels: (0 | 1)[],
  trueLabels: (0 | 1)[],
  scores?: number[],
): ClassificationResult | null {
  const n = Math.min(predictedLabels.length, trueLabels.length);
  if (n === 0) return null;
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (let i = 0; i < n; i++) {
    const p = predictedLabels[i];
    const t = trueLabels[i];
    if (p === 1 && t === 1) tp++;
    else if (p === 1 && t === 0) fp++;
    else if (p === 0 && t === 0) tn++;
    else fn++;
  }
  const safe = (num: number, den: number) => (den === 0 ? 0 : num / den);
  const precision = safe(tp, tp + fp);
  const recall = safe(tp, tp + fn);
  return {
    n,
    tp,
    fp,
    tn,
    fn,
    accuracy: +safe(tp + tn, n).toFixed(4),
    precision: +precision.toFixed(4),
    recall: +recall.toFixed(4),
    specificity: +safe(tn, tn + fp).toFixed(4),
    f1: +(precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)).toFixed(4),
    rocAuc: scores && scores.length >= n ? +rocAuc(scores.slice(0, n), trueLabels.slice(0, n)).toFixed(4) : null,
  };
}

/** ROC-AUC via the rank-sum (Mann-Whitney U) identity. */
export function rocAuc(scores: number[], labels: (0 | 1)[]): number {
  const pairs = scores.map((s, i) => ({ s, y: labels[i] })).sort((a, b) => a.s - b.s);
  const pos = pairs.filter((p) => p.y === 1).length;
  const neg = pairs.length - pos;
  if (!pos || !neg) return NaN;
  // average ranks for ties
  let i = 0;
  let rankSumPos = 0;
  while (i < pairs.length) {
    let j = i;
    while (j + 1 < pairs.length && pairs[j + 1].s === pairs[i].s) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if (pairs[k].y === 1) rankSumPos += avgRank;
    i = j + 1;
  }
  return (rankSumPos - (pos * (pos + 1)) / 2) / (pos * neg);
}

/* --------------------------- leakage prevention --------------------------- */

export interface PatientRecord<T> {
  patientId: string;
  data: T;
}

export interface Split<T> {
  train: PatientRecord<T>[];
  test: PatientRecord<T>[];
  trainPatients: string[];
  testPatients: string[];
}

/**
 * Patient-level (grouped) split. All records belonging to one patient land in
 * exactly one fold, so frames/sessions from the same patient can never appear
 * in both training and test data. Deterministic given `seed`.
 */
export function splitByPatient<T>(
  records: PatientRecord<T>[],
  testFraction = 0.2,
  seed = 42,
): Split<T> {
  const patients = Array.from(new Set(records.map((r) => r.patientId)));
  // deterministic LCG shuffle
  let a = seed >>> 0 || 1;
  const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0), a / 0xffffffff);
  for (let i = patients.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [patients[i], patients[j]] = [patients[j], patients[i]];
  }
  const nTest = Math.max(1, Math.round(patients.length * testFraction));
  const testPatients = new Set(patients.slice(0, nTest));
  return {
    train: records.filter((r) => !testPatients.has(r.patientId)),
    test: records.filter((r) => testPatients.has(r.patientId)),
    trainPatients: patients.slice(nTest),
    testPatients: [...testPatients],
  };
}

/**
 * Feature standardization fitted ONLY on training data, then applied unchanged
 * to the test data — the standard guard against preprocessing leakage.
 */
export interface Scaler {
  mean: number[];
  sd: number[];
  transform: (row: number[]) => number[];
}

export function fitScaler(trainRows: number[][]): Scaler {
  const d = trainRows[0]?.length ?? 0;
  const mean = new Array(d).fill(0);
  const sd = new Array(d).fill(1);
  if (!trainRows.length) return { mean, sd, transform: (r) => r };
  for (let j = 0; j < d; j++) {
    const col = trainRows.map((r) => r[j] ?? 0);
    const m = col.reduce((x, y) => x + y, 0) / col.length;
    const v = col.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, col.length - 1);
    mean[j] = m;
    sd[j] = Math.sqrt(v) || 1;
  }
  return { mean, sd, transform: (row) => row.map((v, j) => ((v ?? 0) - mean[j]) / sd[j]) };
}
