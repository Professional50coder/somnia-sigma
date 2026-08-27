"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "sigma-watchlist";

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...watchlist]));
  }, [watchlist]);

  const toggle = useCallback((marketId: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(marketId)) next.delete(marketId);
      else next.add(marketId);
      return next;
    });
  }, []);

  const isWatched = useCallback(
    (marketId: string) => watchlist.has(marketId),
    [watchlist]
  );

  return { watchlist, toggle, isWatched };
}
