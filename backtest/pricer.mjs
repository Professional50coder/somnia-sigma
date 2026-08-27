// TypeScript-semantics port of contracts/libraries/BinaryPricer.sol, executed
// as plain ESM for a zero-build backtest run. Float-based (the backtest works
// in probability space, not WAD integers) but the SAME formulas as the
// Solidity, and normalCdf is checked directly against the SciPy golden
// vectors in test/vectors/binary_pricer.json (see validate-pricer.mjs).

// Abramowitz & Stegun 7.1.26 erf approximation, |error| <= 1.5e-7 -- ample
// precision for comparing against scipy.stats.norm at 1e-6 tolerance.
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

export function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

// Zero-drift GBM d2 for a terminal-price binary. sigma is volatility over the
// FULL window (not annualised); tau is the fraction of the window remaining.
export function d2(spot, strike, sigma, tau) {
  const sigmaSqrtTau = sigma * Math.sqrt(tau);
  return (Math.log(spot / strike) - 0.5 * sigmaSqrtTau * sigmaSqrtTau) / sigmaSqrtTau;
}

export function probUp(spot, strike, sigma, tau) {
  return normalCdf(d2(spot, strike, sigma, tau));
}

// For a fixed payout of 1, buying at price `a` costs `a` to win `1-a`, so
// expected value is exactly p - a.
export function edgeBps(modelProb, price) {
  return (modelProb - price) * 10_000;
}

export function breakEvenBps(price) {
  return price * 10_000;
}

export function kellyFraction(modelProb, price) {
  if (modelProb <= price) return 0;
  const f = modelProb - (1 - modelProb) * (price / (1 - price));
  return Math.max(0, Math.min(1, f));
}
