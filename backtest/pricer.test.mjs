// Property and hand-checked tests for the JS pricer port (backtest/pricer.mjs).
// Run: node --test backtest/pricer.test.mjs   (no install needed)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalCdf, d2, probUp, edgeBps, breakEvenBps, kellyFraction, studentCdf, studentProbUp,
} from "./pricer.mjs";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} got ${a}, want ${b} (tol ${tol})`);

// Deterministic PRNG so property tests are reproducible.
function rng(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = rng(42);
const between = (lo, hi) => lo + (hi - lo) * rand();

test("normalCdf: known values (scipy.stats.norm.cdf)", () => {
  near(normalCdf(0), 0.5, 1e-7);
  near(normalCdf(1), 0.8413447460685429, 2e-7);
  near(normalCdf(-1.96), 0.024997895148220435, 2e-7);
});

test("hand-checked: S=K, sigma=0.01, tau=1 -> d2 = -sigma/2 = -0.005, P = 0.498005", () => {
  near(d2(100, 100, 0.01, 1), -0.005, 1e-12);
  near(probUp(100, 100, 0.01, 1), 0.49800529690925915, 2e-7);
});

test("hand-checked: S=1.003K, sigma=0.01, tau=0.25 -> P = 0.724613 (scipy)", () => {
  // sigma*sqrt(tau)=0.005; d2=(ln 1.003 - 0.0000125)/0.005
  near(probUp(100.3, 100, 0.01, 0.25), 0.7246133640533912, 3e-7);
});

test("hand-checked economics: p=0.70 at price 0.60", () => {
  near(edgeBps(0.70, 0.60), 1000, 1e-9);
  near(breakEvenBps(0.60), 6000, 1e-9);
  // Kelly = p - (1-p)*a/(1-a) = 0.7 - 0.3*1.5 = 0.25
  near(kellyFraction(0.70, 0.60), 0.25, 1e-12);
  assert.equal(kellyFraction(0.55, 0.60), 0);
});

test("property: probability always in [0,1]", () => {
  for (let i = 0; i < 5000; i++) {
    const p = probUp(between(50, 150), 100, between(0.0005, 0.2), between(0.001, 1));
    assert.ok(p >= 0 && p <= 1 && Number.isFinite(p));
    const q = studentProbUp(between(50, 150), 100, between(0.0005, 0.2), between(0.001, 1), between(2.5, 30));
    assert.ok(q >= 0 && q <= 1 && Number.isFinite(q));
  }
});

test("property: monotone increasing in spot, decreasing in strike", () => {
  for (let i = 0; i < 500; i++) {
    const sigma = between(0.001, 0.1), tau = between(0.01, 1);
    let prev = -1;
    for (let s = 90; s <= 110; s += 0.5) {
      const p = probUp(s, 100, sigma, tau);
      assert.ok(p >= prev - 1e-12);
      prev = p;
    }
    prev = 2;
    for (let k = 90; k <= 110; k += 0.5) {
      const p = probUp(100, k, sigma, tau);
      assert.ok(p <= prev + 1e-12);
      prev = p;
    }
  }
});

test("property: sharpens toward the outcome as time runs out (spot above line)", () => {
  for (let i = 0; i < 300; i++) {
    const sigma = between(0.002, 0.05), spot = 100 * (1 + between(0.001, 0.02));
    const early = probUp(spot, 100, sigma, 1), late = probUp(spot, 100, sigma, 0.05);
    assert.ok(late >= early - 1e-12);
  }
});

test("property: Phi(x) + Phi(-x) = 1", () => {
  for (let x = -5; x <= 5; x += 0.25) near(normalCdf(x) + normalCdf(-x), 1, 3e-7);
});

test("property: edge + price == model probability (fixed payout of 1)", () => {
  for (let i = 0; i < 1000; i++) {
    const p = between(0, 1), a = between(0.01, 0.99);
    near(edgeBps(p, a) / 1e4 + a, p, 1e-12);
    const k = kellyFraction(p, a);
    assert.ok(k >= 0 && k <= 1);
    if (p <= a) assert.equal(k, 0);
  }
});

test("Student-t approximation: symmetric, monotone, and bounded by Phi(sqrt(nu-1.5))", () => {
  const nu = 5.2, cap = normalCdf(Math.sqrt(nu - 1.5));
  let prev = 0;
  for (let x = -50; x <= 50; x += 0.1) {
    const f = studentCdf(x, nu);
    near(f + studentCdf(-x, nu), 1, 1e-12);
    assert.ok(f >= prev - 1e-12);
    assert.ok(f <= cap + 1e-12 && f >= 1 - cap - 1e-12);
    prev = f;
  }
});

test("Student-t approximation vs exact t CDF (scipy, nu=5.2): documented error", () => {
  // Exact values from scipy.stats.t.cdf(x, 5.2). The approximation is tight near 0
  // and diverges in the tails; max |error| over |x|<=8 is 0.0469 near x=2.33.
  const exact = { 0.5: 0.6812427814369866, 1: 0.8192272451742649, 2: 0.9501263994563762, 3: 0.9856719064315327 };
  for (const [x, want] of Object.entries(exact)) {
    const got = studentCdf(Number(x), 5.2);
    assert.ok(Math.abs(got - want) < 0.05, `x=${x}: ${got} vs ${want}`);
  }
  assert.ok(studentCdf(5, 5.2) < 0.97); // exact is 0.99816: the approximation saturates
});
