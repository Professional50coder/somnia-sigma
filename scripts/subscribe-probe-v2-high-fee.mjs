// Base fee measured at 6 gwei right now. Original subscription used
// priorityFeePerGas=2gwei / maxFeePerGas=10gwei (8 gwei effective, thin
// margin). Testing whether much higher fees unlock delivery to the same
// (already deployed, ungated) ReactivityProbeV2.
import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK } from "@somnia-chain/reactivity";

const rpc = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const client = createPublicClient({ transport: http(rpc) });
const wallet = createWalletClient({ account, transport: http(rpc) });
const sdk = new SDK({ public: client, wallet });

const probe = "0x528362f99367ca15abf6a855f08c447f6ca3ef09"; // ReactivityProbeV2, already deployed

const result = await sdk.subscribeRaw({
  eventTopics: [
    "0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  ],
  origin: "0x0000000000000000000000000000000000000000",
  caller: "0x0000000000000000000000000000000000000000",
  emitter: "0x3605f28aA7C50e7441211e77Cb0762d49539326C",
  handlerContractAddress: probe,
  handlerFunctionSelector: "0x53edf33d",
  priorityFeePerGas: 20_000_000_000n,  // 20 gwei priority, vs 2 gwei before
  maxFeePerGas: 100_000_000_000n,       // 100 gwei max, vs 10 gwei before
  gasLimit: 300_000n,
  isGuaranteed: true,
  isCoalesced: false,
});
if (result instanceof Error) throw result;
const receipt = await client.waitForTransactionReceipt({ hash: result });
const subId = BigInt(receipt.logs[0].topics[1]);
console.log(JSON.stringify({ subscriptionTx: result, subscriptionId: subId.toString(), status: receipt.status }));
