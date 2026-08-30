"use client";

import { useRef, useEffect } from "react";
import { animate, stagger } from "animejs";
import type { Trade } from "@/lib/types";
import { formatPrice, timeAgo } from "@/lib/format";
import { sideColor } from "@/lib/colors";

interface TradeFeedProps {
  trades: Trade[];
  maxItems?: number;
}

export function TradeFeed({ trades, maxItems = 20 }: TradeFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayed = trades.slice(0, maxItems);
  const played = useRef(false);

  useEffect(() => {
    if (!containerRef.current || played.current || displayed.length === 0) return;
    const el = containerRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !played.current) {
          played.current = true;
          const rows = el.querySelectorAll("[data-trade]");
          animate(rows, {
            opacity: [0, 1],
            translateX: [12, 0],
            duration: 400,
            delay: stagger(40),
            ease: "outExpo",
          });
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [displayed.length]);

  // Animate new trades arriving
  useEffect(() => {
    if (!containerRef.current) return;
    const first = containerRef.current.querySelector("[data-trade]");
    if (first && !first.getAttribute("data-animated")) {
      first.setAttribute("data-animated", "true");
      animate(first, {
        opacity: [0, 1],
        translateX: [-12, 0],
        scale: [0.98, 1],
        duration: 350,
        ease: "outExpo",
      });
    }
  }, [trades.length]);

  return (
    <div className="sigma-card p-4" ref={containerRef}>
      <h3 className="text-sm font-medium text-foreground mb-3">Recent Trades</h3>
      <div className="space-y-1">
        {displayed.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No trades yet</p>
        )}
        {displayed.map((trade) => (
          <div
            key={trade.id}
            data-trade
            className="flex items-center gap-3 text-xs font-mono py-1 opacity-0 hover:bg-secondary/30 rounded px-1 transition-colors"
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
