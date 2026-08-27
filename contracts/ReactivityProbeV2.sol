// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Diagnostic only. Deliberately has NO sender gate, so it can answer
///         one question: is anything calling onEvent at all, and if so, from
///         where? ReactivityProbe.sol (v1) requires msg.sender == precompile;
///         if the real callback arrives from a different system address, v1
///         would revert silently and look identical to "no delivery at all".
///         This contract removes that ambiguity.
contract ReactivityProbeV2 {
    uint256 public hits;
    address public lastSender;
    address public lastEmitter;
    bytes32 public lastTopic0;
    uint256 public lastDataWord;
    uint64 public lastBlock;

    event Hit(uint256 indexed n, address sender, address emitter, bytes32 topic0, uint256 dataWord, uint256 block_);

    function onEvent(address emitter, bytes32[] calldata topics, bytes calldata data) external {
        hits += 1;
        lastSender = msg.sender;
        lastEmitter = emitter;
        lastBlock = uint64(block.number);
        if (topics.length > 0) lastTopic0 = topics[0];
        if (data.length >= 32) lastDataWord = abi.decode(data[:32], (uint256));
        emit Hit(hits, msg.sender, emitter, lastTopic0, lastDataWord, block.number);
    }
}
