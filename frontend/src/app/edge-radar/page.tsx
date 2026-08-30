"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { animate, stagger, onScroll } from "animejs";
import { Activity, Filter, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";
import { MarketCard } from "@/components/sigma/market-card";
import { CategoryFilter } from "@/components/sigma/category-filter";
import { StatsCards } from "@/components/sigma/stats-cards";
import { EdgeRadar3D } from "@/components/sigma/edge-radar-3d";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useSigmaData } from "@/hooks/use-sigma-data";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PerformanceStats } from "@/lib/types";

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 2 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(value);
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
      prev.current = value;
      if (elRef.current) {
        animate(elRef.current, {
          scale: [1, 1.15, 1],
          duration: 300,
          ease: "outQuad",
        });
      }
      const t = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(t);
    }
  }, [value]);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (Math.abs(diff) < 0.01) { setDisplay(value); return; }
    let frame: number;
    const startTime = performance.now();
    const duration = 400;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + diff * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const color = flash === "up" ? "text-positive" : flash === "down" ? "text-negative" : "text-foreground";

  return (
    <span ref={elRef} className={`font-mono transition-colors duration-300 ${color}`}>
      {prefix}{display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

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
  const [intervalFilter, setIntervalFilter] = useState("all");
  const [showWatchedOnly, setShowWatchedOnly] = useState(false);
  const { watchlist, toggle } = useWatchlist();
  const { windows, vol, lastUpdated, loading, error, refresh } = useSigmaData(15000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

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
    if (intervalFilter !== "all") {
      const sec = parseInt(intervalFilter);
      result = result.filter((w) => w.intervalSec === sec);
    }
    if (showWatchedOnly) {
      result = result.filter((w) => watchlist.has(w.marketId));
    }
    return result;
  }, [windows, category, intervalFilter, showWatchedOnly, watchlist]);

  // Animate grid cards when filteredWindows change (using onScroll + stagger from grid)
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll("[data-card]");
    if (cards.length === 0) return;
    const cols = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    animate(cards, {
      opacity: [0, 1],
      translateY: [16, 0],
      scale: [0.95, 1],
      duration: 400,
      delay: stagger(50, { from: "center", grid: [cols, Math.ceil(cards.length / cols)], jitter: 80 }),
      ease: "outExpo",
    });
  }, [filteredWindows.length]);

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ backgroundColor: "#070709" }}>
      <div className="absolute inset-0 opacity-40"><EdgeRadar3D /></div>
      <div className="relative z-10 flex flex-col h-full">
      <SigmaNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-6 py-6" style={{ maxWidth: "1400px" }}>
          {/* Vol state banner */}
          {vol && (
            <div className="mb-4 sigma-card p-3 flex items-center justify-between group hover:border-primary/30 transition-all duration-300">
              <div className="flex items-center gap-5 text-xs font-mono text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1.5 cursor-help">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      σ: <AnimatedNumber value={vol.sigma} decimals={4} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Realized volatility (EWMA) — higher σ = wider price swings</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      samples: <AnimatedNumber value={vol.sampleCount} decimals={0} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Number of MarkPriceUpdated events accumulated on-chain</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 cursor-help">
                      spot: <AnimatedNumber value={vol.lastPrice} prefix="$" decimals={2} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Current BTC/USDC mark price from dreamDEX spot pool</TooltipContent>
                </Tooltip>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${vol.ok ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"}`}>
                  {vol.ok ? "VOL OK" : "VOL NOT READY"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {error ? (
                  <WifiOff className="w-3.5 h-3.5 text-negative" />
                ) : (
                  <div className="relative">
                    <Wifi className="w-3.5 h-3.5 text-positive" />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-positive rounded-full animate-ping" />
                  </div>
                )}
                {lastUpdated && (
                  <span className="text-[10px] text-muted-foreground">
                    {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="mb-6">
            <StatsCards stats={stats} />
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <CategoryFilter
              categories={categories}
              active={category}
              onSelect={setCategory}
            />
            <div className="flex items-center gap-2">
              <Select value={intervalFilter} onValueChange={setIntervalFilter}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="Interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="900">15m</SelectItem>
                  <SelectItem value="3600">1h</SelectItem>
                  <SelectItem value="14400">4h</SelectItem>
                  <SelectItem value="86400">24h</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() => setShowWatchedOnly(!showWatchedOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  showWatchedOnly
                    ? "bg-yellow-500/10 text-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.15)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Watchlist
              </button>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Edge Radar Grid */}
          <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWindows.map((w) => (
              <div key={w.marketId} data-card>
                <MarketCard
                  window={w}
                  isWatched={watchlist.has(w.marketId)}
                  onToggleWatch={toggle}
                />
              </div>
            ))}
          </div>

          {filteredWindows.length === 0 && !loading && (
            <div className="text-center py-12">
              <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-bounce" />
              <p className="text-sm text-muted-foreground">
                {windows.length === 0
                  ? "No open windows found on-chain. Markets may not be published to SigmaWindowRegistry yet."
                  : "No windows match your filters"}
              </p>
            </div>
          )}

          {loading && windows.length === 0 && (
            <div className="text-center py-12">
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
                <span className="text-sm text-muted-foreground">Loading on-chain data...</span>
              </div>
              <div className="flex justify-center gap-1 mt-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary/40 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 py-2 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Sigma — Fair-Value Edge Detection</span>
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${error ? "bg-negative" : "bg-positive"}`}>
              <span className={`block w-full h-full rounded-full ${error ? "" : "animate-ping bg-positive"}`} />
            </span>
            {error ? "Error" : "Live"}
          </span>
        </div>
      </footer>
      </div>
    </div>
  );
}
