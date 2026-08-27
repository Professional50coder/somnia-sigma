// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal binary-pool read surface for SigmaOracle unit tests.
contract MockBinaryPool {
    struct BookLevel { uint256 price; uint256 quantity; }
    BookLevel[] private _asks;
    bool private _shouldRevert;

    function setBestAsk(uint256 price, uint256 quantity) external {
        delete _asks;
        if (price != 0) _asks.push(BookLevel({price: price, quantity: quantity}));
    }

    function setShouldRevert(bool shouldRevert) external { _shouldRevert = shouldRevert; }

    function getBookLevels(bool isBid, uint64) external view returns (BookLevel[] memory) {
        if (_shouldRevert) revert("mock pool reverted");
        if (isBid) return new BookLevel[](0);
        return _asks;
    }
}
