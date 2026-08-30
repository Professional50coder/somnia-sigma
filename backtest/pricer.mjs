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

/**
 * Student-t cumulative distribution function.
 * Uses the Abramowitz & Stegun approximation:
 * F(x; nu) ≈ Phi(x * g) where g = sqrt((nu - 1.5) / (nu + x^2 - 0.5))
 * Accurate to ~1e-3 for nu > 2.
 */
export function studentCdf(x, nu) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  // g = sqrt((nu - 1.5) / (nu + x^2 - 0.5))
  const gSq = (nu - 1.5) / (nu + x * x - 0.5);
  const g = Math.sqrt(Math.max(0, gSq));

  return normalCdf(sign * x * g);
}

/**
 * Student-t version of probUp: uses Student-t CDF instead of Gaussian.
 */
export function studentProbUp(spot, strike, sigma, tau, nu) {
  return studentCdf(d2(spot, strike, sigma, tau), nu);
}

/**
 * Compare Gaussian vs Student-t for given parameters.
 * Returns { gaussian, studentT } probabilities.
 */
export function compareModels(spot, strike, sigma, tau, nu) {
  return {
    gaussian: probUp(spot, strike, sigma, tau),
    studentT: studentProbUp(spot, strike, sigma, tau, nu),
  };
}

/**
 * Estimate optimal nu (degrees of freedom) from return series.
 * Uses method of moments: kurtosis of Student-t = 6/(nu-4) for nu > 4.
 * excess_kurtosis = mean((r - mean)^4) / std^4 - 3
 * nu = 4 + 6 / excess_kurtosis (clamped to [2.5, 30])
 */
export function estimateNu(returns) {
  const n = returns.length;
  if (n < 10) return 5; // default fallback

  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const m2 = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const m4 = returns.reduce((s, r) => s + (r - mean) ** 4, 0) / n;

  const kurtosis = m4 / (m2 * m2); // excess + 3
  const excessKurtosis = kurtosis - 3;

  if (excessKurtosis <= 0.01) return 30; // near-Gaussian
  const nu = 4 + 6 / excessKurtosis;
  return Math.max(2.5, Math.min(30, nu));
}
