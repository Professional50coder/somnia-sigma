/**
 * Sigma DRY_RUN runner — full bot loop without placing real orders.
 *
 * Polls live dreamDEX binary markets, reads the SigmaOracle fair value,
 * evaluates edge, and logs what it WOULD do. No signing, no orders, no claims.
 *
 * Usage:
 *   node run-dry-run.mjs                   # single pass
 *   node run-dry-run.mjs --loop            # poll every 30s
 *   node run-dry-run.mjs --loop --interval 15000
 *
 * Environment:
 *   SIGMA_MIN_EDGE_BPS=200    minimum edge to act (default 200)
 *   SIGMA_MAX_STAKE=25        max USDC per trade (default 25)
 *   LOOP=false                set to "true" for continuous polling
 *   INTERVAL_MS=30000         poll interval in ms
 */

import "dotenv/config";
import { createPublicClient, http, parseAbiItem } from "viem";
import { somniaTestnet } from "viem/chains";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeReadOnlyExchange, VENUE_ID_REAL } from "./src/client.mjs";
import { evaluate, createTradeRecord } from "./src/strategy.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Load deployed addresses ──────────────────────────────────────────────────

const deployments = JSON.parse(readFileSync(resolve(ROOT, "deployments/somniaTestnet.json"), "utf8"));
const ORACLE_ADDRESS = deployments.oracle;

// ── Oracle ABI (from compiled artifact, avoids parseAbiItem tuple issues) ────

const ORACLE_ABI = JSON.parse(readFileSync(resolve(ROOT, "artifacts/sigma/SigmaOracle.json"), "utf8")).abi;

// ── Public client ────────────────────────────────────────────────────────────

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http("https://dream-rpc.somnia.network"),
});

// ── Config ───────────────────────────────────────────────────────────────────

const MIN_EDGE_BPS = Number(process.env.SIGMA_MIN_EDGE_BPS ?? 200);
const MAX_STAKE = Number(process.env.SIGMA_MAX_STAKE ?? 25);
const LOOP = process.argv.includes("--loop") || process.env.LOOP === "true";
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? process.argv.find((_, i, a) => a[i - 1] === "--interval") ?? 30000);

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

// ── Single pass ──────────────────────────────────────────────────────────────

async function runPass() {
  const now = Math.floor(Date.now() / 1000);
  const track = loadTrackRecord();

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  Sigma DRY_RUN  ${ts()}  UTC`);
  console.log(`  Oracle: ${ORACLE_ADDRESS}`);
  console.log(`  Min edge: ${MIN_EDGE_BPS} bps  Max stake: ${MAX_STAKE} USDC`);
  console.log(`${"═".repeat(72)}\n`);

  // 1. Load markets
  let exchange;
  try {
    exchange = await makeReadOnlyExchange();
  } catch (err) {
    console.error(`  Failed to load markets: ${err.message}`);
    return { scanned: 0, trades: 0, skips: 0 };
  }

  const allMarkets = exchange.getMarkets?.() ?? [];
  const live = allMarkets.filter((m) => {
    if (m.venueId !== VENUE_ID_REAL) return false;
    const start = Number(m.tradingStart ?? 0);
    const exp = Number(m.expiry ?? 0);
    return start <= now && now < exp;
  });

  console.log(`  Found ${live.length} live market(s)\n`);

  let tradesLogged = 0;
  let skipped = 0;

  for (const market of live) {
    const marketId = market.id ?? market.marketId;
    if (!marketId) continue;

    // 2. Read oracle
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

    // 3. Read book
    let bookPrice = null;
    try {
      const book = await exchange.fetchOrderBook(market.symbol, 5);
      if (book?.asks?.length > 0) {
        bookPrice = Number(book.asks[0][0]);
      }
    } catch {
      // book unavailable
    }

    // 4. Evaluate
    if (bookPrice === null) {
      console.log(`  ${shortId(marketId)}  ${market.symbol ?? "?"}  fair: ${(Number(fairValue.fairProbBps) / 100).toFixed(2)}%  book: N/A  [skip: no book]`);
      skipped++;
      continue;
    }

    const decision = evaluate(fairValue, bookPrice, "buyYes", {
      minEdgeBps: MIN_EDGE_BPS,
      maxStake: MAX_STAKE,
    });

    // 5. Log
    const probStr = (Number(fairValue.fairProbBps) / 100).toFixed(2);
    const bookStr = (bookPrice * 100).toFixed(2);
    const edgeStr = Number(fairValue.edgeBps) >= 0
      ? `+${Number(fairValue.edgeBps)}`
      : `${Number(fairValue.edgeBps)}`;
    const kellyStr = (Number(fairValue.kellyWad) / 1e18).toFixed(4);

    if (decision.action === "trade") {
      console.log(`  ${shortId(marketId)}  ${market.symbol ?? "?"}`);
      console.log(`    fair: ${probStr}%  book: ${bookStr}%  edge: ${edgeStr} bps  kelly: ${kellyStr}`);
      console.log(`    -> WOULD ${decision.side.toUpperCase()} at price ${(Number(decision.priceRaw) / 1e6).toFixed(4)}  size ${(Number(decision.sizeRaw) / 1e6).toFixed(2)} USDC`);
      console.log(`    [DRY_RUN] no order placed`);

      // Record
      const record = createTradeRecord(marketId, decision, fairValue);
      track.trades.push(record);
      track.summary.totalTrades++;
      track.summary.skips++; // not yet settled
      saveTrackRecord(track);
      tradesLogged++;
    } else {
      console.log(`  ${shortId(marketId)}  ${market.symbol ?? "?"}  fair: ${probStr}%  book: ${bookStr}%  edge: ${edgeStr} bps  [skip: ${decision.reason}]`);
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
    console.log(`  Starting DRY_RUN loop (interval: ${INTERVAL_MS}ms)`);
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

function shortId(id) {
  return id.slice(0, 10) + "..." + id.slice(-6);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
