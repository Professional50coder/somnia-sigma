/**
 * Sigma on-chain reads — reads SigmaOracle, SigmaWindowRegistry,
 * and RealizedVol via viem public client.
 */
import { client, ADDRESSES, oracleAbi, registryAbi, realizedVolAbi, BTC_PRICE_KEY } from "./chain";
import type { WindowWithFair, FairValue } from "./types";

export interface RegistryWindow {
  marketId: `0x${string}`;
  asset: `0x${string}`;
  priceKey: `0x${string}`;
  poolAddress: `0x${string}`;
  openingPrice: bigint;
  openingScale: number;
  tradingStart: bigint;
  expiry: bigint;
  intervalSec: number;
  publisher: `0x${string}`;
  publishedAt: bigint;
  exists: boolean;
}

export interface RawFairValue {
  fairProbBps: bigint;
  impliedProbBps: bigint;
  edgeBps: bigint;
  breakEvenBps: bigint;
  kellyWad: bigint;
  sigmaWad: bigint;
  tauWad: bigint;
  updatedAt: bigint;
  reason: number;
  ok: boolean;
}

/**
 * Read all open window IDs from the on-chain registry.
 */
export async function getOpenWindowIds(): Promise<`0x${string}`[]> {
  try {
    const ids = await client.readContract({
      address: ADDRESSES.registry,
      abi: registryAbi,
      functionName: "openWindows",
    });
    return ids as `0x${string}`[];
  } catch (err) {
    console.error("[sigma] Failed to read openWindows:", err);
    return [];
  }
}

/**
 * Read a single window from the registry.
 */
export async function getRegistryWindow(marketId: `0x${string}`): Promise<RegistryWindow | null> {
  try {
    const w = await client.readContract({
      address: ADDRESSES.registry,
      abi: registryAbi,
      functionName: "getWindow",
      args: [marketId],
    });
    return w as unknown as RegistryWindow;
  } catch (err) {
    console.error(`[sigma] Failed to read window ${marketId}:`, err);
    return null;
  }
}

/**
 * Read the raw fair value from SigmaOracle for a given market.
 */
export async function getRawFairValue(marketId: `0x${string}`): Promise<RawFairValue | null> {
  try {
    const fv = await client.readContract({
      address: ADDRESSES.oracle,
      abi: oracleAbi,
      functionName: "getFairValue",
      args: [marketId],
    });
    return fv as unknown as RawFairValue;
  } catch (err) {
    console.error(`[sigma] Failed to read fair value for ${marketId}:`, err);
    return null;
  }
}

/**
 * Read sigma (volatility) state for the BTC price key.
 */
export async function getVolState() {
  try {
    const [sampleCount, lastPrice, varianceRate, sigma] = await Promise.all([
      client.readContract({
        address: ADDRESSES.realizedVol,
        abi: realizedVolAbi,
        functionName: "sampleCount",
        args: [BTC_PRICE_KEY],
      }),
      client.readContract({
        address: ADDRESSES.realizedVol,
        abi: realizedVolAbi,
        functionName: "lastPriceWad",
        args: [BTC_PRICE_KEY],
      }),
      client.readContract({
        address: ADDRESSES.realizedVol,
        abi: realizedVolAbi,
        functionName: "varianceRateWad",
        args: [BTC_PRICE_KEY],
      }),
      client.readContract({
        address: ADDRESSES.realizedVol,
        abi: realizedVolAbi,
        functionName: "sigmaForSecondsWad",
        args: [BTC_PRICE_KEY, 900n],
      }) as Promise<readonly [bigint, boolean]>,
    ]);

    return {
      sampleCount: Number(sampleCount),
      lastPrice: Number(lastPrice) / 1e18,
      varianceRate: Number(varianceRate) / 1e18,
      sigma: Number(sigma[0]) / 1e18,
      ok: sigma[1],
    };
  } catch (err) {
    console.error("[sigma] Failed to read vol state:", err);
    return null;
  }
}

/**
 * Convert a raw on-chain fair value to the frontend FairValue type.
 */
export function toFairValue(raw: RawFairValue): FairValue {
  return {
    fairProbBps: Number(raw.fairProbBps),
    impliedProbBps: Number(raw.impliedProbBps),
    edgeBps: Number(raw.edgeBps),
    breakEvenBps: Number(raw.breakEvenBps),
    kellyWad: raw.kellyWad,
    sigmaWad: raw.sigmaWad,
    tauWad: raw.tauWad,
    updatedAt: Number(raw.updatedAt),
    reason: reasonLabel(Number(raw.reason)),
    ok: raw.ok,
  };
}

function reasonLabel(reason: number): string {
  const labels: Record<number, string> = {
    0: "ok",
    1: "no_window",
    2: "expired",
    3: "vol_not_ready",
    4: "no_spot",
    5: "scale_mismatch",
    6: "no_book",
  };
  return labels[reason] ?? `unknown_${reason}`;
}

/**
 * Batch-read all open windows with their fair values.
 * Returns windows sorted by expiry (soonest first).
 */
export async function getAllOpenWindows(): Promise<WindowWithFair[]> {
  const ids = await getOpenWindowIds();
  if (ids.length === 0) return [];

  const windows = await Promise.all(
    ids.map(async (id) => {
      const [reg, raw] = await Promise.all([
        getRegistryWindow(id),
        getRawFairValue(id),
      ]);
      if (!reg || !reg.exists) return null;

      const intervalSec = Number(reg.intervalSec);

      const window: WindowWithFair = {
        marketId: id,
        question: `BTC window ${formatInterval(intervalSec)}`,
        category: "Crypto",
        beginsAt: Number(reg.tradingStart),
        expiresAt: Number(reg.expiry),
        collateralToken: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
        minOrderSize: BigInt(1000000),
        outcomeCount: 2,
        fairValue: raw ? toFairValue(raw) : undefined,
        marketPrice: raw?.ok ? Number(raw.impliedProbBps) / 10000 : undefined,
      };

      return window;
    })
  );

  const filtered = windows.filter((w): w is WindowWithFair => w !== null);
  filtered.sort((a, b) => a.expiresAt - b.expiresAt);
  return filtered;
}

function formatInterval(seconds: number): string {
  if (seconds <= 900) return "15m";
  if (seconds <= 3600) return "1h";
  if (seconds <= 14400) return "4h";
  return "24h";
}
