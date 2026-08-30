/**
 * Sigma Proof of Work — comprehensive on-chain activity generator.
 *
 * Uses the Bot wallet (50 STT) to fund the Deployer, push fresh BTC prices
 * into RealizedVol, publish a live window, refresh the oracle, and read
 * the resulting fair value. Produces a complete audit trail.
 *
 * Usage:
 *   node scripts/proof-of-work.mjs              # full pipeline
 *   node scripts/proof-of-work.mjs --dry-run    # show what would happen
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  parseAbiItem,
  formatEther,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  SomniaMarkets,
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

// ── Constants ────────────────────────────────────────────────────────────────

const VENUE_ID_REAL =
  "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c";
const BTC_SPOT_POOL = "0x3605f28aA7C50e7441211e77Cb0762d49539326C";
const MARK_PRICE_UPDATED_TOPIC0 =
  "0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888";
const FUND_AMOUNT = 1000000000000000000n; // 1 STT

// ── Load artifacts & deployment ──────────────────────────────────────────────

const deployment = JSON.parse(
  readFileSync("deployments/somniaTestnet.json", "utf8")
);
const volArtifact = JSON.parse(
  readFileSync("artifacts/sigma/RealizedVol.json", "utf8")
);
const registryArtifact = JSON.parse(
  readFileSync("artifacts/sigma/SigmaWindowRegistry.json", "utf8")
);
const oracleArtifact = JSON.parse(
  readFileSync("artifacts/sigma/SigmaOracle.json", "utf8")
);

// ── Clients ──────────────────────────────────────────────────────────────────

const RPC = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
const deployerAccount = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const botAccount = privateKeyToAccount(process.env.PRIVATE_KEY);

const client = createPublicClient({ transport: http(RPC) });
const deployerWallet = createWalletClient({
  account: deployerAccount,
  transport: http(RPC),
});
const botWallet = createWalletClient({
  account: botAccount,
  transport: http(RPC),
});

const MARK_PRICE_ABI = [
  parseAbiItem(
    "event MarkPriceUpdated(address indexed asset, uint256 markPrice, uint256 rawMidpoint)"
  ),
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
const short = (id) => id.slice(0, 10) + "..." + id.slice(-6);

function txHash(hash) {
  return `https://shannon-explorer.somnia.network/tx/${hash}`;
}

// ── Main pipeline ────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const proof = { steps: [], txs: [], timestamp: new Date().toISOString() };

  console.log("\n" + "═".repeat(72));
  console.log("  SIGMA PROOF OF WORK");
  console.log("  " + new Date().toISOString());
  console.log("  Mode:", dryRun ? "DRY RUN (no txs)" : "LIVE (real on-chain txs)");
  console.log("═".repeat(72) + "\n");

  // ── Step 0: Check balances ───────────────────────────────────────────────

  log("Step 0: Checking balances...");
  const [deployerBal, botBal] = await Promise.all([
    client.getBalance({ address: deployerAccount.address }),
    client.getBalance({ address: botAccount.address }),
  ]);
  const deployerSTT = formatEther(deployerBal);
  const botSTT = formatEther(botBal);
  log(`  Deployer: ${deployerSTT} STT`);
  log(`  Bot:      ${botSTT} STT`);
  proof.steps.push({
    step: "balances",
    deployerSTT,
    botSTT,
    deployerAddress: deployerAccount.address,
    botAddress: botAccount.address,
  });

  // ── Step 1: Fund deployer from bot ─────────────────────────────────────

  if (deployerBal < 20000000000000000n) {
    // < 0.02 STT
    log("\nStep 1: Funding deployer from bot wallet (1 STT)...");
    if (dryRun) {
      log("  [DRY RUN] Would send 1 STT from bot to deployer");
    } else {
      try {
        const hash = await botWallet.sendTransaction({
          to: deployerAccount.address,
          value: FUND_AMOUNT,
        });
        const receipt = await client.waitForTransactionReceipt({ hash });
        log(`  Funded! tx: ${short(hash)} status=${receipt.status}`);
        log(`  Explorer: ${txHash(hash)}`);
        proof.txs.push({ type: "fund", hash, status: receipt.status });
      } catch (err) {
        log(`  Fund failed: ${err.shortMessage ?? err.message}`);
        log("  Continuing with existing balance...");
      }
    }
  } else {
    log("\nStep 1: Deployer already funded, skipping transfer.");
  }
  proof.steps.push({ step: "fund", action: "transfer STT" });

  // ── Step 2: Push BTC prices into RealizedVol ──────────────────────────

  log("\nStep 2: Pushing BTC mark prices into RealizedVol...");

  // Get latest mark price from the BTC pool
  const latest = await client.getBlockNumber();
  const from = latest > 900n ? latest - 900n : 0n;
  const rawLogs = await client.getLogs({
    address: BTC_SPOT_POOL,
    topics: [MARK_PRICE_UPDATED_TOPIC0],
    fromBlock: from,
    toBlock: "latest",
  });
  const logs = rawLogs.filter((l) => l.topics[0] === MARK_PRICE_UPDATED_TOPIC0);
  log(`  Found ${logs.length} genuine MarkPriceUpdated events`);

  let pushCount = 0;
  const pushTargets = Math.min(5, logs.length); // push up to 5 fresh prices

  for (let i = logs.length - pushTargets; i < logs.length; i++) {
    const logEntry = logs[i];
    const decoded = decodeEventLog({
      abi: MARK_PRICE_ABI,
      data: logEntry.data,
      topics: logEntry.topics,
    });
    const markPriceWad = decoded.args.markPrice;

    if (
      typeof markPriceWad !== "bigint" ||
      markPriceWad <= 0n ||
      markPriceWad < 1000n * 10n ** 18n ||
      markPriceWad > 10_000_000n * 10n ** 18n
    ) {
      continue;
    }

    if (dryRun) {
      log(
        `  [DRY RUN] Would push price ${(Number(markPriceWad) / 1e18).toFixed(2)} (block ${logEntry.blockNumber})`
      );
      pushCount++;
      continue;
    }

    try {
      const hash = await deployerWallet.writeContract({
        address: deployment.realizedVol,
        abi: volArtifact.abi,
        functionName: "recordPrice",
        args: [BTC_SPOT_POOL, markPriceWad],
      });
      const receipt = await client.waitForTransactionReceipt({ hash });
      pushCount++;
      log(
        `  Pushed ${(Number(markPriceWad) / 1e18).toFixed(2)} -> tx: ${short(hash)} status=${receipt.status}`
      );
      proof.txs.push({
        type: "recordPrice",
        hash,
        price: (Number(markPriceWad) / 1e18).toFixed(2),
        status: receipt.status,
      });
    } catch (err) {
      log(`  Push failed: ${err.shortMessage ?? err.message}`);
    }
  }
  log(`  Pushed ${pushCount} price(s)`);
  proof.steps.push({ step: "pushPrices", count: pushCount });

  // ── Step 3: Read volatility state ─────────────────────────────────────

  log("\nStep 3: Reading on-chain volatility state...");
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
  const sigmaResult = await client.readContract({
    address: deployment.realizedVol,
    abi: volArtifact.abi,
    functionName: "sigmaWad",
    args: [BTC_SPOT_POOL],
  });
  log(`  sampleCount: ${sampleCount}`);
  log(`  lastPrice: ${(Number(lastPrice) / 1e18).toFixed(2)} USD`);
  log(`  sigma: ${(Number(sigmaResult[0]) / 1e18).toFixed(6)}`);
  log(`  sigma ok: ${sigmaResult[2]}`);
  proof.steps.push({
    step: "volState",
    sampleCount: Number(sampleCount),
    lastPrice: (Number(lastPrice) / 1e18).toFixed(2),
    sigmaOk: sigmaResult[2],
  });

  // ── Step 4: Find and publish a live BTC window ────────────────────────

  log("\nStep 4: Discovering live BTC markets...");
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
  log(`  Found ${live.length} live BTC market(s)`);

  if (live.length === 0) {
    log("  No live markets available. Cannot publish window.");
    proof.steps.push({ step: "publish", status: "no live markets" });
  } else {
    // Pick market with most time remaining
    live.sort((a, b) => Number(b.expiry) - Number(a.expiry));
    const market = live[0];
    const marketId = market.marketId ?? market.id;
    log(`  Selected: ${short(marketId)}`);
    log(`    pool: ${market.poolAddress ?? market.marketAddress}`);
    log(`    expiry: ${new Date(Number(market.expiry) * 1000).toISOString()}`);
    log(
      `    time remaining: ${Math.round((Number(market.expiry) - now) / 60)} min`
    );

    // Get opening price
    const openingPrices = await exchange.client.getOpeningPrices([marketId]);
    const openingPriceRaw = openingPrices[marketId.toLowerCase()];
    log(`    opening price (raw): ${openingPriceRaw} -> ${(Number(openingPriceRaw) / 100).toFixed(2)} USD`);

    if (!openingPriceRaw || openingPriceRaw === "0") {
      log("  No opening price available. Skipping publish.");
      proof.steps.push({ step: "publish", status: "no opening price" });
    } else {
      const poolAddress = market.poolAddress ?? market.marketAddress;
      const window = {
        marketId,
        asset: `0x${Buffer.from("BTC")
          .toString("hex")
          .padEnd(64, "0")}`,
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

      log("\n  Publishing window to SigmaWindowRegistry...");
      let publishHash, publishReceipt;
      if (dryRun) {
        log("  [DRY RUN] Would publish window");
      } else {
        try {
          publishHash = await deployerWallet.writeContract({
            address: deployment.registry,
            abi: registryArtifact.abi,
            functionName: "publishWindow",
            args: [window],
          });
          publishReceipt = await client.waitForTransactionReceipt({
            hash: publishHash,
          });
          log(`  Published! tx: ${short(publishHash)} status=${publishReceipt.status}`);
          log(`  Explorer: ${txHash(publishHash)}`);
          proof.txs.push({
            type: "publishWindow",
            hash: publishHash,
            status: publishReceipt.status,
          });
        } catch (err) {
          log(`  Publish failed: ${err.shortMessage ?? err.message}`);
        }
      }

      // ── Step 5: Refresh oracle ──────────────────────────────────────

      log("\nStep 5: Calling SigmaOracle.refresh()...");
      let refreshHash, refreshReceipt;
      if (dryRun) {
        log("  [DRY RUN] Would refresh oracle");
      } else {
        try {
          refreshHash = await deployerWallet.writeContract({
            address: deployment.oracle,
            abi: oracleArtifact.abi,
            functionName: "refresh",
            args: [marketId],
          });
          refreshReceipt = await client.waitForTransactionReceipt({
            hash: refreshHash,
          });
          log(`  Refreshed! tx: ${short(refreshHash)} status=${refreshReceipt.status}`);
          log(`  Explorer: ${txHash(refreshHash)}`);
          proof.txs.push({
            type: "oracleRefresh",
            hash: refreshHash,
            status: refreshReceipt.status,
          });
        } catch (err) {
          log(`  Refresh failed: ${err.shortMessage ?? err.message}`);
        }
      }

      // ── Step 6: Read fair value ────────────────────────────────────

      log("\nStep 6: Reading fair value from SigmaOracle...");
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
        breakEven: (Number(fairValue[3]) / 10000).toFixed(2) + "%",
        kelly: (Number(fairValue[4]) / 1e18).toFixed(4),
        sigma: (Number(fairValue[5]) / 1e18).toFixed(6),
        tau: (Number(fairValue[6]) / 1e18).toFixed(4),
        ok: fairValue[9],
        reason: fairValue[8],
      };

      log(`  Fair probability: ${fv.fairProb}`);
      log(`  Implied (book):   ${fv.impliedProb}`);
      log(
        `  Edge:             ${fv.edge >= 0 ? "+" : ""}${fv.edge} bps`
      );
      log(`  Break-even:       ${fv.breakEven}`);
      log(`  Kelly fraction:   ${fv.kelly}`);
      log(`  Sigma (vol):      ${fv.sigma}`);
      log(`  Tau (time left):  ${fv.tau}`);
      log(`  OK:               ${fv.ok}`);
      if (!fv.ok) log(`  Reason:           reason=${fv.reason}`);

      proof.steps.push({ step: "fairValue", ...fv, marketId });
    }
  }

  // ── Step 7: Final balance check ───────────────────────────────────────

  log("\nStep 7: Final balances...");
  const [finalDeployer, finalBot] = await Promise.all([
    client.getBalance({ address: deployerAccount.address }),
    client.getBalance({ address: botAccount.address }),
  ]);
  log(`  Deployer: ${formatEther(finalDeployer)} STT (was ${deployerSTT})`);
  log(`  Bot:      ${formatEther(finalBot)} STT (was ${botSTT})`);
  const gasUsed = Number(deployerBal - finalDeployer + FUND_AMOUNT) / 1e18;
  log(`  Estimated gas spent: ~${gasUsed.toFixed(4)} STT`);

  // ── Summary ───────────────────────────────────────────────────────────

  console.log("\n" + "═".repeat(72));
  console.log("  PROOF OF WORK COMPLETE");
  console.log("═".repeat(72));
  console.log(`  Total on-chain transactions: ${proof.txs.length}`);
  for (const tx of proof.txs) {
    console.log(
      `    ${tx.type}: ${short(tx.hash)} [${tx.status}]${tx.price ? ` price=$${tx.price}` : ""}`
    );
  }
  console.log(`  Timestamp: ${proof.timestamp}`);
  console.log("═".repeat(72) + "\n");

  // Save proof
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const proofDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "proofs");
  mkdirSync(proofDir, { recursive: true });
  const proofFile = resolve(
    proofDir,
    `proof-${Date.now()}.json`
  );
  writeFileSync(proofFile, JSON.stringify(proof, null, 2) + "\n");
  log(`Proof saved to: ${proofFile}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
