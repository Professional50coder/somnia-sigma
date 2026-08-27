"use client";

import type { Trade } from "@/lib/types";
import { formatPrice, timeAgo } from "@/lib/format";
import { sideColor } from "@/lib/colors";

interface TradeFeedProps {
  trades: Trade[];
  maxItems?: number;
}

export function TradeFeed({ trades, maxItems = 20 }: TradeFeedProps) {
  const displayed = trades.slice(0, maxItems);

  return (
    <div className="sigma-card p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">Recent Trades</h3>
      <div className="space-y-1">
        {displayed.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No trades yet</p>
        )}
        {displayed.map((trade) => (
          <div
            key={trade.id}
            className="flex items-center gap-3 text-xs font-mono py-1 animate-trade-enter"
          >
            <span className={`w-8 ${sideColor(trade.side)}`}>
              {trade.side.toUpperCase()}
            </span>
            <span className="flex-1 text-foreground">{formatPrice(trade.price)}</span>
            <span className="text-muted-foreground w-16 text-right">
              {trade.size.toFixed(0)}
            </span>
            <span className="text-muted-foreground w-14 text-right">
              {timeAgo(trade.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
