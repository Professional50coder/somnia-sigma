import "dotenv/config";
import { createWalletClient, createPublicClient, http, parseAbi, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://dream-rpc.somnia.network";
const CHAIN = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Shannon Explorer", url: "https://shannon-explorer.somnia.network" } },
};

const CRON = "0x3e30784b649558befbb2897429d5a0e5544c007c";
const ORACLE = "0x35cd22b3d983329d2ba9131d982a91e528a0b931";
const pk = process.env.DEPLOYER_PRIVATE_KEY;
const account = privateKeyToAccount(pk);

const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: CHAIN, transport: http(RPC) });

const abi = parseAbi([
  "function setCadence(uint32 seconds_)",
  "function setNextScheduledMs(uint256 timestampMs)",
  "function sweep()",
  "function nextScheduledMs() view returns (uint256)",
  "function cadenceSeconds() view returns (uint32)",
]);

async function main() {
  const bal = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer: ${account.address}`);
  console.log(`Balance: ${formatEther(bal)} STT`);

  const currentNext = await publicClient.readContract({ address: CRON, abi, functionName: "nextScheduledMs" });
  const currentCadence = await publicClient.readContract({ address: CRON, abi, functionName: "cadenceSeconds" });
  console.log(`Current cadence: ${currentCadence}s, next scheduled: ${new Date(Number(currentNext)).toISOString()}`);

  // Set cadence to 15 minutes
  console.log("\nSetting cadence to 900s (15 min)...");
  const cadenceHash = await walletClient.writeContract({ address: CRON, abi, functionName: "setCadence", args: [900] });
  console.log(`  tx: ${cadenceHash}`);
  await publicClient.waitForTransactionReceipt({ hash: cadenceHash });

  // Set next scheduled to next 15-min boundary
  const now = Date.now();
  const cadenceMs = 900_000;
  const nextBoundary = Math.ceil(now / cadenceMs) * cadenceMs;
  console.log(`\nSetting next scheduled to ${new Date(nextBoundary).toISOString()}...`);
  const schedHash = await walletClient.writeContract({ address: CRON, abi, functionName: "setNextScheduledMs", args: [BigInt(nextBoundary)] });
  console.log(`  tx: ${schedHash}`);
  await publicClient.waitForTransactionReceipt({ hash: schedHash });

  // Immediate sweep
  console.log("\nRunning immediate sweep...");
  const sweepHash = await walletClient.writeContract({ address: CRON, abi, functionName: "sweep" });
  console.log(`  tx: ${sweepHash}`);
  await publicClient.waitForTransactionReceipt({ hash: sweepHash });

  // Verify
  const newNext = await publicClient.readContract({ address: CRON, abi, functionName: "nextScheduledMs" });
  const newCadence = await publicClient.readContract({ address: CRON, abi, functionName: "cadenceSeconds" });
  console.log(`\nDone! Cadence: ${newCadence}s, next: ${new Date(Number(newNext)).toISOString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
