// Quantization for dreamDEX binary-market prices/sizes.
//
// The venue's tick/lot grid is NOT on the market row (BinaryMarket carries no
// tickSize/lotSize/minQuantity — those fields are null on every binary row).
// Source of truth is client.getBinaryBookParams(pool), read at runtime.
// Measured on Shannon (docs/INTEGRATION.md §6): tickSize = lotSize =
// minQuantity = 1000n on 6-decimal collateral (oneCollateral = 1_000_000n).
//
// NEVER use parseUnits(x.toFixed(18), 18) to build a price. That is the
// documented InvalidPrice trap: (0.05).toFixed(18) === "0.050000000000000003",
// three wei off an 18-decimal tick, and the pool reverts. It rounds away on
// Shannon's 6-decimal collateral (which is exactly why it would be missed
// here and appear for the first time on mainnet) -- so this module works
// entirely in BigInt space from the start, never via string-formatted floats.

/**
 * Snap a human probability (0 < p < 1) onto the venue's YES-price tick grid.
 * @param {number} probability - model fair value in (0, 1), e.g. 0.6237
 * @param {bigint} tickSize - raw tick size, e.g. 1000n
 * @param {bigint} oneCollateral - 10n ** BigInt(quoteDecimals), e.g. 1_000_000n
 * @returns {bigint} priceYesRaw - an exact multiple of tickSize, clamped into
 *          [tickSize, oneCollateral - tickSize] (a binary may not rest at
 *          exactly 0 or 1).
 */
export function quantizePrice(probability, tickSize, oneCollateral) {
  if (!(probability > 0 && probability < 1)) {
    throw new RangeError(`probability out of (0,1): ${probability}`);
  }
  if (tickSize <= 0n || oneCollateral <= 0n) {
    throw new RangeError("tickSize and oneCollateral must be positive");
  }
  const steps = oneCollateral / tickSize; // e.g. 1000n
  if (steps <= 0n) throw new RangeError("oneCollateral must exceed tickSize");

  // Round to nearest step in bigint space. Scale probability up before
  // rounding so we never touch a floating decimal-string representation.
  const scaled = probability * Number(steps);
  let stepIndex = BigInt(Math.round(scaled));

  const minStep = 1n;
  const maxStep = steps - 1n;
  if (stepIndex < minStep) stepIndex = minStep;
  if (stepIndex > maxStep) stepIndex = maxStep;

  return stepIndex * tickSize;
}

/**
 * The complementary NO-side price. Integer subtraction, so it stays exactly
 * on-grid whenever priceYesRaw is (no independent rounding to drift it off).
 */
export function complementPrice(priceYesRaw, oneCollateral) {
  return oneCollateral - priceYesRaw;
}

/**
 * Snap a desired stake size down onto the lot grid (floors -- a strategy
 * must never send MORE size than it decided to risk).
 * @param {number} desiredHuman - desired size in whole outcome tokens, e.g. 12.5
 * @param {bigint} lotSize
 * @param {bigint} oneBase - 10n ** BigInt(baseDecimals)
 * @returns {bigint} an exact multiple of lotSize, or 0n if it floors to nothing
 */
export function quantizeSize(desiredHuman, lotSize, oneBase) {
  if (desiredHuman <= 0) return 0n;
  if (lotSize <= 0n || oneBase <= 0n) {
    throw new RangeError("lotSize and oneBase must be positive");
  }
  const rawDesired = BigInt(Math.floor(desiredHuman * Number(oneBase)));
  const lots = rawDesired / lotSize; // floor, integer division
  return lots * lotSize;
}

/**
 * True if `raw` is an exact non-negative multiple of `step`.
 */
export function isOnGrid(raw, step) {
  return raw >= 0n && raw % step === 0n;
}
