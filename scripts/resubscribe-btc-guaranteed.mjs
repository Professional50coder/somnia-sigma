// The friendly SDK.subscribe() wrapper defaults isGuaranteed to false, and a
// 2026-08-27 live test showed zero callbacks delivered after several minutes
// against a feed confirmed to be firing ~0.5/sec. subscribeRaw() exposes the
// full SubscriptionData struct so isGuaranteed can be forced to true.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK } from "@somnia-chain/reactivity";

const rpc = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const publicClient = createPublicClient({ transport: http(rpc) });
const wallet = createWalletClient({ account, transport: http(rpc) });
const sdk = new SDK({ public: publicClient, wallet });
const d = JSON.parse(readFileSync("deployments/somniaTestnet.json", "utf8"));

const oldSubscriptionId = 14222133n;

const unsub = await sdk.unsubscribe(oldSubscriptionId);
if (unsub instanceof Error) console.warn("unsubscribe warning:", unsub.message);
else console.log("unsubscribed old id", oldSubscriptionId.toString(), "tx", unsub);

const result = await sdk.subscribeRaw({
  eventTopics: [
    "0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888",
    "0x0000000000000000000000000000000000000000000000000000000000000000".slice(0, 66),
    "0x0000000000000000000000000000000000000000000000000000000000000000".slice(0, 66),
    "0x0000000000000000000000000000000000000000000000000000000000000000".slice(0, 66),
  ],
  origin: "0x0000000000000000000000000000000000000000",
  caller: "0x0000000000000000000000000000000000000000",
  emitter: "0x3605f28aA7C50e7441211e77Cb0762d49539326C",
  handlerContractAddress: d.reactiveVol,
  handlerFunctionSelector: "0x53edf33d",
  priorityFeePerGas: 2_000_000_000n,
  maxFeePerGas: 10_000_000_000n,
  gasLimit: 500_000n,
  isGuaranteed: true,
  isCoalesced: false,
});
if (result instanceof Error) throw result;
console.log("new subscription tx:", result);
