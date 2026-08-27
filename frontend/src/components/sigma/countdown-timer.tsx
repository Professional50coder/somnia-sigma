"use client";

import { useCountdown } from "@/hooks/use-countdown";
import { formatCountdown } from "@/lib/format";

interface CountdownTimerProps {
  expiresAt: number;
  size?: "sm" | "md" | "lg";
}

export function CountdownTimer({ expiresAt, size = "md" }: CountdownTimerProps) {
  const { remaining, isExpired, isUrgent } = useCountdown(expiresAt);

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  if (isExpired) {
    return (
      <span className={`font-mono ${sizeClasses[size]} text-muted-foreground`}>
        Expired
      </span>
    );
  }

  return (
    <span
      className={`font-mono ${sizeClasses[size]} ${
        isUrgent ? "text-negative animate-pulse" : "text-muted-foreground"
      }`}
    >
      {formatCountdown(remaining)}
    </span>
  );
}
