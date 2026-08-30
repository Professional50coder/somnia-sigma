"use client";

import { useRef, useEffect } from "react";
import { animate, onScroll } from "animejs";

interface ProbabilityBarProps {
  probability: number;
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ProbabilityBar({
  probability,
  label,
  showValue = true,
  size = "md",
}: ProbabilityBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const played = useRef(false);
  const height = size === "sm" ? "h-1.5" : size === "md" ? "h-2.5" : "h-4";
  const pct = Math.min(100, Math.max(0, probability * 100));

  useEffect(() => {
    if (!barRef.current || played.current) return;
    const el = barRef.current;
    played.current = true;

    const inner = el.querySelector("[data-fill]");
    if (inner) {
      animate(inner, {
        width: `${pct}%`,
        duration: 1000,
        ease: "outExpo",
        autoplay: onScroll({ target: el, enter: "100%" }),
      });
    }
  }, [pct]);

  return (
    <div className="w-full" ref={barRef}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="sigma-label">{label}</span>}
          {showValue && (
            <span className="sigma-caption font-mono">
              {(probability * 100).toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full ${height} rounded-full bg-secondary overflow-hidden`}>
        <div
          data-fill
          className="h-full rounded-full bg-primary"
          style={{ width: 0 }}
        />
      </div>
    </div>
  );
}
