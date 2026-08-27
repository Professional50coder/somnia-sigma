import { readFileSync, writeFileSync } from "node:fs";
import { probUp } from "./pricer.mjs";

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
      points.push({ tau, cadence: cad.name, predicted, outcome: outcomeUp });
    }
  }
}

// ---- calibration: decile buckets on predicted probability ----
points.sort((a, b) => a.predicted - b.predicted);
const nBuckets = 10;
const bucketSize = Math.ceil(points.length / nBuckets);
const calibration = [];
for (let b = 0; b < nBuckets; b++) {
  const slice = points.slice(b * bucketSize, (b + 1) * bucketSize);
  if (slice.length === 0) continue;
  const meanPred = slice.reduce((s, p) => s + p.predicted, 0) / slice.length;
  const freq = slice.reduce((s, p) => s + p.outcome, 0) / slice.length;
  calibration.push({ bucket: b, n: slice.length, meanPredicted: meanPred, realisedFreq: freq });
}

// ---- Brier score + log loss ----
let brier = 0, logloss = 0;
const eps = 1e-9;
for (const p of points) {
  brier += (p.predicted - p.outcome) ** 2;
  const pc = Math.min(1 - eps, Math.max(eps, p.predicted));
  logloss += -(p.outcome * Math.log(pc) + (1 - p.outcome) * Math.log(1 - pc));
}
brier /= points.length;
logloss /= points.length;

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

// ---- simple threshold-swept policy sim vs a synthetic book (fair value + noise/lag) ----
// ASSUMPTION, stated plainly: book = predicted probability from 2 bars ago
// (a naive lag proxy for a slow-moving market maker), clipped to (0.02,0.98).
const bookLagBars = 2;
const withBook = [];
for (let idx = 0; idx < points.length; idx++) {
  const p = points[idx];
  const lagIdx = idx - bookLagBars;
  if (lagIdx < 0) continue;
  const book = Math.min(0.98, Math.max(0.02, points[lagIdx].predicted));
  withBook.push({ ...p, book });
}
const thresholds = [0.01, 0.02, 0.05, 0.10, 0.15];
const sweep = thresholds.map((thr) => {
  let trades = 0, wins = 0, pnl = 0;
  for (const p of withBook) {
    const edge = p.predicted - p.book;
    if (Math.abs(edge) < thr) continue;
    const up = edge > 0;
    const price = up ? p.book : 1 - p.book;
    const won = up ? p.outcome === 1 : p.outcome === 0;
    trades++;
    if (won) { wins++; pnl += (1 - price); } else { pnl -= price; }
  }
  return { thresholdBps: thr * 10000, trades, winRate: trades ? wins / trades : null, avgPnlPerTrade: trades ? pnl / trades : null };
});

const results = {
  source, totalBars: bars.length, totalCheckpoints: points.length,
  lambdaBar: LAMBDA_BAR, minSamples: MIN_SAMPLES,
  brier, logloss, calibration, tauBuckets, byCadence, thresholdSweep: sweep,
};
writeFileSync(new URL("./results.json", import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
