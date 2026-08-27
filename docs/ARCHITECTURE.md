# Sigma — Architecture

Public system design reference. For the reasoning behind each decision, see
[`DESIGN.md`](./DESIGN.md) (the full build spec) and [`RESEARCH.md`](./RESEARCH.md)
(the fact base it's built on). This document describes *what the system is*,
not the day-by-day process of building it.

---

## 1. The instrument, in one paragraph

A dreamDEX Event Contract is a fixed-payout binary: will the underlying
(BTC/ETH) finish a fixed window (15m/1h/4h/24h) at or above the price it
*opened* at. There is no preset strike — the strike **is** the opening price.
The contract's price is a probability in (0,1). Fair value is therefore
`Φ(d₂)` under zero-drift GBM, computed with `K` = the window's own opening
price, `σ` = realised volatility, and `τ` = fraction of the window remaining.

## 2. System diagram

```
                    ┌──────────────────────────────┐
                    │   dreamDEX BTC spot pool      │
                    │   emits MarkPriceUpdated      │   ~0.5 Hz, 1e18-scaled
                    │   (order-book mark price)     │
                    └───────────────┬───────────────┘
                                    │
                       Somnia Reactivity precompile
                          (on-chain subscription,
                           no keeper, no polling)
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │      SigmaReactiveVol         │  decode + forward only
                    └───────────────┬───────────────┘
                                    │ recordPrice(asset, price)
                                    ▼
                    ┌──────────────────────────────┐
                    │         RealizedVol           │  EWMA variance-per-second
                    │  (time-aware, not tick-count) │  staleness + min-sample guards
                    └───────────────┬───────────────┘
                                    │ σ(window length)
                                    ▼
   ┌────────────────────┐  ┌──────────────────────────────┐  ┌───────────────┐
   │ SigmaWindowRegistry │─▶│         SigmaOracle          │◀─│ BinaryPricer  │
   │ opening price,      │  │  refresh() reads σ, spot,    │  │ Φ(d₂), edge,  │
   │ pool, cadence,      │  │  opening price, and the      │  │ break-even,   │
   │ publisher-audited   │  │  window's ON-CHAIN book      │  │ Kelly (pure)  │
   └─────────────────────┘  │  (getBookLevels on the pool) │  └───────────────┘
                             │  → publishes fair value,     │
                             │    implied prob, edge, ok    │
                             └───────────────┬───────────────┘
                                    │ read (free, public)      │ self-reschedules
                                    │                           ▼
                                    │                    ┌──────────────┐
                                    │                    │  SigmaCron   │  refresh at each
                                    │                    └──────────────┘  window boundary
                                    │
                    ┌───────────────┼────────────────────────────────┐
                    ▼               ▼                                ▼
            any other builder   ec-sigma bot                   Edge Radar UI
            (the public good)   (dreamDEX SDK,                 (fair value vs
                                 quantized orders,               book, live)
                                 book seeding, claims)
```

## 3. Components

| Contract | Responsibility | Notes |
|---|---|---|
| `BinaryPricer` | Pure math library: `Φ(d₂)`, edge, break-even, Kelly | No state, no external calls. Validated against `scipy.stats.norm` |
| `RealizedVol` | EWMA volatility per asset, time-aware (per second, not per tick) | Staleness bound, minimum-sample gate, outlier rejection |
| `SigmaReactiveVol` | Reactivity handler bridging the dreamDEX mark-price feed into `RealizedVol` | Deliberately minimal — decode and forward only |
| `SigmaWindowRegistry` | Holds the off-chain-sourced facts about each window (opening price, pool, cadence) | A publisher pushes windows; publisher and timestamp are recorded per window, so the trust boundary is explicit rather than hidden |
| `SigmaOracle` | Combines σ, spot, opening price, and the on-chain book into a published fair value | The public good — any contract can read `getFairValue()` |
| `SigmaCron` | Self-rescheduling window-boundary refresh via Somnia's cron subscription | No off-chain scheduler in the intended design |

Off-chain, layered on top: the `ec-sigma` Bot Kit strategy (trades through the
official `@somnia-chain/markets-sdk`) and the Edge Radar frontend.

## 4. Why the split between on-chain and off-chain is where it is

**On-chain:** everything that must be independently readable and verifiable —
the volatility estimate, the fair-value computation, the published edge. This
is what makes Sigma a public good rather than a private model.

**Off-chain (SDK):** order placement, tick/lot quantization, nonce handling,
claim sweeps. dreamDEX's official SDK already solves these correctly; the
hackathon's own judging criteria weight "effective use of the SDK" at 25% —
reimplementing this in Solidity would be worse engineering and score worse.

**The one structural constraint this creates:** dreamDEX binary markets are
only discoverable through an off-chain GraphQL indexer, and on the live
Up/Down venue, the market row's `strike` field is literally `"0"` — the real
opening price lives on the oracle's *reference question* and is only
reachable off-chain. `SigmaOracle` therefore cannot self-discover a window;
`SigmaWindowRegistry` exists specifically to carry that one off-chain-sourced
fact on-chain, explicitly and auditably, rather than pretending it doesn't
exist.

## 5. Data flow for one window

1. The BTC spot pool emits `MarkPriceUpdated`. Reactivity invokes
   `SigmaReactiveVol.onEvent`, which forwards to `RealizedVol.recordPrice`.
   Continuous, no keeper.
2. A publisher (or, at the design's endpoint, `SigmaCron`) pushes the
   window's metadata — opening price, pool address, cadence — into
   `SigmaWindowRegistry`.
3. `SigmaOracle.refresh(marketId)` reads σ from `RealizedVol`, the opening
   price and pool from the registry, the live book from the pool directly
   (`getBookLevels`), and computes fair probability, implied probability,
   edge, and break-even via `BinaryPricer`. An empty book still yields a
   published fair value (`ok=true`, `reason=NoBook`) — the number a market
   maker or seeder needs even with nothing to compare against.
4. Any contract, the bot, or the frontend reads `getFairValue(marketId)`.

## 6. Honesty constraints, enforced in the design

- **Not-ok is published, never omitted.** Silence would be indistinguishable
  from "no edge exists." Every refusal carries a typed reason
  (`NoWindow`, `Expired`, `VolNotReady`, `NoBook`, `ScaleMismatch`).
- **A scale guard rejects implausible ratios before pricing.** The opening
  price and the live spot feed are in different numeric scales (1e2 vs
  1e18); a mismatch produces a *confident, wrong* number rather than an
  error unless explicitly guarded against.
- **No claim of unattended operation without an observed proof.** The
  reactivity subscription must be shown, via repeated on-chain reads, to
  advance a sample counter with no process running — not merely deployed.

## 7. What is deliberately not on-chain

- Order placement and settlement — the SDK's job, not Sigma's.
- Market discovery — the indexer's job; `SigmaWindowRegistry` carries only
  the minimum fact set needed to price, not a full market mirror.
- Any AI/LLM component. The pricing core is closed-form and independently
  checkable; nothing here is a model's opinion.
