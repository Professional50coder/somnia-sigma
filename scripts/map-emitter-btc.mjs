// Maps the BTC spot pool + MarkPriceUpdated topic0 to an asset key in
// SigmaReactiveVol, independent of creating the reactivity subscription
// itself. Required because the old combined subscribeTo() path reverted at
// the precompile before ever writing this mapping, and the SDK-based
// subscription path (subscribe-btc-sdk.mjs) does not touch contract state at
// all -- it only registers the subscription with the precompile. Without this
// mapping, onEvent() silently emits EventIgnored for every callback forever.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpc = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const client = createPublicClient({ transport: http(rpc) });
const wallet = createWalletClient({ account, transport: http(rpc) });

const deployment = JSON.parse(readFileSync("deployments/somniaTestnet.json", "utf8"));
const artifact = JSON.parse(readFileSync("artifacts/sigma/SigmaReactiveVol.json", "utf8"));

const pool = "0x3605f28aa7c50e7441211e77cb0762d49539326c"; // BTC spot pool (WBTC:USDso)
const topic = "0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888"; // MarkPriceUpdated

const current = await client.readContract({
  address: deployment.reactiveVol,
  abi: artifact.abi,
  functionName: "emitterAsset",
  args: [pool, topic],
});

if (current.toLowerCase() !== "0x0000000000000000000000000000000000000000") {
  console.log(JSON.stringify({ alreadyMapped: true, asset: current }, null, 2));
  process.exit(0);
}

const hash = await wallet.writeContract({
  address: deployment.reactiveVol,
  abi: artifact.abi,
  functionName: "mapEmitter",
  args: [pool, topic, pool], // asset key convention: the pool address identifies BTC
});
const receipt = await client.waitForTransactionReceipt({ hash });

console.log(JSON.stringify({
  pool, topic, assetKey: pool,
  hash, status: receipt.status, gasUsed: receipt.gasUsed.toString(),
}, null, 2));
