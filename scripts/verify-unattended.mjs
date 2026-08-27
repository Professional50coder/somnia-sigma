import { readFileSync } from "node:fs";
import { createPublicClient, http, parseAbi } from "viem";

const deployment = JSON.parse(readFileSync("deployments/somniaTestnet.json", "utf8"));
const client = createPublicClient({ transport: http(process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network") });
const asset = process.env.SIGMA_BTC_KEY;
if (!asset) throw new Error("Set SIGMA_BTC_KEY to the address used when subscribing BTC mark prices.");
const abi = parseAbi([
  "function sampleCount(address) view returns (uint32)",
  "function varianceRateWad(address) view returns (uint256)",
  "function lastPriceWad(address) view returns (uint256)",
  "function sigmaWad(address) view returns (uint256,uint64,bool)",
]);
const [block, sampleCount, varianceRateWad, lastPriceWad, sigma] = await Promise.all([
  client.getBlock(),
  client.readContract({ address: deployment.realizedVol, abi, functionName: "sampleCount", args: [asset] }),
  client.readContract({ address: deployment.realizedVol, abi, functionName: "varianceRateWad", args: [asset] }),
  client.readContract({ address: deployment.realizedVol, abi, functionName: "lastPriceWad", args: [asset] }),
  client.readContract({ address: deployment.realizedVol, abi, functionName: "sigmaWad", args: [asset] }),
]);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), block: block.number.toString(), blockTimestamp: Number(block.timestamp), sampleCount: sampleCount.toString(), varianceRateWad: varianceRateWad.toString(), lastPriceWad: lastPriceWad.toString(), sigmaWad: sigma[0].toString(), updatedAt: sigma[1].toString(), ok: sigma[2] }, null, 2));
