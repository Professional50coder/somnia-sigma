"use client";

import type { OrderbookData } from "@/lib/types";
import { formatPrice } from "@/lib/format";

interface OrderbookProps {
  orderbook: OrderbookData;
  maxLevels?: number;
}

export function Orderbook({ orderbook, maxLevels = 12 }: OrderbookProps) {
  const bids = orderbook.bids.slice(0, maxLevels);
  const asks = orderbook.asks.slice(0, maxLevels);
  const maxSize = Math.max(
    ...bids.map((l) => l.size),
    ...asks.map((l) => l.size),
    1
  );

  return (
    <div className="sigma-card p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">Order Book</h3>
      <div className="space-y-0.5">
        {/* Asks (reversed so lowest ask is at bottom) */}
        {[...asks].reverse().map((level, i) => (
          <div key={`ask-${i}`} className="flex items-center gap-2 text-xs font-mono relative">
            <div
              className="absolute right-0 top-0 bottom-0 bg-negative/10 rounded"
              style={{ width: `${(level.size / maxSize) * 100}%` }}
            />
            <span className="relative flex-1 text-right text-negative">
              {formatPrice(level.price)}
            </span>
            <span className="relative w-20 text-right text-muted-foreground">
              {level.size.toFixed(0)}
            </span>
          </div>
        ))}

        {/* Spread */}
        <div className="flex items-center justify-center py-1.5 border-y border-border">
          <span className="text-[11px] text-muted-foreground font-mono">
            Spread: {asks.length && bids.length ? formatPrice(asks[0].price - bids[0].price) : "—"}
          </span>
        </div>

        {/* Bids */}
        {bids.map((level, i) => (
          <div key={`bid-${i}`} className="flex items-center gap-2 text-xs font-mono relative">
            <div
              className="absolute right-0 top-0 bottom-0 bg-positive/10 rounded"
              style={{ width: `${(level.size / maxSize) * 100}%` }}
            />
            <span className="relative flex-1 text-right text-positive">
              {formatPrice(level.price)}
            </span>
            <span className="relative w-20 text-right text-muted-foreground">
              {level.size.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
