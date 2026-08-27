// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {FixedPointMathLib} from "solady/src/utils/FixedPointMathLib.sol";

/// @title RealizedVol
/// @author Sigma
/// @notice Exponentially-weighted realised volatility per underlying, folded
///         from a stream of price observations.
///
/// @dev On Somnia these observations arrive through the Reactivity precompile
///      rather than from a keeper (see SigmaReactiveVol), so volatility
///      accumulates on-chain and continuously with no off-chain process. The
///      intended source is dreamDEX's live spot-pool MarkPriceUpdated feed.
///      This is an order-book mark, not the settlement oracle; it is chosen for
///      its measured ~2-second cadence and the provenance is explicit upstream.
///
///      Two guards matter more than the maths: a minimum sample count, and a
///      staleness bound. Both exist so the contract can say "I do not know"
///      instead of returning a confident-looking number derived from nothing.
///      Callers must refuse to trade on a not-ok reading.
contract RealizedVol {
    using FixedPointMathLib for uint256;
    using FixedPointMathLib for int256;

    uint256 private constant WAD = 1e18;

    /// @notice EWMA decay factor. 0.94 is the RiskMetrics convention.
    uint256 public constant LAMBDA = 940_000_000_000_000_000;

    /// @notice Observations required before sigma is treated as meaningful.
    uint256 public constant MIN_SAMPLES = 30;

    /// @notice Age beyond which a reading is considered stale.
    uint64 public constant STALENESS_SECONDS = 300;

    /// @notice Log returns beyond this magnitude are treated as a feed glitch
    ///         rather than a real move, and are skipped.
    /// @dev 20% in a single observation. A genuine 20% tick between two
    ///      consecutive oracle updates on BTC/ETH is not a market event, it is
    ///      bad data -- and squaring it would poison the EWMA for a long time.
    uint256 public constant MAX_ABS_LOG_RETURN = 200_000_000_000_000_000;

    struct VolState {
        uint256 lastPriceWad;
        uint256 varianceWad; // EWMA of squared log returns, per observation
        uint256 varianceRateWad; // EWMA of squared log returns PER SECOND
        uint64 updatedAt;
        uint32 samples;
    }

    mapping(address => VolState) private _state;

    /// @notice The only address permitted to submit observations.
    address public writer;

    address public owner;

    error NotWriter();
    error NotOwner();
    error ZeroPrice();

    event PriceRecorded(address indexed underlying, uint256 priceWad, uint256 varianceWad, uint32 samples);
    event OutlierRejected(address indexed underlying, uint256 priceWad, uint256 absLogReturnWad);
    event WriterChanged(address indexed writer);

    constructor(address owner_, address writer_) {
        owner = owner_;
        writer = writer_;
        emit WriterChanged(writer_);
    }

    modifier onlyWriter() {
        if (msg.sender != writer) revert NotWriter();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Point the estimator at a new observation source.
    /// @dev Owner-gated rather than writer-gated so a compromised or retired
    ///      writer cannot hand the feed to itself.
    function setWriter(address writer_) external onlyOwner {
        writer = writer_;
        emit WriterChanged(writer_);
    }

    /// @notice Fold one price observation into the EWMA estimate.
    /// @param underlying Identity of the asset being observed.
    /// @param priceWad Observed price, WAD. Scale must be consistent across
    ///        calls for a given underlying -- only ratios are used, so the
    ///        absolute scale is free, but it must not change mid-stream.
    function recordPrice(address underlying, uint256 priceWad) external onlyWriter {
        if (priceWad == 0) revert ZeroPrice();
        VolState storage s = _state[underlying];

        if (s.lastPriceWad != 0) {
            int256 logReturn = int256(priceWad.divWad(s.lastPriceWad)).lnWad();
            uint256 absLog = uint256(logReturn < 0 ? -logReturn : logReturn);

            if (absLog > MAX_ABS_LOG_RETURN) {
                // Reject the move but adopt the price, so one bad print does
                // not make every subsequent return look enormous too.
                s.lastPriceWad = priceWad;
                s.updatedAt = uint64(block.timestamp);
                emit OutlierRejected(underlying, priceWad, absLog);
                return;
            }

            uint256 squared = absLog.mulWad(absLog);
            s.varianceWad = s.varianceWad.mulWad(LAMBDA) + squared.mulWad(WAD - LAMBDA);

            // Time-aware variance. Volatility scales with TIME, not with tick
            // count, and the dreamDEX mark feed does not tick on a fixed
            // cadence -- it fires roughly every two seconds but irregularly.
            // Treating every observation as one equal step would make sigma a
            // function of how chatty the feed happened to be, which is not a
            // property of the market. So accumulate variance PER SECOND.
            uint64 dt = uint64(block.timestamp) - s.updatedAt;
            if (dt > 0) {
                uint256 rate = squared / dt;
                s.varianceRateWad = s.varianceRateWad.mulWad(LAMBDA) + rate.mulWad(WAD - LAMBDA);
            }

            unchecked {
                if (s.samples < type(uint32).max) s.samples += 1;
            }
        }

        s.lastPriceWad = priceWad;
        s.updatedAt = uint64(block.timestamp);
        emit PriceRecorded(underlying, priceWad, s.varianceWad, s.samples);
    }

    /// @notice Current per-observation volatility estimate.
    /// @return sigma Square root of the EWMA variance, WAD.
    /// @return updatedAt Timestamp of the most recent observation.
    /// @return ok False when there are too few samples or the data is stale.
    ///         A caller that trades on a not-ok reading is trading on nothing.
    function sigmaWad(address underlying)
        external
        view
        returns (uint256 sigma, uint64 updatedAt, bool ok)
    {
        VolState storage s = _state[underlying];
        sigma = s.varianceWad.sqrtWad();
        updatedAt = s.updatedAt;
        ok =
            s.samples >= MIN_SAMPLES &&
            s.updatedAt != 0 &&
            block.timestamp - s.updatedAt <= STALENESS_SECONDS;
    }

    /// @notice Volatility over a window of `seconds_`, from the time-aware rate.
    /// @dev This is the method SigmaOracle uses. A dreamDEX Event Contract
    ///      window is defined by `intervalSec` (900 | 3600 | 14400 | 86400), so
    ///      the model needs sigma over that many SECONDS — not over some number
    ///      of oracle ticks, which is an artefact of feed chattiness rather
    ///      than a property of the market.
    ///
    ///      Volatility scales as the square root of time:
    ///          sigma(T) = sqrt(varianceRate * T)
    /// @return sigma Volatility over the requested span, WAD.
    /// @return ok False when the estimator is cold or stale — callers must
    ///         refuse to price on a not-ok reading rather than substitute zero.
    function sigmaForSecondsWad(address underlying, uint256 seconds_)
        external
        view
        returns (uint256 sigma, bool ok)
    {
        VolState storage s = _state[underlying];
        bool fresh = s.samples >= MIN_SAMPLES &&
            s.updatedAt != 0 &&
            block.timestamp - s.updatedAt <= STALENESS_SECONDS;

        if (!fresh || seconds_ == 0 || s.varianceRateWad == 0) return (0, false);
        return ((s.varianceRateWad * seconds_).sqrtWad(), true);
    }

    /// @notice EWMA variance per second, WAD.
    function varianceRateWad(address underlying) external view returns (uint256) {
        return _state[underlying].varianceRateWad;
    }

    function sampleCount(address underlying) external view returns (uint32) {
        return _state[underlying].samples;
    }

    function lastPriceWad(address underlying) external view returns (uint256) {
        return _state[underlying].lastPriceWad;
    }

    function stateOf(address underlying) external view returns (VolState memory) {
        return _state[underlying];
    }
}
