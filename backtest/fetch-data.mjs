// Attempt real BTC M1 history from dreamDEX's price-feed indexer (read-only,
// auth-free GraphQL: https://price-feed.dev.oracle.somnia.host/v1/graphql).
// Hard-timeboxed: falls back to clearly-labeled synthetic GBM minute bars if
// the live fetch doesn't land quickly, so the backtest always has SOMETHING
// to run against rather than blocking indefinitely on network conditions.
import { writeFileSync } from "node:fs";

const URL_ = "https://price-feed.dev.oracle.somnia.host/v1/graphql";
const QUERY = `query PriceCandles($base: String!, $limit: Int!, $quote: String!) {
  Candle(where: {_and: [{base: {_eq: $base}}, {resolution: {_eq: M1}}, {quote: {_eq: $quote}}]}, order_by: {bucketStart: desc}, limit: $limit) {
    bucketStart open high low close markClose count
  }
}`;

async function tryFetch() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(URL_, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { base: "BTC", limit: 3000, quote: "USDC" } }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    const rows = json.data?.Candle ?? [];
    if (rows.length === 0) throw new Error("empty result");
    return rows.reverse().map((c) => ({
      t: Number(c.bucketStart),
      close: Number(c.close) / 1e18,
    }));
  } finally {
    clearTimeout(timer);
  }
}

function synthetic() {
  // Clearly-labeled fallback: GBM minute bars, ~35% annualised vol (a
  // realistic BTC-ish figure), 3 days of 1-minute bars. NOT real market data.
  const n = 3 * 24 * 60;
  const dt = 60 / (365 * 24 * 3600);
  const sigmaAnnual = 0.35;
  const sigmaPerBar = sigmaAnnual * Math.sqrt(dt);
  let price = 65000;
  const bars = [];
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const t0 = Math.floor(Date.now() / 1000) - n * 60;
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rand(), 1e-9), u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    price = price * Math.exp(-0.5 * sigmaPerBar * sigmaPerBar + sigmaPerBar * z);
    bars.push({ t: t0 + i * 60, close: price });
  }
  return bars;
}

let bars, source;
try {
  bars = await tryFetch();
  source = "live:price-feed.dev.oracle.somnia.host BTC/USDC M1";
  console.log(`Live fetch succeeded: ${bars.length} real M1 candles.`);
} catch (e) {
  console.log(`Live fetch failed/timed out (${e.message}). Falling back to SYNTHETIC data.`);
  bars = synthetic();
  source = "SYNTHETIC — GBM(sigma=35% annualised), NOT real market data";
}

writeFileSync(new URL("./data/btc_m1.json", import.meta.url), JSON.stringify({ source, bars }));
console.log(`Wrote ${bars.length} bars, source: ${source}`);
