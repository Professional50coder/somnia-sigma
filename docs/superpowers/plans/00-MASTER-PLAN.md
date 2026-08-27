# Sigma — Master Plan

**One line to beat. Sigma tells you the odds.**

Phase-by-phase plan from where the project stands today to submission.
**Deadline: 2026-09-08 23:30.** Written 2026-08-27, so **12 days remain**.

| Doc | Role |
|---|---|
| **00-MASTER-PLAN.md** | ← this. All phases, dependencies, exit criteria, risk |
| `01`–`09` | One detailed plan per phase |
| [`../../OVERVIEW.md`](../../OVERVIEW.md) | What we are building and why |
| [`../../INTEGRATION.md`](../../INTEGRATION.md) | Measured SDK/chain facts — the traps |
| [`../../DESIGN.md`](../../DESIGN.md) | Architecture |
| `_SUPERSEDED-*` | Audit trail only. Do not execute. |

---

## Phase map

```
 P0  Foundation & verification          DONE
 P1  Pricing core (Φ(d₂), Kelly)        DONE      83 tests green
 P2  Volatility engine + reactivity     IN PROGRESS
 P3  Fair-value oracle (publish)        ─┐
 P4  Self-rescheduling cron              ├─ on-chain, sequential
 P5  Testnet deploy + unattended proof  ─┘        <- the make-or-break proof
 P6  ec-sigma bot (read, seed, claim)   ─┐
 P7  Edge Radar frontend                 ├─ parallelisable after P5
 P8  Replay backtest                    ─┘
 P9  Video, README, submission          LAST
```

**Critical path:** P2 → P3 → P4 → P5 → P9.
P6, P7, P8 are parallel branches off P5. Each can be cut back without breaking
the submission; **P5 cannot** — the on-chain fair value is the product.

---

## Status at time of writing

**Done and verified**

| Item | Evidence |
|---|---|
| RPC + chain id | `eth_chainId` → `0xc488` = 50312 |
| Wallets funded | Deployer + Bot: 50 STT, 500 tUSDC each |
| Toolchain | Hardhat 3.15.0, solady, viem, SDK 0.28.1 |
| `BinaryPricer.sol` | Compiles; validated against SciPy |
| `RealizedVol.sol` | Compiles; time-aware variance rate |
| Venue adapter + mock | Compiles |
| **Test suite** | **83 passing, 0 failing** |
| Docs | OVERVIEW, RESEARCH, SDK-NOTES, INTEGRATION, DESIGN, BRAND, DEPLOYMENT |
| Brand | `σ` mark bisected by the opening-price line |

**Decided**

- Demo shape: **seed the book live *and* replay history for evidence.**
- Trading goes through the SDK, not Solidity — 25% of the rubric names the SDK.
- Agents excluded from the critical path (per-call cost unmeasured).

**Known and accepted**

- Builder fees revert on Shannon (cap `0`) — implement, show in code, cannot demo.
- No liquidity on Shannon binaries — hence seeding.
- `markPrice` is order-book-derived, not a signed attestation — stated, not hidden.

---

## Phase 0 — Foundation & verification ✅ DONE

**Goal:** prove the ground is solid before building on it.

Delivered: repo on `D:\somnia-sigma`; RPC and chain id verified live; `OracleHub`
inspected; dreamDEX REST probed; SDK installed and read; `BinaryMarket` schema
recovered; two burner wallets generated, gitignored, funded.

**The finding that mattered:** `OracleHub` emits **no price event**. It resolves
questions, not prices. The design claim "volatility from the settling feed" was
false and has been corrected everywhere it appeared.

---

## Phase 1 — Pricing core ✅ DONE

**Goal:** a provably-correct fair-value engine.

Delivered: `BinaryPricer.sol` (`normalCdf`, `d2`, `probUp`, `edgeBps`,
`breakEvenWinRateBps`, `kellyFractionWad`), a SciPy reference oracle, 43 golden
vectors, and 65 pricing tests.

**Anchors that validate the thesis:**

| Scenario | Fair probability |
|---|---|
| ATM, full window | 0.4980 |
| +0.3%, 10% of window left | 0.8278 |
| −0.3%, 10% of window left | 0.1706 |

A 0.3% BTC move is noise; near expiry it is 83%. Against a book at 0.70 that is
**1,278 bps of edge** — and it is the demo.

**Note:** the single test failure was the *Python reference* being wrong (float
truncation made `0.70 − 0.60` → 999 bps). Fixed the reference to exact WAD
integer maths rather than loosening the assertion.

---

## Phase 2 — Volatility engine + reactivity 🔄 IN PROGRESS

**Goal:** σ accumulating on-chain, continuously, with no keeper.
**Detail:** `01-phase2-volatility.md`

**Done:** `RealizedVol.sol` with EWMA variance **per second** (not per tick —
the mark feed is irregular, and tick-count weighting would make σ a function of
feed chattiness rather than of the market), outlier rejection, staleness and
minimum-sample guards, 18 tests.

**Remaining**

1. `ISomniaReactivity.sol` — precompile `0x0100`, handler selector `0x53edf33d`
   *(written, untested)*
2. `SigmaReactiveVol.sol` — decode `MarkPriceUpdated`, forward to `RealizedVol`
3. Tests driving `onEvent` from an impersonated precompile
4. Tests for `sigmaForSecondsWad` across window cadences

**Feed:**
```
MarkPriceUpdated(address indexed asset, uint256 markPrice, uint256 rawMidpoint)
topic0    0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888
BTC pool  0x3605f28aa7c50e7441211e77cb0762d49539326c
ETH pool  0xd180195da5459c7a0dea188ed61216ec43682b50
```
`markPrice` is 1e18 regardless of token decimals. One pool = one asset, so the
`emitter` filter alone disambiguates.

**Exit criteria:** handler decodes a real log correctly; unauthorised callers
rejected; unmapped emitters ignored, not reverted; suite green.

**Risk — gas.** ~0.5 events/sec/asset ≈ **43,000 handler calls/day/asset**,
each charged to the subscription owner. Mitigations: subscribe to **BTC only**
for the demo; early-return before any SSTORE when the move is below threshold;
measure real cost in P5 before claiming continuous operation.

---

## Phase 3 — Fair-value oracle

**Goal:** publish fair value on-chain so any contract can read it.
**Detail:** `02-phase3-oracle.md` · **Depends on:** P2

**The constraint that shapes this phase.** Binary markets are discoverable only
through the off-chain indexer, and on the real venue **`strike` is `"0"`** — the
opening price lives on the oracle's reference question, reachable only via
`getOpeningPrices()`. So the oracle cannot self-discover windows.

| Concern | Where |
|---|---|
| Window metadata (id, opening price, start, expiry, cadence) | pushed on-chain by a permissioned publisher |
| σ | on-chain, from reactivity |
| Fair value, edge, break-even, Kelly | **on-chain** |
| Orders, quantization, claims | off-chain, SDK |

**Build**

1. `SigmaWindowRegistry.sol` — publisher pushes windows (**including
   `poolAddress`**); records **who** published each, so the trust boundary is
   explicit
2. `SigmaOracle.sol` — `refresh(marketId)` reads the best YES ask **on-chain
   from the window's pool** (`getBookLevels` — the CLOB is on-chain), so σ →
   fair value → edge is on-chain end to end; `refreshAll()`, `getFairValue()`,
   `quote()` for caller-supplied prices, `FairValuePublished` event. Empty book
   → `NoBook`, with fair value still published — that number is what a seeder
   needs
3. Scale guard: assert `0.5 < S/K < 2` before pricing. Outside that band on a
   15-minute window is a **scale bug**, not a market move — refuse to publish
4. Publishes `ok = false` explicitly; never silently omits

**Exit criteria:** fair value computed from pushed metadata + on-chain σ; stale
and cold paths return not-ok; scale guard rejects a 1e16 mismatch; event emitted.

---

## Phase 4 — Self-rescheduling cron

**Goal:** refresh every window boundary with no keeper anywhere.
**Detail:** `03-phase4-cron.md` · **Depends on:** P3

```solidity
SomniaExtensions.scheduleSubscriptionAtTimestamp(address handler, uint256 timestampMs, SubscriptionOptions);
```

One-shot, callable from Solidity, timestamps in **milliseconds**, must be **≥ 12
seconds ahead**. The handler refreshes, then schedules its own next invocation.

**Exit criteria:** a sweep continues when one window fails (`try/catch`, event
per failure — never a silent skip); rescheduling asserted; gas per sweep measured.

**Risk:** cron requires **≥ 32 SOMI** in the owning EOA per the docs. We hold 50
STT. If the testnet equivalent is unaffordable, fall back to an off-chain
scheduled `refreshAll()` **and say so in the README** rather than claiming
unattended operation that is not happening.

---

## Phase 5 — Testnet deploy + unattended proof ⭐ CRITICAL

**Goal:** the moment the central claim is true or it is not.
**Detail:** `04-phase5-deploy.md` · **Depends on:** P4

1. Deploy `RealizedVol` → `SigmaReactiveVol` → `SigmaWindowRegistry` →
   `SigmaOracle` → `SigmaCron`; wire owners; write `deployments/somniaTestnet.json`
2. Fund `SigmaReactiveVol` (it pays its own handler gas as subscription owner)
3. `subscribeTo(BTC pool, topic0, ...)` — 210,000 gas
4. **Walk away. Come back. Read `sampleCount` again.**

**Exit criterion — the one that matters:** `sampleCount` has climbed **with no
process of ours running**. Record both readings and the tx hash. This is the
single most persuasive artefact in the video.

**Do not claim it until the number has actually moved on its own.**

Also measure here: STT burn rate per hour of subscription. That number decides
whether "continuous" is honest.

---

## Phase 6 — `ec-sigma` bot

**Goal:** trade the gap through the real SDK, and seed the book.
**Detail:** `05-phase6-bot.md` · **Depends on:** P5 · **Parallel with P7, P8**

Loop: `listLiveBinaryMarkets({ venueId: 0x679795a0… })` → gate on
`tradingStart ≤ now < expiry` (**not** on indexer status) → `getOpeningPrices()`
→ `fetchPrice(asset)` → read `SigmaOracle` → if `|edge| ≥ threshold`, Kelly-size
→ **quantize to the 0.001 tick grid** → `placeLimit`/`placeOrder` with
`expireTimestampNs` → `assertTxOk` → `maybeClaim()`.

**Seeding mode:** `POST_ONLY` quotes either side of fair value, so an empty
market becomes two-sided.

**Non-negotiables** (all measured — see INTEGRATION.md): filter to venue
operator 2; key state by `marketId`, never pool address; read
`getBinaryBookParams` at runtime (`ec-core`'s `MM_LOT = 1` is stale — it is
`1000`); never pass a float price; `builderFeeBpsTimes1k = 0` on Shannon or it
reverts; redeem explicitly, payouts are pull.

**Exit criteria:** `DRY_RUN` log shows correctly quantized orders; one real
testnet order rests; an empty market shows two-sided; settlement claimed.

---

## Phase 7 — Edge Radar

**Goal:** make it legible in ten seconds. **20% of the rubric.**
**Detail:** `06-phase7-frontend.md` · **Depends on:** P5

Screens: **Edge Radar** (live windows, book vs fair value, edge in bps) ·
**Window detail** (fair value and book against time as the window runs) ·
**Track record** (predicted edge vs realised, losses included) · **Backtest**.

The interface must convey one thing: **fair value is alive and the book is not.**
That gap is the product. Tabular figures, values interpolate rather than snap.

Load the `frontend-design` and `dataviz` skills before building.

---

## Phase 8 — Replay backtest

**Goal:** evidence the edge is structural, not one lucky window.
**Detail:** `07-phase8-backtest.md` · **Depends on:** P1 only — can start early

The Bot Kit has **no** event-contract backtester; all nine adapters are spot-only.
Binary candles are useless here (keyed by recycled `poolAddress`, so one series
concatenates unrelated markets).

Input is `fetchPriceCandles(asset, "M1", { from, to })`: reconstruct synthetic
15m/1h windows from BTC minute bars, take each window's opening price as the
strike, price forward, and compare model probability against realised outcome.

**Exit criteria:** calibration curve (predicted vs realised frequency) over
hundreds of windows; parameters exposed; validated against the SciPy reference.

**Honesty gate:** if the model is not calibrated, **report that**. A published
calibration curve showing honest error is worth more than a hidden one.

---

## Phase 9 — Video, README, submission

**Goal:** submit. **Detail:** `08-phase9-submission.md`

**Required:** testnet prototype · public repo · **2–3 min** video.
**Optional, and worth it:** deck · **SDK/docs feedback report** — explicitly
invited, almost nobody submits one, and we have real material: `strike: "0"`,
the 1e2/1e18 scale gap, stale `MM_LOT`, builder fees reverting, `OracleHub`
having no price event, the testnet WS path ambiguity.

Video beats (script in `BRAND.md` §7): problem 0:00–0:25 · solution 0:25–0:50 ·
product 0:50–1:30 · demo 1:30–2:30 · vision 2:30–2:50. **Show a loss as well as
a win.**

**Pre-submission checks:** suite green · addresses match `deployments/` · README
states plainly what is live vs seeded vs replayed · model limits stated · no key
in repo, history, or any video frame · repo public with a licence.

---

## Timeline

| Day | Phase | Exit |
|---|---|---|
| 1 ✅ | P0, P1 | 83 tests green; chain verified; wallets funded |
| 2 | P2 | Handler decodes a real log |
| 3 | P3 | Fair value published on-chain |
| 4 | P4 | Cron reschedules itself |
| 5 | **P5** | **`sampleCount` climbing unattended** |
| 6–7 | P6 | Real order rests; empty market becomes two-sided |
| 7–9 | P7 | Edge Radar live |
| 8–9 | P8 | Calibration curve |
| 10 | Buffer | — |
| 11 | P9 | Video, README, feedback report |
| 12 | Submit | Before 2026-09-08 23:30 |

One full buffer day, deliberately. P7 and P8 can compress; **P5 cannot slip.**

---

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Handler gas burns 50 STT faster than expected | **High** | BTC only; early-return before SSTORE; measure in P5; faucet is 24h-limited so re-claim daily |
| Cron needs ≥32 SOMI-equivalent | **High** | Fall back to off-chain scheduled refresh, stated plainly in README |
| `VENUE_ID` drifts mid-hackathon | Medium | Moved 3× in one week; read from config, verify against live rows, fail loudly |
| No fills even after seeding | Medium | Fair value is the product; seeding proves the book; replay carries the edge claim |
| Publisher looks centralised | Medium | Record publisher per window on-chain; state the boundary rather than obscure it |
| Model poorly calibrated | Medium | Publish the calibration curve either way |
| Price-scale bug (1e2 vs 1e18) | Medium | `0.5 < S/K < 2` guard refuses to publish |
| `InvalidPrice` on mainnet only | Low | 6dp rounds it away on Shannon; build quantization correctly now, it cannot be caught here |
| Contracts unverified on explorer | Low | ABIs from SDK; every topic0 validated against a real log |

---

## Standing rules

1. **No commits without explicit instruction.**
2. **No claim without evidence** — especially "runs unattended".
3. **Every skip logged.** A window skipped and a window never examined must be
   distinguishable afterwards.
4. **Not-ok is published, never omitted.** Silence reads as "no edge".
5. **Losses shown as prominently as wins.**
6. **Read scales and grids at runtime**; never hard-code decimals or tick size.
7. **Key state by `marketId`**, never by pool address.
8. **State what is live, seeded, replayed, or mocked** — in the README, the UI,
   and the video.
