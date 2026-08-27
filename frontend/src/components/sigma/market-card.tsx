"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Star, TrendingUp, TrendingDown } from "lucide-react";
import type { WindowWithFair } from "@/lib/types";
import { formatProbability, formatEdge, formatCountdown, timeAgo } from "@/lib/format";
import { edgeColor, edgeBgColor } from "@/lib/colors";
import { useCountdown } from "@/hooks/use-countdown";

interface MarketCardProps {
  window: WindowWithFair;
  isWatched: boolean;
  onToggleWatch: (id: string) => void;
}

function WindowCountdown({ expiresAt }: { expiresAt: number }) {
  const { remaining, isUrgent } = useCountdown(expiresAt);
  return (
    <span className={`font-mono text-xs ${isUrgent ? "text-negative animate-pulse" : "text-muted-foreground"}`}>
      {formatCountdown(remaining)}
    </span>
  );
}

export function MarketCard({ window: w, isWatched, onToggleWatch }: MarketCardProps) {
  const fv = w.fairValue;
  const hasEdge = fv?.ok && Math.abs(fv.edgeBps) > 50;
  const edgeDir = (fv?.edgeBps ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="sigma-card p-4 group"
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/window/${w.marketId}`}
          className="flex-1 min-w-0"
        >
          <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {w.question}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              {w.category}
            </span>
            <WindowCountdown expiresAt={w.expiresAt} />
          </div>
        </Link>

        <button
          onClick={() => onToggleWatch(w.marketId)}
          className="shrink-0 p-1 rounded hover:bg-secondary transition-colors"
        >
          <Star
            className={`w-4 h-4 ${isWatched ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`}
          />
        </button>
      </div>

      {fv?.ok ? (
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="sigma-label">Fair Value</div>
            <div className="sigma-price-lg">{formatProbability(fv.fairProbBps)}</div>
          </div>
          <div className="text-right">
            <div className="sigma-label">Edge</div>
            <div className={`flex items-center gap-1 font-mono text-lg font-semibold ${edgeColor(fv.edgeBps)}`}>
              {edgeDir ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {formatEdge(fv.edgeBps)}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <div className="sigma-label">Market Price</div>
          <div className="sigma-price-lg text-muted-foreground">
            {w.marketPrice ? formatProbability(Math.round(w.marketPrice * 10000)) : "—"}
          </div>
        </div>
      )}

      {hasEdge && (
        <div className={`mt-2 px-2 py-1 rounded text-xs font-medium ${edgeBgColor(fv!.edgeBps)} ${edgeColor(fv!.edgeBps)}`}>
          {fv!.edgeBps > 0 ? "Undervalued" : "Overvalued"} —               Kelly {formatProbability(fv!.kellyWad > BigInt(0) ? Number(fv!.kellyWad) / 1e16 : 0)}
        </div>
      )}
    </motion.div>
  );
}
