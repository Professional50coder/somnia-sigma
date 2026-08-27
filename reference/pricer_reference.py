"""Reference implementation of the Sigma binary pricer.

SciPy is the source of truth. This script generates golden vectors that the
Solidity library is tested against, so that the on-chain maths is validated
against an independent, well-established implementation rather than against
itself.

The instrument being priced: a dreamDEX Event Contract is a fixed-payout binary
on whether the underlying finishes at or above the window's OPENING price.
There are no preset strikes -- the strike IS the opening price -- so every
market is at-the-money at t=0 and fair value only becomes informative as spot
drifts off that line and time decays.

Run:  ./.venv/Scripts/python.exe reference/pricer_reference.py
"""

import json
import math
import os

from scipy.stats import norm

WAD = 10**18


def d2(spot: float, strike: float, sigma: float, tau: float) -> float:
    """Zero-drift GBM d2 for a terminal-price binary.

    sigma is volatility over the FULL window (not annualised); tau is the
    fraction of that window still remaining, in (0, 1].
    """
    sigma_sqrt_tau = sigma * math.sqrt(tau)
    return (math.log(spot / strike) - 0.5 * sigma_sqrt_tau**2) / sigma_sqrt_tau


def prob_up(spot: float, strike: float, sigma: float, tau: float) -> float:
    """P(S_T >= K) under zero-drift GBM."""
    return float(norm.cdf(d2(spot, strike, sigma, tau)))


def _trunc_div(numerator: int, denominator: int) -> int:
    """Integer division truncating toward zero, matching Solidity's semantics.

    Python's // floors, which differs from Solidity for negative values.
    """
    q = abs(numerator) // abs(denominator)
    return -q if (numerator < 0) != (denominator < 0) else q


def edge_bps(model_prob: float, price: float) -> int:
    """Model edge over the book, in basis points.

    For a fixed payout of 1, buying at price `a` costs `a` to win `1 - a`, so
    expected value is p(1-a) - (1-p)a = p - a exactly. No approximation.

    Computed in exact WAD integer arithmetic rather than on floats. Doing this
    in floating point silently truncates: 0.70 - 0.60 evaluates to
    0.09999999999999998, so `int(... * 10_000)` yields 999 instead of 1000.
    The Solidity is exact here, so the reference must be too, or the vectors
    would assert a wrong value against correct on-chain maths.
    """
    diff = int(round(model_prob * WAD)) - int(round(price * WAD))
    return _trunc_div(diff * 10_000, WAD)


def break_even_bps(price: float) -> int:
    """Break-even win rate in bps -- exactly the price, in WAD integer maths."""
    return _trunc_div(int(round(price * WAD)) * 10_000, WAD)


def kelly_fraction(model_prob: float, price: float) -> float:
    """f* = p - (1-p)*a/(1-a); zero when the edge is not positive."""
    if model_prob <= price:
        return 0.0
    f = model_prob - (1.0 - model_prob) * price / (1.0 - price)
    return max(0.0, min(1.0, f))


def to_wad(x: float) -> str:
    return str(int(round(x * WAD)))


# (spot, strike, sigma_over_window, tau_fraction_remaining)
#
# Strike equals the window's opening price, so the realistic cases are spot
# hovering within a fraction of a percent of strike -- which is exactly where
# a 15-minute BTC window lives.
PRICER_CASES = [
    (100_000.0, 100_000.0, 0.010, 1.00),   # at the money, full window
    (100_000.0, 100_000.0, 0.010, 0.50),   # ATM, half the window gone
    (100_000.0, 100_000.0, 0.010, 0.05),   # ATM, nearly expired
    (100_300.0, 100_000.0, 0.010, 0.50),   # drifted up 0.3%, half left
    (100_300.0, 100_000.0, 0.010, 0.10),   # drifted up 0.3%, nearly expired
    ( 99_700.0, 100_000.0, 0.010, 0.10),   # drifted down 0.3%, nearly expired
    (100_100.0, 100_000.0, 0.005, 0.25),   # small move, low vol
    (100_800.0, 100_000.0, 0.020, 1.00),   # large move, high vol, full window
    (  3_500.0,   3_500.0, 0.015, 1.00),   # ETH scale, ATM
    (  3_512.0,   3_500.0, 0.015, 0.40),   # ETH scale, drifted up, partial
]

# Standard normal CDF vectors, to test the Phi implementation in isolation.
PHI_POINTS = [
    -5.0, -4.0, -3.0, -2.0, -1.5, -1.0, -0.5, -0.1, 0.0,
    0.1, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0,
]

# (model_prob, price) for the economics functions.
ECON_CASES = [
    (0.70, 0.60),
    (0.40, 0.55),
    (0.50, 0.50),
    (0.85, 0.70),
    (0.99, 0.01),
    (0.55, 0.54),
]


def main() -> None:
    pricer = []
    for spot, strike, sigma, tau in PRICER_CASES:
        pricer.append({
            "spot": to_wad(spot),
            "strike": to_wad(strike),
            "sigma": to_wad(sigma),
            "tau": to_wad(tau),
            "d2": to_wad(d2(spot, strike, sigma, tau)),
            "prob": to_wad(prob_up(spot, strike, sigma, tau)),
            "_note": f"S={spot} K={strike} sigma={sigma} tau={tau}",
        })

    phi = [
        {"x": to_wad(x), "cdf": to_wad(float(norm.cdf(x)))}
        for x in PHI_POINTS
    ]

    econ = [
        {
            "prob": to_wad(p),
            "price": to_wad(a),
            "edgeBps": str(edge_bps(p, a)),
            "breakEvenBps": str(break_even_bps(a)),
            "kelly": to_wad(kelly_fraction(p, a)),
        }
        for p, a in ECON_CASES
    ]

    os.makedirs("test/vectors", exist_ok=True)
    path = "test/vectors/binary_pricer.json"
    with open(path, "w") as fh:
        json.dump({"pricer": pricer, "phi": phi, "econ": econ}, fh, indent=2)

    print(f"wrote {len(pricer)} pricer, {len(phi)} phi, {len(econ)} econ vectors -> {path}")

    # Sanity anchors, printed so a human can eyeball them without opening JSON.
    atm = prob_up(100_000.0, 100_000.0, 0.01, 1.0)
    print(f"  ATM full window      -> {atm:.6f}   (expect just under 0.5)")
    drift = prob_up(100_300.0, 100_000.0, 0.01, 0.10)
    print(f"  +0.3% near expiry    -> {drift:.6f}   (expect strongly above 0.5)")
    down = prob_up(99_700.0, 100_000.0, 0.01, 0.10)
    print(f"  -0.3% near expiry    -> {down:.6f}   (expect strongly below 0.5)")


if __name__ == "__main__":
    main()
