// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SOMNIA_REACTIVITY_PRECOMPILE} from "./somnia/ISomniaReactivity.sol";

interface ISigmaOracle { function refreshAll() external returns (uint256); }

/// @notice Cron-handler endpoint for Somnia's one-shot on-chain cron jobs.
/// @dev Scheduling is intentionally performed by the official Reactivity SDK
///      in scripts/arm-cron.mjs until the cron-precompile Solidity ABI is
///      verified on Shannon. This contract is still fully autonomous once the
///      subscription is armed: only the precompile may invoke onEvent.
contract SigmaCron {
    error NotOwner(); error NotPrecompile(); error InvalidCadence();
    ISigmaOracle public immutable oracle;
    address public owner;
    uint32 public cadenceSeconds;
    uint256 public nextScheduledMs;
    event SweepCompleted(uint256 refreshed, uint256 gasUsed);
    event CadenceChanged(uint32 cadenceSeconds);

    constructor(ISigmaOracle oracle_, address owner_) { oracle = oracle_; owner = owner_; cadenceSeconds = 900; }
    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }
    receive() external payable {}
    function setCadence(uint32 seconds_) external onlyOwner {
        if (seconds_ == 0) revert InvalidCadence(); cadenceSeconds = seconds_; emit CadenceChanged(seconds_);
    }
    function sweep() external onlyOwner returns (uint256 refreshed) { return _sweep(); }
    function onEvent(address, bytes32[] calldata, bytes calldata) external returns (uint256 refreshed) {
        if (msg.sender != SOMNIA_REACTIVITY_PRECOMPILE) revert NotPrecompile(); return _sweep();
    }
    function setNextScheduledMs(uint256 timestampMs) external onlyOwner { nextScheduledMs = timestampMs; }
    function _sweep() private returns (uint256 refreshed) {
        uint256 gasStart = gasleft();
        try oracle.refreshAll() returns (uint256 count) { refreshed = count; } catch {}
        emit SweepCompleted(refreshed, gasStart - gasleft());
    }
}
