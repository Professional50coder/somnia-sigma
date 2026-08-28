"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAllOpenWindows, getVolState } from "@/lib/sigma";
import type { WindowWithFair } from "@/lib/types";

export interface VolState {
  sampleCount: number;
  lastPrice: number;
  varianceRate: number;
  sigma: number;
  ok: boolean;
}

export interface SigmaData {
  windows: WindowWithFair[];
  vol: VolState | null;
  lastUpdated: Date | null;
}

/**
 * Polls on-chain SigmaOracle + registry for live window data.
 * Returns windows sorted by expiry (soonest first) with fair values.
 */
export function useSigmaData(intervalMs: number = 15000) {
  const [data, setData] = useState<SigmaData>({
    windows: [],
    vol: null,
    lastUpdated: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef<() => Promise<SigmaData>>(async () => {
    const [windows, vol] = await Promise.all([getAllOpenWindows(), getVolState()]);
    return { windows, vol, lastUpdated: new Date() };
  });

  const refresh = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, refresh]);

  return { ...data, loading, error, refresh };
}
