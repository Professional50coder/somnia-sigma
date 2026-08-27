# Sigma — Design Spec (v2, fully informed)

> **One line to beat. Sigma tells you the odds.**
> The fair-value layer for dreamDEX Event Contracts.

**Date:** 2026-08-27 · **Deadline:** 2026-09-08 23:30 · **Target:** Somnia Shannon testnet, **chain ID 50312**
**Companions:** [`RESEARCH.md`](./RESEARCH.md) (fact base) · [`BRAND.md`](./BRAND.md) (identity) · [`DEPLOYMENT.md`](./DEPLOYMENT.md) (end-to-end ops)

> **v2 supersedes v1.** v1 was written before the dreamDEX developer docs and
> the hackathon judging criteria were available. Three things changed: the
> instrument has **no strikes** (strike = the window's opening price), the
> trading path must go through **the official SDK** rather than Solidity, and
> settlement is **terminal vs opening price**, not Asian. See RESEARCH.md §9.

---

## 1. The problem

dreamDEX Event Contracts are Up/Down binaries on BTC and ETH over 15-minute and
1-hour windows, collateralised in USDso (tUSDC on testnet).

They have **no strikes**. As the docs put it: *"There is one line to beat: the
window's opening price."*

That single design choice creates the problem worth solving:

- At window open, `S = K`, so the fair probability is ≈ 0.50 in **every market,
  every time**. There is nothing to know.
- During the window, as spot drifts off the opening line and time decays, the
  true probability moves **fast** and **non-linearly**.
- A binary's price *is* a probability. Pay 0.70 and you need to be right more
  than 70% of the time merely to break even.
- Nothing tells anyone whether the price on screen is right.

Late in a 15-minute window, a modest move away from the opening line with little
time left can put the true probability at 0.85 while the book still shows 0.70.
That is a 1,500 basis-point mispricing, visible only to someone computing it.

**Across the seven competing submissions, every one asks "what will happen?"
None asks "what should this cost, and is the book wrong right now?"**

---

## 2. The insight

For a binary settling on whether the terminal price finishes at or above the
opening price, under zero-drift GBM:

```
d₂ = ( ln(S/K) − σ²τ⁄2 ) / ( σ√τ )        with K = the window's opening price
fairProbability = Φ(d₂)
```

Because it is a fixed-payout binary, the economics collapse to something
unusually clean. Buying Up at price `a` costs `a` to win `1 − a`, so expected
value is `p(1−a) − (1−p)a = p − a`. Therefore:

| Quantity | Value |
|---|---|
| **Break-even win rate** | exactly the price `a` |
| **Edge** | exactly `p − a` |
| **Kelly fraction** | `f* = p − (1−p)·a/(1−a)` |

No approximation, no fitting. `Φ(d₂)` with `K = openingPrice` is **the defining
number of this instrument**, and the entire product follows from computing it
honestly.

---

## 3. Why this is native to Somnia, not merely deployed on it

**Volatility from dreamDEX's own live mark price, with no keeper.** `σ` must
come from somewhere. Somnia **Reactivity** lets a contract subscribe directly to
another contract's events, so `σ` accumulates on-chain and continuously with no
polling and no server. On any other chain this needs off-chain infrastructure;
here it is a subscription. The 200,000,000 gas handler ceiling means the maths
genuinely runs inside the handler.

The feed is `MarkPriceUpdated`, emitted by the dreamDEX **spot pools**:

```
event MarkPriceUpdated(address indexed asset, uint256 markPrice, uint256 rawMidpoint)
topic0   0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888
BTC pool 0x3605f28aa7c50e7441211e77cb0762d49539326c   (WBTC:USDso)
ETH pool 0xd180195da5459c7a0dea188ed61216ec43682b50   (WETH:USDso)
```

`markPrice` is **1e18-scaled regardless of token decimals** (WBTC is an
8-decimal token; its price is still 1e18). Each pool serves exactly one asset,
so the `emitter` filter alone disambiguates BTC from ETH — no topic slot is
spent on it. Measured cadence on testnet: **~1 update per asset every ~2
seconds**, continuously.

This also addresses a gap in the organiser's own code: `ec-oracle-follow`
documents that *"underlying BTC/ETH price data [is] unavailable in market rows"*
and its bundled feed is testnet-only. Subscribing to the pool on-chain is a
cleaner answer.

> **Correction — an earlier version of this spec was wrong.** It claimed σ would
> be measured from `OracleHub` (`0xe40d…E32b`), "the same feed that decides the
> outcome". **`OracleHub` emits no price event at all.** It is a *question
> resolution* hub: its richest event, `AnswerDelivered`, carries a YES/NO payout
> vector, and it only fires on the ~12-minute market-roll cycle. The claim was
> checked against live chain logs and does not survive.
>
> The honest statement is therefore narrower: **σ is measured from dreamDEX's
> own order-book mark price, not from a signed oracle attestation, and not from
> the settlement feed.** A closer-to-oracle alternative exists —
> `FundingUpdated.indexPrice` on the perp pools — but it fires only on funding
> settlement, roughly every 5 minutes per asset, which is too slow to estimate
> short-window volatility. Cross-checked live, spot mark and perp index agree to
> **0.12%** on BTC, so the mark price is tracking the real oracle closely and is
> not a thin-book artefact. That is the tradeoff, stated rather than hidden.

**Self-rescheduling cron.** 15-minute windows mean 96 markets per underlying per
day. `SomniaExtensions.scheduleSubscriptionAtTimestamp(handler, timestampMs,
options)` is callable from Solidity and one-shot, so the handler refreshes the
oracle and then schedules **its own** next invocation at the next window
boundary. No cron server exists anywhere in this system.

**Agents are deliberately excluded from the critical path.** Consensus-validated
off-chain compute is real and interesting, but per-call cost on testnet is
unmeasured (RESEARCH.md §5.3). Nothing in Sigma's core may depend on it.

---

## 4. Architecture

The design is **hybrid on purpose**, and the split follows a single rule:
*computation and publication belong on-chain; order execution belongs in the SDK.*

Fighting the SDK would be both worse engineering and worse scoring — 25% of the
rubric is "how effectively does the project use DreamDEX Event Contracts and
available APIs/SDKs". Meanwhile the fair-value feed genuinely belongs on-chain,
because its whole value is being readable by other contracts.

```
   BTC spot pool 0x3605f28a…326c   ← MarkPriceUpdated, ~2s cadence
        │
   Reactivity precompile 0x0100
        ▼
 ┌──────────────────┐
 │ SigmaReactiveVol │  onEvent → decode price
 └────────┬─────────┘
          ▼
 ┌──────────────────┐
 │   RealizedVol    │  EWMA of squared log returns → σ
 │   (on-chain)     │  staleness + min-sample guards
 └────────┬─────────┘
          │ σ
          ▼
 ┌────────────────────────────────────┐      ┌──────────────────┐
 │            SigmaOracle             │◄─────┤   BinaryPricer   │
 │  fairProbBps · impliedBps · edgeBps│      │  Φ(d₂) · Kelly   │
 │  breakEvenBps · σ · updatedAt · ok │      │  pure library    │
 │  emits FairValuePublished          │      └──────────────────┘
 └───┬────────────────────────────┬───┘
     │ read (free, public)        │ self-reschedules
     │                            ▼
     │                    ┌──────────────┐
     │                    │  SigmaCron   │  scheduleSubscriptionAtTimestamp
     │                    └──────────────┘  → refresh at each window boundary
     │
     ├──────────────► any other builder's contract  ── the public good
     │                (ec-maker needs exactly this number)
     ▼
 ┌────────────────────────────────────────────────┐
 │  ec-sigma   (dreamDEX Bot Kit strategy)        │   OFF-CHAIN
 │  @dreamdex-bot-kit/ec-core                     │
 │  @somnia-chain/markets-sdk ≥ 0.28.0            │
 │                                                │
 │  loadMarkets → gate on-chain status == Trading │
 │  read SigmaOracle → edge                       │
 │  quantize() → placeLimit() → assertTxOk()      │
 │  maybeClaim() each loop                        │
 │  builder = Sigma  (builder-fee revenue)        │
 └────────────────────┬───────────────────────────┘
                      ▼
             dreamDEX Event Contracts
             MarketsCore / BinaryMarketsModule
                      │
                      ▼
              ┌───────────────┐
              │  Edge Radar   │   Next.js + viem + wagmi
              │  (frontend)   │   reads oracle + SDK + track record
              └───────────────┘
```

### 4.1 Components

| Unit | Where | Purpose |
|---|---|---|
| `BinaryPricer` | Solidity library | Pure math: `Φ(d₂)`, edge, break-even, Kelly. No state, no calls. |
| `RealizedVol` | Solidity | EWMA volatility per underlying, with staleness and min-sample guards |
| `SigmaReactiveVol` | Solidity | Reactivity handler bridging `MarkPriceUpdated` from the dreamDEX spot pools into `RealizedVol` |
| `SigmaOracle` | Solidity | Stores and serves fair value; emits `FairValuePublished`. **The public good.** |
| `SigmaCron` | Solidity | Self-rescheduling cron that refreshes the oracle each window boundary |
| `ec-sigma` | TypeScript | Bot Kit strategy: reads the oracle, quantizes, trades, claims |
| Edge Radar | Next.js | The interface |
| Backtest | TypeScript | Evidence the edge is structural, via `packages/backtest` |

**Note on scope change from v1.** v1 had a `SigmaPolicyVault` placing orders
from Solidity. That is dropped. Order placement requires tick/lot quantization,
nonce management, escrow reconciliation and claim sweeps — all of which the SDK
already solves correctly and none of which belongs in a contract written in
twelve days. `ec-sigma` replaces it. The *policy* (thresholds, sizing) and the
*track record* stay legible and are recorded from the strategy.

### 4.1.1 Correction: the oracle cannot discover markets on its own

Measured on Shannon, and it changes the oracle's shape:

- Binary markets are **only** discoverable through the off-chain GraphQL
  indexer (`listBinaryMarkets`). There is no on-chain enumeration.
- On the real Up/Down venue, **`strike` is `"0"` on the market row.** The
  opening price lives on the oracle's *reference question* and is fetched with
  `client.getOpeningPrices(marketIds)` — an off-chain, two-round-trip read.

So `SigmaOracle` cannot read a window's opening price by itself. The split
becomes:

| Concern | Where | Why there |
|---|---|---|
| Window metadata (`marketId`, opening price, `tradingStart`, `expiry`) | **Pushed on-chain** by a permissioned publisher | Only obtainable off-chain |
| Volatility `σ` | **On-chain**, from `MarkPriceUpdated` via reactivity | Genuinely keeper-free, and the novel part |
| Fair value `Φ(d₂)`, edge, break-even, Kelly | **On-chain** | The number must be readable by other contracts to be a public good |
| Order placement, quantization, claims | **Off-chain** via the SDK | The SDK solves these correctly; 25% of the rubric scores using it |

This keeps what matters on-chain — σ accumulating unattended, and a fair value
any contract can read — without pretending the market list is on-chain when it
is not. The publisher is a thin, auditable input, and the oracle records who
published each window so the trust boundary is explicit rather than implied.

### 4.1.2 Sigma seeds the book

Shannon binary markets have **no liquidity**: every live market probed showed
`lastPrice: null` and empty books. "Edge versus the book" has nothing to measure
against on a live testnet market.

Rather than fake a counterparty, Sigma posts `POST_ONLY` quotes around its own
fair value and **becomes** the book. An empty market turns two-sided on camera.

This is the stronger version of the pitch, not a workaround: `ec-maker` is
documented as quoting *"around fair probability"* — and nothing in the Bot Kit
supplies that number. On an empty market a maker has nothing to anchor to. Sigma
is the anchor, and the resulting book is the 20% "generate trading activity /
increase Event Contracts adoption" criterion demonstrated rather than asserted.

Evidence that the edge is real comes separately, from replaying BTC minute bars
through `fetchPriceCandles` — so the claim rests on history rather than on one
lucky window. Both paths ship, each labelled for what it is.

### 4.2 Data flow for one window

1. The BTC spot pool emits `MarkPriceUpdated` → Reactivity invokes `SigmaReactiveVol.onEvent`
   → `RealizedVol` folds it into the EWMA. Continuous, unattended.
2. Window opens. `SigmaCron` fires, calls `SigmaOracle.refreshAll()`, then
   schedules its own next invocation.
3. `SigmaOracle` reads `σ` and spot from `RealizedVol`, the opening price and
   `poolAddress` from the registry, computes `τ` from `intervalSec` and time
   elapsed, reads the best YES ask **on-chain from the window's pool**
   (`getBookLevels` — the CLOB is on-chain), and publishes fair probability,
   implied probability, edge, and break-even. Empty book → `NoBook`, with fair
   value still published — the number a seeder needs.
4. `ec-sigma` polls the oracle, gates on **on-chain** market status `1 = Trading`,
   and if `|edge| ≥ minEdgeBps` sizes by capped Kelly.
5. Price is **quantized to the venue tick grid** via `ec-core`, then submitted
   with `placeLimit(...)` carrying `expireTimestampNs` and Sigma as `builder`.
6. Result validated with `assertTxOk` — SDK writes resolve even when reverted.
7. Window expires. `maybeClaim()` redeems. Track record records **predicted edge
   against realised outcome**.

Step 7 is what makes the track record evidence rather than assertion.

---

## 5. Correctness and honesty constraints

These are requirements, not aspirations. Each maps to a test.

- **Model validated against SciPy.** `Φ(d₂)` is property-tested against
  `scipy.stats.norm` across a grid of S, K, σ, τ, with bounded fixed-point error.
  This is the most defensible artefact in the submission.
- **Stale volatility means no trade.** Every fair value carries `updatedAt` and
  an `ok` flag. Beyond the staleness bound, `ok` is false and `ec-sigma` refuses.
- **Insufficient samples means no number.** Below `MIN_SAMPLES` the oracle
  reports not-ok rather than a fabricated σ.
- **Not-ok is published, not omitted.** Silence is indistinguishable from "no
  edge". The oracle explicitly publishes `ok = false`.
- **Every skip is logged.** A window skipped and a window never examined must be
  distinguishable after the fact.
- **Prices are quantized before they reach the SDK.** Non-negotiable — see
  RESEARCH.md §4.1. `0.6237` handed over as a float is rejected as
  `InvalidPrice`, and the model emits values like that constantly.
- **State keyed by `marketId`, never pool address.** Pools recycle across windows.
- **`assertTxOk` on every write.** Reverted writes do not throw.
- **Model and assumptions displayed with the numbers.** No edge figure appears in
  the UI without its model label.
- **Losses shown as prominently as wins.**

### 5.1 Stated model limits

Zero-drift GBM understates fat tails. Over a 15-minute window that error is
small but real. The honest framing — also the stronger pitch — is that Sigma
makes the pricing assumption **explicit and auditable**, where the rest of the
market leaves it implicit and unexamined. The UI says which model produced each
number, and the README states the limitation plainly.

The `Average` (Asian) settlement branch remains in `BinaryPricer` as a cheap
hedge, but RESEARCH.md §2.2 confirms `Terminal` is correct.

---

## 6. The frontend — Edge Radar

Detailed in `docs/superpowers/plans/2026-08-27-sigma-frontend.md`. Four screens:

1. **Edge Radar** — every live window: underlying, window length, opening line,
   current spot, seconds to expiry, book implied probability, Sigma fair
   probability, **edge in bps**, break-even win rate. Mispricing highlighted.
2. **Window detail** — one market: fair value and book plotted against time as
   the window runs, showing fair value moving while the book lags.
3. **Track record** — trades, win rate, P&L, and **predicted edge vs realised
   outcome**. Losses included.
4. **Backtest** — historical simulation with parameters exposed.

The interface must convey one thing: **fair value is alive and the book is not.**
That visual gap is the product.

---

## 7. Testing

| Target | Approach |
|---|---|
| `BinaryPricer` | Property tests against SciPy; edge cases τ→0, σ→0, deep ITM/OTM |
| `RealizedVol` | Simulated tick series with known volatility; staleness and min-sample paths |
| `SigmaReactiveVol` | `onEvent` driven from an impersonated precompile; unmapped-emitter and caller-auth paths |
| `SigmaOracle` | Access control, not-ok publication, expiry handling, event emission |
| `SigmaCron` | Sweep continues when one market fails; rescheduling asserted |
| `ec-sigma` | Quantization round-trip (**the `0.6237` case explicitly**), threshold behaviour, claim handling, `assertTxOk` |
| Backtest | Validated against the same SciPy reference so simulator and contracts agree |

---

## 8. Build order

Each stage leaves something demonstrable, so a late slip degrades scope rather
than breaking the submission.

| # | Deliverable |
|---|---|
| 0 | ✅ **RESOLVED** — `OracleHub` emits no price event; the feed is `MarkPriceUpdated` on the spot pools |
| 1 | Repo, Hardhat, testnet config, verified RPC |
| 2 | SciPy reference oracle + golden vectors |
| 3–5 | `BinaryPricer`: Φ, fair probability, edge/break-even/Kelly — all SciPy-validated |
| 6 | dreamDEX adapter interface + mock |
| 7 | `RealizedVol` |
| 8 | `SigmaReactiveVol` + live subscription to the BTC spot pool on testnet |
| 9 | `SigmaOracle` |
| 10 | `SigmaCron` self-rescheduling |
| 11 | Deploy to testnet; **prove the subscription runs unattended** |
| 12 | `ec-sigma` Bot Kit strategy on the real SDK (DRY_RUN first) |
| 13 | Edge Radar |
| 14 | Backtest evidence |
| 15 | Demo video, README, submission |

Stage 0 is complete: the feed was located and its `topic0` validated against a
real log. See `INTEGRATION.md` §8.

---

## 9. Explicit non-goals

- No AI verdict, score, or rating on markets — three submissions already do this,
  and "AI-powered" is a *weaker* claim here than "SciPy-validated Φ(d₂)".
- No agent leaderboard or agent-vs-agent competition — same lane as Rivo/QDS.
- No conditional/parlay chaining (Branch), liquidity metric (rampart), max-loss
  sizing (Sluice), or gamification (Market Dungeon).
- No generic trading bot as the headline — six EC strategies ship in the Bot Kit;
  competing with the organiser's sample code is a losing frame.
- **No claim of profitability.** Sigma claims a measurable, auditable edge
  *signal*, and reports realised results honestly, including losses.

---

## 10. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| `OracleHub` emits no subscribable event | **High** | Stage 0 resolves it first. Fallbacks: cron-scheduled pull; DIA/Protofire feed |
| Price-grid rejection (`InvalidPrice`) | **High** | `ec-core` `quantize`/`placeLimit`; explicit test for `0.6237` |
| `VENUE_ID` drifts mid-hackathon | Medium | Documented to have moved 3× in one week; read from config, verify against live rows, fail loudly |
| Thin testnet liquidity → no fills | Medium | Demo tolerates it: the *fair value* is the product; DRY_RUN and backtest carry the evidence |
| Reverted writes resolving silently | Medium | `assertTxOk` on every write |
| Stranded winnings | Low | `AUTO_CLAIM` + `maybeClaim()` each loop |
| Agent cost unknown | Low | Agents excluded from the critical path entirely |
| GBM understates tails | Low | Stated openly in UI and README; not hidden |
