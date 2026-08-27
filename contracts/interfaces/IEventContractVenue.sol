// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IEventContractVenue
/// @author Sigma
/// @notice The minimal surface SigmaOracle needs in order to price an Event
///         Contract window.
///
/// @dev This interface exists to isolate one genuine uncertainty: dreamDEX
///      binary markets are discovered off-chain through a GraphQL indexer
///      (`listBinaryMarkets`), not through the REST market list, so an on-chain
///      oracle cannot simply enumerate them. There are two ways to satisfy this
///      interface and the rest of the system does not care which is used:
///
///        1. READ-THROUGH — a thin adapter that reads the per-window
///           `BinaryMarket` clone contract directly for strike and timings.
///        2. PUSH — a registry that a permissioned publisher keeps current from
///           indexer data.
///
///      Field names mirror the SDK's `BinaryMarket` type so the mapping stays
///      obvious: `strike`, `tradingStart`, `expiry`.
///
///      Note on naming: the SDK calls the two sides YES and NO
///      (`winningOutcome` 0 = YES, 1 = NO). YES corresponds to Up — the
///      underlying finishing at or above the opening price.
interface IEventContractVenue {
    /// @notice One Event Contract window.
    /// @dev `strike` is the window's OPENING price. dreamDEX has no preset
    ///      strikes: "there is one line to beat: the window's opening price".
    ///      It is expressed in the oracle's own price scale, which is NOT
    ///      necessarily WAD — see `priceScale()`.
    struct Window {
        bytes32 marketId;
        bytes32 asset; // e.g. bytes32("BTC")
        uint256 strike; // the opening price, in oracle price scale
        uint64 tradingStart; // unix seconds
        uint64 expiry; // unix seconds
        uint32 intervalSec; // 900 | 3600 | 14400 | 86400
        bool settled;
        bool outcomeUp; // meaningful only once settled
        bool voided; // both sides redeem 0.5
    }

    /// @notice Number of decimals the oracle's prices (and `strike`) carry.
    /// @dev Read, never assumed. Comparing a WAD spot against a differently
    ///      scaled strike makes ln(S/K) silently wrong by orders of magnitude,
    ///      and the resulting fair value looks plausible rather than broken.
    function priceScale() external view returns (uint8);

    /// @notice Markets currently open for trading.
    function openWindows() external view returns (bytes32[] memory);

    /// @notice Full detail for one window.
    function getWindow(bytes32 marketId) external view returns (Window memory);

    /// @notice Best ask for the Up (YES) side, WAD in (0,1).
    /// @dev A binary's price IS a probability, so this is directly comparable
    ///      with the model's output. Reverts when there is no book.
    function bestAskUpWad(bytes32 marketId) external view returns (uint256);

    /// @notice Current price of the window's underlying, in the oracle's scale.
    /// @dev Returns ok=false rather than a stale or zero price. Underlying spot
    ///      is deliberately not assumed to be present — the dreamDEX Bot Kit
    ///      documents that spot is absent from market rows.
    function spot(bytes32 marketId) external view returns (uint256 price, bool ok);
}
