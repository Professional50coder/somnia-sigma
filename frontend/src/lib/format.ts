export function formatProbability(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

export function formatEdge(bps: number): string {
  const sign = bps >= 0 ? "+" : "";
  return `${sign}${(bps / 100).toFixed(1)}%`;
}

export function formatPrice(price: number): string {
  return `${(price * 100).toFixed(1)}¢`;
}

export function formatUSD(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Expired";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatKelly(kellyWad: bigint): string {
  const kelly = Number(kellyWad) / 1e18;
  return `${(kelly * 100).toFixed(1)}%`;
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() / 1000 - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
