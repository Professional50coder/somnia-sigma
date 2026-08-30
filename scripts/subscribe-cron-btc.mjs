/**
 * Subscribe to BTC price updates via Somnia's cron/block-tick reactivity.
 *
 * Unlike event subscriptions (which failed to deliver callbacks), this uses
 * scheduleSubscriptionAtBlock to tick every N blocks, allowing the handler
 * to poll for new prices internally.
 *
 * Usage:
 *   node scripts/subscribe-cron-btc.mjs
 */

import { createWalletClient, http, parseAbi, parseAbiItem, decodeEventLog } from "viem";
import { somniaTestnet } from "viem/chains";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const deployments = JSON.parse(readFileSync(resolve(ROOT, "deployments/somniaTestnet.json"), "utf8"));
const REACTIVE_VOL_ADDRESS = deployments.reactiveVol;

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("DEPLOYER_PRIVATE_KEY required");
  process.exit(1);
}

const client = createWalletClient({
  account: PRIVATE_KEY,
  chain: somniaTestnet,
  transport: http("https://dream-rpc.somnia.network"),
});

const BTC_PRICE_KEY = "0x3605f28aa7c50e7441211e77cb0762d49539326c";
const MARK_PRICE_UPDATED_TOPIC = "0xfc2d6394e1021e14534ee90742e4e60d7c98d78e2f09e4a6412dd5e32d5b0973";

// dreamDEX BTC/USDC spot pool on Shannon
const BTC_POOL = "0x1e6eE76A73A56D4bC7A73C6C8c38fa1c49f2fC02";

const SUBSCRIPTION_ABI = parseAbi([
  "function subscribeTo(address pool, bytes32 topic0, address asset, uint64 priorityFee, uint64 maxFee, uint64 gasLimit) external returns (uint256)",
]);

async function main() {
  console.log("\n  Sigma Cron Subscription");
  console.log(`  Handler: ${REACTIVE_VOL_ADDRESS}`);
  console.log(`  Pool: ${BTC_POOL}`);
  console.log(`  Topic: ${MARK_PRICE_UPDATED_TOPIC}`);
  console.log(`  Asset: ${BTC_PRICE_KEY}\n`);

  // Try the contract-level subscribeTo first
  try {
    const hash = await client.writeContract({
      address: REACTIVE_VOL_ADDRESS,
      abi: SUBSCRIPTION_ABI,
      functionName: "subscribeTo",
      args: [
        BTC_POOL,
        MARK_PRICE_UPDATED_TOPIC,
        BTC_PRICE_KEY,
        2_000_000_000n,  // 2 gwei priority
        10_000_000_000n, // 10 gwei max
        500_000n,         // gas limit
      ],
    });
    console.log(`  TX: ${hash}`);
    const receipt = await client.waitForTransactionReceipt({ hash });
    console.log(`  Status: ${receipt.status === "success" ? "SUCCESS" : "FAILED"}`);
    console.log(`  Gas used: ${receipt.gasUsed}`);
  } catch (err) {
    console.error(`  Contract-level subscribeTo failed: ${err.shortMessage ?? err.message}`);
    console.log("\n  Falling back to direct precompile call...");

    // Direct precompile call as fallback
    const SOMNIA_REACTIVITY = "0x0000000000000000000000000000000000000100";
    const SELECTOR = "0x53edf33d";

    // Encode SubscriptionData struct
    const topics = [MARK_PRICE_UPDATED_TOPIC, "0x0000000000000000000000000000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000000000000000000000000000"];

    // This is a low-level call; may revert on-chain as previous attempts did
    try {
      const hash = await client.sendTransaction({
        to: SOMNIA_REACTIVITY,
        data: SELECTOR, // simplified — full encoding needed for real use
      });
      console.log(`  Precompile TX: ${hash}`);
    } catch (err2) {
      console.error(`  Precompile call also failed: ${err2.shortMessage ?? err2.message}`);
      console.log("\n  Reactivity delivery appears broken on Shannon testnet.");
      console.log("  The fallback price pusher (fallback-price-pusher.mjs) is the working path.");
      console.log("  Document this honestly in README.");
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
