/**
 * Arm SigmaCron — schedule the next oracle refresh on-chain.
 *
 * This script tells SigmaCron when to fire next. It does NOT perform
 * the refresh itself — SigmaCron handles that via Somnia reactivity.
 *
 * Usage:
 *   node scripts/arm-cron.mjs                          # schedule next window boundary
 *   node scripts/arm-cron.mjs --sweep                  # also run an immediate refresh
 *   node scripts/arm-cron.mjs --cadence 900            # set cadence to 15 minutes
 *   node scripts/arm-cron.mjs --at 1693161600000       # schedule at specific timestamp ms
 *
 * Requires DEPLOYER_PRIVATE_KEY in .env (SigmaCron owner).
 */

import "dotenv/config";
import { createWalletClient, createPublicClient, http, parseAbiItem, formatEther } from "viem";
import { somniaTestnet } from "viem/chains";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Load config ──────────────────────────────────────────────────────────────

const deployments = JSON.parse(readFileSync(resolve(ROOT, "deployments/somniaTestnet.json"), "utf8"));
const CRON_ADDRESS = deployments.cron;
const ORACLE_ADDRESS = deployments.oracle;

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("  Error: DEPLOYER_PRIVATE_KEY not set in .env");
  process.exit(1);
}

// ── ABI ──────────────────────────────────────────────────────────────────────

const CRON_ABI = [
  parseAbiItem("function setCadence(uint32 seconds_)"),
  parseAbiItem("function setNextScheduledMs(uint256 timestampMs)"),
  parseAbiItem("function sweep()"),
  parseAbiItem("function nextScheduledMs() view returns (uint256)"),
  parseAbiItem("function cadenceSeconds() view returns (uint32)"),
  parseAbiItem("function oracle() view returns (address)"),
  parseAbiItem("function owner() view returns (address)"),
];

// ── Clients ──────────────────────────────────────────────────────────────────

const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http("https://dream-rpc.somnia.network"),
});

const walletClient = createWalletClient({
  account: PRIVATE_KEY,
  chain: somniaTestnet,
  transport: http("https://dream-rpc.somnia.network"),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function nextWindowBoundary(nowMs, cadenceMs = 900_000) {
  // Round up to the next 15-minute boundary
  return Math.ceil(nowMs / cadenceMs) * cadenceMs;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const doSweep = process.argv.includes("--sweep");
  const cadenceIdx = process.argv.indexOf("--cadence");
  const atIdx = process.argv.indexOf("--at");

  console.log(`\n  Sigma Cron Armer  ${ts()}`);
  console.log(`  Chain: Somnia Shannon testnet (50312)`);
  console.log(`  Cron: ${CRON_ADDRESS}`);
  console.log(`  Oracle: ${ORACLE_ADDRESS}`);
  console.log(`  Owner (deployer): ${walletClient.account.address}`);
  console.log();

  // Check balance
  const bal = await publicClient.getBalance({ address: walletClient.account.address });
  console.log(`  Balance: ${formatEther(bal)} STT`);
  if (bal < 100000000000000000n) { // < 0.1 STT
    console.error("  Warning: very low STT balance. Operations may fail.\n");
  }

  // Read current state
  const currentNext = await publicClient.readContract({
    address: CRON_ADDRESS,
    abi: CRON_ABI,
    functionName: "nextScheduledMs",
  });
  const currentCadence = await publicClient.readContract({
    address: CRON_ADDRESS,
    abi: CRON_ABI,
    functionName: "cadenceSeconds",
  });
  const cronOwner = await publicClient.readContract({
    address: CRON_ADDRESS,
    abi: CRON_ABI,
    functionName: "owner",
  });

  console.log(`  Current owner: ${cronOwner}`);
  console.log(`  Current cadence: ${currentCadence}s (${currentCadence / 60} min)`);
  console.log(`  Current nextScheduledMs: ${currentNext} (${new Date(Number(currentNext)).toISOString()})`);
  console.log();

  // Check if we're the owner
  if (cronOwner.toLowerCase() !== walletClient.account.address.toLowerCase()) {
    console.error("  Error: this wallet is not the cron owner. Cannot arm.");
    process.exit(1);
  }

  // 1. Set cadence if requested
  if (cadenceIdx !== -1) {
    const cadence = Number(process.argv[cadenceIdx + 1]);
    console.log(`  Setting cadence to ${cadence}s...`);
    const hash = await walletClient.writeContract({
      address: CRON_ADDRESS,
      abi: CRON_ABI,
      functionName: "setCadence",
      args: [cadence],
    });
    console.log(`  Tx: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  Confirmed in block ${receipt.blockNumber} (gas: ${receipt.gasUsed})\n`);
  }

  // 2. Set next scheduled time
  let targetMs;
  if (atIdx !== -1) {
    targetMs = Number(process.argv[atIdx + 1]);
  } else {
    targetMs = nextWindowBoundary(Date.now());
  }

  console.log(`  Arming cron for: ${new Date(targetMs).toISOString()} (${targetMs}ms)`);
  const hash = await walletClient.writeContract({
    address: CRON_ADDRESS,
    abi: CRON_ABI,
    functionName: "setNextScheduledMs",
    args: [BigInt(targetMs)],
  });
  console.log(`  Tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  Confirmed in block ${receipt.blockNumber} (gas: ${receipt.gasUsed})\n`);

  // 3. Optional: run immediate sweep
  if (doSweep) {
    console.log("  Running immediate sweep...");
    const sweepHash = await walletClient.writeContract({
      address: CRON_ADDRESS,
      abi: CRON_ABI,
      functionName: "sweep",
    });
    console.log(`  Tx: ${sweepHash}`);
    const sweepReceipt = await publicClient.waitForTransactionReceipt({ hash: sweepHash });
    console.log(`  Confirmed in block ${sweepReceipt.blockNumber} (gas: ${sweepReceipt.gasUsed})\n`);
  }

  // Verify
  const newNext = await publicClient.readContract({
    address: CRON_ADDRESS,
    abi: CRON_ABI,
    functionName: "nextScheduledMs",
  });
  console.log(`  Verified nextScheduledMs: ${newNext} (${new Date(Number(newNext)).toISOString()})`);
  console.log(`\n  Done. Cron armed.\n`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
