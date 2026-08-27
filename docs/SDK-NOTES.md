# SDK Notes — verified against the installed package

Everything here was read directly from **`@somnia-chain/markets-sdk@0.28.1`**
installed into this repo, and from live calls against Somnia Shannon testnet.
This is grade-A: not documentation *about* the SDK, but the SDK's own type
declarations. It supersedes several assumptions in `RESEARCH.md`.

---

## 1. Live verification results (2026-08-27)

| Check | Result |
|---|---|
| `eth_chainId` on `https://dream-rpc.somnia.network` | **`0xc488` = 50312** ✅ RPC and chain id confirmed |
| Chain liveness | Block ~472,570,000, advancing **~280 blocks in a few seconds** — sub-second blocks |
| `OracleHub` `0xe40d…E32b` `eth_getCode` | **Has code** — ERC-1967 upgradeable proxy ✅ |
| `OracleHub` logs | Later resolved by a wider scan: **`OracleHub` emits no price event.** It is a question-resolution hub. The price feed is `MarkPriceUpdated` on the spot pools — `INTEGRATION.md` §8. |
| `GET /v0/markets` on `stg.api.dreamdex.io` | **200** — returns **spot markets only** |
| `GET /v0/markets?kind=binary` | **400** — `kind` enum is only `["spot","perp","all"]` |
| OpenAPI spec at 9 candidate paths | All 404 |
| `npm view @somnia-chain/markets-sdk version` | **0.28.1** — clears the ≥0.28.0 floor ✅ |

**Conclusion:** binary markets are **not exposed through the REST `/v0/markets`
endpoint at all.** They are served by a **Hasura GraphQL indexer** that the SDK
wraps (the type docs reference server-side Hasura `where` clauses and the package
ships a `gql/` directory). Do not build against REST for Event Contracts — use
the SDK.

### 1.1 Spot markets on testnet (for reference)

`GET https://stg.api.dreamdex.io/v0/markets`

| Symbol | Contract | tickSize | lotSize | minQuantity |
|---|---|---|---|---|
| `SOMI:USDso` | `0x259fD6559214dd5aD3752322426eA9F9fABEFff4` | 0.0001 | 0.01 | 1 |
| `WBTC:USDso` | `0x3605f28aA7C50e7441211e77Cb0762d49539326C` | 0.1 | 0.00001 | 0.0001 |
| `WETH:USDso` | `0xD180195da5459C7a0DEA188ed61216ec43682b50` | 0.01 | 0.0001 | 0.001 |

Testnet quote token: `0x9c32F3827A1a99f0cf9B213de8b53eC3d57bb171`.
Each row also carries a `stopRegistry` — the reactivity-driven conditional-order
contract referenced in `RESEARCH.md` §5.1.

---

## 2. `BinaryMarket` — the authoritative schema

From `dist/markets.d.ts:168`. These are the fields Sigma consumes.

```typescript
export type BinaryMarket = BaseMarket & {
  marketType: "BINARY";
  marketId: Hex;              // bytes32, == id
  marketAddress: Address;     // the BinaryMarket clone (lowercased)

  yesTokenId: string;         // ERC-6909 position id, uint256 as decimal string
  noTokenId: string;

  collateral: Address;        // per-venue ERC-20
  asset: string;              // "BTC" | "ETH"
  question: string;           // display text
  oracleQuestion: string | null;
  oracleQuestionId?: string | null;

  status: BinaryMarketStatus;

  strike: string;             // <-- THE OPENING PRICE, raw, in the ORACLE'S price scale
  tradingStart: string;       // unix seconds
  expiry: string;             // unix seconds

  winningOutcome: number | null;      // 0 = YES, 1 = NO; null until Resolved
  payoutNumerators?: string[] | null; // one-hot on a win, uniform on a void
  payoutDenominator?: string | null;  // PAYOUT_VECTOR_DENOMINATOR = 10_000_000
  resolvedAtBlock: string | null;
  resolvedAtTimestamp: string | null;
  createdByTx: Hex | null;
};
```

### 2.1 The three fields Sigma actually needs

Everything the fair-value model requires is present:

| Model input | Source |
|---|---|
| `K` (strike) | **`strike`** — "Strike the question resolves against (raw, in the oracle's price scale)" |
| `τ` (time remaining) | `(expiry − now) / (expiry − tradingStart)` |
| `S` (spot) | **not in the market row** — on-chain via `MarkPriceUpdated`, or off-chain via `fetchPrice(asset)` |
| `σ` (volatility) | `RealizedVol`, computed by Sigma |

> **Scale warning.** `strike` is raw *in the oracle's price scale*, not WAD and
> not the collateral's decimals. Spot must be converted into the same scale
> before `ln(S/K)` is computed, or the log-moneyness is silently wrong by orders
> of magnitude. Assert the scale at integration time; do not assume 18.

---

## 3. Lifecycle status — and a trap

```typescript
type BinaryMarketStatus =
  "Listed" | "Trading" | "Locked" | "Settling" | "Resolved" | "Voided" | "Finalized";
```

Seven states, not the two implied elsewhere. But the SDK's own comment is a
warning:

> *"Lifecycle status (aliased from the indexer's `clobStatus`). Derived from
> lifecycle **EVENTS only** — the timestamp-implicit Listed→Trading→Settling
> transitions emit none, so **derive the live trading state from
> `tradingStart`/`expiry` between events rather than trusting this alone.**"*

**Consequence for Sigma:** never gate solely on `status === "Trading"`. A market
can be genuinely tradeable while the indexer still reports `Listed`, because the
transition emitted no event. Gate on:

```
tradingStart <= now < expiry   AND   status not in {Locked, Settling, Resolved, Voided, Finalized}
```

This is compatible with, and stricter than, the Bot Kit's "gate on on-chain
status, not the indexer" guidance.

---

## 4. Window lengths — RESEARCH.md §2.3 was incomplete

```typescript
/** Series cadence in seconds: `900` (15m) | `3600` (1h) | `14400` (4h) | `86400` (24h). */
intervalSec?: number;
```

**Four** cadences exist, not two: **15m, 1h, 4h, 24h.** The public docs mention
only 15m and 1h.

This is a meaningful upside for Sigma. `τ` and `σ√τ` scale across cadences, so
the same model prices all four — and the **term structure across cadences on the
same asset** is a genuine analytic that falls out for free. A 15-minute and a
24-hour window on BTC, priced simultaneously, expose whether the book is pricing
short-horizon and long-horizon volatility consistently. Nothing in the field
shows that.

---

## 5. Query surface

```typescript
listBinaryMarkets(opts)      // narrowed BinaryMarket[], newest first
listLiveBinaryMarkets(opts)  // live only, ordered closingSoon by default
listPastBinaryMarkets(opts)  // settled, for redemption sweeps
listMarkets({ marketType })  // "BINARY" | "SPOT" | "PERP", default limit 50
```

```typescript
type BinaryMarketFilter = {
  operatorId?: number;   // from BinaryMarketsModule.MarketCreated
  venueId?: string;      // bytes32 hex, contract-generated
  asset?: string;        // "BTC" | "ETH"
  intervalSec?: number;  // 900 | 3600 | 14400 | 86400
  status?: BinaryMarketStatus;
  orderBy?: "newest" | "closingSoon" | "volume" | "tradeCount";
};
```

Filters are applied **server-side** (Hasura `where`); `venueId` and `intervalSec`
hit indexes, so filter there rather than in application code.

For the Edge Radar, `listLiveBinaryMarkets` ordered `closingSoon` is exactly the
right query — windows nearest expiry are where fair value diverges most from the
book, so the most interesting rows sort to the top for free.

---

## 6. Package layout

```
@somnia-chain/markets-sdk@0.28.1
├─ dist/binary/     index · plugin · portfolio · sets · settlement
├─ dist/chains/     network configs
├─ src/             full TypeScript source ships with the package
│  ├─ markets.ts marketTypes/ ids.ts interval.ts logTopics.ts
│  ├─ gql/          GraphQL documents — the indexer transport
│  ├─ liveTail.ts   realtime market tail
│  └─ candles.ts    historical candles (backtest input)
```

`dist/binary/sets.js` is complete-set mint/merge (1 collateral ⇄ 1 YES + 1 NO);
`dist/binary/settlement.js` is redemption. `src/candles.ts` is the backtest data
source. Reading `src/` directly is faster and more reliable than any prose doc.

---

## 7. Corrections this makes to RESEARCH.md

| RESEARCH.md said | Correct |
|---|---|
| Windows: 15m and 1h | **15m, 1h, 4h, 24h** (`intervalSec` 900/3600/14400/86400) |
| Status `1 = Trading` is the gate | Indexer status is a **string enum of 7 states**, and is **unreliable on its own** — derive from `tradingStart`/`expiry` |
| Market rows expose `strike` and `intervalSec` | Confirmed, plus `tradingStart`, `expiry`, `yesTokenId`, `noTokenId`, `payoutNumerators` |
| Fetch markets via `GET /v0/markets` | **Wrong for binaries.** REST serves spot/perp only; binaries come from the SDK's GraphQL indexer |
| Up / Down | The SDK calls them **YES / NO**; `winningOutcome` 0 = YES, 1 = NO |
| Void handling: redeem 0.5 | Mechanically: a **uniform payout vector** over `payoutDenominator` = 10,000,000 |

---

## 8. Still open

| # | Question | Why it matters |
|---|---|---|
| 10 | Does `OracleHub` emit a subscribable price event? | Determines whether reactivity-driven σ works as designed. The empty log scan was inconclusive — sub-second blocks meant it covered only seconds. Re-check across a wider span, or read the verified proxy implementation. |
| 11 | What price scale is `strike` denominated in? | `ln(S/K)` is silently wrong if spot and strike are in different scales |
| 12 | Binary market **tick size** | Governs quantization. Spot ticks are known (§1.1); binary ticks are not, and `InvalidPrice` is the failure mode |
| 13 | Does the SDK expose spot for `asset`? | `ec-oracle-follow` documents that underlying price is absent from market rows and its bundled feed is testnet-only |

Questions 11 and 12 are both answerable in one call once a live binary market is
listed: fetch a row, print `strike`, and read the venue's tick config.

---

## 9. Live-chain facts confirmed by direct read (2026-08-27, second session)

| Fact | Value | How confirmed |
|---|---|---|
| **tUSDC decimals** | **6** — *not* 18 | `decimals()` read on `0x70a86D…5d8E` |
| tUSDC symbol | `tUSDC` | `symbol()` read |
| Faucet grant | 50 STT + 500 tUSDC per wallet, 24h cooldown | Observed after claiming |
| Chain liveness | block ~472,580,000, `chainId` 50312 | `viem` public client |

> **The decimals matter.** The venue prices binaries on an 18-decimal grid, but
> the collateral is 6-decimal. Any sizing path that assumes a single decimals
> value for both is wrong by 10^12 — and fails silently as "nothing fills"
> rather than as an error. Always read `decimals()`; never hard-code it.

Balances are checked with `node scripts/balances.mjs`, which reads token
metadata rather than assuming it.
