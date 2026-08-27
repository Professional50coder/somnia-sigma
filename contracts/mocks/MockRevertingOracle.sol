// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Always-reverting oracle stand-in, used to prove SigmaCron's sweep
///         never propagates an oracle failure back to the reactivity caller.
contract MockRevertingOracle {
    error AlwaysReverts();
    function refreshAll() external pure returns (uint256) { revert AlwaysReverts(); }
}
