/**
 * Sigma Auto-Trade — full pipeline: detect → publish → refresh → evaluate → trade.
 *
 * Watches dreamDEX for new BTC binary markets. When one appears:
 *   1. Publishes its window to SigmaWindowRegistry
 *   2. Calls SigmaOracle.refresh() to compute fair value
 *   3. Reads the live order book
 *   4. Evaluates edge via the strategy
 *   5. Places a real order (or logs in DRY_RUN mode)
 *   6. Monitors for settlement and claims winnings
 *
 * Usage:
 *   node scripts/auto-trade.mjs                    # DRY_RUN (default)
 *   node scripts/auto-trade.mjs --live             # real orders
 *   node scripts/auto-trade.mjs --loop             # continuous watching
 *   node scripts/auto-trade.mjs --loop --live      # continuous + real orders
 *   node scripts/auto-trade.mjs --loop --interval 30000
 *
 * Environment:
 *   SIGMA_MIN_EDGE_BPS=200    minimum edge to act (default 200)
 *   SIGMA_MAX_STAKE=25        max USDC per trade (default 25)
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  SomniaMarkets,
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { evaluate, createTradeRecord } from "../bot/src/strategy.mjs";
import { placeTakerOrder, placeMakerOrders } from "../bot/src/order.mjs";
import { maybeClaim, isSettled } from "../bot/src/settle.mjs";

// ── Constants ────────────────────────────────────────────────────────────────

const VENUE_ID_REAL = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c";
const BTC_SPOT_POOL = "0x3605f28aA7C50e7441211e77Cb0762d49539326C";

const RPC = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
const MIN_EDGE_BPS = Number(process.env.SIGMA_MIN_EDGE_BPS ?? 200);
const MAX_STAKE = Number(process.env.SIGMA_MAX_STAKE ?? 25);

// ── Load artifacts ───────────────────────────────────────────────────────────

const deployment = JSON.parse(readFileSync("deployments/somniaTestnet.json", "utf8"));
const volArtifact = JSON.parse(readFileSync("artifacts/sigma/RealizedVol.json", "utf8"));
const registryArtifact = JSON.parse(readFileSync("artifacts/sigma/SigmaWindowRegistry.json", "utf8"));
const oracleArtifact = JSON.parse(readFileSync("artifacts/sigma/SigmaOracle.json", "utf8"));

// ── Clients ──────────────────────────────────────────────────────────────────

const deployerAccount = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const botAccount = privateKeyToAccount(process.env.PRIVATE_KEY);

const client = createPublicClient({ transport: http(RPC) });
const deployerWallet = createWalletClient({ account: deployerAccount, transport: http(RPC) });
const botWallet = createWalletClient({ account: botAccount, transport: http(RPC) });

// ── Trade log ────────────────────────────────────────────────────────────────

const LOG_FILE = "proofs/auto-trade-log.jsonl";
const SUMMARY_FILE = "proofs/auto-trade-summary.json";

function logTrade(entry) {
  mkdirSync("proofs", { recursive: true });
  appendFileSync(LOG_FILE, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + "\n");
}

function saveSummary(summary) {
  mkdirSync("proofs", { recursive: true });
  writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2) + "\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ts = () => new Date().toISOString().slice(11, 19);
const short = (id) => id.slice(0, 10) + "..." + id.slice(-6);
const txUrl = (hash) => `https://shannon-explorer.somnia.network/tx/${hash}`;

// ── Main pipeline ────────────────────────────────────────────────────────────

async function runPipeline() {
  const dryRun = !process.argv.includes("--live");
  const now = Math.floor(Date.now() / 1000);
  const pipeline = { startTime: new Date().toISOString(), steps: [], trades: [], txs: [] };

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  SIGMA AUTO-TRADE  ${ts()} UTC  ${dryRun ? "DRY_RUN" : "LIVE"}`);
  console.log(`${"═".repeat(72)}\n`);

  // ── 1. Discover markets ────────────────────────────────────────────────

  console.log("  [1/6] Discovering markets...");
  let exchange;
  try {
    exchange = new SomniaMarkets({
      indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
      priceFeed: SOMNIA_TESTNET_PRICE_FEED,
      privateKey: process.env.PRIVATE_KEY, // bot key for trading
    });
    await exchange.loadMarkets();
  } catch (err) {
    console.log(`  Failed to load markets: ${err.message}`);
    pipeline.steps.push({ step: "discover", status: "error", error: err.message });
    return pipeline;
  }

  const allMarkets = exchange.getMarkets?.() ?? [];
  const live = allMarkets.filter((m) => {
    if (m.venueId !== VENUE_ID_REAL) return false;
    const start = Number(m.tradingStart ?? 0);
    const exp = Number(m.expiry ?? 0);
    return start <= now && now < exp;
  });

  console.log(`  Found ${allMarkets.length} total, ${live.length} live`);
  pipeline.steps.push({ step: "discover", total: allMarkets.length, live: live.length });

  if (live.length === 0) {
    console.log("  No live markets. Waiting for next window...\n");
    return pipeline;
  }

  // ── 2. For each live market: publish → refresh → evaluate → trade ──────

  for (const market of live) {
    const marketId = market.marketId ?? market.id;
    const pool = market.poolAddress ?? market.marketAddress;
    const interval = Number(market.intervalSec);
    const remaining = Number(market.expiry) - now;
    const intervalLabel = interval <= 900 ? "15m" : interval <= 3600 ? "1h" : interval <= 14400 ? "4h" : "24h";

    console.log(`\n  ${short(marketId)}  ${intervalLabel} window  ${Math.round(remaining / 60)}m left`);

    // 2a. Get opening price
    const openingPrices = await exchange.client.getOpeningPrices([marketId]);
    const openingPriceRaw = openingPrices[marketId.toLowerCase()];
    if (!openingPriceRaw || openingPriceRaw === "0") {
      console.log(`    No opening price yet — skipping`);
      continue;
    }
    const openingPriceUsd = (Number(openingPriceRaw) / 100).toFixed(2);
    console.log(`    Opening: $${openingPriceUsd}`);

    // 2b. Publish window
    console.log("    Publishing window...");
    const window = {
      marketId,
      asset: `0x${Buffer.from("BTC").toString("hex").padEnd(64, "0")}`,
      priceKey: BTC_SPOT_POOL,
      pool,
      openingPrice: BigInt(openingPriceRaw),
      openingScale: 2,
      tradingStart: BigInt(market.tradingStart),
      expiry: BigInt(market.expiry),
      intervalSec: interval,
      publisher: deployerAccount.address,
      publishedAt: 0n,
      exists: false,
    };

    if (dryRun) {
      console.log("    [DRY_RUN] Would publish window");
    } else {
      try {
        const hash = await deployerWallet.writeContract({
          address: deployment.registry,
          abi: registryArtifact.abi,
          functionName: "publishWindow",
          args: [window],
        });
        const receipt = await client.waitForTransactionReceipt({ hash });
        console.log(`    Published: ${txUrl(hash)}`);
        pipeline.txs.push({ type: "publishWindow", hash, status: receipt.status });
        logTrade({ type: "publish", marketId, hash, status: receipt.status });
      } catch (err) {
        console.log(`    Publish failed: ${err.shortMessage ?? err.message}`);
      }
    }

    // 2c. Refresh oracle
    console.log("    Refreshing oracle...");
    if (dryRun) {
      console.log("    [DRY_RUN] Would refresh oracle");
    } else {
      try {
        const hash = await deployerWallet.writeContract({
          address: deployment.oracle,
          abi: oracleArtifact.abi,
          functionName: "refresh",
          args: [marketId],
        });
        const receipt = await client.waitForTransactionReceipt({ hash });
        console.log(`    Refreshed: ${txUrl(hash)}`);
        pipeline.txs.push({ type: "oracleRefresh", hash, status: receipt.status });
        logTrade({ type: "refresh", marketId, hash, status: receipt.status });
      } catch (err) {
        console.log(`    Refresh failed: ${err.shortMessage ?? err.message}`);
      }
    }

    // 2d. Read fair value
    let fairValue;
    try {
      fairValue = await client.readContract({
        address: deployment.oracle,
        abi: oracleArtifact.abi,
        functionName: "getFairValue",
        args: [marketId],
      });
    } catch (err) {
      console.log(`    Oracle read failed: ${err.message}`);
      continue;
    }

    const fv = {
      fairProbBps: Number(fairValue[0]),
      impliedProbBps: Number(fairValue[1]),
      edgeBps: Number(fairValue[2]),
      breakEvenBps: Number(fairValue[3]),
      kellyWad: fairValue[4],
      sigmaWad: fairValue[5],
      tauWad: fairValue[6],
      ok: fairValue[9],
    };

    const fairProb = (fv.fairProbBps / 100).toFixed(2);
    const impliedProb = (fv.impliedProbBps / 100).toFixed(2);
    const edgeStr = fv.edgeBps >= 0 ? `+${fv.edgeBps}` : `${fv.edgeBps}`;
    const kelly = (Number(fv.kellyWad) / 1e18 * 100).toFixed(2);
    const sigma = (Number(fv.sigmaWad) / 1e18 * 100).toFixed(2);

    console.log(`    Fair: ${fairProb}%  Book: ${impliedProb}%  Edge: ${edgeStr} bps  Kelly: ${kelly}%  σ: ${sigma}%  ok: ${fv.ok}`);

    // 2e. Read book
    let bookPrice = null;
    try {
      const book = await exchange.fetchOrderBook(market.symbol, 5);
      if (book?.asks?.length > 0) {
        bookPrice = Number(book.asks[0][0]);
      }
    } catch {}

    if (bookPrice === null) {
      console.log("    No book available");
      pipeline.steps.push({ step: "book", marketId, status: "no book" });
      continue;
    }

    console.log(`    Book ask: ${(bookPrice * 100).toFixed(2)}%`);

    // 2f. Evaluate strategy
    const decision = evaluate(fv, bookPrice, "buyYes", {
      minEdgeBps: MIN_EDGE_BPS,
      maxStake: MAX_STAKE,
    });

    if (decision.action !== "trade") {
      console.log(`    SKIP: ${decision.reason}`);
      pipeline.steps.push({ step: "evaluate", marketId, action: "skip", reason: decision.reason });
      continue;
    }

    const decSide = decision.side === "buyYes" ? "YES" : "NO";
    const decPrice = (Number(decision.priceRaw) / 1e6).toFixed(3);
    const decSize = (Number(decision.sizeRaw) / 1e6).toFixed(2);

    console.log(`    TRADE: ${decSide} @ ${decPrice}  size ${decSize} USDC  edge ${decision.edge} bps  kelly ${(decision.kelly * 100).toFixed(2)}%`);

    // 2g. Place order
    if (dryRun) {
      console.log("    [DRY_RUN] Would place order");
      pipeline.trades.push({
        marketId,
        side: decSide,
        price: decPrice,
        size: decSize,
        edge: decision.edge,
        kelly: decision.kelly,
        dryRun: true,
      });
    } else {
      try {
        const result = await placeTakerOrder(exchange, market, decision, { dryRun: false });
        if (result.error) {
          console.log(`    Order failed: ${result.error}`);
          pipeline.trades.push({ marketId, side: decSide, error: result.error });
        } else {
          console.log(`    Order placed: ${txUrl(result.hash)}`);
          pipeline.trades.push({
            marketId,
            side: decSide,
            price: decPrice,
            size: decSize,
            edge: decision.edge,
            hash: result.hash,
            status: result.receipt?.status,
          });
          pipeline.txs.push({ type: "placeOrder", hash: result.hash, status: result.receipt?.status });
          logTrade({ type: "order", marketId, side: decSide, price: decPrice, size: decSize, edge: decision.edge, hash: result.hash });
        }
      } catch (err) {
        console.log(`    Order error: ${err.message}`);
        pipeline.trades.push({ marketId, side: decSide, error: err.message });
      }
    }
  }

  // ── 3. Check for settlements ──────────────────────────────────────────

  console.log("\n  [5/6] Checking settlements...");
  try {
    const claimResult = await maybeClaim(exchange, { dryRun });
    if (claimResult.redeemed > 0) {
      console.log(`  Claimed ${claimResult.redeemed} position(s)`);
      pipeline.steps.push({ step: "claim", redeemed: claimResult.redeemed });
    } else {
      console.log(`  ${claimResult.message ?? "Nothing to claim"}`);
    }
  } catch (err) {
    console.log(`  Claim check error: ${err.message}`);
  }

  // ── 4. Summary ────────────────────────────────────────────────────────

  const bal = await client.getBalance({ address: botAccount.address });
  console.log(`\n  [6/6] Bot balance: ${formatEther(bal)} STT`);

  console.log(`\n${"─".repeat(72)}`);
  console.log(`  Pipeline complete: ${pipeline.txs.length} txs, ${pipeline.trades.length} trades`);
  console.log(`${"─".repeat(72)}\n`);

  pipeline.endTime = new Date().toISOString();
  saveSummary(pipeline);

  return pipeline;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const loop = process.argv.includes("--loop");
  const intervalMs = Number(
    process.argv.find((_, i, a) => a[i - 1] === "--interval") ?? 30000
  );

  if (loop) {
    console.log(`  Auto-trade loop started (interval: ${intervalMs}ms)`);
    console.log(`  Press Ctrl+C to stop\n`);

    while (true) {
      try {
        await runPipeline();
      } catch (err) {
        console.error(`  Pipeline error: ${err.message}`);
      }
      console.log(`  Next check in ${intervalMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  } else {
    await runPipeline();
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
