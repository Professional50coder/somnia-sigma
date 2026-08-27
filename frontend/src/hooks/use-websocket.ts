"use client";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface SubscriptionType {
  type: "orderbook" | "trades" | "market";
  platform: string;
  market_id: string;
}

export interface ServerMessage {
  type: string;
  [key: string]: unknown;
}

export function useWebSocket() {
  return {
    connectionState: "disconnected" as ConnectionState,
    error: null as string | null,
    latency: null as number | null,
    subscribe: (_sub: SubscriptionType) => {},
    unsubscribe: (_sub: SubscriptionType) => {},
    onMessage: (_handler: (msg: ServerMessage) => void) => () => {},
  };
}
