/**
 * Sigma Scheduled Runner — continuous on-chain data capture.
 *
 * Runs three concurrent loops:
 *   1. Price pusher: polls MarkPriceUpdated every 20s, pushes to RealizedVol
 *   2. Market watcher: checks for live BTC markets, publishes + refreshes oracle
 *   3. State logger: snapshots on-chain state every 60s to a JSON log file
 *
 * Usage:
 *   node scripts/scheduled-runner.mjs              # all loops
 *   node scripts/scheduled-runner.mjs --push-only  # price pusher only
 *   node scripts/scheduled-runner.mjs --once        # single pass of everything
 *
 * Stop: Ctrl+C
 * Logs: proofs/scheduled-log-<timestamp>.json
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  parseAbiItem,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  SomniaMarkets,
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { evaluate, createTradeRecord } from "../bot/src/strategy.mjs";
import { placeTakerOrder } from "../bot/src/order.mjs";
import { maybeClaim } from "../bot/src/settle.mjs";

// ── Constants ────────────────────────────────────────────────────────────────

const VENUE_ID_REAL = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c";
const BTC_SPOT_POOL = "0x3605f28aA7C50e7441211e77Cb0762d49539326C";
const MARK_PRICE_UPDATED_TOPIC0 = "0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888";

const PUSH_INTERVAL_MS = 20_000;    // push prices every 20s
const WATCH_INTERVAL_MS = 60_000;   // check markets every 60s
const LOG_INTERVAL_MS = 60_000;     // log state every 60s

const RPC = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";

// ── Artifacts ────────────────────────────────────────────────────────────────

const deployment = JSON.parse(readFileSync("deployments/somniaTestnet.json", "utf8"));
const volArtifact = JSON.parse(readFileSync("artifacts/sigma/RealizedVol.json", "utf8"));
const registryArtifact = JSON.parse(readFileSync("artifacts/sigma/SigmaWindowRegistry.json", "utf8"));
const oracleArtifact = JSON.parse(readFileSync("artifacts/sigma/SigmaOracle.json", "utf8"));

// ── Clients ──────────────────────────────────────────────────────────────────

const deployerAccount = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const client = createPublicClient({ transport: http(RPC) });
const wallet = createWalletClient({ account: deployerAccount, transport: http(RPC) });

const MARK_PRICE_ABI = [
  parseAbiItem("event MarkPriceUpdated(address indexed asset, uint256 markPrice, uint256 rawMidpoint)"),
];

// ── State ────────────────────────────────────────────────────────────────────

let lastPushedPrice = null;
let pushCount = 0;
let skipCount = 0;
let txCount = 0;
let marketPublished = false;
let publishedMarketId = null;
let tradeCount = 0;
let LIVE_MODE = false; // set via --live flag

const startTime = Date.now();
const logFile = `proofs/scheduled-log-${startTime}.json`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString().slice(11, 19);
}

function logEvent(event) {
  const entry = { ...event, timestamp: new Date().toISOString() };
  const dir = logFile.substring(0, logFile.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  appendFileSync(logFile, JSON.stringify(entry) + "\n");
  return entry;
}

// ── Loop 1: Price Pusher ────────────────────────────────────────────────────

async function pushPrice() {
  try {
    const latest = await client.getBlockNumber();
    const from = latest > 900n ? latest - 900n : 0n;
    const rawLogs = await client.getLogs({
      address: BTC_SPOT_POOL,
      topics: [MARK_PRICE_UPDATED_TOPIC0],
      fromBlock: from,
      toBlock: "latest",
    });
    const logs = rawLogs.filter((l) => l.topics[0] === MARK_PRICE_UPDATED_TOPIC0);

    if (logs.length === 0) {
      skipCount++;
      console.log(`[${ts()}] push: no MarkPriceUpdated in last 900 blocks (skip=${skipCount})`);
      return;
    }

    const mostRecent = logs[logs.length - 1];
    const decoded = decodeEventLog({
      abi: MARK_PRICE_ABI,
      data: mostRecent.data,
      topics: mostRecent.topics,
    });
    const markPriceWad = decoded.args.markPrice;

    if (typeof markPriceWad !== "bigint" || markPriceWad <= 0n) {
      skipCount++;
      return;
    }
    if (markPriceWad < 1_000n * 10n ** 18n || markPriceWad > 10_000_000n * 10n ** 18n) {
      skipCount++;
      return;
    }
    if (markPriceWad === lastPushedPrice) {
      skipCount++;
      return;
    }

    const hash = await wallet.writeContract({
      address: deployment.realizedVol,
      abi: volArtifact.abi,
      functionName: "recordPrice",
      args: [BTC_SPOT_POOL, markPriceWad],
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    lastPushedPrice = markPriceWad;
    pushCount++;
    txCount++;

    const priceUsd = (Number(markPriceWad) / 1e18).toFixed(2);
    console.log(`[${ts()}] PUSH $${priceUsd} -> tx ${hash.slice(0, 10)}... status=${receipt.status} (pushes=${pushCount}, txs=${txCount})`);
    logEvent({ type: "push", price: priceUsd, hash, status: receipt.status, block: Number(mostRecent.blockNumber) });
  } catch (err) {
    skipCount++;
    console.error(`[${ts()}] push error:`, err.shortMessage ?? err.message);
  }
}

// ── Loop 2: Market Watcher ──────────────────────────────────────────────────

async function watchMarkets() {
  try {
    const exchange = new SomniaMarkets({
      indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
      priceFeed: SOMNIA_TESTNET_PRICE_FEED,
    });
    await exchange.loadMarkets();

    const allMarkets = exchange.getMarkets?.() ?? [];
    const now = Math.floor(Date.now() / 1000);
    const live = allMarkets.filter((m) => {
      if (m.venueId !== VENUE_ID_REAL) return false;
      const start = Number(m.tradingStart ?? 0);
      const exp = Number(m.expiry ?? 0);
      return start <= now && now < exp;
    });

    if (live.length === 0) {
      console.log(`[${ts()}] watch: ${allMarkets.length} total markets, 0 live`);
      logEvent({ type: "watch", total: allMarkets.length, live: 0 });
      return;
    }

    console.log(`[${ts()}] watch: found ${live.length} live market(s)`);
    logEvent({ type: "watch", live: live.length, marketIds: live.map(m => (m.marketId ?? m.id)?.slice(0, 10)) });

    // For each live market: publish + refresh
    for (const market of live) {
      const marketId = market.marketId ?? market.id;
      if (!marketId) continue;

      const openingPrices = await exchange.client.getOpeningPrices([marketId]);
      const openingPriceRaw = openingPrices[marketId.toLowerCase()];
      if (!openingPriceRaw || openingPriceRaw === "0") {
        console.log(`[${ts()}] watch: ${marketId.slice(0, 10)}... no opening price yet`);
        continue;
      }

      const poolAddress = market.poolAddress ?? market.marketAddress;
      const window = {
        marketId,
        asset: `0x${Buffer.from("BTC").toString("hex").padEnd(64, "0")}`,
        priceKey: BTC_SPOT_POOL,
        poolAddress,
        openingPrice: BigInt(openingPriceRaw),
        openingScale: 2,
        tradingStart: BigInt(market.tradingStart),
        expiry: BigInt(market.expiry),
        intervalSec: Number(market.intervalSec),
        publisher: deployerAccount.address,
        publishedAt: 0n,
        exists: false,
      };

      // Publish window
      try {
        const pubHash = await wallet.writeContract({
          address: deployment.registry,
          abi: registryArtifact.abi,
          functionName: "publishWindow",
          args: [window],
        });
        const pubReceipt = await client.waitForTransactionReceipt({ hash: pubHash });
        txCount++;
        console.log(`[${ts()}] PUBLISH ${marketId.slice(0, 10)}... tx=${pubHash.slice(0, 10)}... status=${pubReceipt.status}`);
        logEvent({ type: "publish", marketId, openingPrice: openingPriceRaw, hash: pubHash, status: pubReceipt.status });
      } catch (err) {
        console.log(`[${ts()}] publish error: ${err.shortMessage ?? err.message}`);
      }

      // Refresh oracle
      try {
        const refHash = await wallet.writeContract({
          address: deployment.oracle,
          abi: oracleArtifact.abi,
          functionName: "refresh",
          args: [marketId],
        });
        const refReceipt = await client.waitForTransactionReceipt({ hash: refHash });
        txCount++;

        const fairValue = await client.readContract({
          address: deployment.oracle,
          abi: oracleArtifact.abi,
          functionName: "getFairValue",
          args: [marketId],
        });

        const fv = {
          fairProb: (Number(fairValue[0]) / 10000).toFixed(2) + "%",
          impliedProb: (Number(fairValue[1]) / 10000).toFixed(2) + "%",
          edge: Number(fairValue[2]),
          kelly: (Number(fairValue[4]) / 1e18).toFixed(4),
          ok: fairValue[9],
        };

        console.log(`[${ts()}] REFRESH ${marketId.slice(0, 10)}... fair=${fv.fairProb} book=${fv.impliedProb} edge=${fv.edge}bps ok=${fv.ok}`);
        logEvent({ type: "refresh", marketId, ...fv, hash: refHash, status: refReceipt.status });
        marketPublished = true;
        publishedMarketId = marketId;

        // ── Auto-trade: evaluate + place order ────────────────────────
        if (fv.ok) {
          let bookPrice = null;
          try {
            const book = await exchange.fetchOrderBook(market.symbol, 5);
            if (book?.asks?.length > 0) bookPrice = Number(book.asks[0][0]);
          } catch {}

          if (bookPrice !== null) {
            const fvForStrategy = {
              fairProbBps: Number(fairValue[0]),
              impliedProbBps: Number(fairValue[1]),
              edgeBps: Number(fairValue[2]),
              breakEvenBps: Number(fairValue[3]),
              kellyWad: fairValue[4],
              sigmaWad: fairValue[5],
              tauWad: fairValue[6],
              ok: fairValue[9],
            };

            const decision = evaluate(fvForStrategy, bookPrice, "buyYes", {
              minEdgeBps: MIN_EDGE_BPS,
              maxStake: MAX_STAKE,
            });

            if (decision.action === "trade") {
              const side = decision.side === "buyYes" ? "YES" : "NO";
              const price = (Number(decision.priceRaw) / 1e6).toFixed(3);
              const size = (Number(decision.sizeRaw) / 1e6).toFixed(2);

              console.log(`[${ts()}] TRADE ${marketId.slice(0, 10)}... ${side} @ ${price} size=${size}USDC edge=${decision.edge}bps`);

              if (LIVE_MODE) {
                try {
                  const result = await placeTakerOrder(exchange, market, decision, { dryRun: false });
                  if (result.error) {
                    console.log(`[${ts()}] order failed: ${result.error}`);
                  } else {
                    tradeCount++;
                    console.log(`[${ts()}] ORDER PLACED tx=${result.hash?.slice(0, 10)}... status=${result.receipt?.status}`);
                    logEvent({ type: "trade", marketId, side, price, size, edge: decision.edge, hash: result.hash, status: result.receipt?.status });
                    txCount++;
                  }
                } catch (err) {
                  console.log(`[${ts()}] order error: ${err.shortMessage ?? err.message}`);
                }
              } else {
                logEvent({ type: "trade_dry_run", marketId, side, price, size, edge: decision.edge });
              }
            } else {
              console.log(`[${ts()}] SKIP ${marketId.slice(0, 10)}... ${decision.reason}`);
            }
          }
        }
      } catch (err) {
        console.log(`[${ts()}] refresh error: ${err.shortMessage ?? err.message}`);
      }
    }

    // ── Check settlements ───────────────────────────────────────────
    try {
      const claim = await maybeClaim(exchange, { dryRun: !LIVE_MODE });
      if (claim.redeemed > 0) {
        console.log(`[${ts()}] CLAIMED ${claim.redeemed} position(s)`);
        logEvent({ type: "claim", redeemed: claim.redeemed });
      }
    } catch {}
  } catch (err) {
    console.error(`[${ts()}] watch error:`, err.shortMessage ?? err.message);
  }
}

// ── Loop 3: State Logger ────────────────────────────────────────────────────

async function logState() {
  try {
    const block = await client.getBlock();
    const sampleCount = await client.readContract({
      address: deployment.realizedVol,
      abi: volArtifact.abi,
      functionName: "sampleCount",
      args: [BTC_SPOT_POOL],
    });
    const lastPrice = await client.readContract({
      address: deployment.realizedVol,
      abi: volArtifact.abi,
      functionName: "lastPriceWad",
      args: [BTC_SPOT_POOL],
    });
    const sigma = await client.readContract({
      address: deployment.realizedVol,
      abi: volArtifact.abi,
      functionName: "sigmaWad",
      args: [BTC_SPOT_POOL],
    });
    const bal = await client.getBalance({ address: deployerAccount.address });

    const state = {
      block: Number(block.number),
      sampleCount: Number(sampleCount),
      lastPriceUsd: (Number(lastPrice) / 1e18).toFixed(2),
      sigmaWad: sigma[0].toString(),
      sigmaOk: sigma[2],
      deployerSTT: formatEther(bal),
      pushCount,
      skipCount,
      txCount,
      uptimeMin: Math.round((Date.now() - startTime) / 60000),
    };

    console.log(`[${ts()}] STATE block=${state.block} samples=${state.sampleCount} price=$${state.lastPriceUsd} sigma_ok=${state.sigmaOk} stt=${state.deployerSTT} txs=${txCount} trades=${tradeCount} uptime=${state.uptimeMin}m`);
    logEvent({ type: "state", ...state });
  } catch (err) {
    console.error(`[${ts()}] state error:`, err.shortMessage ?? err.message);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const pushOnly = process.argv.includes("--push-only");
  const once = process.argv.includes("--once");
  LIVE_MODE = process.argv.includes("--live");

  console.log("\n" + "═".repeat(72));
  console.log("  SIGMA SCHEDULED RUNNER");
  console.log("  " + new Date().toISOString());
  console.log("  Mode:", once ? "single pass" : pushOnly ? "push-only" : "full (push + watch + log)");
  console.log("  Trade mode:", LIVE_MODE ? "LIVE (real orders)" : "DRY_RUN");
  console.log("  Push interval:", PUSH_INTERVAL_MS / 1000 + "s");
  console.log("  Watch interval:", WATCH_INTERVAL_MS / 1000 + "s");
  console.log("  Log interval:", LOG_INTERVAL_MS / 1000 + "s");
  console.log("  Log file:", logFile);
  console.log("═".repeat(72) + "\n");

  logEvent({ type: "start", mode: once ? "once" : pushOnly ? "push-only" : "full" });

  if (once) {
    await pushPrice();
    if (!pushOnly) {
      await watchMarkets();
      await logState();
    }
    logEvent({ type: "end", pushCount, skipCount, txCount });
    return;
  }

  // Initial pass
  await pushPrice();
  if (!pushOnly) {
    await watchMarkets();
    await logState();
  }

  // Schedule loops
  setInterval(pushPrice, PUSH_INTERVAL_MS);
  if (!pushOnly) {
    setInterval(watchMarkets, WATCH_INTERVAL_MS);
    setInterval(logState, LOG_INTERVAL_MS);
  }

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log(`\n[${ts()}] Shutting down. Total: ${pushCount} pushes, ${txCount} txs`);
    logEvent({ type: "shutdown", pushCount, skipCount, txCount });
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
