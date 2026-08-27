import { test } from "node:test";
import assert from "node:assert/strict";
import { quantizePrice, complementPrice, quantizeSize, isOnGrid } from "./quantize.mjs";

// Measured on Shannon (docs/INTEGRATION.md §6), all four live pools, both venues.
const TICK = 1000n;
const ONE_COLLATERAL = 1_000_000n; // 6-decimal collateral
const LOT = 1000n;
const ONE_BASE = 1_000_000n; // outcome tokens also read as 6dp on this venue

test("0.6237 -> 0.624 (the documented worked example)", () => {
  const raw = quantizePrice(0.6237, TICK, ONE_COLLATERAL);
  assert.equal(raw, 624000n);
  assert.equal(Number(raw) / Number(ONE_COLLATERAL), 0.624);
});

test("every output is an exact multiple of tickSize", () => {
  const probes = [0.0001, 0.001, 0.0499, 0.05, 0.5, 0.6237, 0.9999, 0.001234];
  for (const p of probes) {
    const raw = quantizePrice(p, TICK, ONE_COLLATERAL);
    assert.ok(isOnGrid(raw, TICK), `${p} -> ${raw} not on ${TICK} grid`);
  }
});

test("clamps into [tick, one-tick] -- a binary may not rest at 0 or 1", () => {
  const nearZero = quantizePrice(0.00001, TICK, ONE_COLLATERAL);
  assert.equal(nearZero, TICK, "must clamp up to the first valid tick, never 0");

  const nearOne = quantizePrice(0.99999, TICK, ONE_COLLATERAL);
  assert.equal(nearOne, ONE_COLLATERAL - TICK, "must clamp down to the last valid tick, never one");
});

test("rejects probability outside the open interval (0,1)", () => {
  assert.throws(() => quantizePrice(0, TICK, ONE_COLLATERAL), RangeError);
  assert.throws(() => quantizePrice(1, TICK, ONE_COLLATERAL), RangeError);
  assert.throws(() => quantizePrice(-0.1, TICK, ONE_COLLATERAL), RangeError);
  assert.throws(() => quantizePrice(1.1, TICK, ONE_COLLATERAL), RangeError);
});

test("YES + NO price sum to exactly `one`, for a sweep of probabilities", () => {
  const probes = [0.0001, 0.05, 0.1234, 0.3, 0.5, 0.6237, 0.7, 0.9, 0.9999];
  for (const p of probes) {
    const yes = quantizePrice(p, TICK, ONE_COLLATERAL);
    const no = complementPrice(yes, ONE_COLLATERAL);
    assert.equal(yes + no, ONE_COLLATERAL, `mismatch at p=${p}: yes=${yes} no=${no}`);
    assert.ok(isOnGrid(no, TICK), `NO side ${no} not on grid at p=${p}`);
  }
});

test("a fair value below one tick still produces a valid on-grid order, never a revert", () => {
  // 0.00001 is far below one tick (0.001); must clamp to the minimum valid
  // tick rather than round to 0 (which would be an invalid/degenerate price).
  const raw = quantizePrice(0.00001, TICK, ONE_COLLATERAL);
  assert.ok(raw > 0n, "must never be zero");
  assert.ok(isOnGrid(raw, TICK));
  assert.equal(raw, TICK);
});

test("quantizeSize floors to the lot grid, never rounds up (never risk more than decided)", () => {
  // 12.5 outcome tokens at lot=1000 raw (0.001 tokens) on a 6dp base:
  // rawDesired = 12_500_000n, floor to nearest 1000n multiple -> unchanged here.
  const sized = quantizeSize(12.5, LOT, ONE_BASE);
  assert.equal(sized, 12_500_000n);
  assert.ok(isOnGrid(sized, LOT));
});

test("quantizeSize floors a non-grid-aligned amount down, not up", () => {
  // 0.0015 tokens -> raw 1500n -> floor to nearest 1000n multiple -> 1000n.
  const sized = quantizeSize(0.0015, LOT, ONE_BASE);
  assert.equal(sized, 1000n);
});

test("quantizeSize returns 0 for a non-positive or sub-lot desire, never negative or a revert", () => {
  assert.equal(quantizeSize(0, LOT, ONE_BASE), 0n);
  assert.equal(quantizeSize(-5, LOT, ONE_BASE), 0n);
  // 0.0000001 tokens floors to 0 raw, then 0 lots -- a clean skip, not an order.
  assert.equal(quantizeSize(0.0000001, LOT, ONE_BASE), 0n);
});

test("complementPrice never independently rounds -- exact integer subtraction only", () => {
  // Regression guard: if this were ever reimplemented as its own quantizePrice(1-p,...)
  // call, floating point could put it off-grid or off by one tick from `one - yes`.
  const yes = 999000n; // p ~= 0.999
  const no = complementPrice(yes, ONE_COLLATERAL);
  assert.equal(no, 1000n);
  assert.equal(yes + no, ONE_COLLATERAL);
});
