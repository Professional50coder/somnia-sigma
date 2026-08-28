"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, Filter, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";
import { MarketCard } from "@/components/sigma/market-card";
import { CategoryFilter } from "@/components/sigma/category-filter";
import { StatsCards } from "@/components/sigma/stats-cards";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useSigmaData } from "@/hooks/use-sigma-data";
import type { PerformanceStats } from "@/lib/types";

function deriveStats(windows: import("@/lib/types").WindowWithFair[]): PerformanceStats {
  const withEdge = windows.filter((w) => w.fairValue?.ok);
  const positiveEdge = withEdge.filter((w) => (w.fairValue?.edgeBps ?? 0) > 0);
  const avgEdge = withEdge.length > 0
    ? withEdge.reduce((sum, w) => sum + (w.fairValue?.edgeBps ?? 0), 0) / withEdge.length / 10000
    : 0;

  return {
    totalTrades: withEdge.length,
    winRate: withEdge.length > 0 ? positiveEdge.length / withEdge.length : 0,
    totalPnl: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    kellyFraction: 0,
    avgEdge,
  };
}

export default function EdgeRadarPage() {
  const [category, setCategory] = useState("all");
  const [showWatchedOnly, setShowWatchedOnly] = useState(false);
  const { watchlist, toggle } = useWatchlist();
  const { windows, vol, lastUpdated, loading, error, refresh } = useSigmaData(15000);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of windows) {
      counts[w.category] = (counts[w.category] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({
      id: name.toLowerCase(),
      name,
      count,
    }));
  }, [windows]);

  const stats = useMemo(() => deriveStats(windows), [windows]);

  const filteredWindows = useMemo(() => {
    let result = windows;
    if (category !== "all") {
      result = result.filter((w) => w.category.toLowerCase() === category);
    }
    if (showWatchedOnly) {
      result = result.filter((w) => watchlist.has(w.marketId));
    }
    return result;
  }, [windows, category, showWatchedOnly, watchlist]);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#070709" }}>
      <SigmaNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-6 py-6" style={{ maxWidth: "1400px" }}>
          {/* Vol state banner */}
          {vol && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 sigma-card p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                <span>
                  σ: <span className="text-foreground">{vol.sigma.toFixed(4)}</span>
                </span>
                <span>
                  samples: <span className="text-foreground">{vol.sampleCount}</span>
                </span>
                <span>
                  spot: <span className="text-foreground">${vol.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </span>
                <span className={vol.ok ? "text-positive" : "text-negative"}>
                  {vol.ok ? "VOL OK" : "VOL NOT READY"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {error ? (
                  <WifiOff className="w-3.5 h-3.5 text-negative" />
                ) : (
                  <Wifi className="w-3.5 h-3.5 text-positive" />
                )}
                {lastUpdated && (
                  <span className="text-[10px] text-muted-foreground">
                    {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <StatsCards stats={stats} />
          </motion.div>

          {/* Filters */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <CategoryFilter
              categories={categories}
              active={category}
              onSelect={setCategory}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowWatchedOnly(!showWatchedOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  showWatchedOnly
                    ? "bg-yellow-500/10 text-yellow-500"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Watchlist
              </button>
              <button
                onClick={() => refresh()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Edge Radar Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWindows.map((w) => (
              <MarketCard
                key={w.marketId}
                window={w}
                isWatched={watchlist.has(w.marketId)}
                onToggleWatch={toggle}
              />
            ))}
          </div>

          {filteredWindows.length === 0 && !loading && (
            <div className="text-center py-12">
              <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {windows.length === 0
                  ? "No open windows found on-chain. Markets may not be published to SigmaWindowRegistry yet."
                  : "No windows match your filters"}
              </p>
            </div>
          )}

          {loading && windows.length === 0 && (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading on-chain data...</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 py-2 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Sigma — Fair-Value Edge Detection</span>
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${error ? "bg-negative" : "bg-positive animate-pulse"}`} />
            {error ? "Error" : "Live"}
          </span>
        </div>
      </footer>
    </div>
  );
}
