# Sigma — End-to-End Development & Deployment

How this project gets built, run, deployed, and submitted. Written so a second
engineer with no context can execute it.

**Repo root:** `D:\somnia-sigma` (on `D:`, never the OneDrive-synced Desktop —
`node_modules` on a synced folder is sync poison)
**Target chain:** Somnia Shannon **testnet, chain ID 50312**

---

## 1. Where everything lives

```
D:\somnia-sigma\
├─ docs\
│  ├─ RESEARCH.md            fact base, cross-verified, with source grades
│  ├─ DESIGN.md              architecture spec (v2)
│  ├─ BRAND.md               name, tagline, icon, mission, vision, pitch
│  ├─ DEPLOYMENT.md          this file
│  └─ superpowers\plans\     task-by-task implementation plans
├─ contracts\
│  ├─ libraries\BinaryPricer.sol
│  ├─ interfaces\IEventContractVenue.sol
│  ├─ somnia\ISomniaReactivity.sol
│  ├─ mocks\MockEventContractVenue.sol
│  ├─ RealizedVol.sol
│  ├─ SigmaReactiveVol.sol
│  ├─ SigmaOracle.sol
│  └─ SigmaCron.sol
├─ test\                     Hardhat tests + test\vectors\ (SciPy golden values)
├─ reference\                pricer_reference.py — SciPy source of truth
├─ scripts\                  deploy.ts, subscribe.ts, verify-oracle.ts
├─ deployments\              somniaTestnet.json — address book
├─ bot\                      ec-sigma strategy (Bot Kit workspace)
├─ frontend\                 Next.js Edge Radar
└─ .venv\                    isolated Python (never the PATH python)
```

**Three environments, one chain.** Local Hardhat for unit tests; Somnia testnet
50312 for everything real; mainnet is **never** a deploy target during the
hackathon.

---

## 2. Prerequisites

| Tool | Version | Status on this machine |
|---|---|---|
| Node | 24.14.1 | ✅ installed |
| npm | 11.11.0 | ✅ installed |
| git | 2.53.0 | ✅ installed |
| Python | 3.11.15 | ✅ installed — **use a project venv, not the PATH python** |
| Foundry | — | ❌ not installed; **Hardhat is the toolchain**, no action needed |

**Accounts and funds**

1. Deployer EOA private key → `.env` as `DEPLOYER_PRIVATE_KEY`. Use a
   throwaway key. Never commit `.env`.
2. **STT** from the faucet at `testnet.somnia.network` — pays gas, funds the
   reactivity subscription, and covers handler gas.
3. **tUSDC** (`0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E`) — collateral for
   Event Contract orders.
4. A **separate** key for the bot. Never run two bots on one key — the Bot Kit
   serialises claims per key and concurrent bots cause nonce races.

> Cron subscriptions are documented to require **at least 32 SOMI** funded in the
> owning EOA. Confirm the testnet-STT equivalent before relying on `SigmaCron`;
> if the faucet cannot supply it, fall back to an off-chain scheduled
> `refreshAll()` call and say so plainly in the README rather than claiming
> unattended operation that is not happening.

---

## 3. Phase 0 — RESOLVED

The blocking unknown was: *does `OracleHub` emit a price event that Reactivity
can subscribe to?*

**Answer: no.** Verified against live chain logs on 2026-08-27. `OracleHub`
emits no price event at all — it is a question-resolution hub whose richest
event, `AnswerDelivered`, carries a YES/NO payout vector and fires only on the
~12-minute market-roll cycle.

**The subscribable BTC/ETH price feed is `MarkPriceUpdated`, on the dreamDEX
spot pools:**

```
event MarkPriceUpdated(address indexed asset, uint256 markPrice, uint256 rawMidpoint)
topic0    0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888
BTC pool  0x3605f28aa7c50e7441211e77cb0762d49539326c   (WBTC:USDso)
ETH pool  0xd180195da5459c7a0dea188ed61216ec43682b50   (WETH:USDso)
```

`markPrice` is 1e18 regardless of token decimals; measured cadence is ~1 update
per asset every ~2 seconds. One pool serves one asset, so the `emitter` filter
alone disambiguates.

Order-book derived, not a signed attestation — cross-checked against the perp
`FundingUpdated.indexPrice` at **0.12%** apart on BTC. Stated in the README, not
hidden.

Other live checks, all passing:

```bash
curl -s -X POST https://dream-rpc.somnia.network   -H 'content-type: application/json'   -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
# {"result":"0xc488"}  -> 50312

node scripts/balances.mjs      # deployer + bot: 50 STT, 500 tUSDC each
```

Full measured detail: `INTEGRATION.md`.

---

## 4. Phase 1 — contracts (local)

```bash
cd /d/somnia-sigma
npm init -y
npm install --save-dev hardhat@^3 @nomicfoundation/hardhat-toolbox-viem typescript ts-node @types/node dotenv
npm install solady

python -m venv .venv
./.venv/Scripts/python.exe -m pip install --upgrade pip scipy
./.venv/Scripts/python.exe reference/pricer_reference.py   # golden vectors

npx hardhat test
```

Follow `docs/superpowers/plans/00-MASTER-PLAN.md` and the per-phase plans. Strict
TDD: write the failing test, watch it fail, implement, watch it pass.

**Gate:** the whole suite green, with `BinaryPricer` matching SciPy, before
anything is deployed.

---

## 5. Phase 2 — deploy to testnet

```bash
npx hardhat run scripts/deploy.ts --network somniaTestnet
```

Deployment order (dependencies first):

1. `RealizedVol(owner)`
2. `SigmaReactiveVol(realizedVol, owner)` → `realizedVol.setWriter(reactive)`
3. `SigmaOracle(realizedVol, venue, owner)`
4. `SigmaCron(oracle, owner)`

Writes `deployments/somniaTestnet.json` — the single address book that the bot
and the frontend both read. Nothing hard-codes an address anywhere else.

**Then fund and subscribe:**

```bash
# SigmaReactiveVol pays its own handler gas as subscription owner
cast send <SigmaReactiveVol> --value 1ether        # or the viem equivalent
npx hardhat run scripts/subscribe.ts --network somniaTestnet
```

`subscribe.ts` calls `subscribeTo(<BTC spot pool>, topic0, assetKey, ...)` —
210,000 gas, charged to the sender.

```
BTC pool  0x3605f28aa7c50e7441211e77cb0762d49539326c
topic0    0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888
```

### 5.1 The proof that matters

```bash
npx hardhat run scripts/verify-oracle.ts --network somniaTestnet
```

Read `RealizedVol.sampleCount(underlying)`, wait, read it again. **If it has
climbed with no process of ours running, the central technical claim is true.**

Record the transaction hash and both readings. This is the single most
persuasive artefact in the demo video. Do not claim it until the number has
actually moved on its own.

---

## 6. Phase 3 — the bot (`ec-sigma`)

```bash
git clone https://github.com/somnia-chain/dreamdex-bot-kit
cd dreamdex-bot-kit && npm install
cp .env.example .env
npx tsx scripts/doctor.ts        # read-only setup check
```

`.env`:

```
NETWORK=testnet
PRIVATE_KEY=<bot key, NOT the deployer key>
VENUE_ID=0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c
DRY_RUN=true
AUTO_CLAIM=true
SIGMA_ORACLE=<address from deployments/somniaTestnet.json>
SIGMA_MIN_EDGE_BPS=200
SIGMA_MAX_STAKE=25
```

> **`VENUE_ID` moves.** It changed three times in the first week of August. If
> the bot reports no markets, re-read it from live market rows before debugging
> anything else.

`ec-sigma` loop, in order:

1. `loadMarkets()` → candidate windows
2. **Gate on `tradingStart <= now < expiry`** — indexer status is unreliable alone
3. Read `SigmaOracle.getFairValue(marketId)`; skip unless `ok`
4. Skip unless `|edgeBps| ≥ SIGMA_MIN_EDGE_BPS`
5. Size by capped Kelly, bounded by `SIGMA_MAX_STAKE`
6. **`quantize()` the price to the venue tick grid** — never pass a float
7. `placeLimit(price, size, side, expireTimestampNs)` with Sigma as `builder`
8. `assertTxOk(...)` — reverted writes do not throw
9. `maybeClaim()` — winnings are claimed, not received

**Run `DRY_RUN=true` until the logged orders look right. Only then set false.**

```bash
npm start -w ec-sigma
npm run backtest -- run ec-sigma --days 7        # evidence
```

---

## 7. Phase 4 — Edge Radar

```bash
cd frontend && npm install && npm run dev
```

Reads `deployments/somniaTestnet.json` for addresses, `SigmaOracle` over viem
for fair values, and the dreamDEX REST/WS endpoints for books.

```
NEXT_PUBLIC_CHAIN_ID=50312
NEXT_PUBLIC_RPC=https://dream-rpc.somnia.network
NEXT_PUBLIC_DREAMDEX_REST=https://stg.api.dreamdex.io/v0
NEXT_PUBLIC_DREAMDEX_WS=wss://stg.api.dreamdex.io/v0/ws/public
```

> WS path is ambiguous between sources — try `/v0/ws/public`, fall back to
> `/ws/public`. Not a bug.

**Deploy:** Vercel, or Hostinger via the MCP tooling already connected to this
session. A public URL is not required for submission but materially helps the
UX and Presentation scores. Static export works — there is no server component.

---

## 8. Phase 5 — submission

**Required**

- [ ] Working prototype **on testnet**
- [ ] Public GitHub repo
- [ ] **2–3 minute** demo video

**Optional but worth it**

- [ ] Deck (`BRAND.md` §7 is the script)
- [ ] **SDK/docs feedback report** — explicitly invited, cheap to write, and we
      have real material: the `InvalidPrice` float trap, `VENUE_ID` drift, the
      testnet WS path ambiguity, and the `ec-oracle-follow` spot-price gap.
      Almost nobody will submit this.

**Video structure** — timings in `BRAND.md` §7. Record the live testnet run,
not a mock. Show a loss as well as a win.

**Pre-submission checks**

- [ ] `npx hardhat test` fully green
- [ ] Deployed addresses in the README match `deployments/somniaTestnet.json`
- [ ] README states plainly what is live vs mocked — overstating is the fastest
      way to lose a judge's trust
- [ ] Model limits stated (zero-drift GBM, fat tails)
- [ ] `.env` not committed; no private keys in the repo or the video
- [ ] Repo public, license present

---

## 9. Timeline

12 days. Contracts are front-loaded because everything else depends on them.

| Days | Phase | Exit condition |
|---|---|---|
| 1 | Phase 0 + repo setup | `OracleHub` question answered; RPC verified; suite runs |
| 2–3 | `BinaryPricer` + SciPy vectors | Math provably matches SciPy |
| 4 | `RealizedVol` + adapter/mock | Volatility converges on known series |
| 5 | `SigmaReactiveVol` + deploy + subscribe | **`sampleCount` climbing unattended** |
| 6 | `SigmaOracle` + `SigmaCron` | Fair values published on-chain |
| 7–8 | `ec-sigma` (DRY_RUN → live) | Real testnet order, correctly quantized |
| 9–10 | Edge Radar | Live fair value vs book on screen |
| 11 | Backtest + README + feedback report | Evidence assembled |
| 12 | Video + submit | Submitted before 2026-09-08 23:30 |

**Slack:** stages 12–14 (bot, UI, backtest) can each degrade without breaking
the submission. Stages 1–11 cannot — the on-chain fair value is the product.

---

## 10. What to do if something goes wrong

| Symptom | First thing to check |
|---|---|
| Bot reports no markets | `VENUE_ID` — it drifts. Verify against live rows. |
| `InvalidPrice` on order | Float price reached the SDK. Use `quantize`/`placeLimit`. |
| Order "succeeded" but nothing happened | Reverted write that did not throw. Add `assertTxOk`. |
| `sampleCount` not climbing | Subscription unfunded, wrong `topic0`, or `OracleHub` emits nothing (Phase 0). |
| Fair value always not-ok | Below `MIN_SAMPLES`, or σ stale beyond the bound. Both are correct refusals. |
| Winnings missing | Not claimed. `CLAIM=1 npm start -w ec-settlement`. |
| Contracts do not compile | `viaIR` is on for stack depth; Solidity pinned at 0.8.28. |
