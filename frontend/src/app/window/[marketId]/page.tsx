"use client";

import { use } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Clock, Zap, Target, TrendingUp, TrendingDown } from "lucide-react";
import { SigmaNav } from "@/components/sigma/sigma-nav";
import { ProbabilityBar } from "@/components/sigma/probability-bar";
import { CountdownTimer } from "@/components/sigma/countdown-timer";
import { Orderbook } from "@/components/sigma/orderbook";
import { TradeFeed } from "@/components/sigma/trade-feed";
import type { WindowWithFair, OrderbookData, Trade } from "@/lib/types";
import { formatProbability, formatEdge, formatKelly, timeAgo } from "@/lib/format";
import { edgeColor } from "@/lib/colors";

// Sample data for detail view
const SAMPLE_WINDOW: WindowWithFair = {
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
  orderbook: {
    bids: [
      { price: 0.57, size: 450 },
      { price: 0.56, size: 320 },
      { price: 0.55, size: 680 },
      { price: 0.54, size: 210 },
      { price: 0.53, size: 540 },
      { price: 0.52, size: 180 },
    ],
    asks: [
      { price: 0.59, size: 380 },
      { price: 0.60, size: 520 },
      { price: 0.61, size: 290 },
      { price: 0.62, size: 410 },
      { price: 0.63, size: 150 },
      { price: 0.64, size: 330 },
    ],
    timestamp: Date.now() / 1000,
  },
  recentTrades: [
    { id: "t1", price: 0.58, size: 120, side: "buy", timestamp: Date.now() / 1000 - 30, trader: "0x0dDb...A468" },
    { id: "t2", price: 0.57, size: 85, side: "sell", timestamp: Date.now() / 1000 - 60, trader: "0x7F8F...2ad9" },
    { id: "t3", price: 0.58, size: 200, side: "buy", timestamp: Date.now() / 1000 - 90, trader: "0x0dDb...A468" },
    { id: "t4", price: 0.57, size: 150, side: "sell", timestamp: Date.now() / 1000 - 120, trader: "0x7F8F...2ad9" },
    { id: "t5", price: 0.59, size: 90, side: "buy", timestamp: Date.now() / 1000 - 150, trader: "0x0dDb...A468" },
  ],
};

export default function WindowDetailPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = use(params);
  const w = SAMPLE_WINDOW;
  const fv = w.fairValue;

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
                <h1 className="text-xl font-semibold text-foreground">{w.question}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {w.category}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <CountdownTimer expiresAt={w.expiresAt} />
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="w-3 h-3 text-accent" />
                    {marketId}
                  </span>
                </div>
              </div>
            </div>

            {/* Fair value + Market price side by side */}
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
                          {(Number(fv.sigmaWad) / 1e18).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="sigma-label">Tau (Time)</div>
                        <div className="font-mono text-sm text-muted-foreground">
                          {(Number(fv.tauWad) / 86400e18).toFixed(1)}d
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Reason: <span className="text-foreground">{fv.reason}</span>
                      {" · Updated {timeAgo(fv.updatedAt)}"}
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground text-sm">No fair value available</div>
                )}
              </div>

              {/* Market Price */}
              <div className="sigma-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-medium text-foreground">Market Price (dreamDEX)</h3>
                </div>
                <div className="sigma-price-lg mb-3">
                  {w.marketPrice ? formatProbability(Math.round(w.marketPrice * 10000)) : "—"}
                </div>
                <ProbabilityBar probability={w.marketPrice ?? 0} label="Implied Probability" />
                {fv?.ok && (
                  <div className="mt-4 p-3 rounded-lg bg-secondary/50">
                    <div className="text-xs text-muted-foreground mb-1">Edge Analysis</div>
                    <div className={`text-sm font-medium ${edgeColor(fv.edgeBps)}`}>
                      {fv.edgeBps > 0
                        ? `Market is underpriced by ${formatEdge(fv.edgeBps)} — buying opportunity`
                        : `Market is overpriced by ${formatEdge(Math.abs(fv.edgeBps))} — selling opportunity`}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Orderbook + Trades */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {w.orderbook && <Orderbook orderbook={w.orderbook} />}
              {w.recentTrades && <TradeFeed trades={w.recentTrades} />}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
