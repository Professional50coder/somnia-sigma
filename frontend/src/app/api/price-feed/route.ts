import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://dream-rpc.somnia.network";
const CHAIN = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const REALIZED_VOL = "0xbd7eedfa178d8eb094449e3461e83195f4b062ef" as const;
const ASSET_KEY = "0x3605f28aA7C50e7441211e77Cb0762d49539326C" as const;
const BTC_POOL = "0x8eb893db72752b1d2b3ac11f625af90db1beb404" as const;

const abi = parseAbi([
  "function recordPrice(bytes32 assetKey, uint256 markPriceWad)",
  "function sampleCount(bytes32) view returns (uint256)",
]);

interface DexPool {
  address?: string;
  markPrice?: string;
}

export async function GET() {
  try {
    const pk = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
    if (!pk) return NextResponse.json({ error: "No private key" }, { status: 500 });

    const account = privateKeyToAccount(pk);
    const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC) });
    const walletClient = createWalletClient({ account, chain: CHAIN, transport: http(RPC) });

    const res = await fetch("https://app.dreamdex.io/api/pools");
    const pools: DexPool[] = await res.json() as DexPool[];
    const btcPool = pools.find((p: DexPool) => p.address?.toLowerCase() === BTC_POOL);
    const markPrice = btcPool?.markPrice;
    if (!markPrice) return NextResponse.json({ error: "No BTC price found" }, { status: 500 });

    const markPriceWad = BigInt(Math.round(parseFloat(markPrice) * 1e18));

    const hash = await walletClient.writeContract({
      address: REALIZED_VOL,
      abi,
      functionName: "recordPrice",
      args: [ASSET_KEY, markPriceWad],
    });
    await publicClient.waitForTransactionReceipt({ hash });

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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
