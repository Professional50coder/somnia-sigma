"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, Target, Activity, Shield, Zap, RefreshCw } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";
import { StatsCards } from "@/components/sigma/stats-cards";
import type { PerformanceStats } from "@/lib/types";

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

function deriveStats(record: TrackRecord): PerformanceStats {
  const { summary, trades } = record;
  const settled = trades.filter((t) => t.settled);
  const wins = settled.filter((t) => t.won === true).length;
  const losses = settled.filter((t) => t.won === false).length;
  const total = wins + losses;
  const avgEdge = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.edgeBps, 0) / trades.length / 10000
    : 0;

  return {
    totalTrades: summary.totalTrades,
    winRate: total > 0 ? wins / total : 0,
    totalPnl: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    kellyFraction: trades.length > 0
      ? trades.reduce((sum, t) => sum + t.kelly, 0) / trades.length
      : 0,
    avgEdge,
  };
}

function shortId(id: string): string {
  return id.slice(0, 8) + "..." + id.slice(-4);
}

export default function TrackRecordPage() {
  const [record, setRecord] = useState<TrackRecord>({ trades: [], summary: { totalTrades: 0, wins: 0, losses: 0, skips: 0 } });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/track-record");
        const data = await res.json();
        setRecord(data);
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const stats = deriveStats(record);
  const settled = record.trades.filter((t) => t.settled);
  const wins = settled.filter((t) => t.won === true).length;
  const losses = settled.filter((t) => t.won === false).length;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#070709" }}>
      <SigmaNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-6 py-6" style={{ maxWidth: "1200px" }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-yellow-500" />
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Track Record</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {record.trades.length > 0
                      ? `${record.trades.length} trade(s) logged by ec-sigma bot`
                      : "No trades yet — bot is in DRY_RUN mode"}
                  </p>
                </div>
              </div>
              {loading && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
            </div>

            {/* Stats */}
            <div className="mb-6">
              <StatsCards stats={stats} />
            </div>

            {/* Trade log */}
            <div className="sigma-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">Trade Log</h3>
                <span className="text-xs text-muted-foreground">
                  {wins}W / {losses}L / {record.trades.length - settled.length} pending
                </span>
              </div>
              {record.trades.length === 0 ? (
                <div className="py-12 text-center">
                  <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No trades logged yet. Run the ec-sigma bot to start recording.
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Time</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Market</th>
                      <th className="text-center px-4 py-2 font-medium text-muted-foreground">Side</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Fair</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Edge</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Kelly</th>
                      <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.trades.slice().reverse().map((trade, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
                          {new Date(trade.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="px-4 py-2.5 text-foreground font-mono text-xs">
                          {shortId(trade.marketId)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            trade.side === "buyYes"
                              ? "bg-positive/10 text-positive"
                              : "bg-negative/10 text-negative"
                          }`}>
                            {trade.side === "buyYes" ? "BUY YES" : "BUY NO"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                          {(trade.fairProbBps / 100).toFixed(1)}%
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono ${trade.edgeBps > 0 ? "text-positive" : "text-negative"}`}>
                          {trade.edgeBps > 0 ? "+" : ""}{(trade.edgeBps / 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                          {(trade.kelly * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {trade.settled ? (
                            trade.won ? (
                              <span className="text-xs text-positive">WIN</span>
                            ) : (
                              <span className="text-xs text-negative">LOSS</span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">PENDING</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
