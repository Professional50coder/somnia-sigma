// FALLBACK ADOPTION: reactivity push delivery is confirmed broken after
// exhaustive elimination (see FINDINGS.md). Repointing RealizedVol.writer to
// the deployer EOA so an off-chain scheduled puller (scripts/fallback-price-
// pusher.mjs) can call recordPrice directly. Reversible: call setWriter back
// to SigmaReactiveVol's address if reactivity ever starts delivering.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpc = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const client = createPublicClient({ transport: http(rpc) });
const wallet = createWalletClient({ account, transport: http(rpc) });

const deployment = JSON.parse(readFileSync("deployments/somniaTestnet.json", "utf8"));
const artifact = JSON.parse(readFileSync("artifacts/sigma/RealizedVol.json", "utf8"));

const hash = await wallet.writeContract({
  address: deployment.realizedVol,
  abi: artifact.abi,
  functionName: "setWriter",
  args: [account.address],
});
const receipt = await client.waitForTransactionReceipt({ hash });
console.log(JSON.stringify({
  previousWriter: "0x5F6a29B5717841f6F7B394Be6936ea176dC63D28 (SigmaReactiveVol)",
  newWriter: account.address,
  hash, status: receipt.status, gasUsed: receipt.gasUsed.toString(),
}, null, 2));
