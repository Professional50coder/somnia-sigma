"use client";

import { useState, useEffect } from "react";

export function useCountdown(targetTimestamp: number) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, targetTimestamp - Date.now() / 1000)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, targetTimestamp - Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [targetTimestamp]);

  const isExpired = remaining <= 0;
  const isUrgent = remaining > 0 && remaining < 300;

  return { remaining, isExpired, isUrgent };
}
