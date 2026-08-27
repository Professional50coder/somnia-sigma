// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {RealizedVol} from "./RealizedVol.sol";
import {
    ISomniaReactivity,
    SubscriptionData,
    SOMNIA_ON_EVENT_SELECTOR,
    SOMNIA_REACTIVITY_PRECOMPILE
} from "./somnia/ISomniaReactivity.sol";

/// @title SigmaReactiveVol
/// @notice Minimal bridge from dreamDEX spot-pool mark events to RealizedVol.
/// @dev The Somnia reactivity precompile is the sole authorised caller of
///      onEvent. Unknown feeds are deliberately observable no-ops: a broad or
///      retired subscription must not make every subsequent callback revert.
contract SigmaReactiveVol {
    error NotOwner();
    error NotPrecompile();
    error BadPayload();

    RealizedVol public immutable realizedVol;
    address public owner;

    /// @notice Asset identity to use for a subscribed pool and event signature.
    mapping(address pool => mapping(bytes32 topic0 => address asset)) public emitterAsset;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event EmitterMapped(address indexed pool, bytes32 indexed topic0, address indexed asset);
    event EventIgnored(address indexed emitter, bytes32 indexed topic0);
    event SubscriptionCreated(address indexed pool, bytes32 indexed topic0, address indexed asset, uint256 subscriptionId);

    constructor(RealizedVol realizedVol_, address owner_) {
        realizedVol = realizedVol_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    receive() external payable {}

    function transferOwnership(address owner_) external onlyOwner {
        owner = owner_;
        emit OwnershipTransferred(msg.sender, owner_);
    }

    function mapEmitter(address pool, bytes32 topic0, address asset) public onlyOwner {
        emitterAsset[pool][topic0] = asset;
        emit EmitterMapped(pool, topic0, asset);
    }

    /// @notice Subscribe this handler to a specific dreamDEX pool event.
    function subscribeTo(
        address pool,
        bytes32 topic0,
        address asset,
        uint64 priorityFee,
        uint64 maxFee,
        uint64 gasLimit
    ) external onlyOwner returns (uint256 subscriptionId) {
        mapEmitter(pool, topic0, asset);
        bytes32[4] memory topics;
        topics[0] = topic0;
        subscriptionId = ISomniaReactivity(SOMNIA_REACTIVITY_PRECOMPILE).subscribe(SubscriptionData({
            eventTopics: topics, origin: address(0), caller: address(0), emitter: pool,
            handlerContractAddress: address(this), handlerFunctionSelector: SOMNIA_ON_EVENT_SELECTOR,
            priorityFeePerGas: priorityFee, maxFeePerGas: maxFee, gasLimit: gasLimit,
            isGuaranteed: true, isCoalesced: false
        }));
        emit SubscriptionCreated(pool, topic0, asset, subscriptionId);
    }

    /// @notice Reactivity callback for MarkPriceUpdated(address,uint256,uint256).
    function onEvent(address emitter, bytes32[] calldata topics, bytes calldata data) external {
        if (msg.sender != SOMNIA_REACTIVITY_PRECOMPILE) revert NotPrecompile();
        if (topics.length == 0 || data.length < 32) revert BadPayload();

        address asset = emitterAsset[emitter][topics[0]];
        if (asset == address(0)) {
            emit EventIgnored(emitter, topics[0]);
            return;
        }

        // markPrice is the first non-indexed event word and is WAD-scaled.
        uint256 markPrice = abi.decode(data[:32], (uint256));
        realizedVol.recordPrice(asset, markPrice);
    }
}
