import { createPublicClient, http, parseAbi } from "viem";
import deployment from "../../deployments/somniaTestnet.json";

export const CHAIN_ID = 50312;
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC ?? "https://dream-rpc.somnia.network";

export const ADDRESSES = {
  realizedVol: deployment.realizedVol as `0x${string}`,
  reactiveVol: deployment.reactiveVol as `0x${string}`,
  registry: deployment.registry as `0x${string}`,
  oracle: deployment.oracle as `0x${string}`,
  cron: deployment.cron as `0x${string}`,
};

export const BTC_PRICE_KEY = "0x3605f28aa7c50e7441211e77cb0762d49539326c" as const;

export const client = createPublicClient({
  transport: http(RPC_URL),
});

export const realizedVolAbi = parseAbi([
  "function sampleCount(address) view returns (uint32)",
  "function lastPriceWad(address) view returns (uint256)",
  "function varianceRateWad(address) view returns (uint256)",
  "function sigmaForSecondsWad(address, uint256) view returns (uint256 sigma, bool ok)",
  "function MIN_SAMPLES() view returns (uint256)",
  "function STALENESS_SECONDS() view returns (uint64)",
]);

export const registryAbi = parseAbi([
  "function openWindows() view returns (bytes32[])",
  "function getWindow(bytes32) view returns (bytes32 marketId, bytes32 asset, address priceKey, address poolAddress, uint256 openingPrice, uint8 openingScale, uint64 tradingStart, uint64 expiry, uint32 intervalSec, address publisher, uint64 publishedAt, bool exists)",
]);

export const oracleAbi = parseAbi([
  "function getFairValue(bytes32) view returns (uint256 fairProbBps, uint256 impliedProbBps, int256 edgeBps, uint256 breakEvenBps, uint256 kellyWad, uint256 sigmaWad, uint256 tauWad, uint64 updatedAt, uint8 reason, bool ok)",
]);

export const ORACLE_FEED_ABI = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 price, uint256 startedAt, uint256 timeStamp, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);

export const ORACLE_FEED_ADDRESSES = {
  btcUsd: "0x8CeE6c58b8CbD8afdEaF14e6fCA0876765e161fE" as `0x${string}`,
  ethUsd: "0xd9132c1d762D432672493F640a63B758891B449e" as `0x${string}`,
  usdcUsd: "0xa2515C9480e62B510065917136B08F3f7ad743B4" as `0x${string}`,
  diaBtc: "0x4803db1ca3A1DA49c3DB991e1c390321c20e1f21" as `0x${string}`,
} as const;

export const REASON_LABEL: Record<number, string> = {
  0: "OK",
  1: "NO WINDOW",
  2: "EXPIRED",
  3: "VOL NOT READY",
  4: "NO SPOT",
  5: "SCALE MISMATCH",
  6: "NO BOOK",
};

export function describeReason(updatedAt: bigint, reason: number, ok: boolean) {
  if (updatedAt === 0n) return "NEVER PUBLISHED";
  if (ok) return "OK";
  return REASON_LABEL[reason] ?? `UNKNOWN (${reason})`;
}
