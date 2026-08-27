// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IEventContractVenue} from "../interfaces/IEventContractVenue.sol";

/// @notice Deterministic stand-in for a dreamDEX Event Contract venue.
/// @dev Used for unit tests and as the fallback demo path. It implements the
///      same interface the live adapter will, so nothing downstream changes
///      when the real one is swapped in. Deliberately permissionless: it is a
///      test double and is never deployed as production infrastructure.
contract MockEventContractVenue is IEventContractVenue {
    error NoBook();
    error UnknownWindow();

    uint8 private _priceScale;

    mapping(bytes32 => Window) private _windows;
    mapping(bytes32 => uint256) private _askUp;
    mapping(bytes32 => uint256) private _spot;
    mapping(bytes32 => bool) private _spotOk;
    bytes32[] private _all;

    constructor(uint8 priceScale_) {
        _priceScale = priceScale_;
    }

    // --- IEventContractVenue -------------------------------------------------

    function priceScale() external view returns (uint8) {
        return _priceScale;
    }

    function openWindows() external view returns (bytes32[] memory) {
        uint256 n;
        for (uint256 i; i < _all.length; ++i) {
            if (!_windows[_all[i]].settled) ++n;
        }
        bytes32[] memory out = new bytes32[](n);
        uint256 j;
        for (uint256 i; i < _all.length; ++i) {
            if (!_windows[_all[i]].settled) out[j++] = _all[i];
        }
        return out;
    }

    function getWindow(bytes32 marketId) external view returns (Window memory) {
        return _windows[marketId];
    }

    function bestAskUpWad(bytes32 marketId) external view returns (uint256) {
        uint256 a = _askUp[marketId];
        if (a == 0) revert NoBook();
        return a;
    }

    function spot(bytes32 marketId) external view returns (uint256 price, bool ok) {
        return (_spot[marketId], _spotOk[marketId]);
    }

    // --- test controls -------------------------------------------------------

    function createWindow(
        bytes32 marketId,
        bytes32 asset,
        uint256 strike,
        uint64 tradingStart,
        uint64 expiry,
        uint32 intervalSec
    ) external {
        _windows[marketId] = Window({
            marketId: marketId,
            asset: asset,
            strike: strike,
            tradingStart: tradingStart,
            expiry: expiry,
            intervalSec: intervalSec,
            settled: false,
            outcomeUp: false,
            voided: false
        });
        _all.push(marketId);
    }

    function setBook(bytes32 marketId, uint256 askUpWad) external {
        _askUp[marketId] = askUpWad;
    }

    function clearBook(bytes32 marketId) external {
        _askUp[marketId] = 0;
    }

    function setSpot(bytes32 marketId, uint256 price, bool ok) external {
        _spot[marketId] = price;
        _spotOk[marketId] = ok;
    }

    function settle(bytes32 marketId, bool outcomeUp) external {
        Window storage w = _windows[marketId];
        if (w.marketId == bytes32(0)) revert UnknownWindow();
        w.settled = true;
        w.outcomeUp = outcomeUp;
    }

    function voidWindow(bytes32 marketId) external {
        Window storage w = _windows[marketId];
        if (w.marketId == bytes32(0)) revert UnknownWindow();
        w.settled = true;
        w.voided = true;
    }
}
