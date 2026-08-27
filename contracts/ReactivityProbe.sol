// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SOMNIA_REACTIVITY_PRECOMPILE} from "./somnia/ISomniaReactivity.sol";

/// @notice Minimal diagnostic handler. Records every callback it receives with
///         no business logic in the way, so a stuck subscription can be
///         diagnosed independently of RealizedVol/SigmaReactiveVol correctness.
contract ReactivityProbe {
    uint256 public hits;
    address public lastEmitter;
    bytes32 public lastTopic0;
    uint256 public lastDataWord;
    uint64 public lastBlock;

    event Hit(uint256 indexed n, address emitter, bytes32 topic0, uint256 dataWord, uint256 block_);

    function onEvent(address emitter, bytes32[] calldata topics, bytes calldata data) external {
        require(msg.sender == SOMNIA_REACTIVITY_PRECOMPILE, "not precompile");
        hits += 1;
        lastEmitter = emitter;
        lastBlock = uint64(block.number);
        if (topics.length > 0) lastTopic0 = topics[0];
        if (data.length >= 32) lastDataWord = abi.decode(data[:32], (uint256));
        emit Hit(hits, emitter, lastTopic0, lastDataWord, block.number);
    }
}
