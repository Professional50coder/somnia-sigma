import { createPublicClient, http, formatEther } from "viem";

const client = createPublicClient({
  chain: {
    id: 50312,
    name: "somniaTestnet",
    rpcUrls: { default: { http: ["https://dream-rpc.somnia.network"] } },
    nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  },
  transport: http("https://dream-rpc.somnia.network"),
});

const deployer = "0x0dDb3093df73Ca59F33420670125e0C686c0A468";
const bot = "0x7F8F17738f2901D291e465249a177F009E582ad9";

const [dBal, bBal] = await Promise.all([
  client.getBalance({ address: deployer }),
  client.getBalance({ address: bot }),
]);

console.log("Deployer:", formatEther(dBal), "STT");
console.log("Bot:", formatEther(bBal), "STT");

// Also check tUSDC balance
const tUSDC = "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E";
const erc20Abi = [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }];

const [dUsdc, bUsdc] = await Promise.all([
  client.readContract({ address: tUSDC, abi: erc20Abi, functionName: "balanceOf", args: [deployer] }),
  client.readContract({ address: tUSDC, abi: erc20Abi, functionName: "balanceOf", args: [bot] }),
]);

console.log("Deployer tUSDC:", (Number(dUsdc) / 1e6).toFixed(6));
console.log("Bot tUSDC:", (Number(bUsdc) / 1e6).toFixed(6));
