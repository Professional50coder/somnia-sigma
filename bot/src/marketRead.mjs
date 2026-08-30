/**
 * Sigma market reader — lists live dreamDEX binary markets, reads the
 * SigmaOracle fair value, and shows the edge.
 *
 * No signing, no order placement. Read-only by construction.
 *
 * Usage:
 *   node src/marketRead.mjs              # list live markets + oracle values
 *   node src/marketRead.mjs --json       # machine-readable output
 */

import { createPublicClient, http, parseAbiItem } from "viem";
import { somniaTestnet } from "viem/chains";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeReadOnlyExchange, VENUE_ID_REAL } from "./client.mjs";
import { evaluate } from "./strategy.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

// ── Load deployed addresses ──────────────────────────────────────────────────

const deployments = JSON.parse(readFileSync(resolve(ROOT, "deployments/somniaTestnet.json"), "utf8"));

const ORACLE_ADDRESS = deployments.oracle;
const REGISTRY_ADDRESS = deployments.registry;

// ── Oracle ABI (from compiled artifact) ─────────────────────────────────────

const ORACLE_ABI = JSON.parse(readFileSync(resolve(ROOT, "artifacts/sigma/SigmaOracle.json"), "utf8")).abi;

// ── Public client (read-only, viem) ──────────────────────────────────────────

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http("https://dream-rpc.somnia.network"),
});

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const jsonMode = process.argv.includes("--json");

  // 1. Load markets via SDK
  const exchange = await makeReadOnlyExchange();
  const allMarkets = exchange.getMarkets?.() ?? [];

  // Filter to live binary markets on the real Up/Down venue
  const now = Math.floor(Date.now() / 1000);
  const live = allMarkets.filter((m) => {
    if (m.venueId !== VENUE_ID_REAL) return false;
    // Must be between tradingStart and expiry
    const start = Number(m.tradingStart ?? 0);
    const exp = Number(m.expiry ?? 0);
    return start <= now && now < exp;
  });

  if (!jsonMode) {
    console.log(`\n  Sigma Market Reader`);
    console.log(`  Chain: Somnia Shannon testnet (50312)`);
    console.log(`  Oracle: ${ORACLE_ADDRESS}`);
    console.log(`  Venue: ${VENUE_ID_REAL}`);
    console.log(`  Live markets: ${live.length}`);
    console.log(`  ${"─".repeat(80)}\n`);
  }

  const results = [];

  for (const market of live) {
    const marketId = market.id ?? market.marketId;
    if (!marketId) continue;

    // 2. Read oracle fair value
    let fairValue;
    try {
      fairValue = await client.readContract({
        address: ORACLE_ADDRESS,
        abi: ORACLE_ABI,
        functionName: "getFairValue",
        args: [marketId],
      });
    } catch (err) {
      if (!jsonMode) {
        console.log(`  ${shortId(marketId)}  oracle read failed: ${err.shortMessage ?? err.message}`);
      }
      continue;
    }

    // 3. Read book price
    let bookPrice = null;
    try {
      const book = await exchange.fetchOrderBook(market.symbol, 5);
      if (book && book.asks && book.asks.length > 0) {
        bookPrice = Number(book.asks[0][0]); // best YES ask
      }
    } catch {
      // book unavailable — show oracle only
    }

    // 4. Run strategy evaluation
    let decision = null;
    if (bookPrice !== null) {
      decision = evaluate(fairValue, bookPrice, "buyYes");
    }

    // 5. Display
    if (jsonMode) {
      results.push({
        marketId,
        symbol: market.symbol,
        fairProbBps: Number(fairValue.fairProbBps),
        edgeBps: Number(fairValue.edgeBps),
        kellyWad: fairValue.kellyWad.toString(),
        sigmaWad: fairValue.sigmaWad.toString(),
        tauWad: fairValue.tauWad.toString(),
        ok: fairValue.ok,
        reason: fairValue.reason,
        updatedAt: Number(fairValue.updatedAt),
        bookPrice,
        decision: decision?.action ?? null,
      });
    } else {
      const fv = fairValue;
      const okStr = fv.ok ? "OK" : `NOT-OK(${fv.reason})`;
      const edgeStr = Number(fv.edgeBps) >= 0
        ? `+${Number(fv.edgeBps)} bps`
        : `${Number(fv.edgeBps)} bps`;
      const probStr = (Number(fv.fairProbBps) / 100).toFixed(2) + "%";
      const bookStr = bookPrice !== null ? (bookPrice * 100).toFixed(2) + "%" : "no book";
      const kellyStr = (Number(fv.kellyWad) / 1e18).toFixed(4);
      const decStr = decision ? `[${decision.action}] ${decision.side ?? ""}` : "[skip] no book";

      console.log(`  ${shortId(marketId)}  ${market.symbol ?? "?"}`);
      console.log(`    fair: ${probStr}  book: ${bookStr}  edge: ${edgeStr}  kelly: ${kellyStr}  ${okStr}`);
      console.log(`    σ: ${(Number(fv.sigmaWad) / 1e18).toFixed(6)}  τ: ${(Number(fv.tauWad) / 1e18).toFixed(4)}  ${decStr}`);
      console.log();
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2));
  } else if (results.length === 0 && live.length === 0) {
    console.log("  No live markets found. Markets may have expired or venue changed.");
  }
}

function shortId(id) {
  return id.slice(0, 10) + "..." + id.slice(-6);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
