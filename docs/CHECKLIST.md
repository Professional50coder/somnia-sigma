# Sigma — Master Checklist

Consolidated, item-level tick state across all 9 phases, kept honest against
what has actually been *verified on-chain or in the test suite* — not what
was merely written. Updated after a round of four parallel fork agents plus
continued main-thread diagnosis. Compare against `docs/superpowers/plans/*.md`
for full task-level detail; this file is the fast scan.

**Legend:** ✅ done & verified · 🔶 built, not yet proven/tested · ⛔ blocked · ⬜ not started

---

## Phase 0 — Foundation & verification

- [x] ✅ Repo at `D:\somnia-sigma`, never the OneDrive-synced Desktop
- [x] ✅ RPC verified live: `eth_chainId` → `0xc488` = 50312
- [x] ✅ Two burner wallets generated locally, gitignored, funded (STT/tUSDC)
- [x] ✅ `@somnia-chain/markets-sdk@0.28.1` and `@somnia-chain/reactivity` installed, typings read directly
- [x] ✅ `BinaryMarket` schema recovered from SDK source, not docs
- [x] ✅ `OracleHub` investigated and ruled out as a price source
- [x] ✅ Real price feed located and validated against a live log (`MarkPriceUpdated`)

## Phase 1 — Pricing core (`BinaryPricer.sol`)

- [x] ✅ `normalCdf`, `probUp`, `edgeBps`, `breakEvenWinRateBps`, `kellyFractionWad` — 65 Solidity tests, SciPy-validated
- [x] ✅ **Now independently re-validated by a second, TypeScript implementation** (Phase 8 backtest) against the same golden vectors — three independent implementations agree, the strongest correctness claim in the project
- [x] ✅ Demo anchor reproduced: +0.3% w/ 10% window left → ~1278 bps edge vs a 0.70 book

## Phase 2 — Volatility engine + reactivity

- [x] ✅ `RealizedVol.sol` — EWMA variance per second, outlier rejection, staleness/min-sample guards, 18 tests
- [x] ✅ Stale tick-count scaler (`sigmaForWindowWad`) — confirmed already removed, no action needed
- [x] ✅ `SigmaReactiveVol.sol` — decode + forward, tested against impersonated precompile calls
- [x] ✅ Deployed live; `emitterAsset` mapping confirmed set correctly on-chain
- [ ] ⛔ **Live delivery not achieved, after exhaustive elimination.** Six subscriptions (2 owners × up to 3 fee/config variants), all correctly registered, all delivering zero callbacks. Every documented, checkable cause (topic/emitter/selector, `isGuaranteed`, fees, owner balance, sender semantics, handler logic) has been ruled out. See `FINDINGS.md` for the full trail. **Next step is external (ask Somnia's dev channel) or a fallback decision, not more self-serve trial and error.**

## Phase 3 — Fair-value oracle

- [x] ✅ `SigmaWindowRegistry.sol` — written, deployed, tested (3 tests)
- [x] ✅ `SigmaOracle.sol` — written, deployed, **and now fully tested (11 new tests this session)**: every not-ok reason, exact `edgeBps` identity, NoBook-but-fair-value-published, pool-revert resilience, event emission on every path, `refreshAll` surviving a reverting pool
- [x] ✅ On-chain book read (`getBookLevels`, 6dp→WAD scaling via `*1e12`) confirmed genuinely implemented and correctly tested, not just planned
- [x] ✅ Scale guard and not-ok reasons — all exercised in the new test suite

## Phase 4 — Self-rescheduling cron

- [x] ✅ `SigmaCron.sol` — written, deployed, **and now fully tested (4 new tests this session)**: precompile-only gate, sweep survives a reverting oracle, refreshed-count reporting, owner controls
- [ ] 🔶 **Design deviation from the original plan, confirmed deliberate, not a bug:** the deployed contract has **no on-chain self-rescheduling**. Its own doc comment states this is intentional, deferred "until the cron-precompile Solidity ABI is verified on Shannon" — scheduling is done off-chain via `scripts/arm-cron.mjs` instead. Update `docs/superpowers/plans/03-phase4-cron.md` and the pitch to reflect this honestly rather than claim a self-rescheduling design that isn't what's deployed.
- [ ] ⬜ Whether `scripts/arm-cron.mjs` has actually been run/armed — not yet checked this session.

## Phase 5 — Testnet deploy + unattended proof ⭐

- [x] ✅ All 5 contracts + 2 diagnostic probes deployed to Shannon, every address independently re-verified via `eth_getCode`
- [x] ✅ Writer wiring, emitter mapping — confirmed correct on-chain
- [x] ✅ Reactivity subscriptions registered on-chain with correct fields (confirmed via `getSubscriptionInfo`, not just tx success), across 6 configurations
- [ ] ⛔ **THE PROOF ITSELF: still not achieved.** This is the single most important open item in the project. See FINDINGS.md for the complete diagnostic trail and the recommendation (external escalation or fallback, not further guessing).
- [ ] ⬜ Gas burn rate — cannot be measured until delivery works
- [x] ✅ **Real window published and refreshed end-to-end — the phase's core exit criterion.** 24h BTC window, real opening price, fair value 68.44% vs. real live book 67.90%, +54 bps edge. Publish tx `0xe8e2cd04...`, refresh tx `0x343baec8...`, both success. Full detail in `FINDINGS.md`.

## Phase 6 — `ec-sigma` bot

- [x] ✅ **Quantization: 10/10 tests, exact `0.6237 → 0.624`**, pure BigInt math, no float trap possible
- [x] ✅ **Live read path confirmed working end-to-end** with a client that cannot sign: real markets, real opening prices (strike="0" trap confirmed exactly as documented), real spot, **real order books** (see the liquidity correction below)
- [ ] ⬜ Strategy skeleton (edge/threshold/Kelly decision logic) — not built
- [ ] ⬜ Maker/seeding mode — **narrative needs reconsidering**, see liquidity correction
- [ ] ⬜ Settlement/claim handling — not built
- [ ] ⬜ Track record logger — not built

### Correction discovered this session: Shannon binary markets are no longer illiquid
Earlier research found every live binary market with `lastPrice: null` and
empty books. **This is now stale.** All 4 live BTC markets currently have
real two-sided books. `docs/INTEGRATION.md` §11 updated. **Consequence:** the
planned demo moment ("Sigma seeds an empty market") may not be available at
filming time — the fallback narrative ("Sigma competes on an existing book,"
arguably the stronger claim) should be treated as equally likely to be the
one that's actually live. Re-check `getBookTops` close to filming, not now.

## Phase 7 — Edge Radar frontend

- [x] ✅ Next.js 15 scaffold, builds clean, viem-only
- [x] ✅ Design tokens per `docs/BRAND.md` §9; edge-color palette validated colorblind-safe via the dataviz skill's own script (not eyeballed)
- [x] ✅ **Screen 1 (Edge Radar) built and reads the real deployed contracts** — renders the honest empty/not-ok state (`openWindows()` → `[]`, `sampleCount` → `0`), independently re-confirming the Phase 2/5 reactivity gap via a third code path
- [ ] ⬜ Screen 2 (window detail) — not built, the honest priority gap (plan says 1 and 2 shouldn't be cut; 2 was)
- [ ] ⬜ Screens 3 (track record), 4 (backtest) — not built

## Phase 8 — Replay backtest

- [x] ✅ **Substantially complete.** TS pricer port validated against the same golden vectors as the Solidity (45/45 matched, max error 6.9e-8)
- [x] ✅ Real live data: 3,000 BTC M1 candles pulled from the dreamDEX price-feed indexer
- [x] ✅ λ correctly converted by half-life across the different bar cadence (the exact mistake flagged in the plan, avoided in practice)
- [x] ✅ Calibration curve produced: well-calibrated mid-distribution, **honestly overconfident in the tails** — Brier 0.207, log loss 0.743, improving toward expiry (0.26→0.11)
- [ ] ⬜ **Sample-size note to carry forward:** cite **~230 independent windows**, not the 5,620 correlated checkpoints, in any doc or pitch.
- [ ] ⬜ Threshold/policy simulation — attempted, **result invalid** (self-correlated simulated book), correctly discarded rather than reported. Needs a better synthetic-book design as follow-up.

## Phase 9 — Submission

- [ ] ⬜ Not started
- [ ] ⬜ Feedback report — real material now includes: `OracleHub` has no price event, the 32-SOMI subscription-owner requirement was under-scoped in our own first research pass, `ec-core`'s stale `MM_LOT` constant, the 1e2/1e18 opening-price/spot scale trap, builder fees disabled on testnet, and (pending resolution) a possible genuine reactivity-delivery gap on Shannon for event subscriptions specifically
- [ ] ⬜ README, video, repo hygiene — `README.md` and `docs/ARCHITECTURE.md` exist; need a final pass once Phase 6/7 land further

---

## What can proceed RIGHT NOW without waiting on the reactivity resolution

1. **Phase 6 strategy/maker logic** — the read path is confirmed live; only the decision/order-construction logic remains, and it can be built and DRY_RUN-tested against real read data today.
2. **Phase 7 Screens 2–4** — can be built against mock or replay data while live σ is unresolved.
3. **Phase 9 feedback report** — there's more than enough real material now.
4. **Deciding the Phase 6 demo narrative** (seed vs. compete) — a judgment call, not blocked on anything technical.

## What must NOT proceed until the reactivity blocker resolves or the fallback is adopted

- Any claim of "unattended operation" in any doc, video script, or pitch.
- Publishing real windows to `SigmaWindowRegistry` for demo purposes with the expectation that σ will be live — it won't be, without either a fix or the fallback.
- Any gas-burn-rate claim for the reactivity subscription (there's nothing to measure yet).
