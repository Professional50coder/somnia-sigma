import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";

const RESULTS_FILE = resolve(process.cwd(), "../backtest/results.json");

export async function GET() {
  try {
    if (!existsSync(RESULTS_FILE)) {
      return NextResponse.json({ error: "No backtest results found" }, { status: 404 });
    }
    const raw = readFileSync(RESULTS_FILE, "utf8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to read results" }, { status: 500 });
  }
}
