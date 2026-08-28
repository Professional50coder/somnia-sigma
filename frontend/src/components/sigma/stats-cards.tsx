"use client";

import { TrendingUp, Target, BarChart3, Activity, Zap, Shield } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
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
  const cards = [
    {
      label: "Total Trades",
      value: stats.totalTrades.toString(),
      icon: BarChart3,
      color: "text-primary",
    },
    {
      label: "Win Rate",
      value: `${(stats.winRate * 100).toFixed(1)}%`,
      icon: Target,
      color: stats.winRate > 0.5 ? "text-positive" : "text-negative",
    },
    {
      label: "Total PnL",
      value: `$${stats.totalPnl.toFixed(0)}`,
      icon: TrendingUp,
      color: stats.totalPnl >= 0 ? "text-positive" : "text-negative",
    },
    {
      label: "Sharpe Ratio",
      value: stats.sharpeRatio.toFixed(2),
      icon: Activity,
      color: stats.sharpeRatio > 1 ? "text-positive" : "text-muted-foreground",
    },
    {
      label: "Max Drawdown",
      value: `${(stats.maxDrawdown * 100).toFixed(1)}%`,
      icon: Shield,
      color: "text-negative",
    },
    {
      label: "Avg Edge",
      value: `${(stats.avgEdge * 100).toFixed(1)}%`,
      icon: Zap,
      color: stats.avgEdge > 0 ? "text-accent" : "text-muted-foreground",
    },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
    >
      {cards.map((card) => (
        <motion.div key={card.label} variants={staggerItem} whileHover={{ scale: 1.02, y: -2 }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="sigma-card p-3 cursor-help">
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
        </motion.div>
      ))}
    </motion.div>
  );
}
