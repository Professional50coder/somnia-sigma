# Sigma — Master Reference

> Single source of truth for all links, status, architecture, and findings.
> Last updated: 2026-08-27

---

## 1. Hackathon

| Field | Value |
|---|---|
| **Event** | Somnia × DreamDEX Event Contracts Hackathon |
| **Platform** | DoraHacks |
| **Prize Pool** | $5,000 USDso |
| **Registration** | Aug 18, 2026 |
| **Submission Window** | Aug 25 – Sep 8, 2026 |
| **Deadline** | Sep 8, 2026 23:30 UTC |
| **Participants** | 209 hackers, ~146 expected builds |
| **Chain** | Somnia Shannon testnet, chain ID 50312 |
| **RPC** | `https://dream-rpc.somnia.network` |
| **Faucet** | `https://testnet.somnia.network` |

### Judging Criteria

| Weight | Criterion | What judges look for |
|---|---|---|
| 25% | Technical Implementation | SDK usage, on-chain reactivity, Solidity, test coverage |
| 20% | Innovation & Originality | Novel use of Event Contracts, not just another bot |
| 20% | User Experience & Design | Intuitive UI, compelling demo |
| 20% | Business & Ecosystem Impact | Attracts users, generates volume, increases EC adoption |
| 15% | Presentation & Demo | Clear problem/solution, live demo, future vision |

### Submission Requirements

- Working prototype on testnet
- GitHub repo (public)
- 2–3 minute demo video
- SDK/docs feedback report (optional but cheap, we have material)
- Presentation deck (optional)

---

## 2. All External Links

### Official Docs & Tools

| Resource | URL |
|---|---|
| DreamDEX Docs | https://docs.dreamdex.io |
| Event Contracts Docs | https://docs.dreamdex.io/developers/event-contracts |
| EC Gotchas | https://docs.dreamdex.io/developers/event-contracts/gotchas |
| EC Recipes | https://docs.dreamdex.io/developers/event-contracts/recipes |
| EC Market Structure | https://docs.dreamdex.io/developers/event-contracts/market-structure |
| EC Contracts & Addresses | https://docs.dreamdex.io/developers/event-contracts/contracts-and-addresses |
| Somnia Docs | https://docs.somnia.network |
| Somnia Reactivity (On-chain) | https://docs.somnia.network/developer/reactivity/reactivity-onchain |
| Reactivity Tutorial (Solidity) | https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial |
| Reactivity Tutorial (Markdown) | https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial.md |
| Somnia Reactivity TypeScript SDK | https://docs.somnia.network/developer/reactivity/typescript-sdk |
| Shannon Explorer | https://shannon-explorer.somnia.network |
| Shannon Explorer API Docs | https://shannon-explorer.somnia.network/api-docs |
| Shannon Explorer Contract Verification | https://shannon-explorer.somnia.network/contract-verification |
| Shannon Explorer GraphQL | https://shannon-explorer.somnia.network/graphiql |

### Repos & SDK

| Resource | URL |
|---|---|
| DreamDEX Bot Kit | https://github.com/somnia-chain/dreamdex-bot-kit |
| Bot Kit EC Strategies | https://github.com/somnia-chain/dreamdex-bot-kit/tree/main/strategies |
| ec-starter | https://github.com/somnia-chain/dreamdex-bot-kit/tree/main/strategies/ec-starter |
| ec-maker | https://github.com/somnia-chain/dreamdex-bot-kit/tree/main/strategies/ec-maker |
| ec-passive | https://github.com/somnia-chain/dreamdex-bot-kit/tree/main/strategies/ec-passive |
| ec-oracle-follow | https://github.com/somnia-chain/dreamdex-bot-kit/tree/main/strategies/ec-oracle-follow |
| ec-settlement | https://github.com/somnia-chain/dreamdex-bot-kit/tree/main/strategies/ec-settlement |
| ec-laddering-bot | https://github.com/somnia-chain/dreamdex-bot-kit/tree/main/strategies/ec-laddering-bot |
| Bot Kit Core Package | https://github.com/somnia-chain/dreamdex-bot-kit/tree/main/packages/core |
| Bot Kit Backtest Engine | https://github.com/somnia-chain/dreamdex-bot-kit/tree/main/packages/backtest |
| markets-sdk (npm) | https://www.npmjs.com/package/@somnia-chain/markets-sdk |
| reactivity (npm) | https://www.npmjs.com/package/@somnia-chain/reactivity |

### Hackathon & Community

| Resource | URL |
|---|---|
| DoraHacks Hackathon Page | https://dorahacks.io/hackathon/event-contracts/detail |
| Telegram Dev Community | https://t.me/+XHq0F0JXMyhmMzM0 |
| dreamDEX Bot Builder | https://dreambot-builder.vercel.app |
| dreamDEX Twitter | https://x.com/dreamDEXSomnia |
| Somnia Website | https://somnia.network |
| Somnia Devs Twitter | https://x.com/SomniaDevs |

### Network Endpoints (Shannon Testnet)

| Service | URL |
|---|---|
| RPC | `https://dream-rpc.somnia.network` |
| REST API | `https://stg.api.dreamdex.io/v0` |
| WebSocket | `wss://stg.api.dreamdex.io/v0/ws/public` |
| Price Feed Indexer | `https://price-feed.dev.oracle.somnia.host/v1/graphql` |
| Shannon Explorer API | `https://somnia.w3us.site/api` (Etherscan-compatible) |
| Shannon Explorer GraphQL | `https://shannon-explorer.somnia.network/graphiql` |

### Network Endpoints (Mainnet — NOT used during hackathon)

| Service | URL |
|---|---|
| RPC | `https://api.infra.mainnet.somnia.network` |
| REST API | `https://api.dreamdex.io/v0` |
| WebSocket | `wss://api.dreamdex.io/v0/ws/public` |

---

## 3. Deployed Contracts (Shannon Testnet)

| Contract | Address | Deployed |
|---|---|---|
| RealizedVol | `0xbd7eedfa178d8eb094449e3461e83195f4b062ef` | ✅ Verified |
| SigmaReactiveVol | `0x5f6a29b5717841f6f7b394be6936ea176dc63d28` | ✅ Verified |
| SigmaWindowRegistry | `0x16b9d8c364d70f38d0b04b760439efc794a46731` | ✅ Verified |
| SigmaOracle | `0xe4c7be7dca5f536cfb18df61b01f3a952e902270` | ✅ Verified |
| SigmaCron | `0xc573c7b699690d1821aa4156ef7c09ee9ceba0e7` | ✅ Verified |
| ReactivityProbe (diag) | `0x836bf06dc54c470fdcb6fb0533998de493e1c89a` | Deployed |
| ReactivityProbeV2 (diag) | (see DEPLOYMENT-LEDGER.md) | Deployed |

### dreamDEX Pool Addresses

| Pool | Address | Asset |
|---|---|---|
| WBTC:USDso | `0x3605f28aa7c50e7441211e77cb0762d49539326c` | BTC |
| WETH:USDso | `0xd180195da5459c7a0dea188ed61216ec43682b50` | ETH |
| SOMI:USDso | `0x259fD6559214dd5aD3752322426eA9F9fABEFff4` | SOMI |

### Key Events

| Event | topic0 | Source |
|---|---|---|
| MarkPriceUpdated | `0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888` | dreamDEX spot pools |

### Wallets

| Wallet | Address | STT | tUSDC |
|---|---|---|---|
| Deployer | `0x0dDb3093df73Ca59F33420670125e0C686c0A468` | ~0.0002 | 500 |
| Bot | `0x7F8F17738f2901D291e465249a177F009E582ad9` | ~0.0002 | 500 |

**⚠️ STT is nearly empty. Need faucet before any on-chain operations.**

---

## 4. Project Architecture

### What Sigma Is

dreamDEX Event Contracts are Up/Down binaries on BTC/ETH. No preset strike — the strike IS the opening price. At t=0 every market is a coin flip (fair value ≈ 0.50). Mid-window, true probability moves fast and non-linearly. Nothing tells you whether the book price is right.

**Sigma computes it.** Realised volatility measured on-chain, continuously, from dreamDEX's own live mark-price feed, folded into a closed-form fair probability (Φ(d₂)). The result — fair probability, edge in basis points, break-even win rate — is published on-chain, for free, for any contract to read.

### The Math

```
d₂ = ( ln(S/K) − σ²τ/2 ) / (σ√τ)

Where:
  S = current spot price (1e18)
  K = window's opening price (1e18)
  σ = realised volatility over the full window
  τ = fraction of window remaining (0, 1]

Fair probability = Φ(d₂)    (standard normal CDF)
Edge = p − a                 (exactly, for fixed-payout binary)
Break-even = a               (exactly the price)
Kelly = p − (1−p)·a/(1−a)
```

### System Diagram

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

### Component Responsibilities

| Component | What | Status |
|---|---|---|
| `BinaryPricer.sol` | Pure math: Φ(d₂), edge, break-even, Kelly. No state. | ✅ 65 tests, SciPy-validated |
| `RealizedVol.sol` | EWMA variance per second, staleness/min-sample guards | ✅ 18 tests |
| `SigmaReactiveVol.sol` | Bridges MarkPriceUpdated → RealizedVol | ✅ Tested; live delivery broken |
| `SigmaWindowRegistry.sol` | On-chain window metadata (opening price, pool, cadence) | ✅ 3 tests |
| `SigmaOracle.sol` | Fair value, edge, break-even — the public good | ✅ 11 tests |
| `SigmaCron.sol` | Window-boundary refresh handler | ✅ 4 tests |
| `ec-sigma bot` | Reads oracle, quantizes, trades, claims | 🔶 Quantize + read done; strategy NOT built |
| `Edge Radar` | Next.js frontend showing fair value vs book | 🔶 Screen 1 done; Screens 2-4 NOT built |

### Data Flow for One Window

1. BTC spot pool emits `MarkPriceUpdated` → Reactivity invokes `SigmaReactiveVol.onEvent` → `RealizedVol` folds it into EWMA. Continuous, unattended.
2. Window opens. `SigmaCron` fires, calls `SigmaOracle.refreshAll()`, then schedules its own next invocation.
3. `SigmaOracle` reads σ from `RealizedVol`, opening price from registry, live book from pool (`getBookLevels`), computes fair probability, edge, break-even. Publishes on-chain.
4. `ec-sigma` bot polls the oracle, gates on on-chain market status == Trading, and if `|edge| ≥ minEdgeBps` sizes by capped Kelly.
5. Price quantized to venue tick grid via `ec-core`, submitted with `placeLimit()`.
6. Window expires. `maybeClaim()` redeems. Track record records predicted edge vs realised outcome.

---

## 5. Repository Layout

```
somnia-sigma/
├── contracts/                    Solidity — pricing, volatility, oracle, cron, reactivity bridge
│   ├── libraries/BinaryPricer.sol
│   ├── RealizedVol.sol
│   ├── SigmaReactiveVol.sol
│   ├── SigmaWindowRegistry.sol
│   ├── SigmaOracle.sol
│   ├── SigmaCron.sol
│   ├── interfaces/IEventContractVenue.sol
│   ├── somnia/ISomniaReactivity.sol
│   ├── mocks/                    MockBinaryPool, MockEventContractVenue, MockRevertingOracle
│   ├── test/BinaryPricerHarness.sol
│   ├── ReactivityProbe.sol       Diagnostic probe
│   └── ReactivityProbeV2.sol     Ungated diagnostic probe
├── test/                         Hardhat test suite (103 passing)
│   ├── BinaryPricer.test.ts
│   ├── RealizedVol.test.ts
│   ├── SigmaReactiveVol.test.ts
│   ├── SigmaOracle.test.ts
│   ├── SigmaWindowRegistry.test.ts
│   ├── SigmaCron.test.ts
│   └── vectors/binary_pricer.json  SciPy golden vectors
├── reference/                    SciPy reference pricer
│   └── pricer_reference.py
├── scripts/                      Deploy, subscribe, balance-check, diagnostics
│   ├── deploy.ts                 Hardhat deploy
│   ├── deploy-live.mjs           Direct-solc deploy
│   ├── fallback-price-pusher.mjs Off-chain price feed (reactivity fallback)
│   ├── compile-artifacts.mjs     Direct-solc compilation
│   ├── balances.mjs              Wallet balance checker
│   ├── verify-unattended.mjs     Unattended proof checker
│   └── (14 more scripts)
├── deployments/                  Address book
│   └── somniaTestnet.json
├── bot/                          ec-sigma strategy (Bot Kit workspace)
│   ├── src/quantize.mjs          Tick-grid quantization (10/10 tests)
│   ├── src/client.mjs            Read-only SDK client (no signing)
│   └── src/quantize.test.mjs
├── frontend/                     Next.js Edge Radar
│   ├── app/page.tsx              Screen 1 (Edge Radar)
│   ├── lib/chain.ts              Contract reads via viem
│   ├── lib/pricer.ts             Client-side Φ(d₂)
│   ├── lib/backtest-data.ts      Backtest calibration data
│   └── lib/sample-data.ts        Fallback sample data
├── backtest/                     Historical replay
│   ├── pricer.mjs                TS pricer port (45/45 vectors matched)
│   ├── run-backtest.mjs          Window reconstruction + calibration
│   ├── fetch-data.mjs            Live data fetch from price-feed indexer
│   ├── validate-pricer.mjs       Golden vector validation
│   ├── RESULTS.md                Calibration findings
│   └── results.json              Machine-readable output
├── brand/                        Logo assets
├── docs/                         16 documentation files
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   ├── VALUE.md
│   ├── RESEARCH.md
│   ├── INTEGRATION.md
│   ├── DEPLOYMENT.md
│   ├── DEPLOYMENT-LEDGER.md
│   ├── STATUS.md
│   ├── CHECKLIST.md
│   ├── BRAND.md
│   ├── SDK-NOTES.md
│   ├── OVERVIEW.md
│   ├── FEEDBACK.md
│   ├── TELEGRAM-DRAFT.md
│   ├── RELEASE-CHECKLIST.md
│   └── superpowers/plans/        9 phase plans (00-MASTER through 08-phase9)
├── FINDINGS.md                   Internal lab notebook (gitignored)
├── MISTAKES.md                   Process lessons (gitignored)
├── hardhat.config.ts
├── package.json
├── .env                          Secrets (gitignored)
├── .gitignore
├── VERSION                       0.2.0-dev
├── CHANGELOG.md
├── README.md
└── REFERENCE.md                  This file
```

---

## 6. Build Status

### Phase Progress

| Phase | Deliverable | Status |
|---|---|---|
| P0 | Research, SDK and feed verification | ✅ Complete |
| P1 | BinaryPricer + golden vectors | ✅ 65 tests, SciPy-validated, TS port matched |
| P2 | RealizedVol + reactive bridge | ✅ Code complete + tested; live push delivery broken |
| P3 | Window registry + fair-value oracle | ✅ Code + 11 tests |
| P4 | Cron sweep handler | ✅ Code + 4 tests; no on-chain self-rescheduling |
| P5 | Deployment + evidence | ✅ 5/5 deployed; first real fair value published |
| P6 | ec-sigma Bot Kit strategy | 🔶 Quantize + read done; **strategy NOT built** |
| P7 | Edge Radar frontend | 🔶 Screen 1 done; **Screens 2-4 NOT built** |
| P8 | Historical replay/backtest | ✅ Substantially complete; calibration curve produced |
| P9 | Demo and submission package | ⬜ Not started |

### What Works Right Now

1. **On-chain oracle** — `SigmaOracle.refresh()` produces real fair values. First result: 68.44% fair vs 67.90% book → +54 bps edge.
2. **Fallback price feed** — `scripts/fallback-price-pusher.mjs` polls MarkPriceUpdated every 20s and pushes to RealizedVol. Working, sampleCount climbing.
3. **Bot read path** — `bot/src/client.mjs` reads real markets, real opening prices, real spot, real order books from Shannon.
4. **Bot quantization** — `bot/src/quantize.mjs` converts floats to venue tick grid. 10/10 tests pass.
5. **Frontend Screen 1** — Edge Radar reads real contracts, renders honest empty/not-ok state.
6. **Backtest** — 3,000 real BTC candles, ~230 independent windows, calibration curve produced.

### What's Blocked

1. **Reactivity push delivery** — 6 subscriptions tried, all delivered zero callbacks. Fallback path adopted. Not the original design.
2. **STT balance** — Both wallets nearly empty (~0.0002 STT). Need faucet before any on-chain operations.
3. **Bot strategy logic** — Edge/Kelly/decision/maker-seeding/claim. Not built.
4. **Frontend Screens 2-4** — Window detail, track record, backtest display.
5. **Demo video + submission** — Not started.

---

## 7. Key Findings & Corrections

### Critical Corrections

1. **`OracleHub` emits no price event** — It's a question-resolution hub. The subscribable feed is `MarkPriceUpdated` on the spot pools. Corrected in 8 docs.

2. **Shannon binary markets are no longer illiquid** — All 4 live BTC markets have real two-sided books. "Seed an empty market" demo narrative may not apply.

3. **`strike` field is `"0"` on market rows** — The real opening price lives on the oracle's reference question, fetched via `getOpeningPrices()`. The `SigmaWindowRegistry` exists to carry this off-chain fact on-chain.

4. **`eth_getLogs` topics filter not reliably enforced** — 262 of 286 "filtered" results had a different `topics[0]` than requested. Must re-check client-side.

5. **`isGuaranteed` defaults to `false`** in SDK's friendly `subscribe()` wrapper. Must use `subscribeRaw()` with explicit `isGuaranteed: true`.

6. **≥32 SOMI requirement applies to ALL subscriptions** — Not just cron. Found in official tutorial after scoped it to cron only in our docs.

7. **Opening price scale is 1e2, spot scale is 1e18** — Must normalize before computing ln(S/K). Scale guard rejects implausible ratios.

8. **`placeOrder` is now `payable` and pulls funds automatically** — No separate deposit step. Old `placeTakerOrderWithoutVault` is removed.

### The Reactivity Problem (Summary)

Six subscriptions across two owners, two fee tiers, isGuaranteed true/false, gated and ungated handlers — all delivered zero callbacks despite the source feed firing continuously. Every cheap, checkable variable eliminated. Root cause unknown. Recommendation: ask Somnia's dev channel, don't keep guessing.

### The Backtest Finding (Calibration)

- **Well-calibrated mid-distribution** (decile 4: predicted 0.4124, realized 0.4235)
- **Overconfident in tails** (decile 0: predicted 0.0021, realized 0.1406; decile 9: predicted 0.9960, realized 0.9146)
- This is the **documented zero-drift GBM fat-tail limitation**, now measured rather than asserted
- Brier score: 0.207, improves toward expiry (0.26 → 0.11)

---

## 8. What Needs Building

### Priority 1 — Bot Strategy (`bot/src/strategy.mjs`)

Edge threshold check → capped Kelly sizing → order construction → DRY_RUN logging.

```
Input:  fairValue from SigmaOracle, book price from SDK, market info
Output: { side: "buy"|"sell", size: number, price: number, edge: number, kelly: number }

Logic:
  1. Read SigmaOracle.getFairValue(marketId)
  2. If !ok → skip
  3. Read book price from getBookTops
  4. Compute edge = fairProb - bookPrice
  5. If |edge| < MIN_EDGE_BPS → skip
  6. Size = min(kelly * bankroll, MAX_STAKE)
  7. Quantize price to tick grid
  8. Log or place order
```

### Priority 2 — Market Read Entry (`bot/src/marketRead.mjs`)

Read-only script that lists live markets, reads oracle, shows edge. No signing.

### Priority 3 — DRY_RUN Runner (`bot/run-dry-run.mjs`)

Full bot loop in DRY_RUN mode. Logs what it would do.

### Priority 4 — Cron Armer (`scripts/arm-cron.mjs`)

Calls `SigmaCron.setNextScheduledMs()` and schedules via `scheduleSubscriptionAtTimestamp`.

### Priority 5 — Frontend `.env.local`

```
NEXT_PUBLIC_CHAIN_ID=50312
NEXT_PUBLIC_RPC=https://dream-rpc.somnia.network
NEXT_PUBLIC_DREAMDEX_REST=https://stg.api.dreamdex.io/v0
NEXT_PUBLIC_DREAMDEX_WS=wss://stg.api.dreamdex.io/v0/ws/public
```

---

## 9. SDK API Quick Reference

### Key SDK Methods (from @somnia-chain/markets-sdk)

```typescript
// Discovery
exchange.loadMarkets(true)                    // all markets, including binary
exchange.listBinaryMarkets({ venueId })       // binary markets only

// Market info
exchange.client.getMarketOnchain(marketId)    // live on-chain status (1 = Trading)
exchange.client.getOpeningPrices(marketIds)   // off-chain opening prices (1e2 scale)
exchange.fetchPrice("BTC")                    // live spot (1e18)

// Order book
exchange.fetchOrderBook(upSymbol, depth)      // { asks: [[price, qty]], bids: [[price, qty]] }
exchange.client.getBookTops(marketIds)        // top-of-book for multiple markets

// Trading
exchange.createOrder(symbol, "limit", side, shares, price, opts)
// opts: { timeInForce: "IOC"|"GTC", builder: "0x...", builderFeeBpsTimes1k: 0n }
// placeOrder: bool isBid, uint64 userData, uint256 price, uint256 quantity,
//             uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption,
//             address builder, uint96 builderFeeBpsTimes1k

// Settlement
exchange.listPastBinaryMarkets({ venueId })   // recently settled
exchange.getClaimable(markets)                // claimable winnings
```

### Critical Gotchas

1. **Prices are Up probabilities in (0, 1)** — NOT dollar amounts
2. **`strike` is `"0"` on market rows** — use `getOpeningPrices()` instead
3. **Opening price scale: 1e2** — e.g., BTC at $79,000 → `"7900000"`
4. **Spot price scale: 1e18** — always from `fetchPrice()` or pool's `markPrice`
5. **`placeOrder` is `payable`** — auto-pull from wallet, no deposit needed
6. **Reverted writes throw** in SDK ≥0.28.0 — catch or let propagate
7. **`VENUE_ID` drifts** — verify against live rows if bot finds no markets
8. **`MM_QUOTE_SIZE <= MM_INVENTORY`** — sell side escrows real outcome tokens
9. **Builder fee disabled on testnet** — `maxBuilderFeeBpsTimes1k = 0`
10. **Markets die on schedule** — track successor via market list, scan recently settled for claims

---

## 10. Environment Variables

### `.env` (root)

```bash
SOMNIA_TESTNET_RPC=https://dream-rpc.somnia.network
DEPLOYER_PRIVATE_KEY=<throwaway key>
PRIVATE_KEY=<bot key, separate from deployer>
NETWORK=testnet
```

### Bot env (from DEPLOYMENT.md)

```bash
NETWORK=testnet
PRIVATE_KEY=<bot key>
VENUE_ID=0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c
DRY_RUN=true
AUTO_CLAIM=true
SIGMA_ORACLE=0xe4c7be7dca5f536cfb18df61b01f3a952e902270
SIGMA_MIN_EDGE_BPS=200
SIGMA_MAX_STAKE=25
```

### Frontend env

```bash
NEXT_PUBLIC_CHAIN_ID=50312
NEXT_PUBLIC_RPC=https://dream-rpc.somnia.network
NEXT_PUBLIC_DREAMDEX_REST=https://stg.api.dreamdex.io/v0
NEXT_PUBLIC_DREAMDEX_WS=wss://stg.api.dreamdex.io/v0/ws/public
```

---

## 11. First Live Fair Value (Proof of Concept)

**Date:** 2026-08-27
**Market:** 24h BTC window, `marketId 0x...a8cd`
**Opening price:** `79023.52` (real, from `getOpeningPrices()`)

```json
{
  "fairProbBps": 6844,
  "impliedProbBps": 6790,
  "edgeBps": 54,
  "breakEvenBps": 6790,
  "kellyWad": "0.01682...",
  "sigmaWad": "0.02828...",
  "tauWad": "0.41334...",
  "reason": 0,
  "ok": true
}
```

**Honest read:** Modest +54 bps edge on a 24h window with 41% remaining. Mid-window, not near-expiry where edge should be largest. σ based on ~10 minutes of real data. Both facts worth stating plainly.

**Transactions:**
- Publish: `0xe8e2cd0411d0ee3f058c8876a494464c197904cc6b89067ab15abdfad65c636f`
- Refresh: `0x343baec8e30315a2127df232031b7aa8a485e27abb5e803290d5481ab1b072ad`

---

## 12. Running Tests

```bash
# Full suite
npm install
npx hardhat test

# Individual
npx hardhat test test/BinaryPricer.test.ts
npx hardhat test test/RealizedVol.test.ts
npx hardhat test test/SigmaOracle.test.ts
npx hardhat test test/SigmaCron.test.ts

# Bot quantization
cd bot && node --test src/*.test.mjs

# Backtest pricer validation
cd backtest && node validate-pricer.mjs

# Python golden vectors
python reference/pricer_reference.py
```

---

## 13. Submission Checklist

- [ ] Working prototype on testnet (✅ oracle works; 🔶 bot needs strategy)
- [ ] Public GitHub repo
- [ ] 2–3 minute demo video
- [ ] README states what is live vs mocked
- [ ] Model limits stated (zero-drift GBM, fat tails)
- [ ] `.env` not committed, no private keys in repo or video
- [ ] License present (MIT)
- [ ] SDK/docs feedback report
- [ ] Hardhat tests fully green
- [ ] Deployed addresses in README match `deployments/somniaTestnet.json`
