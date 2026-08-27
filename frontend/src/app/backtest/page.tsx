"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";
import type { BacktestResult } from "@/lib/types";
import { formatProbability, formatEdge } from "@/lib/format";

const SAMPLE_BACKTEST: BacktestResult[] = [
  { timestamp: Date.now() / 1000 - 86400 * 6, marketId: "0x001", question: "BTC > $95k end of July", fairProb: 0.62, marketProb: 0.55, edge: 0.07, kellyFraction: 0.12, outcome: "win", pnl: 120 },
  { timestamp: Date.now() / 1000 - 86400 * 5, marketId: "0x002", question: "ETH > $3800 by Friday", fairProb: 0.45, marketProb: 0.50, edge: -0.05, kellyFraction: 0.08, outcome: "win", pnl: 85 },
  { timestamp: Date.now() / 1000 - 86400 * 4, marketId: "0x003", question: "Somnia TPS > 50k", fairProb: 0.70, marketProb: 0.60, edge: 0.10, kellyFraction: 0.15, outcome: "win", pnl: 200 },
  { timestamp: Date.now() / 1000 - 86400 * 3, marketId: "0x004", question: "Fed cut in August", fairProb: 0.30, marketProb: 0.35, edge: -0.05, kellyFraction: 0.06, outcome: "loss", pnl: -60 },
  { timestamp: Date.now() / 1000 - 86400 * 2, marketId: "0x005", question: "AI agent adoption > 25%", fairProb: 0.55, marketProb: 0.48, edge: 0.07, kellyFraction: 0.11, outcome: "win", pnl: 150 },
  { timestamp: Date.now() / 1000 - 86400, marketId: "0x006", question: "SOMNIA token by Q4", fairProb: 0.74, marketProb: 0.68, edge: 0.06, kellyFraction: 0.10, outcome: "pending", pnl: 0 },
];

export default function BacktestPage() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d");

  const wins = SAMPLE_BACKTEST.filter((r) => r.outcome === "win").length;
  const losses = SAMPLE_BACKTEST.filter((r) => r.outcome === "loss").length;
  const total = wins + losses;
  const winRate = total > 0 ? wins / total : 0;
  const totalPnl = SAMPLE_BACKTEST.reduce((sum, r) => sum + r.pnl, 0);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#070709" }}>
      <SigmaNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-6 py-6" style={{ maxWidth: "1200px" }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold text-foreground">Backtest Calibration</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Historical fair-value vs market-price analysis
                </p>
              </div>
              <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
                {(["7d", "30d", "all"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      timeRange === range
                        ? "bg-background text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {range === "all" ? "All Time" : range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="sigma-card p-3">
                <div className="sigma-label mb-1">Win Rate</div>
                <div className={`font-mono text-lg font-semibold ${winRate > 0.5 ? "text-positive" : "text-negative"}`}>
                  {(winRate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="sigma-card p-3">
                <div className="sigma-label mb-1">Total PnL</div>
                <div className={`font-mono text-lg font-semibold ${totalPnl >= 0 ? "text-positive" : "text-negative"}`}>
                  ${totalPnl}
                </div>
              </div>
              <div className="sigma-card p-3">
                <div className="sigma-label mb-1">Wins / Losses</div>
                <div className="font-mono text-lg font-semibold text-foreground">
                  <span className="text-positive">{wins}</span>
                  {" / "}
                  <span className="text-negative">{losses}</span>
                </div>
              </div>
              <div className="sigma-card p-3">
                <div className="sigma-label mb-1">Samples</div>
                <div className="font-mono text-lg font-semibold text-foreground">
                  {SAMPLE_BACKTEST.length}
                </div>
              </div>
            </div>

            {/* Results table */}
            <div className="sigma-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Market</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Fair</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Market</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Edge</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Kelly</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Result</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_BACKTEST.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-foreground truncate max-w-[250px]">{r.question}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{formatProbability(r.fairProb * 10000)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatProbability(r.marketProb * 10000)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${r.edge > 0 ? "text-positive" : r.edge < 0 ? "text-negative" : "text-muted-foreground"}`}>
                        {formatEdge(r.edge * 10000)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{(r.kellyFraction * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-center">
                        {r.outcome === "win" && <TrendingUp className="w-4 h-4 text-positive inline" />}
                        {r.outcome === "loss" && <TrendingDown className="w-4 h-4 text-negative inline" />}
                        {r.outcome === "pending" && <Calendar className="w-4 h-4 text-muted-foreground inline" />}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${r.pnl >= 0 ? "text-positive" : "text-negative"}`}>
                        {r.pnl >= 0 ? "+" : ""}${r.pnl}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
