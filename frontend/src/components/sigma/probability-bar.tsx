"use client";

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
  const height = size === "sm" ? "h-1.5" : size === "md" ? "h-2.5" : "h-4";
  const pct = Math.min(100, Math.max(0, probability * 100));

  return (
    <div className="w-full">
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
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
