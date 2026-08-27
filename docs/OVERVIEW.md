# Sigma — What We Are Building, and Why

**One line to beat. Sigma tells you the odds.**

The single entry point to this project. Read this first; every other document
goes deeper on one part of it.

| Document | Contents |
|---|---|
| **OVERVIEW.md** | ← you are here. The whole prototype, and the reasoning behind it |
| [`RESEARCH.md`](./RESEARCH.md) | Cross-verified fact base, with source grades and an audit trail of corrections |
| [`SDK-NOTES.md`](./SDK-NOTES.md) | Schema and API read directly from the installed SDK + live testnet calls |
| [`DESIGN.md`](./DESIGN.md) | Architecture spec |
| [`BRAND.md`](./BRAND.md) | Name, tagline, icon, voice, pitch script |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | End-to-end build, deploy, and submission runbook |
| [`superpowers/plans/`](./superpowers/plans/) | Task-by-task TDD implementation plans |

---

# 1. What is actually being built

**A fair-value layer for dreamDEX Event Contracts**, in four parts:

| Part | What it is | Where it runs |
|---|---|---|
| **1. Volatility engine** | Realised volatility measured continuously from dreamDEX's own live mark price (~2s cadence), pushed in by Somnia Reactivity with no keeper process | On-chain (Solidity) |
| **2. Fair-value oracle** | For every open window: fair probability, the book's implied probability, edge in basis points, break-even win rate. Published on-chain so **any** builder can read it | On-chain (Solidity) |
| **3. `ec-sigma` strategy** | A dreamDEX Bot Kit strategy that reads the oracle and trades the gap through `@somnia-chain/markets-sdk` | Off-chain (TypeScript) |
| **4. Edge Radar** | The interface: every live window, fair value against the book, mispricing highlighted, with an honest track record | Frontend (Next.js) |

Parts 1 and 2 are the product. Parts 3 and 4 prove it works and make it legible.

---

# 2. Why — the problem, precisely

A dreamDEX Event Contract asks whether BTC or ETH finishes a fixed window at or
above a line. The docs are explicit about what that line is:

> *"There are no preset strikes. There is one line to beat: the window's opening price."*

That one design choice creates the entire problem.

**At window open, there is nothing to know.** Strike equals spot, so the fair
probability is ≈ 0.50 in every market, every time, by construction.

**During the window, everything changes fast.** As spot drifts off the opening
line and the clock runs down, the true probability moves non-linearly. Time
decay and distance-from-the-line interact: the same 0.3% move means something
completely different with twelve minutes left than with forty seconds left.

**And a binary's price *is* a probability.** Pay 0.70 and you need to be right
more than 70% of the time merely to break even. That is not a subtlety — it is
the whole economics of the instrument, and nothing on screen tells you.

Late in a 15-minute window, a modest move away from the line with little time
remaining can put the true probability at 0.85 while the book still shows 0.70.
**A 1,500 basis-point mispricing, visible only to someone computing it.**

No one is computing it.

---

# 3. Why this specifically, and not something else

Seven projects were already submitted when this started. The field was read
before a single design decision was made.

| Already claimed | By |
|---|---|
| AI verdict / score / rating on markets | Vitamin M, Rivo Intelligence, QDS — **three of seven** |
| Conditional / parlay chaining | Branch |
| Liquidity-quality metric | rampart |
| Position sizing from max loss | Sluice Markets |
| Gamification | Market Dungeon |

The AI-verdict lane holds three of seven entries. Differentiating inside it in
twelve days is not realistic, and judges will notice the repetition.

And a second finding closed off the obvious fallback: **the dreamDEX Bot Kit
ships six working Event Contract trading strategies** — `ec-starter`, `ec-maker`,
`ec-passive`, `ec-laddering-bot`, `ec-oracle-follow`, `ec-settlement`. "We built
an autonomous trading bot" competes against the organiser's own sample code.

What is left uncontested is the thing that is actually hard:

> Every submission competes on **"what will happen?"**
> None competes on **"what should this cost, and is the book wrong right now?"**

**And the gap is pointed at directly by the organiser's own code.** `ec-maker`
is documented as *"two-sided post-only quoting around **fair probability**."*
Their market maker quotes around a fair probability — and nothing in the kit
tells it what that number is.

Sigma is that number.

---

# 4. The maths — why there is a right answer

This market is unusual: the answer is checkable. Under zero-drift GBM, for a
binary settling on the terminal price against the opening price:

```
d₂ = ( ln(S/K) − σ²τ⁄2 ) / ( σ√τ )        K = the window's opening price
fair probability = Φ(d₂)
```

Because the payout is fixed, the economics collapse exactly — no fitting, no
approximation. Buying at price `a` costs `a` to win `1 − a`, so expected value
is `p(1−a) − (1−p)a = p − a`. Therefore:

| Quantity | Value |
|---|---|
| **Break-even win rate** | exactly the price `a` |
| **Edge** | exactly `p − a` |
| **Kelly stake** | `f* = p − (1−p)·a/(1−a)` |

The `Φ(d₂)` implementation is property-tested against `scipy.stats.norm` across a
grid of spot, strike, volatility and time-to-expiry, with bounded fixed-point
error. **That validation is the most defensible artefact in the submission** —
in a field of AI verdicts, "our maths provably matches SciPy" is a far stronger
claim than "our AI thinks so."

---

# 5. Why it belongs on Somnia specifically

Not a generic dApp that happens to deploy here. Two platform primitives make
this design possible, and no competing submission uses either.

**Reactivity — volatility on-chain, with no keeper.**
`σ` has to come from somewhere. Somnia's reactivity precompile (`0x0100`) lets a
contract subscribe to another contract's events directly, so `σ` accumulates
on-chain and continuously — no polling, no server, no keeper. On any other chain
this needs off-chain infrastructure. The 200,000,000 gas handler ceiling means
real computation fits inside the handler.

The feed is `MarkPriceUpdated` from the dreamDEX spot pools (BTC
`0x3605f28a…326c`, ETH `0xd180195d…2b50`), 1e18-scaled, firing **about once
every two seconds per asset**.

This also closes a gap in the organiser's own code: `ec-oracle-follow` documents
that underlying price *"[is] unavailable in market rows"* and its bundled feed
is testnet-only. Subscribing to the pool on-chain is a cleaner answer.

> **A correction worth stating.** An earlier draft claimed σ would come from
> `OracleHub`, "the feed that decides the outcome". Checked against live chain
> logs, **`OracleHub` emits no price event** — it resolves questions, not
> prices. So the accurate claim is narrower: σ is measured from dreamDEX's own
> order-book mark price, not a signed oracle attestation. Spot mark and perp
> oracle index agree to 0.12% on BTC, so it tracks closely — but the difference
> is real and is stated rather than papered over.

**Cron — participating in every window.** 15-minute windows mean 96 markets per
underlying per day. `SomniaExtensions.scheduleSubscriptionAtTimestamp` is
callable from Solidity and one-shot, so the handler refreshes the oracle and
then schedules **its own** next invocation. There is no cron server anywhere in
this system.

**Agents are deliberately excluded from the critical path.** Consensus-validated
off-chain compute is real and interesting, but per-call cost on testnet is
unmeasured. Nothing in Sigma's core may depend on it.

---

# 6. Purpose

> **Make the fair price of every Event Contract visible, verifiable, and free.**

Event Contract prices are probabilities, which makes them uniquely checkable —
unlike almost anything else in DeFi, there is a right answer. Sigma exists to
compute it and give it away, so that no one in this market trades blind against
someone who did the maths.

## Mission

Compute the fair probability of every open window, publish it on-chain as a
public feed, and demonstrate the edge honestly — losses included.

## Vision

> **A prediction market where fair value is public infrastructure, not private edge.**

In every mature derivatives market, fair value is a shared utility.
Black-Scholes is not proprietary. DVOL is published. Implied volatility surfaces
are on every screen. Prediction markets have never had that layer, so pricing
knowledge stays with whoever built their own model.

The end state is that the fair probability of every open window, on every venue,
is a public on-chain feed — read by interfaces to warn users, by market makers
to quote, by risk systems to size, and by future strategies as a primitive they
never had to build.

**The measure of success is not that Sigma trades well. It is that other
people's products get better because Sigma exists.**

---

# 7. What is included in the prototype

## Shipping

- `BinaryPricer` — Solidity library: `Φ(d₂)`, edge, break-even, Kelly. Pure, SciPy-validated.
- `RealizedVol` — EWMA volatility per underlying, with staleness and minimum-sample guards.
- `SigmaReactiveVol` — reactivity handler bridging the dreamDEX spot-pool
  `MarkPriceUpdated` feed into the estimator.
- `SigmaOracle` — the public fair-value feed. Emits `FairValuePublished`.
- `SigmaCron` — self-rescheduling window-boundary refresh.
- `ec-sigma` — Bot Kit strategy on the real SDK, with correct tick quantization and claim handling.
- **Edge Radar** — the interface.
- **Backtest** — evidence the edge is structural, not a lucky window.
- **SDK/docs feedback report** — explicitly invited by the organisers, cheap, and we have real material.

## Deliberately excluded

- Any AI verdict, score, or rating — three submissions already do this, and
  "SciPy-validated Φ(d₂)" is a *stronger* claim here than "AI-powered".
- Agent leaderboards or agent-vs-agent competition — same lane as Rivo and QDS.
- A generic trading bot as the headline — six ship in the Bot Kit.
- **Any claim of profitability.** Sigma claims a measurable, auditable edge
  *signal*, and reports realised results honestly.

---

# 8. How it wins, against the published rubric

| Weight | Criterion | Sigma's answer |
|---|---|---|
| **25%** | Technical Implementation | Ships as a Bot Kit strategy on the real SDK (v0.28.1, verified installed); on-chain oracle; reactivity + Solidity cron; SciPy-validated maths |
| **20%** | Innovation & Originality | The only entry that prices the instrument. Built on the "no strikes" property nobody else noticed |
| **20%** | UX & Design | Edge Radar — fair value moving live against a static book. The visual gap *is* the product |
| **20%** | Business & Ecosystem | A public good the other six could consume, plus native **builder-fee** revenue that grows dreamDEX volume rather than diverting it |
| **15%** | Presentation & Demo | Live testnet trades with P&L accruing on camera, and the volatility subscription proven to run unattended |

---

# 9. Honesty constraints

These are requirements with tests behind them, not aspirations. They exist
because the entire value proposition is rigour, and a fair-value product that
overstates itself is worthless.

- **Stale volatility means no trade.** Every fair value carries `updatedAt` and
  an `ok` flag; beyond the staleness bound the strategy refuses.
- **Insufficient samples means no number** — never a fabricated σ.
- **Not-ok is published, not omitted.** Silence is indistinguishable from "no
  edge", so the oracle explicitly publishes `ok = false`.
- **Every skip is logged.** A window skipped and a window never examined must be
  distinguishable afterwards.
- **Model limits stated next to results.** Zero-drift GBM understates fat tails.
  The UI names the model producing each number; the README states the limit.
- **Losses shown as prominently as wins.** A track record that only shows green
  is not a track record.
- **The README says plainly what is live and what is mocked.** Overstating is
  the fastest way to lose a judge's trust.

---

# 10. Status

**Verified live (2026-08-27):** RPC `https://dream-rpc.somnia.network` returns
chain id `0xc488` = **50312** ✅ · `OracleHub` has code (ERC-1967 proxy) ✅ ·
dreamDEX testnet REST responding ✅ · `@somnia-chain/markets-sdk@0.28.1`
installed, clearing the ≥0.28.0 floor ✅ · full `BinaryMarket` schema recovered
from the SDK's own type declarations ✅

**Built:** repo scaffolded on `D:\somnia-sigma`, Hardhat 3.15.0 + solady +
viem + SDK installed, Somnia testnet configured, SciPy reference oracle written.

**Next:** `BinaryPricer` against the golden vectors, then `RealizedVol`, then
the live spot-pool subscription — the moment the central technical claim is
either true or it is not.

**Resolved since:** `OracleHub` emits no price event. The subscribable feed is
`MarkPriceUpdated` on the dreamDEX spot pools (BTC `0x3605f28a…326c`, ~2s
cadence, 1e18-scaled), with its `topic0` validated against a real log.
