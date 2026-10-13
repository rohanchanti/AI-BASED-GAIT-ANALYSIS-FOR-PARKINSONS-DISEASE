/** Agreement statistics between measured values and ground truth. Pure and deterministic. */

export const MIN_PAIRS_FOR_METRICS = 3;
export const MIN_PAIRS_FOR_CI = 8;
export const MIN_PAIRS_FOR_ICC = 10;

export interface Agreement {
  n: number;
  status: "ok" | "insufficient";
  reason?: string;
  mae?: number;
  bias?: number;
  sdDiff?: number;
  loaLower?: number;
  loaUpper?: number;
  rmse?: number;
  maeCI?: [number, number] | null;
  biasCI?: [number, number] | null;
  icc?: number | null;
  settings: { bootstrapIterations: number; seed: number; confidence: number; icc: string };
}

const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const sd = (x: number[]) => {
  const m = mean(x);
  return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
};

/** Mulberry32 — reproducible bootstrap. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ICC(2,1): two-way random effects, absolute agreement, single measurement. */
export function icc21(measured: number[], truth: number[]): number {
  const n = measured.length;
  const k = 2;
  const rows = measured.map((m, i) => [m, truth[i]]);
  const grand = mean(rows.flat());
  const rowMeans = rows.map((r) => mean(r));
  const colMeans = [mean(measured), mean(truth)];
  const ssr = k * rowMeans.reduce((a, m) => a + (m - grand) ** 2, 0);
  const ssc = n * colMeans.reduce((a, m) => a + (m - grand) ** 2, 0);
  const sst = rows.flat().reduce((a, v) => a + (v - grand) ** 2, 0);
  const sse = sst - ssr - ssc;
  const msr = ssr / (n - 1);
  const msc = ssc / (k - 1);
  const mse = sse / ((n - 1) * (k - 1));
  const denom = msr + (k - 1) * mse + (k * (msc - mse)) / n;
  return denom === 0 ? NaN : (msr - mse) / denom;
}

export function agreement(measured: number[], truth: number[], opts: { iterations?: number; seed?: number } = {}): Agreement {
  const settings = { bootstrapIterations: opts.iterations ?? 2000, seed: opts.seed ?? 42, confidence: 0.95, icc: "ICC(2,1) absolute agreement" };
  const n = Math.min(measured.length, truth.length);
  if (n < MIN_PAIRS_FOR_METRICS)
    return { n, status: "insufficient", reason: `At least ${MIN_PAIRS_FOR_METRICS} paired values are needed.`, settings };
  const m = measured.slice(0, n);
  const t = truth.slice(0, n);
  const d = m.map((v, i) => v - t[i]);
  const bias = mean(d);
  const sdd = sd(d);
  const mae = mean(d.map(Math.abs));
  const rmse = Math.sqrt(mean(d.map((x) => x * x)));
  let maeCI: [number, number] | null = null;
  let biasCI: [number, number] | null = null;
  if (n >= MIN_PAIRS_FOR_CI) {
    const r = rng(settings.seed);
    const maes: number[] = [];
    const biases: number[] = [];
    for (let it = 0; it < settings.bootstrapIterations; it++) {
      const s: number[] = [];
      for (let j = 0; j < n; j++) s.push(d[Math.floor(r() * n)]);
      maes.push(mean(s.map(Math.abs)));
      biases.push(mean(s));
    }
    const q = (arr: number[], p: number) => arr.sort((a, b) => a - b)[Math.floor(p * (arr.length - 1))];
    maeCI = [q(maes, 0.025), q(maes, 0.975)];
    biasCI = [q(biases, 0.025), q(biases, 0.975)];
  }
  const icc = n >= MIN_PAIRS_FOR_ICC ? icc21(m, t) : null;
  return { n, status: "ok", mae, bias, sdDiff: sdd, loaLower: bias - 1.96 * sdd, loaUpper: bias + 1.96 * sdd, rmse, maeCI, biasCI, icc, settings };
}
