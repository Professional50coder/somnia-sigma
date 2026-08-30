/**
 * Sigma LIVE runner — full bot loop with real order placement.
 *
 * Reads SigmaOracle fair value, compares against live book, places real
 * orders when edge exceeds threshold, seeds empty books, and claims
 * settled positions.
 *
 * Usage:
 *   node run-live.mjs                    # single pass (DRY_RUN by default)
 *   node run-live.mjs --live             # real orders
 *   node run-live.mjs --live --loop      # continuous
 *   node run-live.mjs --maker            # maker mode (seed book)
 *   node run-live.mjs --loop --interval 30000
 *   node run-live.mjs --claim            # claim only (no new trades)
 *
 * Environment:
 *   DEPLOYER_PRIVATE_KEY        required for live/maker modes
 *   SIGMA_MIN_EDGE_BPS=200     minimum edge to act
 *   SIGMA_MAX_STAKE=25         max USDC per trade
 *   SIGMA_MODE=taker           taker (default) or maker
 *   AUTO_CLAIM=true            auto-claim on each pass
 *   AUTO_CLAIM_INTERVAL_MS=600000
 */

import "dotenv/config";
import { createPublicClient, http, parseAbiItem } from "viem";
import { somniaTestnet } from "viem/chains";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES, SOMNIA_TESTNET_PRICE_FEED } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { evaluate, createTradeRecord } from "./src/strategy.mjs";
import { placeTakerOrder, placeMakerOrders } from "./src/order.mjs";
import { maybeClaim } from "./src/settle.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Load deployed addresses ──────────────────────────────────────────────────

const deployments = JSON.parse(readFileSync(resolve(ROOT, "deployments/somniaTestnet.json"), "utf8"));
const ORACLE_ADDRESS = deployments.oracle;

// ── Oracle ABI ───────────────────────────────────────────────────────────────

const ORACLE_ABI = [
  parseAbiItem("function getFairValue(bytes32 marketId) view returns (tuple(uint256 fairProbBps, uint256 impliedProbBps, int256 edgeBps, uint256 breakEvenBps, uint256 kellyWad, uint256 sigmaWad, uint256 tauWad, uint64 updatedAt, uint8 reason, bool ok))"),
];

// ── Public client ────────────────────────────────────────────────────────────

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http("https://dream-rpc.somnia.network"),
});

// ── Config ───────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes("--live");
const MAKER_MODE = process.argv.includes("--maker");
const CLAIM_ONLY = process.argv.includes("--claim");
const LOOP = process.argv.includes("--loop");
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? process.argv.find((_, i, a) => a[i - 1] === "--interval") ?? 30000);
const MIN_EDGE_BPS = Number(process.env.SIGMA_MIN_EDGE_BPS ?? 200);
const MAX_STAKE = Number(process.env.SIGMA_MAX_STAKE ?? 25);
const AUTO_CLAIM = process.env.AUTO_CLAIM === "true" || process.argv.includes("--claim");
const VENUE_ID_REAL = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c";

// ── Track record file ────────────────────────────────────────────────────────

const TRACK_FILE = resolve(ROOT, "bot/track-record.json");

function loadTrackRecord() {
  if (existsSync(TRACK_FILE)) {
    return JSON.parse(readFileSync(TRACK_FILE, "utf8"));
  }
  return { trades: [], summary: { totalTrades: 0, wins: 0, losses: 0, skips: 0 } };
}

function saveTrackRecord(record) {
  mkdirSync(dirname(TRACK_FILE), { recursive: true });
  writeFileSync(TRACK_FILE, JSON.stringify(record, null, 2) + "\n");
}

// ── Timestamp helper ─────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function shortId(id) {
  return id.slice(0, 10) + "..." + id.slice(-6);
}

// ── Single pass ──────────────────────────────────────────────────────────────

async function runPass() {
  const now = Math.floor(Date.now() / 1000);
  const track = loadTrackRecord();

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  Sigma ${DRY_RUN ? "DRY_RUN" : "LIVE"}  ${ts()}  UTC`);
  console.log(`  Mode: ${MAKER_MODE ? "MAKER" : "TAKER"}  Oracle: ${ORACLE_ADDRESS}`);
  console.log(`  Min edge: ${MIN_EDGE_BPS} bps  Max stake: ${MAX_STAKE} USDC`);
  console.log(`${"═".repeat(72)}\n`);

  // 1. Create exchange client
  let exchange;
  try {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey && !DRY_RUN) {
      console.error("  DEPLOYER_PRIVATE_KEY required for live mode");
      return { scanned: 0, trades: 0, skips: 0 };
    }

    exchange = new SomniaMarkets({
      indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
      priceFeed: SOMNIA_TESTNET_PRICE_FEED,
      ...(privateKey ? { privateKey } : {}),
    });
    await exchange.loadMarkets();
  } catch (err) {
    console.error(`  Failed to init exchange: ${err.message}`);
    return { scanned: 0, trades: 0, skips: 0 };
  }

  // 2. Load live markets
  const allMarkets = exchange.getMarkets?.() ?? [];
  const live = allMarkets.filter((m) => {
    if (m.venueId !== VENUE_ID_REAL) return false;
    const start = Number(m.tradingStart ?? 0);
    const exp = Number(m.expiry ?? 0);
    return start <= now && now < exp;
  });

  console.log(`  Found ${live.length} live market(s)\n`);

  // 3. Auto-claim if enabled
  if (AUTO_CLAIM) {
    console.log("  Checking for claimable positions...");
    const claimResult = await maybeClaim(exchange, { dryRun: DRY_RUN });
    if (claimResult.redeemed > 0) {
      console.log(`  Claimed ${claimResult.redeemed}/${claimResult.total} position(s)`);
      for (const r of claimResult.results) {
        if (r.hash) console.log(`    ${r.hash}`);
        if (r.error) console.log(`    Error: ${r.error}`);
      }
    } else if (claimResult.message) {
      console.log(`  ${claimResult.message}`);
    } else if (claimResult.error) {
      console.log(`  Claim error: ${claimResult.error}`);
    }
    console.log();
  }

  if (CLAIM_ONLY) {
    console.log("  Claim-only mode, skipping trading.\n");
    return { scanned: live.length, trades: 0, skips: 0 };
  }

  let tradesLogged = 0;
  let skipped = 0;

  for (const market of live) {
    const marketId = market.id ?? market.marketId;
    if (!marketId) continue;

    // 4. Read oracle
    let fairValue;
    try {
      fairValue = await client.readContract({
        address: ORACLE_ADDRESS,
        abi: ORACLE_ABI,
        functionName: "getFairValue",
        args: [marketId],
      });
    } catch (err) {
      console.log(`  ${shortId(marketId)}  oracle error: ${err.shortMessage ?? err.message}`);
      skipped++;
      continue;
    }

    // 5. Read book
    let bookPrice = null;
    try {
      const book = await exchange.fetchOrderBook(market.symbol, 5);
      if (book?.asks?.length > 0) {
        bookPrice = Number(book.asks[0][0]);
      }
    } catch {
      // book unavailable
    }

    // 6. Evaluate
    if (bookPrice === null && !MAKER_MODE) {
      console.log(`  ${shortId(marketId)}  ${market.symbol ?? "?"}  fair: ${(Number(fairValue.fairProbBps) / 100).toFixed(2)}%  book: N/A  [skip: no book]`);
      skipped++;
      continue;
    }

    const decision = bookPrice !== null
      ? evaluate(fairValue, bookPrice, "buyYes", { minEdgeBps: MIN_EDGE_BPS, maxStake: MAX_STAKE })
      : { action: "skip", reason: "no book", edge: 0, kelly: 0 };

    // 7. Display
    const probStr = (Number(fairValue.fairProbBps) / 100).toFixed(2);
    const bookStr = bookPrice !== null ? (bookPrice * 100).toFixed(2) + "%" : "N/A";
    const edgeStr = Number(fairValue.edgeBps) >= 0
      ? `+${Number(fairValue.edgeBps)}`
      : `${Number(fairValue.edgeBps)}`;
    const kellyStr = (Number(fairValue.kellyWad) / 1e18).toFixed(4);

    if (MAKER_MODE && fairValue.ok) {
      // 8. Maker mode — seed the book
      console.log(`  ${shortId(marketId)}  ${market.symbol ?? "?"}  fair: ${probStr}%  [MAKER]`);
      const makerResults = await placeMakerOrders(exchange, market, {
        fairProbBps: Number(fairValue.fairProbBps),
      }, { dryRun: DRY_RUN });

      for (const r of makerResults) {
        if (r.dryRun) {
          console.log(`    WOULD ${r.side} at ${(Number(r.price) / 1e6).toFixed(4)}  size ${(Number(r.quantity) / 1e6).toFixed(2)}`);
        } else if (r.hash) {
          console.log(`    PLACED ${r.side} ${r.hash}`);
        } else if (r.error) {
          console.log(`    ERROR ${r.side}: ${r.error}`);
        }
      }
      tradesLogged++;
    } else if (decision.action === "trade") {
      // 9. Taker mode — hit the ask
      console.log(`  ${shortId(marketId)}  ${market.symbol ?? "?"}`);
      console.log(`    fair: ${probStr}%  book: ${bookStr}  edge: ${edgeStr} bps  kelly: ${kellyStr}`);

      const orderResult = await placeTakerOrder(exchange, market, decision, { dryRun: DRY_RUN });

      if (orderResult.dryRun) {
        console.log(`    -> WOULD ${orderResult.side.toUpperCase()} at price ${(Number(orderResult.price) / 1e6).toFixed(4)}  size ${(Number(orderResult.quantity) / 1e6).toFixed(2)} USDC`);
        console.log(`    [DRY_RUN] no order placed`);
      } else if (orderResult.hash) {
        console.log(`    -> PLACED ${orderResult.side.toUpperCase()} ${orderResult.hash}`);
      } else if (orderResult.error) {
        console.log(`    -> ERROR: ${orderResult.error}`);
      }

      // Record
      const record = createTradeRecord(marketId, decision, fairValue);
      track.trades.push(record);
      track.summary.totalTrades++;
      track.summary.skips++;
      saveTrackRecord(track);
      tradesLogged++;
    } else {
      console.log(`  ${shortId(marketId)}  ${market.symbol ?? "?"}  fair: ${probStr}%  book: ${bookStr}  edge: ${edgeStr} bps  [skip: ${decision.reason}]`);
      skipped++;
    }
    console.log();
  }

  // Summary
  console.log(`${"─".repeat(72)}`);
  console.log(`  Pass complete: ${tradesLogged} trade(s) logged, ${skipped} skipped`);
  console.log(`  Track record: ${track.summary.totalTrades} total logged`);
  console.log(`${"─".repeat(72)}\n`);

  return { scanned: live.length, trades: tradesLogged, skips: skipped };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (LOOP) {
    console.log(`  Starting ${DRY_RUN ? "DRY_RUN" : "LIVE"} loop (interval: ${INTERVAL_MS}ms)`);
    console.log(`  Press Ctrl+C to stop\n`);

    while (true) {
      try {
        await runPass();
      } catch (err) {
        console.error(`  Pass error: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  } else {
    await runPass();
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
