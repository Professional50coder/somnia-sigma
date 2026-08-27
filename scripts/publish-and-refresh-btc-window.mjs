// The first genuine end-to-end fair value: pull a real live BTC window,
// its real opening price, publish it into SigmaWindowRegistry, and call
// SigmaOracle.refresh() -- the moment the whole pipeline produces a real
// number for the first time in this project.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES, SOMNIA_TESTNET_PRICE_FEED } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const VENUE_ID_REAL = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c";
const BTC_SPOT_POOL = "0x3605f28aA7C50e7441211e77Cb0762d49539326C"; // priceKey -- matches what the pusher writes to

const rpc = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const client = createPublicClient({ transport: http(rpc) });
const wallet = createWalletClient({ account, transport: http(rpc) });
const deployment = JSON.parse(readFileSync("deployments/somniaTestnet.json", "utf8"));
const registryArtifact = JSON.parse(readFileSync("artifacts/sigma/SigmaWindowRegistry.json", "utf8"));
const oracleArtifact = JSON.parse(readFileSync("artifacts/sigma/SigmaOracle.json", "utf8"));

const exchange = new SomniaMarkets({
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  chain: somniaShannon,
  addresses: SOMNIA_TESTNET_ADDRESSES,
  priceFeed: SOMNIA_TESTNET_PRICE_FEED,
});
await exchange.loadMarkets();

const markets = await exchange.client.listLiveBinaryMarkets({ venueId: VENUE_ID_REAL, asset: "BTC" });
console.log(`Found ${markets.length} live BTC markets on the real venue.`);
if (markets.length === 0) throw new Error("No live BTC markets right now -- nothing to publish.");

// Pick the one with the most time left, so we're not racing expiry while we work.
const now = Math.floor(Date.now() / 1000);
markets.sort((a, b) => Number(b.expiry) - Number(a.expiry));
const market = markets[0];
console.log("Selected market:", {
  marketId: market.marketId,
  poolAddress: market.poolAddress ?? market.marketAddress,
  tradingStart: market.tradingStart,
  expiry: market.expiry,
  intervalSec: market.intervalSec,
  secondsRemaining: Number(market.expiry) - now,
  rowStrike: market.strike, // expected "0" -- the documented trap
});

const openingPrices = await exchange.client.getOpeningPrices([market.marketId]);
const openingPriceRaw = openingPrices[market.marketId.toLowerCase()];
console.log("Opening price (raw, 1e2 scale):", openingPriceRaw, " -> human:", Number(openingPriceRaw) / 100);
if (!openingPriceRaw || openingPriceRaw === "0") throw new Error("No opening price available for this market yet.");

const poolAddress = market.poolAddress ?? market.marketAddress;
const window = {
  marketId: market.marketId,
  asset: `0x${Buffer.from("BTC").toString("hex").padEnd(64, "0")}`,
  priceKey: BTC_SPOT_POOL,
  poolAddress,
  openingPrice: BigInt(openingPriceRaw),
  openingScale: 2,
  tradingStart: BigInt(market.tradingStart),
  expiry: BigInt(market.expiry),
  intervalSec: Number(market.intervalSec),
  // The struct's ABI encoding includes these even though _publish() in the
  // contract overwrites all three unconditionally -- must still be present
  // and correctly typed or viem's ABI encoder fails.
  publisher: account.address,
  publishedAt: 0n,
  exists: false,
};

console.log("\nPublishing window to SigmaWindowRegistry...");
const publishHash = await wallet.writeContract({
  address: deployment.registry,
  abi: registryArtifact.abi,
  functionName: "publishWindow",
  args: [window],
});
const publishReceipt = await client.waitForTransactionReceipt({ hash: publishHash });
console.log("Published:", publishHash, "status:", publishReceipt.status);

console.log("\nCalling SigmaOracle.refresh()...");
const refreshHash = await wallet.writeContract({
  address: deployment.oracle,
  abi: oracleArtifact.abi,
  functionName: "refresh",
  args: [market.marketId],
});
const refreshReceipt = await client.waitForTransactionReceipt({ hash: refreshHash });
console.log("Refreshed:", refreshHash, "status:", refreshReceipt.status);

const fairValue = await client.readContract({
  address: deployment.oracle,
  abi: oracleArtifact.abi,
  functionName: "getFairValue",
  args: [market.marketId],
});

console.log("\n=== FIRST LIVE FAIR VALUE ===");
console.log(JSON.stringify({
  marketId: market.marketId,
  fairProbBps: fairValue.fairProbBps.toString(),
  fairProb: Number(fairValue.fairProbBps) / 10000,
  impliedProbBps: fairValue.impliedProbBps.toString(),
  edgeBps: fairValue.edgeBps.toString(),
  breakEvenBps: fairValue.breakEvenBps.toString(),
  kellyWad: fairValue.kellyWad.toString(),
  sigmaWad: fairValue.sigmaWad.toString(),
  tauWad: fairValue.tauWad.toString(),
  reason: fairValue.reason,
  ok: fairValue.ok,
}, null, 2));
