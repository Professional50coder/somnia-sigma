"use client";

import { useState, useEffect, useRef } from "react";
import { animate, stagger, spring } from "animejs";
import { Trophy, Activity, RefreshCw, Eye } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";
import { StatsCards } from "@/components/sigma/stats-cards";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
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

function SkeletonTrackRecord() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="sigma-card p-3">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="sigma-card">
        <div className="px-4 py-3 border-b border-border">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TrackRecordPage() {
  const [record, setRecord] = useState<TrackRecord>({ trades: [], summary: { totalTrades: 0, wins: 0, losses: 0, skips: 0 } });
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<TradeRecord | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const winBarRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/track-record");
        const data = await res.json();
        setRecord(data);
        if (data.trades.length > 0) {
          toast.success("Track record loaded", { description: `${data.trades.length} trade(s) found` });
        }
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

  // Animate header
  useEffect(() => {
    if (headerRef.current) {
      animate(headerRef.current, {
        opacity: [0, 1],
        translateY: [12, 0],
        duration: 500,
        ease: "outExpo",
      });
    }
  }, []);

  // Animate win/loss bar
  useEffect(() => {
    if (!winBarRef.current || settled.length === 0) return;
    const bars = winBarRef.current.querySelectorAll("[data-winbar]");
    const winPct = `${(wins / settled.length) * 100}%`;
    const lossPct = `${(losses / settled.length) * 100}%`;
    const percentages = [winPct, lossPct];
    bars.forEach((bar, i) => {
      animate(bar, {
        width: percentages[i] ?? "0%",
        duration: 800,
        delay: i * 200,
        ease: "outExpo",
      });
    });
  }, [settled.length, wins, losses]);

  // Animate trade rows
  useEffect(() => {
    if (!rowsRef.current) return;
    const rows = rowsRef.current.querySelectorAll("tr");
    if (rows.length === 0) return;
    animate(rows, {
      opacity: [0, 1],
      translateX: [-12, 0],
      duration: 350,
      delay: stagger(30),
      ease: "outExpo",
    });
  }, [record.trades.length]);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#070709" }}>
      <SigmaNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-6 py-6" style={{ maxWidth: "1200px" }}>
          <div ref={headerRef} style={{ opacity: 0 }}>
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

            {loading && record.trades.length === 0 ? (
              <SkeletonTrackRecord />
            ) : (
              <>
                {/* Stats */}
                <div className="mb-6">
                  <StatsCards stats={stats} />
                </div>

                {/* Win/Loss visual */}
                {settled.length > 0 && (
                  <div ref={winBarRef} className="sigma-card p-4 mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Win/Loss Distribution</span>
                      <span className="text-xs font-mono text-muted-foreground">{wins}W / {losses}L</span>
                    </div>
                    <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-secondary/50">
                      <div data-winbar className="bg-positive rounded-l-full" style={{ width: 0 }} />
                      <div data-winbar className="bg-negative rounded-r-full" style={{ width: 0 }} />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                      <span className="text-positive">{((wins / settled.length) * 100).toFixed(1)}% Win</span>
                      <span className="text-negative">{((losses / settled.length) * 100).toFixed(1)}% Loss</span>
                    </div>
                  </div>
                )}

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
                      <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-bounce" />
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
                          <th className="text-center px-4 py-2 font-medium text-muted-foreground"></th>
                        </tr>
                      </thead>
                      <tbody ref={rowsRef}>
                        {record.trades.slice().reverse().map((trade) => (
                          <tr
                            key={`${trade.marketId}-${trade.timestamp}`}
                            className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedTrade(trade)}
                          >
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
                                  <span className="text-xs text-positive font-medium">WIN</span>
                                ) : (
                                  <span className="text-xs text-negative font-medium">LOSS</span>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground">PENDING</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Trade Detail Dialog */}
      <Dialog open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trade Details</DialogTitle>
            <DialogDescription>Full details for this trade entry</DialogDescription>
          </DialogHeader>
          {selectedTrade && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="sigma-label mb-1">Market</div>
                  <div className="font-mono text-sm text-foreground break-all">{selectedTrade.marketId}</div>
                </div>
                <div>
                  <div className="sigma-label mb-1">Time</div>
                  <div className="text-sm text-foreground">
                    {new Date(selectedTrade.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="sigma-label mb-1">Side</div>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                    selectedTrade.side === "buyYes"
                      ? "bg-positive/10 text-positive"
                      : "bg-negative/10 text-negative"
                  }`}>
                    {selectedTrade.side === "buyYes" ? "BUY YES" : "BUY NO"}
                  </span>
                </div>
                <div>
                  <div className="sigma-label mb-1">Status</div>
                  <span className={`text-sm font-medium ${
                    selectedTrade.settled
                      ? selectedTrade.won ? "text-positive" : "text-negative"
                      : "text-muted-foreground"
                  }`}>
                    {selectedTrade.settled ? (selectedTrade.won ? "WIN" : "LOSS") : "PENDING"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="sigma-label mb-1">Fair Probability</div>
                  <div className="font-mono text-sm text-foreground">{(selectedTrade.fairProbBps / 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="sigma-label mb-1">Edge</div>
                  <div className={`font-mono text-sm font-medium ${selectedTrade.edgeBps > 0 ? "text-positive" : "text-negative"}`}>
                    {selectedTrade.edgeBps > 0 ? "+" : ""}{(selectedTrade.edgeBps / 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="sigma-label mb-1">Kelly Fraction</div>
                  <div className="font-mono text-sm text-foreground">{(selectedTrade.kelly * 100).toFixed(1)}%</div>
                  <Progress value={selectedTrade.kelly * 100} className="mt-1 h-1" />
                </div>
                <div>
                  <div className="sigma-label mb-1">Sigma (Vol)</div>
                  <div className="font-mono text-sm text-foreground">{(Number(selectedTrade.sigmaWad) / 1e18).toFixed(6)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="sigma-label mb-1">Size</div>
                  <div className="font-mono text-sm text-foreground">{selectedTrade.sizeRaw}</div>
                </div>
                <div>
                  <div className="sigma-label mb-1">Price</div>
                  <div className="font-mono text-sm text-foreground">{selectedTrade.priceRaw}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
