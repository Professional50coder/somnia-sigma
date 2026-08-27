"use client";

import { motion } from "framer-motion";
import { Trophy, TrendingUp, Target, Activity, Shield, Zap } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";
import { StatsCards } from "@/components/sigma/stats-cards";
import type { PerformanceStats } from "@/lib/types";

const STATS: PerformanceStats = {
  totalTrades: 47,
  winRate: 0.638,
  totalPnl: 1240,
  sharpeRatio: 1.82,
  maxDrawdown: 0.087,
  kellyFraction: 0.15,
  avgEdge: 0.032,
};

const TRADE_LOG = [
  { date: "Aug 27", market: "BTC > $100k", side: "BUY", entry: 0.55, exit: 0.62, pnl: 120, edge: 7 },
  { date: "Aug 26", market: "ETH > $4000", side: "SELL", entry: 0.50, exit: 0.45, pnl: 85, edge: 5 },
  { date: "Aug 25", market: "Somnia TPS > 50k", side: "BUY", entry: 0.60, exit: 0.70, pnl: 200, edge: 10 },
  { date: "Aug 24", market: "Fed cut Sept", side: "SELL", entry: 0.35, exit: 0.30, pnl: -60, edge: -5 },
  { date: "Aug 23", market: "AI adoption > 25%", side: "BUY", entry: 0.48, exit: 0.55, pnl: 150, edge: 7 },
  { date: "Aug 22", market: "SOMNIA token Q4", side: "BUY", entry: 0.68, exit: 0.74, pnl: 90, edge: 6 },
  { date: "Aug 21", market: "SOL > $200", side: "BUY", entry: 0.42, exit: 0.48, pnl: 110, edge: 6 },
  { date: "Aug 20", market: "BTC > $95k", side: "SELL", entry: 0.58, exit: 0.52, pnl: 75, edge: 6 },
];

export default function TrackRecordPage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#070709" }}>
      <SigmaNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-6 py-6" style={{ maxWidth: "1200px" }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">Track Record</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Live trading performance on Somnia Event Contracts
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="mb-6">
              <StatsCards stats={STATS} />
            </div>

            {/* Equity curve placeholder */}
            <div className="sigma-card p-6 mb-6">
              <h3 className="text-sm font-medium text-foreground mb-4">Equity Curve</h3>
              <div className="h-48 flex items-center justify-center border border-dashed border-border rounded-lg">
                <div className="text-center">
                  <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Equity curve will render with real trading data
                  </p>
                </div>
              </div>
            </div>

            {/* Trade log */}
            <div className="sigma-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-medium text-foreground">Trade Log</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Market</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Side</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Entry</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Exit</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Edge</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {TRADE_LOG.map((trade, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{trade.date}</td>
                      <td className="px-4 py-2.5 text-foreground">{trade.market}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          trade.side === "BUY" ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{(trade.entry * 100).toFixed(0)}¢</td>
                      <td className="px-4 py-2.5 text-right font-mono text-foreground">{(trade.exit * 100).toFixed(0)}¢</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${trade.edge > 0 ? "text-positive" : "text-negative"}`}>
                        {trade.edge > 0 ? "+" : ""}{trade.edge}%
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono font-medium ${trade.pnl >= 0 ? "text-positive" : "text-negative"}`}>
                        {trade.pnl >= 0 ? "+" : ""}${trade.pnl}
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
