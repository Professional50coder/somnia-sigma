"use client";

import Link from "next/link";
import { useRef, useEffect } from "react";
import { animate, stagger, spring, onScroll } from "animejs";
import { Star, TrendingUp, TrendingDown, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
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
  const cardRef = useRef<HTMLDivElement>(null);
  const fv = w.fairValue;
  const hasEdge = fv?.ok && Math.abs(fv.edgeBps) > 50;
  const edgeDir = (fv?.edgeBps ?? 0) >= 0;

  // Entrance animation using onScroll
  useEffect(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;
    animate(el, {
      opacity: [0, 1],
      translateY: [16, 0],
      scale: [0.97, 1],
      duration: 500,
      ease: "outExpo",
      autoplay: onScroll({ target: el, enter: "100%" }),
    });
  }, []);

  // Hover effect using keyframes
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const enter = () => {
      animate(el, {
        scale: [1, 1.02],
        translateY: [0, -2],
        duration: 250,
        ease: spring({ stiffness: 300, damping: 15 }),
      });
    };
    const leave = () => {
      animate(el, {
        scale: [1.02, 1],
        translateY: [-2, 0],
        duration: 250,
        ease: "outBounce",
      });
    };
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => { el.removeEventListener("mouseenter", enter); el.removeEventListener("mouseleave", leave); };
  }, []);

  return (
    <div ref={cardRef} className="sigma-card p-4 group opacity-0">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/window/${w.marketId}`} className="flex-1 min-w-0">
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

        <Switch
          checked={isWatched}
          onCheckedChange={() => onToggleWatch(w.marketId)}
          className="shrink-0"
        />
      </div>

      {fv?.ok ? (
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="sigma-label">Fair Value</div>
            <div className="sigma-price-lg">{formatProbability(fv.fairProbBps)}</div>
          </div>
          <div className="text-right">
            <div className="sigma-label">Edge</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-1 font-mono text-lg font-semibold ${edgeColor(fv.edgeBps)} cursor-help`}>
                  {edgeDir ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {formatEdge(fv.edgeBps)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {fv.edgeBps > 0
                  ? `Book is ${formatEdge(fv.edgeBps)} below fair value — potential buy`
                  : `Book is ${formatEdge(Math.abs(fv.edgeBps))} above fair value — potential sell`}
              </TooltipContent>
            </Tooltip>
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
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`mt-2 px-2 py-1 rounded text-xs font-medium cursor-help ${edgeBgColor(fv!.edgeBps)} ${edgeColor(fv!.edgeBps)}`}>
              {fv!.edgeBps > 0 ? "Undervalued" : "Overvalued"} —               Kelly {formatProbability(fv!.kellyWad > BigInt(0) ? Number(fv!.kellyWad) / 1e16 : 0)}
            </div>
          </TooltipTrigger>
          <TooltipContent>Kelly fraction = optimal bet size as % of bankroll</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
