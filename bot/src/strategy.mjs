/**
 * Sigma strategy — edge-based decision logic for dreamDEX Event Contracts.
 *
 * Reads fair value from the deployed SigmaOracle, compares it against the
 * live book, and decides: skip, buy YES, or buy NO.
 *
 * This module is pure decision logic — no SDK calls, no signing.
 * The caller (run-dry-run.mjs or a live bot) provides the data.
 *
 * Inputs:
 *   fairValue: { fairProbBps, edgeBps, breakEvenBps, ok, ... } from SigmaOracle.getFairValue()
 *   bookPrice: number in (0, 1) — best ask for the side we'd trade
 *   side:      "buyYes" | "buyNo" — which side has positive edge
 *
 * Outputs:
 *   { action, side, edge, kelly, sizeRaw, priceRaw, reason }
 */

import { quantizePrice, quantizeSize, complementPrice } from "./quantize.mjs";

// ── Config (defaults, overridden via env) ────────────────────────────────────

const MIN_EDGE_BPS = Number(process.env.SIGMA_MIN_EDGE_BPS ?? 200);
const MAX_STAKE_USDC = Number(process.env.SIGMA_MAX_STAKE ?? 25);
const ONE_COLLATERAL = 1_000_000n; // tUSDC: 6 decimals
const ONE_BASE = 1_000_000n;       // tUSDC base decimals
const TICK_SIZE = 1000n;           // Shannon binary tick grid
const LOT_SIZE = 1000n;            // Shannon binary lot grid

// ── Safe BigInt-to-Number conversion ─────────────────────────────────────────
// On-chain returns int256/uint256 as BigInt. Math.abs(BigInt) throws.
// These helpers handle both BigInt and number inputs safely.

function toNum(v) {
  if (typeof v === "bigint") return Number(v);
  return v;
}

function absBps(v) {
  return Math.abs(toNum(v));
}

// ── Normalised fair probability from on-chain bps ────────────────────────────

function fairProbFromBps(fairProbBps) {
  return toNum(fairProbBps) / 10_000;
}

// ── Core decision function ───────────────────────────────────────────────────

/**
 * Evaluate whether to trade a given market.
 *
 * @param {Object} fairValue - from SigmaOracle.getFairValue(marketId)
 * @param {number} bookPrice - best ask price for the side we'd trade, in (0, 1)
 * @param {"buyYes"|"buyNo"} preferredSide - which side we're evaluating
 * @param {Object} [opts] - overrides
 * @returns {Object} decision
 */
export function evaluate(fairValue, bookPrice, preferredSide, opts = {}) {
  const minEdgeBps = opts.minEdgeBps ?? MIN_EDGE_BPS;
  const maxStake = opts.maxStake ?? MAX_STAKE_USDC;
  const tickSize = opts.tickSize ?? TICK_SIZE;
  const lotSize = opts.lotSize ?? LOT_SIZE;

  // ── Gate: oracle not ok ──────────────────────────────────────────────────
  if (!fairValue || !fairValue.ok) {
    return {
      action: "skip",
      reason: fairValue?.reason !== undefined ? `not-ok reason=${fairValue.reason}` : "no fair value",
      edge: 0,
      kelly: 0,
    };
  }

  const { fairProbBps, edgeBps, kellyWad } = fairValue;
  const edgeNum = toNum(edgeBps);

  // ── Gate: edge too small ─────────────────────────────────────────────────
  const absEdgeBps = absBps(edgeBps);
  if (absEdgeBps < minEdgeBps) {
    return {
      action: "skip",
      reason: `edge ${absEdgeBps} bps < min ${minEdgeBps} bps`,
      edge: edgeNum,
      kelly: toNum(kellyWad) / 1e18,
    };
  }

  // ── Determine actual side from edge sign ─────────────────────────────────
  // positive edgeBps → fair > book → buy YES is +EV
  // negative edgeBps → fair < book → buy NO is +EV (book is overpricing YES)
  let side, ourPrice;
  if (edgeNum > 0) {
    side = "buyYes";
    ourPrice = bookPrice; // the ask we'd hit
  } else {
    side = "buyNo";
    ourPrice = 1 - bookPrice; // NO ask = 1 - YES ask
  }

  // ── Kelly sizing ─────────────────────────────────────────────────────────
  // KellyWad is in 1e18 fixed-point
  const kelly = toNum(kellyWad) / 1e18;
  const kellyCapped = Math.max(0, Math.min(kelly, 0.25)); // hard cap at 25%

  // Quantize size to lot grid
  const stakeSnap = quantizeSize(kellyCapped * maxStake, lotSize, ONE_BASE);
  if (stakeSnap <= 0n) {
    return {
      action: "skip",
      reason: "kelly sizing floors to zero lots",
      edge: edgeNum,
      kelly,
      side,
    };
  }

  // ── Quantize price to tick grid ──────────────────────────────────────────
  let priceRaw;
  if (side === "buyYes") {
    priceRaw = quantizePrice(ourPrice, tickSize, ONE_COLLATERAL);
  } else {
    // For NO side: priceYesRaw = ONE_COLLATERAL - quantized NO price
    const noQuantized = quantizePrice(ourPrice, tickSize, ONE_COLLATERAL);
    priceRaw = complementPrice(noQuantized, ONE_COLLATERAL);
  }

  return {
    action: "trade",
    side,
    edge: edgeNum,
    kelly,
    kellyCapped,
    sizeRaw: stakeSnap,
    priceRaw,
    fairProbBps: toNum(fairProbBps),
    bookPriceRaw: side === "buyYes"
      ? quantizePrice(bookPrice, tickSize, ONE_COLLATERAL)
      : complementPrice(quantizePrice(1 - bookPrice, tickSize, ONE_COLLATERAL), ONE_COLLATERAL),
  };
}

// ── Trade record for track record ────────────────────────────────────────────

/**
 * Create a trade record entry.
 * @param {string} marketId
 * @param {Object} decision - from evaluate()
 * @param {Object} fairValue - raw from oracle
 * @returns {Object} record
 */
export function createTradeRecord(marketId, decision, fairValue) {
  return {
    marketId,
    timestamp: Date.now(),
    side: decision.side,
    edgeBps: decision.edge,
    kelly: decision.kellyCapped ?? decision.kelly,
    sizeRaw: decision.sizeRaw?.toString() ?? "0",
    priceRaw: decision.priceRaw?.toString() ?? "0",
    fairProbBps: toNum(fairValue.fairProbBps),
    sigmaWad: toNum(fairValue.sigmaWad),
    tauWad: toNum(fairValue.tauWad),
    ok: true,
    settled: false,
    won: null,
    realizedEdgeBps: null,
  };
}
