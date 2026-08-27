// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BinaryPricer} from "../libraries/BinaryPricer.sol";

/// @notice Test-only external surface for the BinaryPricer library.
/// @dev A library's internal functions are not externally callable, so tests
///      go through this thin harness. Not deployed to any live network.
contract BinaryPricerHarness {
    function normalCdf(int256 xWad) external pure returns (uint256) {
        return BinaryPricer.normalCdf(xWad);
    }

    function d2(
        uint256 spotWad,
        uint256 strikeWad,
        uint256 sigmaWad,
        uint256 tauWad,
        BinaryPricer.SettlementStyle style
    ) external pure returns (int256) {
        return BinaryPricer.d2(spotWad, strikeWad, sigmaWad, tauWad, style);
    }

    function probUp(
        uint256 spotWad,
        uint256 strikeWad,
        uint256 sigmaWad,
        uint256 tauWad,
        BinaryPricer.SettlementStyle style
    ) external pure returns (uint256) {
        return BinaryPricer.probUp(spotWad, strikeWad, sigmaWad, tauWad, style);
    }

    function edgeBps(uint256 modelProbWad, uint256 priceWad) external pure returns (int256) {
        return BinaryPricer.edgeBps(modelProbWad, priceWad);
    }

    function breakEvenWinRateBps(uint256 priceWad) external pure returns (uint256) {
        return BinaryPricer.breakEvenWinRateBps(priceWad);
    }

    function kellyFractionWad(uint256 modelProbWad, uint256 priceWad) external pure returns (uint256) {
        return BinaryPricer.kellyFractionWad(modelProbWad, priceWad);
    }
}
