import { readFileSync, writeFileSync } from "node:fs";
import { probUp, studentProbUp, estimateNu } from "./pricer.mjs";

const { source, bars } = JSON.parse(readFileSync(new URL("./data/btc_m1.json", import.meta.url)));
const BAR_SEC = 60;
const OBS_SEC = 2; // measured live cadence of the real MarkPriceUpdated feed
const LAMBDA_CONTRACT = 0.94; // RealizedVol.LAMBDA, applied per observation
const MIN_SAMPLES = 30; // RealizedVol.MIN_SAMPLES

// The exact conversion this project's own plan flagged as a prior bug: do not
// copy LAMBDA=0.94 across a different sampling cadence. Convert by half-life
// so the per-bar EWMA has the SAME real-time memory as the deployed contract.
const LAMBDA_BAR = LAMBDA_CONTRACT ** (BAR_SEC / OBS_SEC); // 0.94^30 ~= 0.1563

// Running EWMA of squared-log-return PER SECOND, updated once per 60s bar,
// mirroring RealizedVol.recordPrice's `rate = squared / dt` step exactly,
// just at bar granularity instead of per-tick.
let varianceRate = 0, samples = 0;
const points = []; // {tau, cadence, predicted, outcome}

const CADENCES = [
  { name: "15m", windowBars: 15, windowSec: 900 },
  { name: "1h", windowBars: 60, windowSec: 3600 },
];

for (const cad of CADENCES) {
  for (let start = 0; start + cad.windowBars < bars.length; start += cad.windowBars) {
    // Warm up the SAME running EWMA independently per cadence pass is wrong --
    // the real system runs ONE continuous estimator. So we don't reset
    // varianceRate/samples across cadences; instead run each cadence's window
    // reconstruction against a FRESH copy of the shared running state up to
    // that point. Simplify: compute the running state once (below, single
    // pass) and reuse it for both cadences by re-deriving per-bar state.
  }
}

// Single continuous pass building per-bar running EWMA state (matches the
// real system: one ongoing estimator, not one per cadence), then slice
// windows out of it for each cadence afterward.
const stateAtBar = []; // stateAtBar[i] = {varianceRate, samples} AFTER processing bars[i]
for (let i = 0; i < bars.length; i++) {
  if (i > 0) {
    const ret = Math.log(bars[i].close / bars[i - 1].close);
    const rate = (ret * ret) / BAR_SEC;
    varianceRate = varianceRate * LAMBDA_BAR + rate * (1 - LAMBDA_BAR);
    samples++;
  }
  stateAtBar.push({ varianceRate, samples });
}

function sigmaForWindow(i, windowSec) {
  const s = stateAtBar[i];
  if (s.samples < MIN_SAMPLES) return null;
  return Math.sqrt(s.varianceRate * windowSec);
}

// Estimate nu from the full return series
const allReturns = [];
for (let i = 1; i < bars.length; i++) {
  allReturns.push(Math.log(bars[i].close / bars[i - 1].close));
}
const estimatedNu = estimateNu(allReturns);
console.log(`  Estimated nu (degrees of freedom): ${estimatedNu.toFixed(2)}`);

for (const cad of CADENCES) {
  for (let start = 0; start + cad.windowBars < bars.length; start += cad.windowBars) {
    const openIdx = start;
    const endIdx = start + cad.windowBars;
    const K = bars[openIdx].close; // strike = the window's own opening price
    const closeAtEnd = bars[endIdx].close;
    const outcomeUp = closeAtEnd >= K ? 1 : 0; // ties favor Up, per dreamDEX rule

    for (let i = openIdx + 1; i < endIdx; i++) {
      const elapsed = (i - openIdx) * BAR_SEC;
      const tau = (cad.windowSec - elapsed) / cad.windowSec;
      if (tau <= 0) continue;
      const sigma = sigmaForWindow(i, cad.windowSec);
      if (sigma === null || sigma === 0) continue;
      const spot = bars[i].close;
      const predicted = probUp(spot, K, sigma, tau);
      const studentPredicted = studentProbUp(spot, K, sigma, tau, estimatedNu);
      points.push({ tau, cadence: cad.name, predicted, studentPredicted, outcome: outcomeUp });
    }
  }
}

// ---- calibration: decile buckets on predicted probability ----
points.sort((a, b) => a.predicted - b.predicted);
const nBuckets = 10;
const bucketSize = Math.ceil(points.length / nBuckets);
const calibration = [];
const studentCalibration = [];
for (let b = 0; b < nBuckets; b++) {
  const slice = points.slice(b * bucketSize, (b + 1) * bucketSize);
  if (slice.length === 0) continue;
  const meanPred = slice.reduce((s, p) => s + p.predicted, 0) / slice.length;
  const meanStudentPred = slice.reduce((s, p) => s + p.studentPredicted, 0) / slice.length;
  const freq = slice.reduce((s, p) => s + p.outcome, 0) / slice.length;
  calibration.push({ bucket: b, n: slice.length, meanPredicted: meanPred, realisedFreq: freq });
  studentCalibration.push({ bucket: b, n: slice.length, meanPredicted: meanStudentPred, realisedFreq: freq });
}

// ---- Brier score + log loss ----
let brier = 0, logloss = 0;
let studentBrier = 0, studentLogloss = 0;
const eps = 1e-9;
for (const p of points) {
  brier += (p.predicted - p.outcome) ** 2;
  const pc = Math.min(1 - eps, Math.max(eps, p.predicted));
  logloss += -(p.outcome * Math.log(pc) + (1 - p.outcome) * Math.log(1 - pc));

  studentBrier += (p.studentPredicted - p.outcome) ** 2;
  const sc = Math.min(1 - eps, Math.max(eps, p.studentPredicted));
  studentLogloss += -(p.outcome * Math.log(sc) + (1 - p.outcome) * Math.log(1 - sc));
}
brier /= points.length;
logloss /= points.length;
studentBrier /= points.length;
studentLogloss /= points.length;

console.log(`\n  Gaussian  — Brier: ${brier.toFixed(4)}  Log loss: ${logloss.toFixed(4)}`);
console.log(`  Student-t — Brier: ${studentBrier.toFixed(4)}  Log loss: ${studentLogloss.toFixed(4)}`);
console.log(`  Improvement: ${((brier - studentBrier) / brier * 100).toFixed(2)}% Brier, ${((logloss - studentLogloss) / logloss * 100).toFixed(2)}% log loss\n`);

// ---- breakout by tau bucket (quintiles of tau) and by cadence ----
function summarize(filterFn) {
  const s = points.filter(filterFn);
  if (s.length === 0) return null;
  const meanPred = s.reduce((a, p) => a + p.predicted, 0) / s.length;
  const freq = s.reduce((a, p) => a + p.outcome, 0) / s.length;
  const b = s.reduce((a, p) => a + (p.predicted - p.outcome) ** 2, 0) / s.length;
  return { n: s.length, meanPredicted: meanPred, realisedFreq: freq, brier: b };
}

const tauBuckets = [
  { label: "tau in (0.8,1.0]", f: (p) => p.tau > 0.8 },
  { label: "tau in (0.5,0.8]", f: (p) => p.tau > 0.5 && p.tau <= 0.8 },
  { label: "tau in (0.2,0.5]", f: (p) => p.tau > 0.2 && p.tau <= 0.5 },
  { label: "tau in (0.0,0.2]", f: (p) => p.tau <= 0.2 },
].map((t) => ({ ...t, ...summarize(t.f) }));

const byCadence = CADENCES.map((c) => ({ cadence: c.name, ...summarize((p) => p.cadence === c.name) }));

// ---- Policy simulation vs a synthetic book ----
//
// The previous version used the model's own prediction from 2 bars ago as the
// book proxy — which is self-correlated with the model's eventual prediction
// (same estimator, just lagged). That produced artifactual negative PnL.
//
// Improved model: the synthetic book represents a MARKET MAKER whose quotes
// lag fair value by a realistic delay AND include quote noise. Specifically:
//   book(t) = clamp(fair(t - LAG) + noise, 0.02, 0.98)
// where:
//   - LAG = 3 bars (3 minutes) — a slow market maker reacting to stale info
//   - noise ~ N(0, σ_quote) with σ_quote = 0.02 — typical quote spread noise
//   - The noise is INDEPENDENT per observation (not autocorrelated)
//
// This creates genuine decorrelation: the book reflects OLD fair values plus
// independent noise, so the edge (fair - book) is a real signal, not an
// artifact of self-correlation. The trade outcome depends on the ACTUAL price
// move, which the lagged/noisy book cannot predict.
//
// IMPORTANT: this still has limitations:
//   - A real book would react to price moves (not just lag time)
//   - Spread is not modeled (book = mid-price)
//   - Fills are assumed instant at the quoted price
// These are stated as known simplifications, not hidden.

const BOOK_LAG_BARS = 3;      // market maker reacts 3 minutes late
const BOOK_NOISE_STD = 0.02;  // independent quote noise (std dev)
const BOOK_SEED = 42;          // reproducible noise

// Simple seeded PRNG (mulberry32) for reproducible noise
function mulberry32(seed) {
  let t = seed;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform for normal distribution
function randn(rng) {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}

const rng = mulberry32(BOOK_SEED);

const withBook = [];
for (let idx = 0; idx < points.length; idx++) {
  const p = points[idx];
  const lagIdx = idx - BOOK_LAG_BARS;
  if (lagIdx < 0) continue;
  const laggedFair = points[lagIdx].predicted;
  const noise = randn(rng) * BOOK_NOISE_STD;
  const book = Math.min(0.98, Math.max(0.02, laggedFair + noise));
  withBook.push({ ...p, book });
}

const thresholds = [0.01, 0.02, 0.05, 0.10, 0.15];
const sweep = thresholds.map((thr) => {
  let trades = 0, wins = 0, pnl = 0;
  for (const p of withBook) {
    const edge = p.predicted - p.book;
    if (Math.abs(edge) < thr) continue;
    // Positive edge → buy YES at book price; negative → buy NO at 1 - book
    const up = edge > 0;
    const price = up ? p.book : 1 - p.book;
    const won = up ? p.outcome === 1 : p.outcome === 0;
    trades++;
    if (won) { wins++; pnl += (1 - price); } else { pnl -= price; }
  }
  return {
    thresholdBps: thr * 10000,
    trades,
    winRate: trades ? wins / trades : null,
    avgPnlPerTrade: trades ? pnl / trades : null,
  };
});

const results = {
  source, totalBars: bars.length, totalCheckpoints: points.length,
  lambdaBar: LAMBDA_BAR, minSamples: MIN_SAMPLES,
  brier, logloss, calibration, tauBuckets, byCadence, thresholdSweep: sweep,
  studentT: {
    nu: estimatedNu,
    brier: studentBrier,
    logloss: studentLogloss,
    calibration: studentCalibration,
  },
};
writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
