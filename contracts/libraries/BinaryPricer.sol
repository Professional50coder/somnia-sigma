// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {FixedPointMathLib} from "solady/src/utils/FixedPointMathLib.sol";

/// @title BinaryPricer
/// @author Sigma
/// @notice Pure pricing maths for fixed-payout binary (Up/Down) event contracts.
///
/// @dev A dreamDEX Event Contract asks whether the underlying finishes a fixed
///      window at or above a line. There are no preset strikes: the strike IS
///      the window's opening price. That makes every market at-the-money at
///      t = 0, so fair value is ~0.50 by construction at open and only becomes
///      informative as spot drifts off the line and time decays.
///
///      Because the payout is fixed at 1, the economics collapse exactly. Buying
///      at price `a` costs `a` to win `1 - a`, so expected value is
///      p(1-a) - (1-p)a = p - a. Hence the break-even win rate is exactly the
///      price, and the edge is exactly (model probability - price). No fitting,
///      no approximation.
///
///      Every value is WAD (1e18) fixed point unless the name ends in `Bps`.
///      Validated against scipy.stats.norm — see reference/pricer_reference.py
///      and test/vectors/binary_pricer.json.
library BinaryPricer {
    using FixedPointMathLib for uint256;
    using FixedPointMathLib for int256;

    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 1e4;

    // --- Abramowitz & Stegun 26.2.17 coefficients, |error| < 7.5e-8 ---
    int256 private constant AS_P = 231641900000000000; // 0.2316419
    int256 private constant AS_B1 = 319381530000000000; // 0.319381530
    int256 private constant AS_B2 = -356563782000000000; // -0.356563782
    int256 private constant AS_B3 = 1781477937000000000; // 1.781477937
    int256 private constant AS_B4 = -1821255978000000000; // -1.821255978
    int256 private constant AS_B5 = 1330274429000000000; // 1.330274429

    /// @dev 1/sqrt(2*pi)
    int256 private constant INV_SQRT_2PI = 398942280401432677;

    /// @dev 1/sqrt(3), the volatility scaling for average-settled (Asian) binaries.
    uint256 private constant INV_SQRT_3 = 577350269189625764;

    /// @notice How the contract's settlement price is determined.
    /// @dev dreamDEX settles on a multi-source TERMINAL price compared against
    ///      the opening price, so `Terminal` is the operative path. `Average` is
    ///      retained as a cheap hedge in case a venue ever settles on a window
    ///      mean, which would be an Asian-style binary with effective volatility
    ///      lower by a factor of sqrt(3).
    enum SettlementStyle {
        Terminal,
        Average
    }

    error ZeroVolatility();
    error ZeroTimeRemaining();
    error ZeroPrice();
    error InvalidPrice();

    // -------------------------------------------------------------------------
    // Standard normal CDF
    // -------------------------------------------------------------------------

    /// @notice Standard normal cumulative distribution function, Phi(x).
    /// @param xWad Point at which to evaluate, signed WAD.
    /// @return probWad Phi(x) in WAD, clamped to [0, WAD].
    function normalCdf(int256 xWad) internal pure returns (uint256 probWad) {
        bool negative = xWad < 0;
        int256 x = negative ? -xWad : xWad;

        // t = 1 / (1 + p*x)
        int256 t = int256(WAD).sDivWad(int256(WAD) + AS_P.sMulWad(x));

        // density = exp(-x^2 / 2) / sqrt(2*pi)
        int256 density = INV_SQRT_2PI.sMulWad((-x.sMulWad(x) / 2).expWad());

        // Horner: b1*t + b2*t^2 + b3*t^3 + b4*t^4 + b5*t^5
        int256 poly = AS_B5;
        poly = poly.sMulWad(t) + AS_B4;
        poly = poly.sMulWad(t) + AS_B3;
        poly = poly.sMulWad(t) + AS_B2;
        poly = poly.sMulWad(t) + AS_B1;
        poly = poly.sMulWad(t);

        int256 upper = int256(WAD) - density.sMulWad(poly); // Phi(|x|)
        int256 result = negative ? int256(WAD) - upper : upper;

        if (result <= 0) return 0;
        if (uint256(result) >= WAD) return WAD;
        return uint256(result);
    }

    // -------------------------------------------------------------------------
    // Fair value
    // -------------------------------------------------------------------------

    /// @notice Effective volatility for the given settlement style.
    function effectiveSigma(uint256 sigmaWad, SettlementStyle style) internal pure returns (uint256) {
        if (style == SettlementStyle.Average) return sigmaWad.mulWad(INV_SQRT_3);
        return sigmaWad;
    }

    /// @notice Zero-drift GBM d2 term.
    /// @param spotWad Current price of the underlying, WAD.
    /// @param strikeWad The window's opening price, WAD. Must be in the SAME
    ///        scale as `spotWad` — ln(S/K) is silently wrong otherwise.
    /// @param sigmaWad Volatility over the FULL window, WAD. Not annualised.
    /// @param tauWad Fraction of the window remaining, WAD in (0, 1].
    function d2(
        uint256 spotWad,
        uint256 strikeWad,
        uint256 sigmaWad,
        uint256 tauWad,
        SettlementStyle style
    ) internal pure returns (int256) {
        if (spotWad == 0 || strikeWad == 0) revert ZeroPrice();
        if (sigmaWad == 0) revert ZeroVolatility();
        if (tauWad == 0) revert ZeroTimeRemaining();

        // Volatility scaled to the remaining fraction of the window.
        uint256 sigmaSqrtTau = effectiveSigma(sigmaWad, style).mulWad(tauWad.sqrtWad());
        if (sigmaSqrtTau == 0) revert ZeroVolatility();

        int256 logMoneyness = int256(spotWad.divWad(strikeWad)).lnWad();
        int256 variance = int256(sigmaSqrtTau.mulWad(sigmaSqrtTau) / 2);

        return (logMoneyness - variance).sDivWad(int256(sigmaSqrtTau));
    }

    /// @notice Probability the underlying finishes at or above the strike.
    /// @dev This is the defining number of a dreamDEX Event Contract.
    function probUp(
        uint256 spotWad,
        uint256 strikeWad,
        uint256 sigmaWad,
        uint256 tauWad,
        SettlementStyle style
    ) internal pure returns (uint256 probWad) {
        return normalCdf(d2(spotWad, strikeWad, sigmaWad, tauWad, style));
    }

    // -------------------------------------------------------------------------
    // Economics
    // -------------------------------------------------------------------------

    /// @notice Model edge over the book, in basis points.
    /// @dev Positive means the contract is CHEAP relative to the model. For a
    ///      fixed payout of 1, expected value is exactly (p - a).
    function edgeBps(uint256 modelProbWad, uint256 priceWad) internal pure returns (int256) {
        if (priceWad == 0 || priceWad >= WAD) revert InvalidPrice();
        int256 diff = int256(modelProbWad) - int256(priceWad);
        return (diff * int256(BPS)) / int256(WAD);
    }

    /// @notice The win rate required merely to break even at this price.
    /// @dev For a fixed-payout binary this is exactly the price. Pay 0.70 and
    ///      you must be right more than 70% of the time to come out level.
    function breakEvenWinRateBps(uint256 priceWad) internal pure returns (uint256) {
        if (priceWad == 0 || priceWad >= WAD) revert InvalidPrice();
        return (priceWad * BPS) / WAD;
    }

    /// @notice Kelly-optimal fraction of bankroll to stake.
    /// @dev f* = p - (1-p)*a/(1-a). Returns 0 when the edge is not positive, so
    ///      a caller can use this as its own trade/no-trade gate.
    function kellyFractionWad(uint256 modelProbWad, uint256 priceWad) internal pure returns (uint256) {
        if (priceWad == 0 || priceWad >= WAD) revert InvalidPrice();
        if (modelProbWad <= priceWad) return 0;

        uint256 lossTerm = (WAD - modelProbWad).mulWad(priceWad.divWad(WAD - priceWad));
        if (lossTerm >= modelProbWad) return 0;

        uint256 f = modelProbWad - lossTerm;
        return f > WAD ? WAD : f;
    }

    // -------------------------------------------------------------------------
    // Student-t CDF (fat-tail model)
    // -------------------------------------------------------------------------

    /// @dev 1.5 in WAD
    int256 private constant WAD_15 = 1500000000000000000;
    /// @dev 0.5 in WAD
    int256 private constant WAD_05 = 500000000000000000;

    /// @notice Student-t cumulative distribution function.
    /// @dev Uses the Abramowitz & Stegun approximation (26.7.5):
    ///      F(x; ν) ≈ Φ(x · g) where g = √((ν - 1.5) / (ν + x² - 0.5))
    ///      This is accurate to ~10⁻³ for ν > 2, which is sufficient for
    ///      on-chain pricing (the Gaussian model's tail error was 10-100x worse).
    ///
    /// @param xWad Point at which to evaluate, signed WAD.
    /// @param nuWad Degrees of freedom, WAD. Must be > 2 for finite variance.
    ///        Lower values = heavier tails. Typical range: 3-8 for BTC intraday.
    /// @return probWad Student-t CDF value in WAD, clamped to [0, WAD].
    function studentCdf(int256 xWad, uint256 nuWad) internal pure returns (uint256 probWad) {
        bool negative = xWad < 0;
        int256 x = negative ? -xWad : xWad;

        // g = sqrt((nu - 1.5) / (nu + x^2 - 0.5))
        int256 xSq = x.sMulWad(x);
        int256 nuMinus15 = int256(nuWad) - WAD_15;
        int256 nuPlusXSqMinus05 = int256(nuWad) + xSq - WAD_05;

        if (nuPlusXSqMinus05 <= 0) return negative ? 0 : WAD;
        if (nuMinus15 <= 0) {
            // For very small nu (<= 1.5), fall back to normal CDF
            return normalCdf(xWad);
        }

        // g² = (nu - 1.5) / (nu + x² - 0.5)
        int256 gSq = nuMinus15 * int256(WAD) / nuPlusXSqMinus05;
        if (gSq <= 0) return normalCdf(xWad);
        uint256 g = uint256(gSq).sqrtWad();

        // F(x; ν) = Φ(x * g)
        int256 xg = x.sMulWad(int256(g));
        int256 adjustedX = negative ? -xg : xg;
        return normalCdf(adjustedX);
    }

    /// @notice Probability the underlying finishes at or above the strike,
    ///      using the Student-t distribution for fat-tail modeling.
    /// @param spotWad Current price of the underlying, WAD.
    /// @param strikeWad The window's opening price, WAD.
    /// @param sigmaWad Volatility over the FULL window, WAD. Not annualised.
    /// @param tauWad Fraction of the window remaining, WAD in (0, 1].
    /// @param nuWad Degrees of freedom for the Student-t distribution, WAD.
    ///        Lower values = heavier tails. Typical range: 3-8 for BTC.
    /// @param style Settlement style (Terminal or Average).
    function studentProbUp(
        uint256 spotWad,
        uint256 strikeWad,
        uint256 sigmaWad,
        uint256 tauWad,
        uint256 nuWad,
        SettlementStyle style
    ) internal pure returns (uint256 probWad) {
        int256 d2Val = d2(spotWad, strikeWad, sigmaWad, tauWad, style);
        return studentCdf(d2Val, nuWad);
    }
}
