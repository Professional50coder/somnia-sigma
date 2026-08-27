import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Sigma — the fair-value layer for dreamDEX Event Contracts.
 *
 * Target is Somnia Shannon testnet, chain id 50312. The RPC below was verified
 * live on 2026-08-27: eth_chainId returned 0xc488 (= 50312).
 * Mainnet (5031) is deliberately absent — it is never a deploy target here.
 */
const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViem],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Needed for stack depth in the pricing math.
      viaIR: true,
    },
  },
  networks: {
    somniaTestnet: {
      type: "http",
      chainId: 50312,
      url: process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
};

export default config;
