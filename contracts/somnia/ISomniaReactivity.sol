// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Somnia's on-chain reactivity precompile.
// Verified live: subscriptions read back through
// `somnia_reactivityGetSubscriptionInfo` carry handler selector
// 0x53edf33d, which is onEvent(address,bytes32[],bytes).
address constant SOMNIA_REACTIVITY_PRECOMPILE = 0x0000000000000000000000000000000000000100;

// Selector the precompile calls on a handler contract.
bytes4 constant SOMNIA_ON_EVENT_SELECTOR = 0x53edf33d;

/// @notice Current Solidity ABI documented by Somnia for on-chain subscriptions.
/// @dev `caller` is reserved by the protocol today and should be address(0).
struct SubscriptionData {
    bytes32[4] eventTopics;
    address origin;
    address caller;
    address emitter;
    address handlerContractAddress;
    bytes4 handlerFunctionSelector;
    uint64 priorityFeePerGas;
    uint64 maxFeePerGas;
    uint64 gasLimit;
    bool isGuaranteed;
    bool isCoalesced;
}

interface ISomniaReactivity {
    /// @notice Persist an event subscription in chain state.
    /// @dev Costs 210,000 gas, charged to the caller. Handler execution is
    ///      charged to the subscription OWNER, so the owning contract must hold
    ///      a balance or its handler silently stops being invoked.
    function subscribe(SubscriptionData memory subscriptionData) external returns (uint256 subscriptionId);

    function unsubscribe(uint256 subscriptionId) external;
}

/// @notice Interface the reactivity precompile calls back into.
interface ISomniaEventHandler {
    function onEvent(address emitter, bytes32[] calldata eventTopics, bytes calldata data) external;
}
