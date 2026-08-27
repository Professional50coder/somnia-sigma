<p align="center"><img src="brand/sigma-mark.svg" width="96" alt="Sigma"></p>

<h1 align="center">Sigma</h1>
<p align="center"><strong>One line to beat. Sigma tells you the odds.</strong></p>
<p align="center">The fair-value layer for dreamDEX Event Contracts, on Somnia.</p>

---

## What this is

A dreamDEX Event Contract has no strike — the strike **is** the window's
opening price. So every market is a coin flip at open, and the real odds move
fast, non-linearly, as spot drifts off that line and the clock runs down. The
price you pay *is* a probability: pay 0.70 and you need to be right more than
70% of the time just to break even. Nothing on the market tells you whether
that price is right.

**Sigma computes it.** Realised volatility is measured on-chain, continuously,
from dreamDEX's own live mark-price feed, and folded into a closed-form fair
probability (`Φ(d₂)`, validated against `scipy.stats.norm`). The result —
fair probability, edge in basis points, break-even win rate — is published
on-chain, for free, for any contract to read.

> dreamDEX's own `ec-maker` strategy is documented as quoting *"two-sided
> post-only... around fair probability"* — with nothing in the kit supplying
> that number. Sigma is that number.

Full reasoning, the competitive read, and the pitch script: [`docs/VALUE.md`](docs/VALUE.md).

## Status — read this before anything else below

This is an active hackathon build. Every claim here is either backed by a
transaction hash or explicitly marked not-yet-proven. See
[`docs/STATUS.md`](docs/STATUS.md) and [`docs/CHECKLIST.md`](docs/CHECKLIST.md)
for the live, itemized state.

| | |
|---|---|
| ✅ Live on Somnia testnet | All 5 contracts deployed to Shannon (chain 50312) — see [`docs/DEPLOYMENT-LEDGER.md`](docs/DEPLOYMENT-LEDGER.md) for every address and tx hash |
| ✅ Pricing engine | `Φ(d₂)`, edge, break-even, Kelly — validated against SciPy, 65 tests green |
| ✅ Volatility estimator | Time-aware EWMA, on-chain, tested |
| ✅ Frontend | Edge Radar, Window Detail, Track Record, Backtest — built with dark terminal aesthetic, reading live contracts |
| ✅ Backtest | Real calibration curve from 3,000+ live BTC candles, ~230 independent windows, honest tail-miscalibration finding |
| 🔶 Oracle integration | DIA / Protofire price feeds integrated for spot data |
| 🔶 Reactivity subscription | Registered on-chain correctly (confirmed via `getSubscriptionInfo`), **live delivery not yet confirmed** — under active investigation |
| ⬜ Bot strategy | ec-sigma strategy/maker logic not yet built |

**We do not claim "runs unattended" until we've observed it.** If reactivity
delivery doesn't resolve, the documented fallback (an off-chain scheduled
price push, same on-chain compute) is used instead, and stated as such.

## Why this, and not something else

Seven other Event Contracts hackathon submissions already exist. Three of
them are AI-verdict products ("is this market safe? GREEN/YELLOW/RED"). None
of them — and nothing in dreamDEX's own Bot Kit — computes what a window
*should* cost. That gap, not "another trading bot," is what Sigma builds into.

Full competitive analysis: [`docs/RESEARCH.md`](docs/RESEARCH.md) §7.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full system design.
In short:

```
dreamDEX BTC spot pool  --MarkPriceUpdated-->  Somnia Reactivity  -->  RealizedVol (on-chain, EWMA σ)
                                                                              |
                                          SigmaWindowRegistry (opening price, per window)
                                                                              |
                                                                        SigmaOracle
                                                          (Φ(d₂) fair value · edge · break-even)
                                                                              |
                                                    read by: any contract  ·  ec-sigma bot  ·  Edge Radar UI
```

## Repository layout

```
contracts/          Solidity — pricing, volatility, oracle, cron, reactivity bridge
test/               Hardhat test suite (103 passing)
reference/          SciPy reference pricer — the ground truth the Solidity is checked against
scripts/            Deploy, subscribe, balance-check, diagnostic tooling
deployments/        Address book for the live testnet deployment
backtest/           Phase 8 historical replay — BTC minute candles, calibration analysis
docs/               Research, design, integration notes, phase plans, status
brand/              Logo assets
frontend/           Next.js 15 Edge Radar UI — dark terminal aesthetic, sigma-prefixed classes
```

## Frontend screens

| Screen | Route | Description |
|---|---|---|
| Edge Radar | `/` | Live windows from on-chain registry, system status, sample layout, model chart, backtest evidence |
| Window Detail | `/window/[marketId]` | Individual window deep-dive: fair probability dial, edge, Φ(d₂) model chart, order book, trade feed |
| Track Record | `/track-record` | Live trading performance: equity curve, trade history, calibration (populates as ec-sigma trades) |
| Backtest | `/backtest` | Historical replay evidence: calibration curve, tau buckets, cadence breakdown, honest tail finding |

Frontend stack: Next.js 15, React 18, TypeScript, viem. No Tailwind — pure vanilla CSS with CSS custom properties. Dark terminal aesthetic, sigma-prefixed component classes.

## Running the tests

```bash
npm install
npx hardhat test
```

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

## Deployed contracts — Somnia Shannon testnet (chain 50312)

| Contract | Address |
|---|---|
| RealizedVol | `0xbd7eedfa178d8eb094449e3461e83195f4b062ef` |
| SigmaReactiveVol | `0x5f6a29b5717841f6f7b394be6936ea176dc63d28` |
| SigmaWindowRegistry | `0x16b9d8c364d70f38d0b04b760439efc794a46731` |
| SigmaOracle | `0xe4c7be7dca5f536cfb18df61b01f3a952e902270` |
| SigmaCron | `0xc573c7b699690d1821aa4156ef7c09ee9ceba0e7` |

Full transaction history for every deploy and write: [`docs/DEPLOYMENT-LEDGER.md`](docs/DEPLOYMENT-LEDGER.md).

## Documentation index

| Doc | Contents |
|---|---|
| [`docs/OVERVIEW.md`](docs/OVERVIEW.md) | What we're building and why, end to end |
| [`docs/VALUE.md`](docs/VALUE.md) | The value proposition, explained at every level |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design |
| [`docs/RESEARCH.md`](docs/RESEARCH.md) | Cross-verified fact base on the hackathon, dreamDEX, and the competitive field |
| [`docs/INTEGRATION.md`](docs/INTEGRATION.md) | Measured SDK/chain integration facts and traps |
| [`docs/STATUS.md`](docs/STATUS.md) · [`docs/CHECKLIST.md`](docs/CHECKLIST.md) | Live build status |
| [`docs/BRAND.md`](docs/BRAND.md) | Name, tagline, identity, pitch script |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | Detailed phase-by-phase implementation plans |

## What this is not

- Not an AI verdict/prediction product. The core is closed-form math
  (`Φ(d₂)`), validated against SciPy — not a model's opinion.
- Not a claim of profitability. Sigma publishes a measurable, auditable
  *signal* and reports realised results honestly, losses included.
- Not overstating what's live. Every number in this repo is either backed
  by a transaction hash or marked as not yet proven.

## License

MIT
