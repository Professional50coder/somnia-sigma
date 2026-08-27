/**
 * Check STT (gas) and tUSDC (collateral) balances for the project wallets on
 * Somnia Shannon testnet.
 *
 * Run:  node scripts/balances.mjs
 * Add an ad-hoc address:  node scripts/balances.mjs 0xabc...
 */
import { createPublicClient, http, formatUnits, formatEther } from "viem";

const RPC = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
const CHAIN_ID = 50312;

const TUSDC = "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E";

const WALLETS = [
  { role: "DEPLOYER", address: "0x0dDb3093df73Ca59F33420670125e0C686c0A468" },
  { role: "BOT", address: "0x7F8F17738f2901D291e465249a177F009E582ad9" },
  ...process.argv.slice(2).map((a, i) => ({ role: `ARG${i + 1}`, address: a })),
];

const ERC20 = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "decimals", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint8" }] },
  { name: "symbol", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ type: "string" }] },
];

const chain = {
  id: CHAIN_ID,
  name: "Somnia Shannon Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const client = createPublicClient({ chain, transport: http(RPC) });

async function main() {
  const id = await client.getChainId();
  const block = await client.getBlockNumber();
  console.log(`\nSomnia testnet  chainId=${id}  block=${block}`);
  if (id !== CHAIN_ID) {
    console.error(`  WARNING: expected chain ${CHAIN_ID}, got ${id}`);
  }

  // Token metadata is read rather than assumed -- tUSDC is not necessarily 6dp.
  let tokenSymbol = "tUSDC";
  let tokenDecimals = 18;
  try {
    [tokenSymbol, tokenDecimals] = await Promise.all([
      client.readContract({ address: TUSDC, abi: ERC20, functionName: "symbol" }),
      client.readContract({ address: TUSDC, abi: ERC20, functionName: "decimals" }),
    ]);
  } catch {
    console.log(`  (could not read token metadata at ${TUSDC}; assuming 18dp)`);
  }
  console.log(`Collateral      ${tokenSymbol} @ ${TUSDC} (${tokenDecimals} decimals)\n`);

  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("ROLE", 10) + pad("ADDRESS", 44) + pad("STT", 18) + tokenSymbol);
  console.log("-".repeat(90));

  let anyFunded = false;
  let anyCollateral = false;

  for (const w of WALLETS) {
    const native = await client.getBalance({ address: w.address });
    let token = 0n;
    try {
      token = await client.readContract({
        address: TUSDC, abi: ERC20, functionName: "balanceOf", args: [w.address],
      });
    } catch { /* token read failed; reported as 0 below */ }

    if (native > 0n) anyFunded = true;
    if (token > 0n) anyCollateral = true;

    console.log(
      pad(w.role, 10) +
      pad(w.address, 44) +
      pad(Number(formatEther(native)).toFixed(4), 18) +
      Number(formatUnits(token, tokenDecimals)).toFixed(4),
    );
  }

  console.log("");
  if (!anyFunded) {
    console.log("No STT anywhere. Claim from the faucet before deploying:");
    for (const w of WALLETS.slice(0, 2)) console.log(`  /faucet ${w.address}`);
  }
  if (!anyCollateral) {
    console.log("No collateral. The BOT wallet needs it to place Event Contract orders:");
    console.log(`  /faucet tUSDC ${WALLETS[1].address}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error("failed:", e.shortMessage ?? e.message);
  process.exitCode = 1;
});
