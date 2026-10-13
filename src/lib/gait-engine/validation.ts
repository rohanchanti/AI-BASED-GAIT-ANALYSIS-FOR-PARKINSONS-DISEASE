/** Evaluation metrics. Inputs must be paired, participant-level data from a documented reference method. */

function assertPairs(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) throw new Error("Paired arrays of equal, non-zero length required.");
}

export function mae(est: number[], ref: number[]) {
  assertPairs(est, ref);
  return est.reduce((s, v, i) => s + Math.abs(v - ref[i]), 0) / est.length;
}

export function rmse(est: number[], ref: number[]) {
  assertPairs(est, ref);
  return Math.sqrt(est.reduce((s, v, i) => s + (v - ref[i]) ** 2, 0) / est.length);
}

/** Bland–Altman: mean bias and 95% limits of agreement (bias ± 1.96 SD of differences). */
export function blandAltman(est: number[], ref: number[]) {
  assertPairs(est, ref);
  const d = est.map((v, i) => v - ref[i]);
  const bias = d.reduce((a, b) => a + b, 0) / d.length;
  const s = d.length > 1 ? Math.sqrt(d.reduce((a, v) => a + (v - bias) ** 2, 0) / (d.length - 1)) : NaN;
  return { bias, sd: s, lower: bias - 1.96 * s, upper: bias + 1.96 * s, n: d.length };
}

/** ICC(2,1): two-way random effects, absolute agreement, single measurement (Shrout & Fleiss). rows = subjects, cols = raters/sessions. */
export function icc21(data: number[][]) {
  const n = data.length;
  const k = data[0]?.length ?? 0;
  if (n < 2 || k < 2 || data.some((r) => r.length !== k)) throw new Error("ICC needs ≥ 2 subjects × ≥ 2 measurements.");
  const grand = data.flat().reduce((a, b) => a + b, 0) / (n * k);
  const rowM = data.map((r) => r.reduce((a, b) => a + b, 0) / k);
  const colM = Array.from({ length: k }, (_, j) => data.reduce((a, r) => a + r[j], 0) / n);
  const ssr = k * rowM.reduce((a, m) => a + (m - grand) ** 2, 0);
  const ssc = n * colM.reduce((a, m) => a + (m - grand) ** 2, 0);
  const sst = data.flat().reduce((a, v) => a + (v - grand) ** 2, 0);
  const sse = sst - ssr - ssc;
  const msr = ssr / (n - 1);
  const msc = ssc / (k - 1);
  const mse = sse / ((n - 1) * (k - 1));
  return (msr - mse) / (msr + (k - 1) * mse + (k * (msc - mse)) / n);
}

/** Test–retest: ICC(2,1) plus standard error of measurement and minimal detectable change (95%). */
export function testRetest(session1: number[], session2: number[]) {
  assertPairs(session1, session2);
  const icc = icc21(session1.map((v, i) => [v, session2[i]]));
  const all = [...session1, ...session2];
  const m = all.reduce((a, b) => a + b, 0) / all.length;
  const sdAll = Math.sqrt(all.reduce((a, v) => a + (v - m) ** 2, 0) / (all.length - 1));
  const sem = sdAll * Math.sqrt(Math.max(0, 1 - icc));
  return { icc, sem, mdc95: 1.96 * Math.SQRT2 * sem, n: session1.length };
}

/** Wilson score 95% interval for a proportion. */
export function wilson(successes: number, total: number, z = 1.96) {
  if (total === 0) return { lower: NaN, upper: NaN };
  const p = successes / total;
  const den = 1 + z ** 2 / total;
  const c = (p + z ** 2 / (2 * total)) / den;
  const h = (z * Math.sqrt((p * (1 - p)) / total + z ** 2 / (4 * total ** 2))) / den;
  return { lower: c - h, upper: c + h };
}

export function classificationMetrics(truth: (0 | 1)[], pred: (0 | 1)[]) {
  if (truth.length !== pred.length || !truth.length) throw new Error("Equal, non-empty label arrays required.");
  let tp = 0, tn = 0, fp = 0, fn = 0;
  truth.forEach((t, i) => {
    const p = pred[i];
    if (t && p) tp++; else if (!t && !p) tn++; else if (!t && p) fp++; else fn++;
  });
  const div = (a: number, b: number) => (b ? a / b : NaN);
  const sensitivity = div(tp, tp + fn);
  const precision = div(tp, tp + fp);
  return {
    confusion: { tp, tn, fp, fn },
    sensitivity, recall: sensitivity,
    specificity: div(tn, tn + fp),
    precision,
    f1: div(2 * precision * sensitivity, precision + sensitivity),
    ci: { sensitivity: wilson(tp, tp + fn), specificity: wilson(tn, tn + fp), precision: wilson(tp, tp + fp) },
    n: truth.length,
  };
}

/** Deterministic participant-level split. All records of one participant land in exactly one partition. */
export function participantSplit(ids: string[], fractions = { dev: 0.6, val: 0.2 }, seed = 42) {
  const unique = [...new Set(ids)].sort();
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  const nDev = Math.round(unique.length * fractions.dev);
  const nVal = Math.round(unique.length * fractions.val);
  return { dev: unique.slice(0, nDev), val: unique.slice(nDev, nDev + nVal), test: unique.slice(nDev + nVal), seed };
}

export function assertNoLeakage(split: { dev: string[]; val: string[]; test: string[] }) {
  const seen = new Map<string, string>();
  for (const [part, ids] of Object.entries(split)) {
    if (part === "seed") continue;
    for (const id of ids as string[]) {
      if (seen.has(id)) throw new Error(`Participant ${id} appears in both ${seen.get(id)} and ${part}.`);
      seen.set(id, part);
    }
  }
  return true;
}
