"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, Filter, RefreshCw } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";
import { MarketCard } from "@/components/sigma/market-card";
import { CategoryFilter } from "@/components/sigma/category-filter";
import { StatsCards } from "@/components/sigma/stats-cards";
import { useWatchlist } from "@/hooks/use-watchlist";
import type { WindowWithFair, PerformanceStats } from "@/lib/types";

// Sample data - will be replaced with on-chain reads
const SAMPLE_WINDOWS: WindowWithFair[] = [
  {
    marketId: "0xabc123...001",
    question: "Will BTC break $100k this month?",
    category: "Crypto",
    beginsAt: Date.now() / 1000 - 86400,
    expiresAt: Date.now() / 1000 + 86400 * 3,
    collateralToken: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
    minOrderSize: BigInt(1000000),
    outcomeCount: 2,
    fairValue: {
      fairProbBps: 6200,
      impliedProbBps: 5800,
      edgeBps: 400,
      breakEvenBps: 350,
      kellyWad: BigInt("150000000000000000"),
      sigmaWad: BigInt("2500000000000000000"),
      tauWad: BigInt("7200000000000000000"),
      updatedAt: Date.now() / 1000 - 30,
      reason: "vol_compression",
      ok: true,
    },
    marketPrice: 0.58,
  },
  {
    marketId: "0xabc123...002",
    question: "ETH above $4000 by Friday?",
    category: "Crypto",
    beginsAt: Date.now() / 1000 - 43200,
    expiresAt: Date.now() / 1000 + 86400 * 2,
    collateralToken: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
    minOrderSize: BigInt(1000000),
    outcomeCount: 2,
    fairValue: {
      fairProbBps: 3800,
      impliedProbBps: 4200,
      edgeBps: -400,
      breakEvenBps: 350,
      kellyWad: BigInt("120000000000000000"),
      sigmaWad: BigInt("3000000000000000000"),
      tauWad: BigInt("4800000000000000000"),
      updatedAt: Date.now() / 1000 - 60,
      reason: "mean_reversion",
      ok: true,
    },
    marketPrice: 0.42,
  },
  {
    marketId: "0xabc123...003",
    question: "SOMNIA token launch by Q4 2026?",
    category: "Somnia",
    beginsAt: Date.now() / 1000 - 172800,
    expiresAt: Date.now() / 1000 + 86400 * 30,
    collateralToken: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
    minOrderSize: BigInt(1000000),
    outcomeCount: 2,
    fairValue: {
      fairProbBps: 7400,
      impliedProbBps: 6800,
      edgeBps: 600,
      breakEvenBps: 500,
      kellyWad: BigInt("200000000000000000"),
      sigmaWad: BigInt("4000000000000000000"),
      tauWad: BigInt("25920000000000000000"),
      updatedAt: Date.now() / 1000 - 120,
      reason: "news_catalyst",
      ok: true,
    },
    marketPrice: 0.68,
  },
  {
    marketId: "0xabc123...004",
    question: "Somnia TPS record broken next week?",
    category: "Somnia",
    beginsAt: Date.now() / 1000 - 3600,
    expiresAt: Date.now() / 1000 + 86400 * 7,
    collateralToken: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
    minOrderSize: BigInt(1000000),
    outcomeCount: 2,
    fairValue: {
      fairProbBps: 5500,
      impliedProbBps: 5200,
      edgeBps: 300,
      breakEvenBps: 280,
      kellyWad: BigInt("100000000000000000"),
      sigmaWad: BigInt("2000000000000000000"),
      tauWad: BigInt("6048000000000000000"),
      updatedAt: Date.now() / 1000 - 15,
      reason: "vol_spike",
      ok: true,
    },
    marketPrice: 0.52,
  },
  {
    marketId: "0xabc123...005",
    question: "Fed rate cut in September 2026?",
    category: "Macro",
    beginsAt: Date.now() / 1000 - 259200,
    expiresAt: Date.now() / 1000 + 86400 * 14,
    collateralToken: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
    minOrderSize: BigInt(1000000),
    outcomeCount: 2,
    fairValue: {
      fairProbBps: 3200,
      impliedProbBps: 3500,
      edgeBps: -300,
      breakEvenBps: 280,
      kellyWad: BigInt("80000000000000000"),
      sigmaWad: BigInt("1800000000000000000"),
      tauWad: BigInt("12096000000000000000"),
      updatedAt: Date.now() / 1000 - 45,
      reason: "macro_drift",
      ok: true,
    },
    marketPrice: 0.35,
  },
  {
    marketId: "0xabc123...006",
    question: "AI agent market share above 30% by 2027?",
    category: "AI",
    beginsAt: Date.now() / 1000 - 432000,
    expiresAt: Date.now() / 1000 + 86400 * 60,
    collateralToken: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
    minOrderSize: BigInt(1000000),
    outcomeCount: 2,
    fairValue: {
      fairProbBps: 4500,
      impliedProbBps: 4000,
      edgeBps: 500,
      breakEvenBps: 420,
      kellyWad: BigInt("180000000000000000"),
      sigmaWad: BigInt("3500000000000000000"),
      tauWad: BigInt("51840000000000000000"),
      updatedAt: Date.now() / 1000 - 200,
      reason: "trend_momentum",
      ok: true,
    },
    marketPrice: 0.40,
  },
];

const SAMPLE_STATS: PerformanceStats = {
  totalTrades: 47,
  winRate: 0.638,
  totalPnl: 1240,
  sharpeRatio: 1.82,
  maxDrawdown: 0.087,
  kellyFraction: 0.15,
  avgEdge: 0.032,
};

const CATEGORIES = [
  { id: "crypto", name: "Crypto", count: 2 },
  { id: "somnia", name: "Somnia", count: 2 },
  { id: "macro", name: "Macro", count: 1 },
  { id: "ai", name: "AI", count: 1 },
];

export default function EdgeRadarPage() {
  const [category, setCategory] = useState("all");
  const [showWatchedOnly, setShowWatchedOnly] = useState(false);
  const { watchlist, toggle } = useWatchlist();

  const filteredWindows = useMemo(() => {
    let result = SAMPLE_WINDOWS;
    if (category !== "all") {
      result = result.filter(
        (w) => w.category.toLowerCase() === category
      );
    }
    if (showWatchedOnly) {
      result = result.filter((w) => watchlist.has(w.marketId));
    }
    return result;
  }, [category, showWatchedOnly, watchlist]);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#070709" }}>
      <SigmaNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-6 py-6" style={{ maxWidth: "1400px" }}>
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <StatsCards stats={SAMPLE_STATS} />
          </motion.div>

          {/* Filters */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <CategoryFilter
              categories={CATEGORIES}
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
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
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

          {filteredWindows.length === 0 && (
            <div className="text-center py-12">
              <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No windows match your filters
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 py-2 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Somnia Sigma — Fair-Value Edge Detection</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Live
          </span>
        </div>
      </footer>
    </div>
  );
}
