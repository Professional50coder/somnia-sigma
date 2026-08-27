// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {RealizedVol} from "./RealizedVol.sol";
import {SigmaWindowRegistry} from "./SigmaWindowRegistry.sol";
import {BinaryPricer} from "./libraries/BinaryPricer.sol";

interface IBinaryPoolRead { struct BookLevel { uint256 price; uint256 quantity; } function getBookLevels(bool isBid, uint64 numLevels) external view returns (BookLevel[] memory); }

/// @title SigmaOracle
/// @notice Public fair-value feed for dreamDEX terminal-price binaries.
contract SigmaOracle {
    uint256 private constant WAD = 1e18;
    uint256 private constant BPS = 1e4;
    enum Reason { Ok, NoWindow, Expired, VolNotReady, NoSpot, ScaleMismatch, NoBook }
    struct FairValue {
        uint256 fairProbBps; uint256 impliedProbBps; int256 edgeBps; uint256 breakEvenBps;
        uint256 kellyWad; uint256 sigmaWad; uint256 tauWad; uint64 updatedAt; Reason reason; bool ok;
    }
    RealizedVol public immutable realizedVol;
    SigmaWindowRegistry public immutable registry;
    mapping(bytes32 => FairValue) private _fairValues;
    event FairValuePublished(bytes32 indexed marketId, int256 edgeBps, uint256 fairProbBps, uint256 impliedProbBps, Reason reason);

    constructor(RealizedVol realizedVol_, SigmaWindowRegistry registry_) { realizedVol = realizedVol_; registry = registry_; }

    function getFairValue(bytes32 marketId) external view returns (FairValue memory) { return _fairValues[marketId]; }

    function refresh(bytes32 marketId) public returns (FairValue memory value) {
        SigmaWindowRegistry.Window memory w = registry.getWindow(marketId);
        value = _base(w);
        if (value.reason == Reason.Ok) {
            try IBinaryPoolRead(w.poolAddress).getBookLevels(false, 1) returns (IBinaryPoolRead.BookLevel[] memory levels) {
                if (levels.length == 0 || levels[0].price == 0) value.reason = Reason.NoBook;
                else value = _applyBook(value, levels[0].price * 1e12);
            } catch { value.reason = Reason.NoBook; }
        }
        value.updatedAt = uint64(block.timestamp);
        _fairValues[marketId] = value;
        emit FairValuePublished(marketId, value.edgeBps, value.fairProbBps, value.impliedProbBps, value.reason);
    }

    function refreshAll() external returns (uint256 count) {
        bytes32[] memory markets = registry.openWindows();
        for (uint256 i; i < markets.length; ++i) { try this.refresh(markets[i]) { ++count; } catch {} }
    }

    function quote(bytes32 marketId, uint256 bookPriceWad) external view returns (FairValue memory) {
        FairValue memory value = _base(registry.getWindow(marketId));
        if (value.reason == Reason.Ok) value = _applyBook(value, bookPriceWad);
        value.updatedAt = uint64(block.timestamp);
        return value;
    }

    function _base(SigmaWindowRegistry.Window memory w) private view returns (FairValue memory value) {
        if (!w.exists) { value.reason = Reason.NoWindow; return value; }
        if (block.timestamp >= w.expiry || block.timestamp < w.tradingStart) { value.reason = Reason.Expired; return value; }
        (uint256 sigma, bool volOk) = realizedVol.sigmaForSecondsWad(w.priceKey, w.intervalSec);
        uint256 spot = realizedVol.lastPriceWad(w.priceKey);
        if (!volOk) { value.reason = Reason.VolNotReady; return value; }
        if (spot == 0) { value.reason = Reason.NoSpot; return value; }
        uint256 openingWad = w.openingPrice * (10 ** (18 - w.openingScale));
        uint256 ratio = spot * WAD / openingWad;
        if (ratio <= WAD / 2 || ratio >= WAD * 2) { value.reason = Reason.ScaleMismatch; return value; }
        uint256 tau = (uint256(w.expiry - uint64(block.timestamp)) * WAD) / (w.expiry - w.tradingStart);
        uint256 fair = BinaryPricer.probUp(spot, openingWad, sigma, tau, BinaryPricer.SettlementStyle.Terminal);
        value.fairProbBps = fair * BPS / WAD;
        value.sigmaWad = sigma;
        value.tauWad = tau;
        value.reason = Reason.Ok;
    }

    function _applyBook(FairValue memory value, uint256 bookPriceWad) private pure returns (FairValue memory) {
        if (bookPriceWad == 0 || bookPriceWad >= WAD) { value.reason = Reason.NoBook; return value; }
        uint256 fairWad = value.fairProbBps * WAD / BPS;
        value.impliedProbBps = bookPriceWad * BPS / WAD;
        value.edgeBps = BinaryPricer.edgeBps(fairWad, bookPriceWad);
        value.breakEvenBps = BinaryPricer.breakEvenWinRateBps(bookPriceWad);
        value.kellyWad = BinaryPricer.kellyFractionWad(fairWad, bookPriceWad);
        value.ok = true;
        return value;
    }
}
