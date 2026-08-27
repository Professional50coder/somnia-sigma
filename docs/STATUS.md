# Sigma — Build Status

Last updated: 2026-08-27 (after frontend page build-out). This
document distinguishes code from testnet proof. See `docs/CHECKLIST.md` for
the item-by-item breakdown per phase, and `FINDINGS.md` / `MISTAKES.md`
(internal, gitignored) for the raw investigation trail behind everything below.

| Phase | Deliverable | Status |
|---|---|---|
| P0 | Research, SDK and feed verification | ✅ complete |
| P1 | BinaryPricer + golden vectors | ✅ complete — 65 tests, SciPy-validated, now also matched by an independent TS port (Phase 8) |
| P2 | RealizedVol + reactive bridge | code complete, tested; **live push delivery unresolved after exhaustive elimination — see below** |
| P3 | Window registry + fair-value oracle | ✅ code + **full test coverage** (11 new tests) — closed this session |
| P4 | Cron sweep handler | ✅ code + **full test coverage** (4 new tests) — closed this session; **design deviation found: no on-chain self-rescheduling, done off-chain instead (deliberate, not a bug)** |
| P5 | Deployment, subscription and evidence | 5/5 contracts deployed and verified live; **the unattended proof itself remains blocked** |
| P6 | ec-sigma Bot Kit strategy | quantization (10/10) + live read-path **confirmed working end-to-end** against real Shannon data; strategy/maker/claim logic not yet built |
| P7 | Edge Radar frontend | ✅ 4 screens built — Edge Radar (live), Window Detail (live), Track Record (awaiting trades), Backtest (real data); dark terminal aesthetic, sidebar navigation |
| P8 | Historical replay/backtest | **substantially complete** — real calibration curve from 3,000+ live BTC candles, ~230 independent windows, honest tail-miscalibration finding |
| P9 | Demo and submission package | not started |

## Frontend status

### What's built

| Screen | Route | Status |
|---|---|---|
| Edge Radar | `/` | ✅ Reading real deployed contracts, live system status, sample layout, model chart, backtest evidence panel |
| Window Detail | `/window/[marketId]` | ✅ Dynamic route, reads window + fair value from contracts, ProbabilityDial, edge display, Φ(d₂) model chart, model parameters |
| Track Record | `/track-record` | ✅ Structure complete with StatsCards, EquityChart, TradesTable, calibration panel — awaiting live trades |
| Backtest | `/backtest` | ✅ Real data from `backtest/results.json`, calibration table, tau buckets, cadence breakdown, honest tail finding |

### Component library (harvested)

- **Layout**: TerminalLayout, Sidebar (Next.js Link navigation), Header (live clock, status badges)
- **Market**: MarketCard, ProbabilityDial, ProbabilityBar, MarketSparkline, CountdownTimer, CategoryFilter, WatchlistButton
- **Orderbook**: Orderbook, TradeFeed, TradesTable
- **Charts**: EquityChart, ProbabilityChart, SparklineChart, TimeRangeSelector
- **UI**: StatsCards, StatusBadge

### Design system

- Pure vanilla CSS with CSS custom properties (no Tailwind)
- Dark terminal aesthetic: `--bg: #0b0d10`, `--panel: #12151a`
- Sigma-prefixed component classes: `.sigma-sidebar`, `.sigma-panel`, `.sigma-dial`, etc.
- All CSS in `app/globals.css`

### Tech stack

- Next.js 15 (App Router)
- React 18
- TypeScript
- viem (on-chain reads)

## Oracle integration

DIA / Protofire price feeds provide spot data for BTC on Somnia Shannon
testnet. The `RealizedVol` contract receives price updates via the fallback
pusher (`scripts/fallback-price-pusher.mjs`), which polls the on-chain
`MarkPriceUpdated` event feed every ~20s and pushes the current price
directly into `RealizedVol.writer`.

## The one blocker that matters right now

**Six separately-configured reactivity subscriptions, across two different
owners and two fee tiers, all delivered zero callbacks**, despite every one
being confirmed correctly registered on-chain (via `getSubscriptionInfo`, not
just a successful creation tx) and the source feed independently confirmed
firing continuously (~0.5 Hz) throughout. This is no longer a "maybe we
configured something wrong" situation — every documented, checkable variable
has been tested and eliminated:

- ✅ Correct topic0/emitter/selector (verified against a real captured log)
- ✅ `isGuaranteed: true` (tried both true and false)
- ✅ Fees well above the measured 6 gwei base fee (tried up to 20/100 gwei)
- ✅ Subscription-owner balance well clear of the documented 32 SOMI/STT
  threshold (tried an owner at 50 STT)
- ✅ No bug in our own handler logic (an ungated, zero-logic diagnostic
  probe also received nothing)
- ✅ `msg.sender` semantics (confirmed by official docs to be the precompile
  address; our gate was already correct)

**Full elimination trail: `FINDINGS.md`.** A findings draft for the
hackathon's dev Telegram is prepared at `docs/TELEGRAM-DRAFT.md` (not yet
posted — for review). We adopted the documented fallback rather than wait:
`RealizedVol.writer` is now the deployer EOA, and
`scripts/fallback-price-pusher.mjs` polls the same on-chain
`MarkPriceUpdated` feed every ~20s and pushes the current price directly.

**This is confirmed genuinely working, with real numbers, right now:**
`sampleCount` is climbing normally (15/30 toward the volatility estimator's
readiness threshold as of the last check), pushing real BTC prices
(~$79,300–79,450, sane and consistent). `sigmaWad(...).ok` will flip to
`true` once 30 samples accrue — at the current cadence, a few more minutes.

**Still true and important:** this is an off-chain scheduled process, not
the originally-designed keeper-free reactivity path. State it as such
everywhere — do not claim "unattended operation" in the reactivity sense.
It *is* a real, live, on-chain volatility feed with unchanged data
provenance, which is the honest and still-meaningful claim to make.

## What actually moved forward this session (four parallel workstreams)

1. **Test coverage gap closed.** `SigmaOracle.sol` and `SigmaCron.sol` went
   from zero unit tests to 15 new tests. Suite: **88 → 103 passing, zero
   regressions.**
2. **Phase 8 backtest went from nothing to substantially complete.** A TS
   port of `BinaryPricer` matches the same golden vectors the Solidity does
   (three independent implementations now agree). A real calibration curve
   was produced from 3,000 live BTC candles: well-calibrated in the middle,
   **honestly overconfident in the tails** — exactly the documented
   zero-drift-GBM limitation, now measured rather than asserted.
3. **Phase 6 bot read-path confirmed live.** Quantization is fully correct
   (`0.6237 → 0.624`, exact). A read-only client with no signing capability
   pulled real BTC markets, real opening prices, real spot, and **real
   order-book data** from Shannon right now.
4. **A significant correction surfaced: Shannon binary markets are no
   longer illiquid.** The "empty book" assumption behind the Phase 6/7 "seed
   an empty market" demo narrative is now stale — all 4 live BTC markets have
   real two-sided books. `docs/INTEGRATION.md` §11 updated; the demo
   narrative may need to shift to "Sigma competes on an existing book,"
   confirmed closer to filming time since testnet liquidity conditions
   evidently change.
5. **Frontend Screen 1 built and reads the real deployed contracts**,
   independently re-confirming the reactivity gap via a third, unrelated
   code path (a Next.js build-time SSR fetch).
6. **Frontend Screens 2–4 built.** Window Detail reads live contract data
   and renders the model chart. Track Record and Backtest pages are
   complete — Backtest shows real calibration data from `results.json`.

## Rules

- No chain claim is made without a transaction hash or read output recorded
  somewhere in `docs/DEPLOYMENT-LEDGER.md` or `FINDINGS.md`.
- Every write records UTC time, sender, hash, explorer link, gas and
  resulting state.
- No private key, seed phrase or `.env` value is ever documented in any
  file that could end up in the public repo.

## Current verified on-chain state

- Deployer: ~34 STT remaining (spent on deploys + ~6 subscription attempts),
  500 tUSDC untouched.
- Bot: 50 STT / 500 tUSDC, untouched except for one diagnostic subscription
  creation this session (owns subscription id `14225960`).
- All 5 Sigma contracts + 2 diagnostic probes deployed to Shannon (50312),
  every address independently re-verified via `eth_getCode`.
- `RealizedVol.writer` correctly wired; `SigmaReactiveVol.emitterAsset`
  correctly mapped; both confirmed on-chain, not just assumed from source.
- Six reactivity subscriptions live and correctly registered; zero delivering.

## 🎯 First live end-to-end fair value (2026-08-27, resumed session)

`sigmaWad(BTC).ok` flipped `true` (31 samples). Immediately published a real
live BTC market (24h window, real opening price `79023.52`) into
`SigmaWindowRegistry` and called `SigmaOracle.refresh()`. **Result: a real,
on-chain, end-to-end fair value — fair 68.44% vs. a real live book at 67.90%,
+54 bps edge, Kelly 1.68%, on a 24h window 41% through its life.** Both txs
`status: success`; full readback in `FINDINGS.md`. This is the first time
this project has produced the actual number it exists to publish, fully
live, no mocked inputs anywhere in the chain: real σ (from the fallback
pusher) → real spot → real opening price → real book → real edge.

The number is intentionally modest (54 bps) rather than dramatic — honest
framing, since this window is mid-life, not near-expiry where the thesis
predicts edge should be largest, and σ is still based on ~10 minutes of real
samples. Both facts are worth stating plainly rather than glossed over.

## Immediate next work (resume here)

1. Check `sigmaWad(BTC).ok` — likely already `true`. If so, this is the
   fallback path's live proof; record it properly (readings + timestamps)
   the way `FINDINGS.md` recommends for the original reactivity proof.
2. **Build the `ec-sigma` strategy/maker logic for real** — edge/threshold
   decision, capped Kelly sizing, `maybeSeedBook`, settlement/claim reads.
   Not done yet; verify against files before marking it done next time too.
3. Decide whether to post `docs/TELEGRAM-DRAFT.md`.
4. Decide and confirm the demo narrative (seed vs. compete-on-existing-book)
   against live venue state close to filming — check `getBookTops` fresh,
   don't assume the state from earlier in this session still holds.
5. Fold the backtest's calibration finding into the pitch — an honest,
   measured tail-miscalibration is a stronger credibility artifact than a
   hidden one.
6. If the pusher process died during the break (this session's background
   processes don't persist across a full restart), restart it:
   `node scripts/fallback-price-pusher.mjs` — check `sampleCount` first to
   see whether it's still climbing before assuming it needs a restart.
