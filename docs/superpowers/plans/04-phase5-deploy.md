# Phase 5 — Testnet Deploy + Unattended Proof ⭐

**Goal:** get Sigma running on Somnia Shannon and prove — with evidence, not
assertion — that volatility accumulates on-chain with nothing of ours running.

**Depends on:** Phase 4 · **Blocks:** Phases 6, 7, 8
**This is the make-or-break phase.** Every other phase can be cut back. This one
either works or the central claim of the submission is false.

---

## Preconditions

| Item | Value |
|---|---|
| Chain | Somnia Shannon, **50312** |
| RPC | `https://dream-rpc.somnia.network` *(verified: `eth_chainId` → `0xc488`)* |
| Deployer | `0x0dDb3093df73Ca59F33420670125e0C686c0A468` — 50 STT, 500 tUSDC |
| Bot | `0x7F8F17738f2901D291e465249a177F009E582ad9` — 50 STT, 500 tUSDC |
| Faucet | 24h cooldown — **re-claim daily from here on** |

- [ ] `npx hardhat test` fully green before deploying anything
- [ ] `node scripts/balances.mjs` confirms funds

---

## Task 5.1 — Deploy

**File:** `scripts/deploy.ts` → writes `deployments/somniaTestnet.json`

Order (dependencies first):

1. `RealizedVol(owner, writer=deployer)`
2. `SigmaReactiveVol(realizedVol, owner)` → `realizedVol.setWriter(reactive)`
3. `SigmaWindowRegistry(owner, publisher)`
4. `SigmaOracle(realizedVol, registry, owner)`
5. `SigmaCron(oracle, owner)`

- [ ] Every address written to `deployments/somniaTestnet.json` — **the single
      address book** that the bot and frontend both read. Nothing hard-codes an
      address anywhere else
- [ ] Record deploy tx hashes
- [ ] Re-run `balances.mjs` and record the STT spent on deployment

---

## Task 5.2 — Fund and subscribe

`SigmaReactiveVol` pays its **own** handler gas as subscription owner. An
unfunded handler simply stops being invoked — silently.

- [ ] Send STT to `SigmaReactiveVol` (start ~10 STT, then measure)
- [ ] `mapEmitter(BTC pool, topic0, assetKey)`
- [ ] `subscribeTo(...)` — 210,000 gas

```
BTC pool  0x3605f28aa7c50e7441211e77cb0762d49539326c
topic0    0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888
```

- [ ] Record the returned `subscriptionId` and the tx hash
- [ ] **BTC only.** ETH doubles the burn and adds nothing to the story

---

## Task 5.3 — THE PROOF

**File:** `scripts/verify-unattended.mjs`

This is the artefact the whole submission rests on.

1. Read `sampleCount(BTC)`, `varianceRateWad`, `lastPriceWad`, block, timestamp
2. **Stop. Run nothing. Wait 10+ minutes.**
3. Read all of it again

**Pass condition:** `sampleCount` has climbed **with no process of ours
running**.

- [ ] Record both readings verbatim, with timestamps and block numbers
- [ ] Save to `docs/evidence/unattended-proof.md`
- [ ] Screen-record the second reading for the demo video
- [ ] Confirm `sigmaWad(BTC)` reports `ok = true` once past `MIN_SAMPLES`
- [ ] Sanity-check σ against BTC's realistic 15-minute volatility — a number
      that is merely *non-zero* is not evidence it is *right*

> **Do not write, say, or record the claim "runs unattended" until this number
> has been observed climbing on its own.** If it has not, the honest move is to
> report that and fall back — not to soften the wording.

**If `sampleCount` does not move:** check, in order — handler balance; `topic0`
matches a real log; emitter address; subscription is live via
`somnia_reactivityGetSubscriptionInfo`; `RealizedVol.writer` is the handler.

---

## Task 5.4 — Measure the burn

The number that decides whether "continuous" is honest.

- [ ] Handler balance before, and after 1 hour
- [ ] Derive STT/hour and STT/day
- [ ] Project against 50 STT and the 24h faucet cap

| Result | Action |
|---|---|
| Runs for days | Claim continuous operation |
| Runs for hours | Claim it, state the funding requirement |
| Drains in minutes | Add the move threshold, reduce scope, **and say so** |

- [ ] Record in `docs/evidence/gas-burn.md`

---

## Task 5.5 — Publish real windows

First end-to-end fair value on live data.

- [ ] `scripts/publish-windows.mjs`: `listLiveBinaryMarkets({ venueId: 0x679795a0… })`
      → `getOpeningPrices()` → `publishWindows()`
- [ ] **Filter to venue operator 2.** Operator 4 is a fixed-strike test series;
      pricing it would be pricing the wrong instrument
- [ ] Assert every `openingPrice != 0` before publishing — the `strike: "0"` trap
- [ ] `oracle.refreshAll()`, then read `getFairValue` for a real market
- [ ] **Verify against the SciPy reference off-chain.** Same inputs must give the
      same number. This is the on-chain/off-chain agreement check
- [ ] Record a real published fair value in `docs/evidence/`

---

## Task 5.6 — Arm the cron

- [ ] Fund `SigmaCron`
- [ ] `scheduleNext()`
- [ ] Wait one boundary; confirm the sweep fired **and rearmed**
- [ ] Record tx hashes
- [ ] If unaffordable, switch to the off-chain fallback **and update the README
      in the same commit-worthy change** — never let an aspirational claim
      outlive the fallback

---

## Exit criteria

- [ ] All five contracts deployed; addresses recorded
- [ ] **`sampleCount` observed climbing unattended** ← the phase
- [ ] σ reports ok and is sanity-checked for magnitude
- [ ] Burn rate measured and recorded
- [ ] Real windows published from the live indexer, `openingPrice != 0`
- [ ] On-chain fair value matches the SciPy reference for identical inputs
- [ ] Cron fired and rearmed, **or** the fallback is documented
- [ ] Evidence files written

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Subscription never fires | **Critical** | Diagnostic order in 5.3; `topic0` already validated against a real log |
| Handler drains STT | **High** | Measured in 5.4; move threshold; daily faucet re-claim |
| `VENUE_ID` has drifted | Medium | Moved 3× in one week. Verify against live rows before publishing; fail loudly |
| No live windows on the real venue | Medium | Check early. If empty, Phase 6 seeding creates activity and replay carries the edge claim |
| Cron unaffordable | Medium | Documented fallback; the volatility proof is independent and is the headline |
| On-chain and SciPy disagree | **High** | Would mean a fixed-point or scale bug. **Stop and fix before proceeding** — every downstream number inherits it |

---

## Why this phase is the demo

The judge sees a number that went up while nobody was running anything. No
server, no keeper, no bot — a contract subscribed to a price feed and did the
maths itself.

That is not a claim about Somnia. It is a demonstration of it, and it is the
part of the submission no competing entry can show.
