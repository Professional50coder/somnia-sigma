# ec-sigma (Bot Kit strategy) — build status

**Time-boxed session. What follows is accurate as of the last test run below.**

## Done and verified

1. **Quantization (`src/quantize.mjs` + `src/quantize.test.mjs`)** — pure,
   no chain dependency, no TypeScript build step. **10/10 tests passing**,
   including the documented `0.6237 → 0.624` case, tick-grid exactness,
   `[tick, one-tick]` clamping, YES+NO summing to exactly `one`, lot-size
   flooring, and the below-one-tick edge case. Run: `npm test` (or
   `node --test src/*.test.mjs`).
2. **Read-only client (`src/client.mjs`)** — constructs `SomniaMarkets` with
   **no `privateKey`**, so it is structurally incapable of signing anything.
   Confirmed working live against Shannon:
   - `listLiveBinaryMarkets({ venueId: <operator 2>, asset: "BTC" })` → **4 real
     markets**, `quoteDecimals: 6`, `collateral` = the known tUSDC address.
   - `strike` field on every row: `"0"` — confirms the documented trap.
   - `getOpeningPrices(marketIds)` → **4 real non-zero opening prices**
     (e.g. `"7935585"` → 79,355.85 at 1e2 scale), matching the documented scale.
   - `fetchPrice("BTC")` → live spot, `raw.price` at 1e18, matching the
     documented scale gap against the 1e2 opening price.
   - `getBookTops(marketIds)` → **real bid/ask on all 4 markets right now**
     (example: bestBid 107000 / bestAsk 140000 raw, i.e. 0.107 / 0.140).

## ⚠️ Correction to `docs/INTEGRATION.md` §11, found live this session

INTEGRATION.md states: *"Measured across every live binary market probed:
`lastPrice: null`, empty books on both sides. There is no liquidity on
Shannon binaries."*

**That is no longer true as of this session's live read.** All 4 currently
open BTC markets on the real venue have a genuine two-sided book right now
(`bestBid`/`bestAsk` both populated, non-null, with real spreads). `lastPrice`
is still `null` on the market rows (no trade has printed), but the *book*
is not empty — someone (possibly another team's bot, possibly a market
maker) is actively quoting.

**Consequence for the plan:** the "seed an empty book" maker-mode narrative
(Task 6.5 in the phase plan) may not be the story anymore if this holds at
demo time — worth re-checking closer to recording, since it changes whether
Sigma is *creating* the book or *competing on* an existing one. Either is a
fine story, but the plan should say which one actually happened.

## Not done — stubbed or not started (time-boxed out)

- **Strategy skeleton (`src/strategy.mjs`)** — not written. Was next: given a
  fair value (stub, since the live oracle's reactivity feed is unproven per
  `docs/STATUS.md`) and the real book prices confirmed above, compute edge,
  threshold, capped-Kelly size, and log (never send) a fully quantized order.
- **Maker/seeding mode** — not written; also needs re-scoping given the book
  is not empty (see correction above).
- **Settlement/claim read path (`listPastBinaryMarkets` / `getClaimable`)** —
  not exercised this session.
- **Track record schema / append-only JSON logger** — not started.
- **`bot/node_modules`** — none installed; deliberately relies on Node's
  directory-walk-up resolution to the repo root's `node_modules`, confirmed
  working by smoke test before any real code was written. `bot/package.json`
  exists as its own manifest (isolation requirement) but no `npm install`
  was run anywhere, so the root's `package-lock.json` was never touched.

## Before `DRY_RUN=false` could ever be safely flipped

Everything above this line was read-only. Nothing here has ever imported a
private key, constructed a wallet client, or called `createTrader`. To go
live safely, still needed: the strategy/maker modules above, `assertTxOk`
handling, the settlement/claim path, and — separately — resolution of the
live reactivity blocker in `docs/STATUS.md`, since trading on a stubbed fair
value is not the real product.
