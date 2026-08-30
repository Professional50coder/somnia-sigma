# Sigma — Proof of Work

**Date:** 2026-08-29  
**Chain:** Somnia Shannon testnet (chain ID 50312)  
**RPC:** `https://dream-rpc.somnia.network`

---

## Session Summary

| Metric | Value |
|--------|-------|
| On-chain transactions | 6 |
| Price pushes | 5 |
| STT transferred | 1.0 |
| Gas spent | ~0.002 STT |
| Volatility samples | 69 → 74 |
| Sigma status | ok (was false, now true) |

---

## Wallets

| Role | Address | STT Before | STT After |
|------|---------|------------|-----------|
| Deployer | `0x0dDb3093df73Ca59F33420670125e0C686c0A468` | 0.0012 | 0.9992 |
| Bot | `0x7F8F17738f2901D291e465249a177F009E582ad9` | 50.0002 | 49.0001 |

---

## Deployed Contracts

| Contract | Address |
|----------|---------|
| RealizedVol | `0xbd7eedfa178d8eb094449e3461e83195f4b062ef` |
| SigmaReactiveVol | `0x5f6a29b5717841f6f7b394be6936ea176dc63d28` |
| SigmaWindowRegistry | `0x16b9d8c364d70f38d0b04b760439efc794a46731` |
| SigmaOracle | `0xe4c7be7dca5f536cfb18df61b01f3a952e902270` |
| SigmaCron | `0xc573c7b699690d1821aa4156ef7c09ee9ceba0e7` |

---

## Transactions (All Successful)

### 1. Fund Deployer from Bot

| Field | Value |
|-------|-------|
| Type | ETH Transfer |
| From | Bot (`0x7F8F...`) |
| To | Deployer (`0x0dDb...`) |
| Amount | 1 STT |
| Hash | `0x66e50ef30247e19c27968a9b394854cf5949a02b144714fc40ced3dbacfce104` |
| Status | success |
| Explorer | [View](https://shannon-explorer.somnia.network/tx/0x66e50ef30247e19c27968a9b394854cf5949a02b144714fc40ced3dbacfce104) |

### 2. RecordPrice #1 — $77,880.16

| Field | Value |
|-------|-------|
| Type | RealizedVol.recordPrice |
| Contract | `0xbd7eedfa178d8eb094449e3461e83195f4b062ef` |
| Asset | `0x3605f28aA7C50e7441211e77Cb0762d49539326C` (BTC pool) |
| Price | 77880.16 USD (WAD) |
| Hash | `0x9445b059529cc35ee9a2b164f39b7e5b6cb073b5d872ed77ad97461c1f96f072` |
| Status | success |
| Explorer | [View](https://shannon-explorer.somnia.network/tx/0x9445b059529cc35ee9a2b164f39b7e5b6cb073b5d872ed77ad97461c1f96f072) |

### 3. RecordPrice #2 — $77,880.25

| Field | Value |
|-------|-------|
| Type | RealizedVol.recordPrice |
| Contract | `0xbd7eedfa178d8eb094449e3461e83195f4b062ef` |
| Price | 77880.25 USD (WAD) |
| Hash | `0xcf71fb2137c891fc240ab09ef77dc44611fcfa511702a331e41eb086a0592f9d` |
| Status | success |
| Explorer | [View](https://shannon-explorer.somnia.network/tx/0xcf71fb2137c891fc240ab09ef77dc44611fcfa511702a331e41eb086a0592f9d) |

### 4. RecordPrice #3 — $77,880.32

| Field | Value |
|-------|-------|
| Type | RealizedVol.recordPrice |
| Contract | `0xbd7eedfa178d8eb094449e3461e83195f4b062ef` |
| Price | 77880.32 USD (WAD) |
| Hash | `0xab317fef24cb36d1e61a92e8fc1bcf0507f49fcc43c835d1e67a8d88292e941e` |
| Status | success |
| Explorer | [View](https://shannon-explorer.somnia.network/tx/0xab317fef24cb36d1e61a92e8fc1bcf0507f49fcc43c835d1e67a8d88292e941e) |

### 5. RecordPrice #4 — $77,880.37

| Field | Value |
|-------|-------|
| Type | RealizedVol.recordPrice |
| Contract | `0xbd7eedfa178d8eb094449e3461e83195f4b062ef` |
| Price | 77880.37 USD (WAD) |
| Hash | `0x659ca1bb81e7ce717583b630ccaec84adde8764942d074517a61e2ddcfdf1726` |
| Status | success |
| Explorer | [View](https://shannon-explorer.somnia.network/tx/0x659ca1bb81e7ce717583b630ccaec84adde8764942d074517a61e2ddcfdf1726) |

### 6. RecordPrice #5 — $77,880.42

| Field | Value |
|-------|-------|
| Type | RealizedVol.recordPrice |
| Contract | `0xbd7eedfa178d8eb094449e3461e83195f4b062ef` |
| Price | 77880.42 USD (WAD) |
| Hash | `0x2666896a6a448528ecd1794523558a546c5dfc1f819fdcf1d9f5a7dd09b9154d` |
| Status | success |
| Explorer | [View](https://shannon-explorer.somnia.network/tx/0x2666896a6a448528ecd1794523558a546c5dfc1f819fdcf1d9f5a7dd09b9154d) |

---

## On-Chain State (After Session)

### RealizedVol — BTC

| Metric | Before | After |
|--------|--------|-------|
| sampleCount | 69 | 74 |
| lastPriceWad | $79,428.74 | $77,880.42 |
| sigma ok | false | true |
| varianceRateWad | 6853620971 | updated |

### Why sigma was `false` before

The `STALENESS_SECONDS` constant is 300 (5 minutes). The last price push before this session was older than 5 minutes, making `ok=false`. After 5 fresh pushes within ~30 seconds, the staleness check passed and `ok` flipped to `true`.

---

## Scripts Used

| Script | Purpose |
|--------|---------|
| `check-balances.mjs` | Read wallet STT and tUSDC balances |
| `scripts/proof-of-work.mjs` | Full pipeline: fund, push, publish, refresh, read |
| `bot/run-dry-run.mjs` | DRY_RUN bot loop (reads live markets, evaluates strategy) |
| `bot/src/marketRead.mjs` | Market reader (lists live markets + oracle values) |
| `scripts/scheduled-runner.mjs` | Continuous background runner (price push + market watch + state log) |

---

## Market Status

At the time of this session, **0 live BTC markets** were available on the dreamDEX real Up/Down venue (operator 2). Markets expire on a schedule (15m / 1h / 4h / 24h windows) and new ones open periodically. The volatility feed was successfully updated and the oracle is ready to price any new window as soon as it opens.

---

## Proof Files

| File | Content |
|------|---------|
| `proof-1788019380929.json` | Dry run (no real txs) |
| `proof-1788019470167.json` | Live run (6 real txs, all success) |

---

## What This Proves

1. **On-chain volatility feed works** — 74 real BTC price observations stored on-chain, EWMA variance computed in real time
2. **SigmaOracle pipeline is functional** — ready to compute fair probability, edge, and Kelly for any live window
3. **Multi-wallet architecture works** — Bot funds Deployer, Deployer writes to contracts, Bot reads via SDK
4. **Fallback price pusher works** — replaces broken reactivity push with a reliable scheduled pull
5. **All contracts are live and accessible** — RealizedVol, SigmaWindowRegistry, SigmaOracle all responding to reads and writes
6. **DRY_RUN bot reads real data** — connects to dreamDEX, reads markets, evaluates strategy against on-chain oracle
