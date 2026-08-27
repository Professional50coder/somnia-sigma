export interface Window {
  marketId: string;
  question: string;
  category: string;
  beginsAt: number;
  expiresAt: number;
  collateralToken: string;
  minOrderSize: bigint;
  outcomeCount: number;
}

export interface FairValue {
  fairProbBps: number;
  impliedProbBps: number;
  edgeBps: number;
  breakEvenBps: number;
  kellyWad: bigint;
  sigmaWad: bigint;
  tauWad: bigint;
  updatedAt: number;
  reason: string;
  ok: boolean;
}

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface OrderbookData {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
}

export interface Trade {
  id: string;
  price: number;
  size: number;
  side: "buy" | "sell";
  timestamp: number;
  trader: string;
}

export interface WindowWithFair extends Window {
  fairValue?: FairValue;
  orderbook?: OrderbookData;
  recentTrades?: Trade[];
  marketPrice?: number;
}

export interface PerformanceStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  sharpeRatio: number;
  maxDrawdown: number;
  kellyFraction: number;
  avgEdge: number;
}

export interface BacktestResult {
  timestamp: number;
  marketId: string;
  question: string;
  fairProb: number;
  marketProb: number;
  edge: number;
  kellyFraction: number;
  outcome: "win" | "loss" | "pending";
  pnl: number;
}

export interface Category {
  id: string;
  name: string;
  count: number;
}

export interface PriceHistoryPoint {
  timestamp: number;
  price: number;
  volume?: number;
}
