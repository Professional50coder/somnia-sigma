import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://dream-rpc.somnia.network";
const CHAIN = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const REALIZED_VOL = "0xbd7eedfa178d8eb094449e3461e83195f4b062ef";
const ASSET_KEY = "0x3605f28aA7C50e7441211e77Cb0762d49539326C";
const BTC_POOL = "0x8eb893db72752b1d2b3ac11f625af90db1beb404";

const abi = parseAbi([
  "function recordPrice(bytes32 assetKey, uint256 markPriceWad)",
  "function sampleCount(bytes32) view returns (uint256)",
]);

const MARKET_SDK_ABI = parseAbi([
  "function getPool(address pool) view returns (tuple(address asset, address quote, uint8 assetDecimals, uint8 quoteDecimals, boolisActive) poolInfo)",
]);

export async function GET() {
  try {
    const pk = process.env.DEPLOYER_PRIVATE_KEY;
    if (!pk) return NextResponse.json({ error: "No private key" }, { status: 500 });

    const account = privateKeyToAccount(pk);
    const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC) });
    const walletClient = createWalletClient({ account, chain: CHAIN, transport: http(RPC) });

    // Fetch latest BTC price from SomniaMarkets SDK (REST API)
    const res = await fetch("https://app.dreamdex.io/api/pools");
    const pools = await res.json();
    const btcPool = pools.find(p => p.address?.toLowerCase() === BTC_POOL);
    const markPrice = btcPool?.markPrice;
    if (!markPrice) return NextResponse.json({ error: "No BTC price found" }, { status: 500 });

    const markPriceWad = BigInt(Math.round(parseFloat(markPrice) * 1e18));

    // Push price on-chain
    const hash = await walletClient.writeContract({
      address: REALIZED_VOL,
      abi,
      functionName: "recordPrice",
      args: [ASSET_KEY, markPriceWad],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Read sample count
    const samples = await publicClient.readContract({
      address: REALIZED_VOL,
      abi,
      functionName: "sampleCount",
      args: [ASSET_KEY],
    });

    return NextResponse.json({
      ok: true,
      price: markPrice,
      tx: hash,
      samples: Number(samples),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
