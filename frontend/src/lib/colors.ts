export function edgeColor(edgeBps: number): string {
  if (edgeBps > 200) return "text-positive";
  if (edgeBps > 0) return "text-accent";
  if (edgeBps > -200) return "text-muted-foreground";
  return "text-negative";
}

export function edgeBgColor(edgeBps: number): string {
  if (edgeBps > 200) return "bg-positive/10";
  if (edgeBps > 0) return "bg-accent/10";
  if (edgeBps > -200) return "bg-muted";
  return "bg-negative/10";
}

export function probabilityColor(probBps: number): string {
  if (probBps > 7000) return "text-positive";
  if (probBps > 4000) return "text-primary";
  if (probBps > 2000) return "text-yellow-500";
  return "text-negative";
}

export function sideColor(side: "buy" | "sell"): string {
  return side === "buy" ? "text-positive" : "text-negative";
}
