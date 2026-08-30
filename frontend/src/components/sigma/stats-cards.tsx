"use client";

import { useRef, useEffect } from "react";
import { animate, stagger, spring, onScroll } from "animejs";
import { TrendingUp, Target, BarChart3, Activity, Zap, Shield } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { PerformanceStats } from "@/lib/types";

interface StatsCardsProps {
  stats: PerformanceStats;
}

const tooltips: Record<string, string> = {
  "Total Trades": "Number of windows with fair value computed",
  "Win Rate": "Percentage of windows where edge was positive",
  "Total PnL": "Cumulative profit/loss from settled trades",
  "Sharpe Ratio": "Risk-adjusted return (higher = better)",
  "Max Drawdown": "Largest peak-to-trough decline",
  "Avg Edge": "Average edge across all priced windows (in basis points)",
};

export function StatsCards({ stats }: StatsCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  const cards = [
    { label: "Total Trades", value: stats.totalTrades.toString(), icon: BarChart3, color: "text-primary" },
    { label: "Win Rate", value: `${(stats.winRate * 100).toFixed(1)}%`, icon: Target, color: stats.winRate > 0.5 ? "text-positive" : "text-negative" },
    { label: "Total PnL", value: `$${stats.totalPnl.toFixed(0)}`, icon: TrendingUp, color: stats.totalPnl >= 0 ? "text-positive" : "text-negative" },
    { label: "Sharpe Ratio", value: stats.sharpeRatio.toFixed(2), icon: Activity, color: stats.sharpeRatio > 1 ? "text-positive" : "text-muted-foreground" },
    { label: "Max Drawdown", value: `${(stats.maxDrawdown * 100).toFixed(1)}%`, icon: Shield, color: "text-negative" },
    { label: "Avg Edge", value: `${(stats.avgEdge * 100).toFixed(1)}%`, icon: Zap, color: stats.avgEdge > 0 ? "text-accent" : "text-muted-foreground" },
  ];

  useEffect(() => {
    if (!containerRef.current || played.current) return;
    const el = containerRef.current;
    played.current = true;

    const items = el.querySelectorAll("[data-stat]");
    animate(items, {
      opacity: [0, 1],
      translateY: [20, 0],
      scale: [0.92, 1],
      duration: 600,
      delay: stagger(60, { from: "center", jitter: 40 }),
      ease: spring({ stiffness: 300, damping: 22 }),
      autoplay: onScroll({ target: el, enter: "100%" }),
    });
  }, []);

  // Hover animations using keyframes multi-bounce
  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll("[data-stat]");
    items.forEach((item) => {
      const enter = () => {
        animate(item, {
          scale: [1, 1.04, 0.98, 1.02, 1],
          translateY: [0, -4, 0, -2, 0],
          duration: 500,
          ease: "outBounce",
        });
      };
      const leave = () => {
        animate(item, {
          scale: [1.04, 1],
          translateY: [-2, 0],
          duration: 200,
          ease: "outQuad",
        });
      };
      item.addEventListener("mouseenter", enter);
      item.addEventListener("mouseleave", leave);
    });
  }, []);

  return (
    <div ref={containerRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <div key={card.label} data-stat className="opacity-0 cursor-default">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="sigma-card p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                  <span className="sigma-label">{card.label}</span>
                </div>
                <div className={`font-mono text-lg font-semibold ${card.color}`}>
                  {card.value}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>{tooltips[card.label]}</TooltipContent>
          </Tooltip>
        </div>
      ))}
    </div>
  );
}
