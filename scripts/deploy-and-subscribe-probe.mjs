import "dotenv/config";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK } from "@somnia-chain/reactivity";

const rpc = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const client = createPublicClient({ transport: http(rpc) });
const wallet = createWalletClient({ account, transport: http(rpc) });

const artifact = JSON.parse(readFileSync("artifacts/sigma/ReactivityProbe.json", "utf8"));
const deployHash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode });
const deployReceipt = await client.waitForTransactionReceipt({ hash: deployHash });
const probe = deployReceipt.contractAddress;
console.log("ReactivityProbe deployed at:", probe, "tx", deployHash);

const sdk = new SDK({ public: client, wallet });
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
  priorityFeePerGas: 2_000_000_000n,
  maxFeePerGas: 10_000_000_000n,
  gasLimit: 200_000n,
  isGuaranteed: true,
  isCoalesced: false,
});
if (result instanceof Error) throw result;
const subReceipt = await client.waitForTransactionReceipt({ hash: result });
const subId = BigInt(subReceipt.logs[0].topics[1]);
console.log("subscribed, tx", result, " subscriptionId", subId.toString());
console.log(JSON.stringify({ probe, subscriptionTx: result, subscriptionId: subId.toString() }));
