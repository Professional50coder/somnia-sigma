function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function probUp(spot: number, strike: number, sigma: number, tau: number): number {
  const sigmaSqrtTau = sigma * Math.sqrt(tau);
  const d2 = (Math.log(spot / strike) - 0.5 * sigmaSqrtTau * sigmaSqrtTau) / sigmaSqrtTau;
  return normalCdf(d2);
}
