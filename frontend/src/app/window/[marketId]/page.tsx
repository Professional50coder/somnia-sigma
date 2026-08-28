"use client";

import { use, useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Clock, Zap, Target, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";
import { ProbabilityBar } from "@/components/sigma/probability-bar";
import { CountdownTimer } from "@/components/sigma/countdown-timer";
import { Orderbook } from "@/components/sigma/orderbook";
import { TradeFeed } from "@/components/sigma/trade-feed";
import { getRegistryWindow, getRawFairValue, toFairValue, type RegistryWindow, type RawFairValue } from "@/lib/sigma";
import { formatProbability, formatEdge, formatKelly, timeAgo } from "@/lib/format";
import { edgeColor } from "@/lib/colors";
import type { WindowWithFair, OrderbookData, Trade } from "@/lib/types";

const INTERVAL_LABELS: Record<number, string> = {
  900: "15m",
  3600: "1h",
  14400: "4h",
  86400: "24h",
};

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
        <main className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
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
            </div>

            {/* Key facts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="sigma-card p-3">
                <div className="sigma-label mb-1">Opening Line</div>
                <div className="font-mono text-lg font-semibold text-foreground">
                  ${openingPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="sigma-card p-3">
                <div className="sigma-label mb-1">Window</div>
                <div className="font-mono text-lg font-semibold text-foreground">
                  {intervalLabel}
                </div>
              </div>
              <div className="sigma-card p-3">
                <div className="sigma-label mb-1">Published At</div>
                <div className="font-mono text-sm text-muted-foreground">
                  {timeAgo(Number(reg.publishedAt))}
                </div>
              </div>
              <div className="sigma-card p-3">
                <div className="sigma-label mb-1">Status</div>
                <div className={`font-mono text-sm font-medium ${fv?.ok ? "text-positive" : "text-negative"}`}>
                  {fv?.ok ? "PRICED" : (fv?.reason?.toUpperCase() ?? "NOT PRICED")}
                </div>
              </div>
            </div>

            {/* Fair value + Edge analysis side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Fair Value */}
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

              {/* Market Price */}
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
            </div>

            {/* Model info */}
            <div className="sigma-card p-5 mb-6">
              <h3 className="text-sm font-medium text-foreground mb-3">Model Assumptions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="block text-foreground font-medium mb-0.5">Model</span>
                  Φ(d₂) — zero-drift GBM
                </div>
                <div>
                  <span className="block text-foreground font-medium mb-0.5">Settlement</span>
                  Terminal (close ≥ open)
                </div>
                <div>
                  <span className="block text-foreground font-medium mb-0.5">Vol Source</span>
                  On-chain EWMA from mark price
                </div>
                <div>
                  <span className="block text-foreground font-medium mb-0.5">Known Limit</span>
                  Understates fat tails
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
