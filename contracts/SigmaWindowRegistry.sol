// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title SigmaWindowRegistry
/// @notice Explicit on-chain record of window facts sourced from dreamDEX's
///         off-chain indexer and opening-price oracle.
contract SigmaWindowRegistry {
    error NotOwner();
    error NotPublisher();
    error InvalidWindow();

    struct Window {
        bytes32 marketId;
        bytes32 asset;
        address priceKey;
        address poolAddress;
        uint256 openingPrice;
        uint8 openingScale;
        uint64 tradingStart;
        uint64 expiry;
        uint32 intervalSec;
        address publisher;
        uint64 publishedAt;
        bool exists;
    }

    address public owner;
    mapping(address => bool) public isPublisher;
    mapping(bytes32 => Window) private _windows;
    bytes32[] private _marketIds;
    mapping(bytes32 => bool) private _retired;

    event PublisherSet(address indexed publisher, bool allowed);
    event WindowPublished(bytes32 indexed marketId, address indexed publisher, uint64 publishedAt);
    event WindowRetired(bytes32 indexed marketId);

    constructor(address owner_, address publisher_) {
        owner = owner_;
        isPublisher[publisher_] = true;
        emit PublisherSet(publisher_, true);
    }

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }
    modifier onlyPublisher() { if (!isPublisher[msg.sender]) revert NotPublisher(); _; }

    function setPublisher(address publisher, bool allowed) external onlyOwner {
        isPublisher[publisher] = allowed;
        emit PublisherSet(publisher, allowed);
    }

    function publishWindow(Window calldata input) external onlyPublisher { _publish(input); }

    function publishWindows(Window[] calldata inputs) external onlyPublisher {
        for (uint256 i; i < inputs.length; ++i) _publish(inputs[i]);
    }

    function _publish(Window calldata input) internal {
        if (
            input.marketId == bytes32(0) || input.priceKey == address(0) || input.poolAddress == address(0)
                || input.openingPrice == 0 || input.openingScale > 18 || input.expiry <= input.tradingStart
                || !_validInterval(input.intervalSec) || input.expiry - input.tradingStart != input.intervalSec
        ) revert InvalidWindow();

        if (!_windows[input.marketId].exists) _marketIds.push(input.marketId);
        _windows[input.marketId] = Window({
            marketId: input.marketId, asset: input.asset, priceKey: input.priceKey, poolAddress: input.poolAddress,
            openingPrice: input.openingPrice, openingScale: input.openingScale, tradingStart: input.tradingStart,
            expiry: input.expiry, intervalSec: input.intervalSec, publisher: msg.sender,
            publishedAt: uint64(block.timestamp), exists: true
        });
        _retired[input.marketId] = false;
        emit WindowPublished(input.marketId, msg.sender, uint64(block.timestamp));
    }

    function getWindow(bytes32 marketId) external view returns (Window memory) { return _windows[marketId]; }

    function openWindows() external view returns (bytes32[] memory) {
        uint256 count;
        for (uint256 i; i < _marketIds.length; ++i) {
            Window storage w = _windows[_marketIds[i]];
            if (!_retired[_marketIds[i]] && w.expiry > block.timestamp) ++count;
        }
        bytes32[] memory out = new bytes32[](count);
        uint256 j;
        for (uint256 i; i < _marketIds.length; ++i) {
            Window storage w = _windows[_marketIds[i]];
            if (!_retired[_marketIds[i]] && w.expiry > block.timestamp) out[j++] = w.marketId;
        }
        return out;
    }

    function retire(bytes32 marketId) external onlyPublisher {
        if (!_windows[marketId].exists) revert InvalidWindow();
        _retired[marketId] = true;
        emit WindowRetired(marketId);
    }

    function _validInterval(uint32 interval) private pure returns (bool) {
        return interval == 900 || interval == 3600 || interval == 14400 || interval == 86400;
    }
}
