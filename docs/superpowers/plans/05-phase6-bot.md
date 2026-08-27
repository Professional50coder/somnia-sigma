# Phase 6 — `ec-sigma` Bot

**Goal:** trade the gap through the official SDK, and seed a book where none
exists.

**Depends on:** Phase 5 · **Parallel with:** Phases 7, 8
**Scores directly against the 25% "how effectively does the project use DreamDEX
Event Contracts and available APIs/SDKs" criterion** — the largest single slice.

---

## Positioning

The Bot Kit ships **six** Event Contract strategies. "We built a trading bot"
competes with the organiser's own sample code and loses.

What the kit does not ship is a fair-value model. `ec-maker` is documented as
*"two-sided post-only quoting around **fair probability**"* — and nothing tells
it what that number is.

`ec-sigma` is that number, wired in. It ships **as a Bot Kit strategy**, using
`@dreamdex-bot-kit/ec-core` and `@somnia-chain/markets-sdk@0.28.1`, so "uses the
SDK effectively" is demonstrated rather than claimed.

---

## Task 6.1 — Scaffold

- [ ] Clone `somnia-chain/dreamdex-bot-kit` **outside** this repo (`D:\dreamdex-bot-kit`)
- [ ] `npm install`, `cp .env.example .env`
- [ ] `npx tsx scripts/doctor.ts` — read-only setup check
- [ ] Create `strategies/ec-sigma/` modelled on `ec-maker`
- [ ] `.env`: `NETWORK=testnet`, bot key, `VENUE_ID`, `DRY_RUN=true`,
      `AUTO_CLAIM=true`, `SIGMA_ORACLE=<address>`, `SIGMA_MIN_EDGE_BPS=200`,
      `SIGMA_MAX_STAKE=25`, `SIGMA_MODE=taker|maker`

> **Never run two bots on one key.** The kit serialises claims per key; parallel
> bots cause nonce races.

---

## Task 6.2 — Read side

- [ ] `listLiveBinaryMarkets({ venueId: 0x679795a0…, asset: "BTC" })`
- [ ] **Gate on `tradingStart <= now < expiry`**, not on indexer status — the
      `Listed → Trading` transition emits no event, so status lags
- [ ] `getOpeningPrices(marketIds)` — the row's `strike` is `"0"`
- [ ] `fetchPrice("BTC")`; use **`raw.price`** (`price` is a lossy double)
- [ ] `getBookTops(marketIds)` — one batched read across all open markets
- [ ] Read `SigmaOracle.quote(marketId, bookPriceWad)`
- [ ] Cross-check on-chain fair value against a local TypeScript port of the
      pricer. **A mismatch is a bug, and it must be loud** — the whole product
      is one number being right

---

## Task 6.3 — Quantization ⚠️

The single most likely source of silent failure.

- [ ] `getBinaryBookParams(pool)` **at runtime**
      *(measured `tickSize = lotSize = minQuantity = 1000n`;
      `ec-core`'s hardcoded `MM_LOT = 1` is **stale** — do not trust it)*
- [ ] Snap price to the tick grid in **bigint** space:

```ts
const one   = 10n ** BigInt(market.quoteDecimals);   // 1_000_000n
const steps = one / bp.tickSize;                     // 1000n
const priceYes = BigInt(Math.round(p * Number(steps))) * bp.tickSize;
const priceNo  = one - priceYes;                     // integer sub stays on-grid
```

- [ ] Clamp into `[tick, one - tick]` — **a binary may not rest at 0 or 1**
- [ ] Snap size to the lot grid, flooring
- [ ] **Never** `parseUnits(x.toFixed(18), 18)`

**Unit tests** (pure, no chain):

- [ ] `0.6237 → 0.624`
- [ ] every output is an exact multiple of `tickSize`
- [ ] `0` and `1` clamp inside the band
- [ ] `priceYes + priceNo === one` for a sweep of probabilities
- [ ] a fair value below one tick still produces a valid order or a clean skip

> On Shannon's 6-decimal collateral the float trap rounds away. **It appears for
> the first time on mainnet.** Build it right now; it cannot be caught here.

---

## Task 6.4 — Taker mode

- [ ] Skip unless `ok` and `|edgeBps| >= SIGMA_MIN_EDGE_BPS`
- [ ] Kelly-size, capped by `kellyCap` and `SIGMA_MAX_STAKE`
- [ ] Choose side: positive edge → BUY_YES; sufficiently negative → BUY_NO
- [ ] `expireTimestampNs` — **defaults to market expiry**; there is no GTC.
      Set just past the requote interval
- [ ] `builderFeeBpsTimes1k = 0` — **non-zero reverts on Shannon** (cap is `0`)
- [ ] `assertTxOk` — SDK writes resolve even when reverted
- [ ] **Log every skip with its reason.** A window skipped and a window never
      examined must be distinguishable afterwards

---

## Task 6.5 — Maker mode — the demo

Shannon binaries have **no liquidity**: every live market probed showed
`lastPrice: null` and empty books. Rather than fake a counterparty, Sigma
becomes the book.

- [ ] `POST_ONLY` (`orderType: 3`) quotes either side of fair value at a
      configured half-spread
- [ ] Both legs quantized and clamped
- [ ] Requote when fair value moves more than a threshold — **not** on a fixed
      timer. Fair value moves fastest near expiry, which is exactly when a timer
      is wrong
- [ ] Cancel and flatten before expiry
- [ ] Log the market going from empty to two-sided — that transition **is** the
      "generate trading activity" evidence

---

## Task 6.6 — Settlement

Payouts are **pull, not push**. A bot that never redeems strands its balance
across finalized markets.

- [ ] `maybeClaim()` each loop; `AUTO_CLAIM_INTERVAL_MS=600000`
- [ ] `listPastBinaryMarkets` / `getClaimable(account)` → `redeemMany`
- [ ] `redeem` takes **`marketId`, not a pool address**
- [ ] **Voided markets pay both sides 0.5 and `winningOutcome` is meaningless**
      — pass `outcomeIdx` explicitly
- [ ] Record predicted edge against realised outcome for the track record

---

## Task 6.7 — Track record

The credibility artefact.

- [ ] Per trade: `marketId`, fair value, book, edge, side, size, price, outcome, P&L
- [ ] Append-only JSON the frontend reads
- [ ] Aggregate: trades, win rate, P&L, **mean predicted edge vs realised**
- [ ] **Losses reported as prominently as wins.** A record showing only green is
      not a record

---

## Exit criteria

- [ ] `DRY_RUN` log shows correctly quantized orders on real markets
- [ ] Quantization unit tests pass, including `0.6237 → 0.624`
- [ ] One real testnet order rests on the book
- [ ] An empty market shown two-sided by Sigma's quotes
- [ ] One settlement claimed end-to-end
- [ ] On-chain and local fair value agree
- [ ] Track record written, losses included

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `InvalidPrice` | **High** | Runtime `getBinaryBookParams`; bigint snapping; explicit tests |
| Stale `MM_LOT = 1` | **High** | Never read it; measured value is `1000` |
| `VENUE_ID` drift | Medium | Verify against live rows; fail loudly on zero markets |
| No counterparty | Medium | Maker mode is the answer; replay carries the edge claim |
| Reverted write reported as success | Medium | `assertTxOk` everywhere |
| Nonce races | Medium | One key, one bot |
| Builder fee reverts | Low | Hard-zero on testnet; mainnet path in code, documented as undemonstrable here |
| Stranded winnings | Low | `AUTO_CLAIM` + explicit sweep |
