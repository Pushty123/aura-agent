/** Small, dependency-free statistics. Every number AURA shows comes from here, not from an AI model. */

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Median absolute deviation. */
export function mad(xs: number[]): number {
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

/** Robust z-score using MAD (1.4826 makes it comparable to a standard deviation). */
export function robustZ(x: number, baseline: number[]): number {
  const s = 1.4826 * mad(baseline);
  return s === 0 ? 0 : (x - median(baseline)) / s;
}

function ranks(xs: number[]): number[] {
  const idx = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const r = new Array<number>(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
    const avg = (i + j) / 2 + 1; // average rank for ties
    for (let k = i; k <= j; k++) r[idx[k].i] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x: number[], y: number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export function spearman(x: number[], y: number[]): number {
  return pearson(ranks(x), ranks(y));
}

/** Small seeded PRNG (mulberry32) so tests and the demo are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Two-sided permutation test on Spearman's rho.
 * Returns the fraction of shuffles whose |rho| is at least as large as observed.
 */
export function permutationP(x: number[], y: number[], iterations = 2000, seed = 42): number {
  const observed = Math.abs(spearman(x, y));
  const rand = rng(seed);
  const ys = [...y];
  let count = 0;
  for (let it = 0; it < iterations; it++) {
    for (let i = ys.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [ys[i], ys[j]] = [ys[j], ys[i]];
    }
    if (Math.abs(spearman(x, ys)) >= observed - 1e-12) count++;
  }
  return (count + 1) / (iterations + 1);
}
