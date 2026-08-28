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

## What is live vs seeded vs replayed

| Component | Status | How to verify |
|---|---|---|
| **5 Solidity contracts** | **LIVE** on Shannon (50312) | `eth_getCode` returns nonempty bytecode for every address below |
| **Pricing engine** `Φ(d₂)` | **LIVE** — on-chain, 65 tests green, triple-implementation agreement (Solidity, TS, SciPy) | `npx hardhat test` |
| **Volatility estimator** | **LIVE** — EWMA σ accumulating on-chain via fallback price pusher | `scripts/verify-unattended.mjs` |
| **Fair-value oracle** | **LIVE** — first end-to-end fair value produced: 68.44% vs book 67.90%, +54 bps edge | `scripts/publish-and-refresh-btc-window.mjs` |
| **ec-sigma bot** | **DRY_RUN** — strategy logic, quantization, order placement, maker seeding, settlement all built | `bot/run-dry-run.mjs` |
| **Edge Radar frontend** | **LIVE** — reads on-chain registry + oracle, displays fair value and edge | `cd frontend && npm run dev` |
| **Backtest** | **REPLAY** — calibration curve from 3,000 real BTC minute candles (~230 independent windows) | `backtest/run-backtest.mjs` |
| **Reactivity subscription** | **NOT DELIVERING** — 6 subscriptions tested, zero callbacks; fallback price pusher works | `docs/FINDINGS.md` §6 |

## Frontend features

The Edge Radar terminal includes:

- **Wallet Connect** — MetaMask integration with Somnia chain switch, address display, QR code, explorer link
- **Bot Controls** — Start/Stop/Claim buttons with live status indicator in the nav bar
- **Theme Toggle** — Dark/light mode via next-themes
- **Animated Spot Price** — Real-time price with color flash on update (green = up, red = down)
- **Interval Filter** — Radix Select dropdown to filter windows by cadence (15m / 1h / 4h / 24h)
- **Watchlist** — Radix Switch toggle per card to track specific windows
- **Tooltips** — Hover explanations on sigma, edge, kelly, and all stat cards
- **Stagger Animations** — Cards entrance with framer-motion stagger, hover lift, tap shrink
- **Window Detail Tabs** — Fair Value / Market Price / Chart (lightweight-charts candlestick)
- **Backtest Tabs** — Calibration / By Time (τ) / By Cadence with animated bar fills
- **Accordion Assumptions** — Collapsible model limitations section
- **Progress Bars** — Brier score, log loss, quality indicators, kelly fraction
- **Dialog Modals** — Trade details, model info
- **Skeleton Loaders** — Graceful loading states on all pages
- **Toast Notifications** — sonner toasts for data load, bot actions, errors
- **Error Boundary** — Catches chart/rendering failures with retry button
- **Scroll Animations** — whileInView on backtest cards and track record

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

## UI stack

| Library | Purpose |
|---|---|
| Next.js 16 + React 19 | App framework |
| Tailwind CSS v4 | Styling |
| Radix UI (dialog, tabs, accordion, progress, tooltip, popover, select, switch) | Accessible primitives |
| Framer Motion | Animations — stagger, hover, tap, scroll, AnimatePresence |
| lightweight-charts | Candlestick / area / line price charts |
| sonner | Toast notifications |
| next-themes | Dark/light mode |
| date-fns | Time formatting |
| qrcode.react | Wallet QR code |
| viem | Ethereum provider + on-chain reads |

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

## Running the bot

```bash
cd bot
npm install

# Dry run (no orders placed)
node run-dry-run.mjs

# Dry run loop
node run-dry-run.mjs --loop

# Live taker mode (requires DEPLOYER_PRIVATE_KEY in .env)
node run-live.mjs --live

# Live maker mode (seed empty books)
node run-live.mjs --live --maker

# Claim settled positions
node run-live.mjs --claim
```

## Running the backtest

```bash
cd backtest
node run-backtest.mjs
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

## Model assumptions and limitations

- **Zero-drift GBM** — the model assumes spot follows geometric Brownian motion with zero drift. This understates fat tails: the backtest found the model is systematically overconfident in the tails (predicted ~0.2% realises ~14%; predicted ~99.6% realises ~91.5%). Well-calibrated in the middle.
- **Volatility source** — σ comes from a dreamDEX spot-pool mark price (`MarkPriceUpdated`), not a signed oracle attestation. Cross-checked 0.12% from the perp index price.
- **Settlement** — Terminal (`close ≥ open`, ties favor Up). The `SettlementStyle.Average` path exists but is not used on the real venue.
- **Builder fees** — implemented in code but **disabled on Shannon** (`maxBuilderFeeBpsTimes1k = 0`). Revenue model is testable on mainnet only.
- **Reactivity** — designed to feed σ on-chain without a keeper, but delivery is not confirmed. Fallback: off-chain scheduled price pusher (`scripts/fallback-price-pusher.mjs`).

## Documentation index

| Doc | Contents |
|---|---|
| [`docs/OVERVIEW.md`](docs/OVERVIEW.md) | What we're building and why, end to end |
| [`docs/VALUE.md`](docs/VALUE.md) | The value proposition, explained at every level |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design |
| [`docs/RESEARCH.md`](docs/RESEARCH.md) | Cross-verified fact base on the hackathon, dreamDEX, and the competitive field |
| [`docs/INTEGRATION.md`](docs/INTEGRATION.md) | Measured SDK/chain integration facts and traps |
| [`docs/FEEDBACK.md`](docs/FEEDBACK.md) | SDK & documentation feedback (submitted to organizers) |
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
