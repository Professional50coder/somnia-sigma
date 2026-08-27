// FALLBACK MECHANISM — adopted after exhaustive reactivity-delivery
// diagnosis found six correctly-registered subscriptions all delivering zero
// callbacks (see FINDINGS.md). This replaces PUSH (reactivity) with PULL
// (scheduled polling), reading the exact same on-chain source
// (MarkPriceUpdated on the dreamDEX BTC spot pool) so the data provenance is
// unchanged -- only the delivery mechanism differs. Honest framing: this is
// an off-chain scheduled process, not the originally-designed keeper-free
// reactivity path. State that plainly anywhere this is discussed.
//
// Correctness note: each tick pushes ONLY the current latest price, never a
// backfill of missed historical events. RealizedVol's variance-rate
// estimator divides by (block.timestamp - lastUpdatedAt); replaying old
// events in a tight loop would make every gap artificially tiny and corrupt
// the per-second rate. Polling for "the current price, right now" every
// POLL_INTERVAL_MS approximates a real, evenly-paced observation stream,
// which is what the estimator assumes.
//
// Run:  node scripts/fallback-price-pusher.mjs
// Stop: Ctrl+C (or let it run -- it logs every push and every skip)
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, decodeEventLog, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const MARK_PRICE_UPDATED_ABI = [parseAbiItem(
  "event MarkPriceUpdated(address indexed asset, uint256 markPrice, uint256 rawMidpoint)",
)];

const RPC = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
const POLL_INTERVAL_MS = 20_000; // 30 samples (MIN_SAMPLES) at this cadence = ~10 minutes to first "ok" reading
const BTC_POOL = "0x3605f28aA7C50e7441211e77Cb0762d49539326C";
const MARK_PRICE_UPDATED_TOPIC0 = "0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888";
const ASSET_KEY = BTC_POOL; // matches the convention already used by mapEmitter(pool, topic0, pool)

const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const client = createPublicClient({ transport: http(RPC) });
const wallet = createWalletClient({ account, transport: http(RPC) });

const deployment = JSON.parse(readFileSync("deployments/somniaTestnet.json", "utf8"));
const artifact = JSON.parse(readFileSync("artifacts/sigma/RealizedVol.json", "utf8"));

let lastPushedPrice = null;
let pushCount = 0;
let skipCount = 0;

async function tick() {
  const stamp = new Date().toISOString();
  try {
    const latest = await client.getBlockNumber();
    const from = latest > 900n ? latest - 900n : 0n; // stay under the 1000-block eth_getLogs cap
    const rawLogs = await client.getLogs({
      address: BTC_POOL,
      topics: [MARK_PRICE_UPDATED_TOPIC0],
      fromBlock: from,
      toBlock: "latest",
    });

    // DEFENSIVE FILTER, load-bearing: confirmed live that this RPC does NOT
    // reliably enforce the topics filter server-side -- a direct check found
    // 262 of 286 "filtered" results had a DIFFERENT topics[0] than requested
    // (other events on the same pool: Transfer-like, Swap-like, etc). The
    // decodeEventLog + sanity-band checks below catch most fallout from this,
    // but re-checking topics[0] explicitly closes the actual root cause
    // rather than only its symptoms.
    const logs = rawLogs.filter((l) => l.topics[0] === MARK_PRICE_UPDATED_TOPIC0);

    if (logs.length === 0) {
      skipCount += 1;
      console.log(`[${stamp}] no genuine MarkPriceUpdated in the last 900 blocks (${rawLogs.length} raw incl. non-matching, 0 after topic filter) -- skipping (skips=${skipCount})`);
      return;
    }

    const mostRecent = logs[logs.length - 1];
    const decoded = decodeEventLog({
      abi: MARK_PRICE_UPDATED_ABI,
      data: mostRecent.data,
      topics: mostRecent.topics,
    });
    const markPriceWad = decoded.args.markPrice;

    if (typeof markPriceWad !== "bigint" || markPriceWad <= 0n) {
      skipCount += 1;
      console.log(`[${stamp}] decoded markPrice looked wrong (${markPriceWad}) -- skipping (skips=${skipCount})`);
      return;
    }
    // Sanity bound: BTC/USD should be nowhere near 1 or near 1e12 in WAD terms.
    // Catches any residual decode/scale error before it poisons the estimator.
    if (markPriceWad < 1_000n * 10n ** 18n || markPriceWad > 10_000_000n * 10n ** 18n) {
      skipCount += 1;
      console.log(`[${stamp}] decoded markPrice ${markPriceWad} outside a sane BTC/USD band -- skipping (skips=${skipCount})`);
      return;
    }

    if (markPriceWad === lastPushedPrice) {
      skipCount += 1;
      console.log(`[${stamp}] price unchanged (${markPriceWad}) -- skipping to avoid a zero log-return sample (skips=${skipCount})`);
      return;
    }

    const hash = await wallet.writeContract({
      address: deployment.realizedVol,
      abi: artifact.abi,
      functionName: "recordPrice",
      args: [ASSET_KEY, markPriceWad],
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    lastPushedPrice = markPriceWad;
    pushCount += 1;
    console.log(`[${stamp}] pushed price ${markPriceWad} (block ${mostRecent.blockNumber}) -> tx ${hash} status=${receipt.status} (pushes=${pushCount})`);
  } catch (err) {
    skipCount += 1;
    console.error(`[${stamp}] tick failed, will retry next interval:`, err.shortMessage ?? err.message);
  }
}

console.log(`Fallback price pusher starting. Asset key: ${ASSET_KEY}. Poll interval: ${POLL_INTERVAL_MS}ms.`);
console.log(`MIN_SAMPLES=30 means ~${Math.round((30 * POLL_INTERVAL_MS) / 60000)} minutes to first "ok" volatility reading, assuming the price changes most ticks.`);
await tick();
setInterval(tick, POLL_INTERVAL_MS);
