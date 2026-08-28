import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";

interface TradeRecord {
  marketId: string;
  timestamp: number;
  side: string;
  edgeBps: number;
  kelly: number;
  sizeRaw: string;
  priceRaw: string;
  fairProbBps: number;
  sigmaWad: number;
  tauWad: number;
  ok: boolean;
  settled: boolean;
  won: boolean | null;
  realizedEdgeBps: number | null;
}

interface TrackRecord {
  trades: TradeRecord[];
  summary: {
    totalTrades: number;
    wins: number;
    losses: number;
    skips: number;
  };
}

const TRACK_FILE = resolve(process.cwd(), "../bot/track-record.json");

export async function GET() {
  try {
    if (!existsSync(TRACK_FILE)) {
      return NextResponse.json({ trades: [], summary: { totalTrades: 0, wins: 0, losses: 0, skips: 0 } });
    }
    const raw = readFileSync(TRACK_FILE, "utf8");
    const data: TrackRecord = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ trades: [], summary: { totalTrades: 0, wins: 0, losses: 0, skips: 0 } });
  }
}
