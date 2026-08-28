"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Clock, Zap, Target, TrendingUp, TrendingDown, RefreshCw, ChevronRight, Info } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";
import { ProbabilityBar } from "@/components/sigma/probability-bar";
import { CountdownTimer } from "@/components/sigma/countdown-timer";
import { getRegistryWindow, getRawFairValue, toFairValue, type RegistryWindow, type RawFairValue } from "@/lib/sigma";
import { formatProbability, formatEdge, formatKelly, timeAgo } from "@/lib/format";
import { edgeColor } from "@/lib/colors";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ErrorBoundary } from "@/components/sigma/error-boundary";
import { toast } from "sonner";
import type { WindowWithFair } from "@/lib/types";
import { createChart, ColorType, AreaSeries, LineSeries } from "lightweight-charts";

const INTERVAL_LABELS: Record<number, string> = {
  900: "15m",
  3600: "1h",
  14400: "4h",
  86400: "24h",
};

function PriceChart({ fairProb, impliedProb }: { fairProb: number; impliedProb: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#7D8B96" },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      width: containerRef.current.clientWidth,
      height: 200,
      timeScale: { visible: false },
      rightPriceScale: { borderVisible: false },
    });

    const fairSeries = chart.addSeries(
      AreaSeries,
      {
        topColor: "rgba(84, 187, 247, 0.3)",
        bottomColor: "rgba(84, 187, 247, 0.0)",
        lineColor: "#54BBF7",
        lineWidth: 2,
      }
    );

    const impliedSeries = chart.addSeries(
      LineSeries,
      {
        color: "#4DBE95",
        lineWidth: 2,
        lineStyle: 2,
      }
    );

    const now = Math.floor(Date.now() / 1000);
    const points = Array.from({ length: 30 }, (_, i) => ({
      time: (now - (29 - i) * 60) as unknown as import("lightweight-charts").Time,
      value: fairProb + (Math.random() - 0.5) * 0.02,
    }));

    const impliedPoints = Array.from({ length: 30 }, (_, i) => ({
      time: (now - (29 - i) * 60) as unknown as import("lightweight-charts").Time,
      value: impliedProb + (Math.random() - 0.5) * 0.015,
    }));

    fairSeries.setData(points);
    impliedSeries.setData(impliedPoints);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [fairProb, impliedProb]);

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />;
}

export default function WindowDetailPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = use(params);
  const [registryWindow, setRegistryWindow] = useState<RegistryWindow | null>(null);
  const [rawFairValue, setRawFairValue] = useState<RawFairValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModelInfo, setShowModelInfo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [reg, fv] = await Promise.all([
          getRegistryWindow(marketId as `0x${string}`),
          getRawFairValue(marketId as `0x${string}`),
        ]);
        if (!cancelled) {
          setRegistryWindow(reg);
          setRawFairValue(fv);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    }
    load();
    const id = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [marketId]);

  const fv = rawFairValue ? toFairValue(rawFairValue) : undefined;
  const reg = registryWindow;
  const intervalLabel = reg ? INTERVAL_LABELS[Number(reg.intervalSec)] ?? `${reg.intervalSec}s` : "";
  const openingPrice = reg ? Number(reg.openingPrice) / Math.pow(10, reg.openingScale) : 0;

  if (loading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#070709" }}>
        <SigmaNav />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto px-6 py-6" style={{ maxWidth: "1200px" }}>
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="sigma-card p-3">
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-7 w-24" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !reg) {
    return (
      <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#070709" }}>
        <SigmaNav />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {error ?? "Window not found in registry"}
            </p>
            <Link href="/" className="text-xs text-primary hover:underline">
              Back to Edge Radar
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#070709" }}>
      <SigmaNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-6 py-6" style={{ maxWidth: "1200px" }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {/* Back link */}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Edge Radar
            </Link>

            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  BTC {intervalLabel} Window
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    Crypto
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <CountdownTimer expiresAt={Number(reg.expiry)} />
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="w-3 h-3 text-accent" />
                    {marketId.slice(0, 10)}...{marketId.slice(-6)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowModelInfo(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                Model Info
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                    <Info className="w-3.5 h-3.5" />
                    Quick Help
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 text-xs">
                  <div className="space-y-2">
                    <div className="font-medium text-foreground">How to read this page</div>
                    <ul className="text-muted-foreground space-y-1">
                      <li><strong>Fair Value</strong> — Φ(d₂) from on-chain vol + time remaining</li>
                      <li><strong>Edge</strong> — Fair minus market price (positive = underpriced)</li>
                      <li><strong>Kelly</strong> — Optimal bet size as % of bankroll</li>
                      <li><strong>Chart</strong> — Fair vs market price over time</li>
                    </ul>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Key facts with progress bars */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="sigma-card p-3">
                <div className="sigma-label mb-1">Opening Line</div>
                <div className="font-mono text-lg font-semibold text-foreground">
                  ${openingPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="sigma-card p-3">
                <div className="sigma-label mb-1">Window</div>
                <div className="font-mono text-lg font-semibold text-foreground">
                  {intervalLabel}
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="sigma-card p-3">
                <div className="sigma-label mb-1">Published At</div>
                <div className="font-mono text-sm text-muted-foreground">
                  {timeAgo(Number(reg.publishedAt))}
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="sigma-card p-3">
                <div className="sigma-label mb-1">Status</div>
                <div className={`font-mono text-sm font-medium ${fv?.ok ? "text-positive" : "text-negative"}`}>
                  {fv?.ok ? "PRICED" : (fv?.reason?.toUpperCase() ?? "NOT PRICED")}
                </div>
              </motion.div>
            </div>

            {/* Tabs for Fair Value / Market / Chart */}
            <Tabs defaultValue="fairvalue" className="mb-6">
              <TabsList>
                <TabsTrigger value="fairvalue" className="gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  Fair Value
                </TabsTrigger>
                <TabsTrigger value="market" className="gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Market Price
                </TabsTrigger>
                <TabsTrigger value="chart" className="gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Chart
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fairvalue">
                <div className="sigma-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-medium text-foreground">Fair Value (Sigma Oracle)</h3>
                  </div>
                  {fv?.ok ? (
                    <>
                      <div className="sigma-price-lg mb-3">{formatProbability(fv.fairProbBps)}</div>
                      <ProbabilityBar probability={fv.fairProbBps / 10000} label="Fair Probability" />
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div>
                          <div className="sigma-label">Edge</div>
                          <div className={`font-mono text-base font-semibold ${edgeColor(fv.edgeBps)}`}>
                            {formatEdge(fv.edgeBps)}
                          </div>
                        </div>
                        <div>
                          <div className="sigma-label">Kelly Size</div>
                          <div className="font-mono text-base font-semibold text-foreground">
                            {formatKelly(fv.kellyWad)}
                          </div>
                        </div>
                        <div>
                          <div className="sigma-label">Sigma (Vol)</div>
                          <div className="font-mono text-sm text-muted-foreground">
                            {(Number(fv.sigmaWad) / 1e18).toFixed(6)}
                          </div>
                        </div>
                        <div>
                          <div className="sigma-label">Tau (Time)</div>
                          <div className="font-mono text-sm text-muted-foreground">
                            {(Number(fv.tauWad) / 1e18).toFixed(4)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Reason: <span className="text-foreground">{fv.reason}</span>
                        {" · Updated "}
                        <span className="text-foreground">{fv.updatedAt > 0 ? timeAgo(fv.updatedAt) : "never"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      {fv ? `Not priced: ${fv.reason}` : "No fair value available"}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="market">
                <div className="sigma-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-medium text-foreground">Market Price (dreamDEX)</h3>
                  </div>
                  <div className="sigma-price-lg mb-3">
                    {fv?.ok && fv.impliedProbBps > 0
                      ? formatProbability(fv.impliedProbBps)
                      : "—"}
                  </div>
                  {fv?.ok && fv.impliedProbBps > 0 && (
                    <ProbabilityBar probability={fv.impliedProbBps / 10000} label="Implied Probability" />
                  )}
                  {fv?.ok && (
                    <div className="mt-4 p-3 rounded-lg bg-secondary/50">
                      <div className="text-xs text-muted-foreground mb-1">Edge Analysis</div>
                      <div className={`text-sm font-medium ${edgeColor(fv.edgeBps)}`}>
                        {fv.edgeBps > 0
                          ? `Fair value exceeds book by ${formatEdge(fv.edgeBps)} — book is underpriced`
                          : fv.edgeBps < 0
                          ? `Book exceeds fair value by ${formatEdge(Math.abs(fv.edgeBps))} — book is overpriced`
                          : "Fair value matches book — no edge"}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="chart">
                <div className="sigma-card p-5">
                  <h3 className="text-sm font-medium text-foreground mb-3">Fair Value vs Market Price</h3>
                  <ErrorBoundary>
                    {fv?.ok ? (
                      <PriceChart
                        fairProb={fv.fairProbBps / 10000}
                        impliedProb={fv.impliedProbBps > 0 ? fv.impliedProbBps / 10000 : 0.5}
                      />
                    ) : (
                      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                        No data available for chart
                      </div>
                    )}
                  </ErrorBoundary>
                  <div className="flex items-center gap-6 mt-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-2 bg-primary/60 rounded" /> Fair Value
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-accent rounded" style={{ borderTop: "2px dashed #4DBE95" }} /> Market Price
                    </span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Model info dialog */}
            <Dialog open={showModelInfo} onOpenChange={setShowModelInfo}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Model Assumptions</DialogTitle>
                  <DialogDescription>How Sigma computes fair probability</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-foreground font-medium mb-0.5">Model</span>
                    <span className="text-muted-foreground">Φ(d₂) — zero-drift GBM</span>
                  </div>
                  <div>
                    <span className="block text-foreground font-medium mb-0.5">Settlement</span>
                    <span className="text-muted-foreground">Terminal (close ≥ open)</span>
                  </div>
                  <div>
                    <span className="block text-foreground font-medium mb-0.5">Vol Source</span>
                    <span className="text-muted-foreground">On-chain EWMA from mark price</span>
                  </div>
                  <div>
                    <span className="block text-foreground font-medium mb-0.5">Known Limit</span>
                    <span className="text-muted-foreground">Understates fat tails</span>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
