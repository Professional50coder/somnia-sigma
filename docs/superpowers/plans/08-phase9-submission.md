# Phase 9 — Video, README, Submission

**Goal:** submit before **2026-09-08 23:30**.

**Depends on:** Phase 5 minimum; Phases 6–8 improve it
**15% of the rubric** is Presentation & Demo — and it gates how the other 85%
is perceived.

---

## Hard requirements

| Required | Status |
|---|---|
| Working prototype **on testnet** | Phase 5 |
| Public GitHub/GitLab/Bitbucket repo | Phase 9 |
| **2–3 minute** demo video | Phase 9 |

| Optional — and worth it | Why |
|---|---|
| Presentation deck | `BRAND.md` §7 is already the script |
| **SDK / docs feedback report** | Explicitly invited. **Almost nobody will submit one.** We have unusually good material |

---

## Task 9.1 — The feedback report ⭐ cheap, high-leverage

Explicitly invited by the organisers, and we found real issues by measurement
rather than opinion. **Write this — it costs an hour and very few teams will.**

**File:** `docs/FEEDBACK.md`

1. **`OracleHub` emits no price event.** The name strongly implies a price
   oracle; it is a question-resolution hub. Suggest renaming or documenting.
2. **`strike` is `"0"` on the real Up/Down venue.** The opening price is only
   reachable via `getOpeningPrices()`. Not documented; costs every integrator a
   day and produces `ln(S/0)` if missed.
3. **Strike is 1e2, price feed is 1e18.** The scale is on neither the row nor
   any exported constant. `scaleStrike`-style inference should not be necessary.
4. **`ec-core`'s `MM_LOT = 1` is stale.** Live pools report `1000`. Its comment
   that binary ticks are "NOT discoverable through the SDK" is out of date at
   0.28.1 — `getBinaryBookParams` exposes them.
5. **Builder fees revert on Shannon** (`maxBuilderFeeBpsTimes1k = 0`) with no
   documentation, so the mainnet revenue path cannot be tested before mainnet.
6. **`InvalidPrice` only reproduces on 18-decimal venues.** Shannon's 6dp
   collateral rounds it away, so the trap first appears in production.
7. **Testnet WS path ambiguity** — `/v0/ws/public` vs `/ws/public` across sources.
8. **Indexer URL is not exported** by the SDK; it exists only in prose.
9. **Contracts are not source-verified** on the explorer.

Each entry: what we expected, what happened, how we found it, suggested fix.
Factual, not complaining — this is the report of a team that read the code.

---

## Task 9.2 — README

**The trust document.** A judge reads it before anything else.

- [ ] One-liner: **"One line to beat. Sigma tells you the odds."**
- [ ] The problem in three sentences — no strikes, price is a probability,
      nothing tells you if it is right
- [ ] Architecture diagram
- [ ] **Deployed addresses**, chain 50312, matching `deployments/somniaTestnet.json`
- [ ] Quickstart: install, test, run
- [ ] **A "What is live vs seeded vs replayed vs mocked" table** — explicit, near
      the top
- [ ] Model limits: zero-drift GBM understates fat tails; σ from an order-book
      mark price, **not** a signed oracle attestation (0.12% from the perp index)
- [ ] Builder fees implemented but **not demonstrable on Shannon** (cap `0`)
- [ ] Evidence links: unattended proof, gas burn, calibration curve
- [ ] MIT licence

> Overstating is the fastest way to lose a judge. Every honest limitation stated
> here buys credibility for the claims that *are* strong.

---

## Task 9.3 — The video (2–3 min, hard limit)

Script and timings in `BRAND.md` §7.

| Time | Beat |
|---|---|
| 0:00–0:25 | **Problem.** No strikes, one line to beat. Price *is* a probability — pay 0.70, you need to be right 70% of the time. Nothing tells you if that is right |
| 0:25–0:50 | **Solution.** Fair value from volatility measured on-chain, ~2s cadence, no keeper |
| 0:50–1:30 | **Product.** Edge Radar. And it is on-chain — `ec-maker` quotes "around fair probability"; nothing tells it what that is. Sigma does |
| 1:30–2:30 | **Demo.** Live testnet. Window drifts off its line, fair value moves, book lags, edge opens. Order placed, quantized. Settles. Track record updates |
| 2:30–2:50 | **Vision.** Fair value as public infrastructure, not private edge |

**Must appear on camera**

- [ ] `sampleCount` climbing **unattended** — the strongest single artefact
- [ ] A real testnet transaction hash
- [ ] An empty market becoming two-sided after Sigma quotes
- [ ] **A loss.** Showing only wins reads as a sales pitch; showing a loss reads
      as a track record

**Must NOT appear**

- [ ] Any private key or recovery phrase in any frame
- [ ] `.env` contents, `wallet.md`, or `.secrets/`
- [ ] A claim not demonstrated in the recording

- [ ] Record at 1080p+, legible terminal font
- [ ] Watch it once muted — the visuals must carry the story alone

---

## Task 9.4 — Repo hygiene

- [ ] `npx hardhat test` fully green; paste the count in the README
- [ ] `git status` shows no `.secrets/`, no `.env`, no `wallet.md`
- [ ] `git log -p | grep -iE "0x[0-9a-f]{64}"` finds **no** private key in history
- [ ] Superseded plans clearly banner-marked
- [ ] README addresses match `deployments/somniaTestnet.json` exactly
- [ ] MIT licence present
- [ ] Repo made public

> **Nothing is committed without explicit instruction from the user.** This task
> prepares the tree; the user decides when it becomes a commit and when it goes
> public.

---

## Task 9.5 — Submit

- [ ] DoraHacks BUIDL: title **Sigma**, tagline **"One line to beat. Sigma tells
      you the odds."**
- [ ] Blurb — the one-sentence version from `BRAND.md` §2
- [ ] Repo link · video link · live Edge Radar URL
- [ ] Tags: DeFi, Event Contracts, Prediction Markets, Infra/API, Somnia
- [ ] Track: Open Track
- [ ] Attach deck + feedback report
- [ ] **Submit with hours to spare, not minutes** — the deadline is 23:30 and
      upload failures are common

---

## Exit criteria

- [ ] Prototype live on testnet
- [ ] Repo public, clean, no secrets in history
- [ ] Video 2–3 min, showing the unattended proof and a loss
- [ ] README states live vs seeded vs replayed
- [ ] Feedback report submitted
- [ ] Submitted before 2026-09-08 23:30

---

## Final self-check, against the rubric

| Weight | Criterion | Evidence we can point to |
|---|---|---|
| 25% | Technical Implementation | Bot Kit strategy on SDK 0.28.1; on-chain oracle; reactivity + Solidity cron; three implementations agreeing on SciPy vectors |
| 20% | Innovation & Originality | The only entry that prices the instrument; built on the "no strikes" property nobody else noticed |
| 20% | UX & Design | Edge Radar — fair value alive against a static book |
| 20% | Business & Ecosystem | Public good other builders read; builder-fee path implemented; **empty market made two-sided on camera** |
| 15% | Presentation & Demo | Unattended proof, real tx, a loss shown, calibration curve |

**The sentence to leave a judge with:**

> We didn't predict the market. We priced it — and gave the price away.
