# Integration Reference — dreamDEX Event Contracts on Shannon (50312)

Read from `@somnia-chain/markets-sdk@0.28.1` source and confirmed by **live
probes** of the chain, the markets indexer, and the price feed on 2026-08-27.
Where this disagrees with prose documentation or with the Bot Kit, this wins —
it was measured.

---

## 0. The five traps, first

Each of these fails **silently** or produces a plausible-looking wrong number.

| # | Trap | Consequence if missed |
|---|---|---|
| 1 | **`strike` is `"0"`** on the real Up/Down venue | `ln(S/K)` = `ln(S/0)` = `Infinity` on every market |
| 2 | **Strike is 1e2, price feed is 1e18** | Log-moneyness wrong by a factor of 10¹⁶ |
| 3 | **Tick grid is 0.001**, and `ec-core`'s `MM_LOT = 1` is stale | Orders rejected, or sized 1000× wrong |
| 4 | **Two venues exist**; operator 4 is a test series | You price and trade the wrong markets |
| 5 | **Builder fees revert on Shannon** (cap `0`) | Any non-zero builder fee reverts the order |

---

## 1. Client setup

```ts
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES, SOMNIA_TESTNET_PRICE_FEED } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const exchange = new SomniaMarkets({
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",   // NOT exported by the SDK
  chain: somniaShannon,                                    // id 50312, blockTime 100ms
  addresses: SOMNIA_TESTNET_ADDRESSES,
  priceFeed: SOMNIA_TESTNET_PRICE_FEED,
  privateKey,                                              // optional
});

await exchange.loadMarkets();   // REQUIRED before priceToPrecision — reads tick/lot per pool
```

**No API key** — indexer and price feed are auth-free.
`SOMNIA_TESTNET_PRICE_FEED` = `{ url: "https://price-feed.dev.oracle.somnia.host/v1/graphql", quote: "USDC" }`.

Multicall3 on Shannon: `0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223`.

> `TraderConfig.decimals` and `getBinaryOrderBook`'s `opts.decimals` both
> **default to 6**. Correct for Shannon's tUSDC today, silently wrong on an
> 18-decimal venue. Pass `market.quoteDecimals` explicitly.

---

## 2. Which venue — filter, or price the wrong thing

Two live venues on Shannon (measured, `distinct_on: venueId`):

| operatorId | venueId | Series | `strike` on rows |
|---|---|---|---|
| **2** ← use this | `0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c` | **Real Up/Down** — "BTC closes at or above its opening price", 900 / 3600s | **`"0"`** |
| 4 | `0x1a1e6821cde7d0159c0d293177871e09677b4e42307c7db3ba94f8648a5a050f` | "Pricefeed test", fixed strike, 60 / 300s | a real number |

Operator 2 matches the `VENUE_ID` the Bot Kit documents, and is **still current**.
Always filter on it.

---

## 3. Market discovery

All indexer (Hasura) reads, never chain. They throw on failure; `[]` genuinely
means no rows.

```ts
listBinaryMarkets(opts?): Promise<BinaryMarket[]>       // newest-first
listLiveBinaryMarkets(filter?): Promise<BinaryMarket[]> // expiry > now, closingSoon-first
listPastBinaryMarkets(opts?): Promise<BinaryMarket[]>   // expiry <= now
getBinaryMarket(id): Promise<BinaryMarket | null>       // by bytes32 marketId
countBinaryMarkets({ ...filter, phase: "live"|"past" }): Promise<number>
```

**Key state by `marketId`, never by `poolAddress`.** Pools are recycled across
successive markets; `(poolAddress, nonce)` identifies one market's slice of a
pool's history.

Status is unreliable alone — the `Listed → Trading → Settling` transitions emit
no events, so derive live-ness from `tradingStart <= now < expiry`.

---

## 4. The opening price — trap #1

On operator 2, `strike` is `"0"`. Real Up/Down markets settle against their own
**opening price**, which lives on the oracle's reference question:

```ts
client.getOpeningPrices(marketIds: string[]): Promise<Record<string, string | null>>
//   keys are LOWERCASED marketIds
//   two round-trips: MarketReferenceLink{market_id → referenceQuestionId}
//                    then OracleAnswer{id → numericValue}

client.getMarketResolution(marketId).openingAnswer   // single-market form
client.getMarketResolution(marketId).closingAnswer   // for settlement checks
```

Measured: market `0x…afc1` (BTC, `strike:"0"`) → `referenceQuestionId 45668` →
`numericValue "7952897"` → **79,528.97**.

---

## 5. Price scales — trap #2

Measured at the same instant:

```
indexer  Market.strike (op 4)      "7940382"                    -> 79,403.82   (1e2)
oracle   OracleAnswer.numericValue "7952897"                    -> 79,528.97   (1e2)
feed     Feed.latestSpot (BTC/USDC)"79419790000000000000000"    -> 79,419.79   (1e18)
feed     Feed.decimals             18
```

**Opening price / strike: 1e2. Price feed: 1e18.** `PRICE_FEED_DECIMALS = 18` is
exported; **the strike scale is not** — it is the per-series `numericDecimals`,
not present on the market row and not exposed by the indexer's `Series` or
`OracleQuestion` entities.

The Bot Kit's answer is to infer it, and it is a reasonable defensive check:

```ts
// strategies/ec-oracle-follow/src/signal.ts
export function scaleStrike(rawStrike, spot) {
  const raw = Number(rawStrike); let best = null, bestErr = Infinity;
  for (let exp = 0; exp <= 18; exp++) {
    const c = raw / 10 ** exp, err = Math.abs(Math.log(c / spot));
    if (err < bestErr) { bestErr = err; best = c; }
  }
  return bestErr <= Math.log(2) ? best : null;   // >2x away => wrong scale
}
```

Sigma's rule: convert both to a common scale, then assert `0.5 < S/K < 2`
before pricing. A ratio outside that band on a 15-minute window is a scale bug,
not a market move — refuse to publish rather than emit a confident wrong number.

---

## 6. Tick grid and quantization — trap #3

`BinaryMarket` carries **no** `tickSize`/`lotSize`/`minQuantity` — the GraphQL
fragment selects them but they are `null` on every binary row. Source of truth
is the pool contract:

```solidity
function getOrderBookParameters() view returns ((uint256 tickSize, uint256 minQuantity, uint256 lotSize))
```

```ts
client.getBinaryBookParams(pool: string): Promise<BinaryBookParams>   // cached
```

**Measured on all four live Shannon pools, both venues, identical:**

```
tickSize = 1000n   minQuantity = 1000n   lotSize = 1000n
collateral 6dp, oneCollateral = 1_000_000n
=> price grid 0.001, size grid 0.001 shares, minimum 0.001 shares
```

Venue convention per the SDK: `tick = lot = min = 10**(collateralDecimals - 3)`.

> **`ec-core/src/config.ts` hardcodes `MM_LOT = 1` and is stale.** Live pools
> report `1000`. Its comment that binary ticks are "NOT discoverable through the
> SDK" is also out of date at 0.28.1. Read `getBinaryBookParams` at runtime.

### 0.6237 to an on-grid price

```ts
const bp    = await client.getBinaryBookParams(market.poolAddress);  // tickSize 1000n
const one   = 10n ** BigInt(market.quoteDecimals);                   // 1_000_000n
const steps = one / bp.tickSize;                                     // 1000n

const priceYes = BigInt(Math.round(0.6237 * Number(steps))) * bp.tickSize;  // 624000n -> 0.624
const priceNo  = one - priceYes;                                     // integer sub stays on-grid
```

**`0.6237 → 0.624`.** Grid resolution is 0.001 on both networks.

SDK quantizers (require `loadMarkets()`; they **throw** rather than guess):

```ts
exchange.priceToPrecision(ref, price)    // snapToGrid(..., { clamp: true }) — rounds DOWN
exchange.amountToPrecision(ref, amount)  // snapToGrid(..., { strict: true })

snapToGrid(x, stepRaw, decimals, { direction?: "down"|"up", clamp?, strict? })
probabilityToPrice(p, decimals) -> bigint
priceToProbability(raw, decimals) -> number
```

`clamp` bounds into `[step, one − step]` — **a binary may not rest at 0 or 1.**
Note `ec-core`'s private `toSteps` *rounds* price to nearest tick while
`priceToPrecision` rounds *down*; the two can differ by one tick.

### The `InvalidPrice` mechanism

`(0.05).toFixed(18) === "0.050000000000000003"` — three wei off a 1e15 tick,
reverting `InvalidPrice(uint256 price, uint256 tickSize)`. The SDK's
`humanToDecimalString` uses `String(n)` (shortest round-tripping repr) instead.

> This only bites on an **18-decimal** venue. Shannon's 6-decimal tUSDC rounds
> it away — **so the bug appears for the first time on mainnet.** Build the
> quantization path correctly now; it cannot be caught by testing here.

---

## 7. Order book

```ts
client.getBinaryOrderBook(pool, { depth?, decimals? })        // chain, one-shot
client.getLiveBinaryOrderBook(pool, { depth? })               // live store, 0 RTT
client.getLiveBinaryOrderBookByMarket(marketId, { depth? })
client.getBookTops(marketIds: string[])                       // indexer, batched

interface BinaryOrderBook { yesBids; yesAsks; noBids; noAsks: BookLevel[] }
interface BookLevel { price: bigint; quantity: bigint }
type BookTop = { bestBid: string|null; bestAsk: string|null; mid: string|null }  // YES terms, raw
```

The book is **always quoted in YES terms**; NO levels are synthesized as
`oneCollateral − yesPrice`. Underlying ABI is
`getBookLevels(bool isBid, uint64 numLevels)` — note **`uint64`**.

`getBookTops` is the right call for the Edge Radar: one batched indexer read
across every open market.

---

## 8. Spot price

Not on the market row. The SDK's "bundled feed" is a standalone Hasura service
over the on-chain EMA oracle, separate from the markets indexer.

```ts
exchange.fetchPrice(asset)                       // "BTC" | "ETH" — market.asset is the key
client.fetchPrices(assets?)                      // omit for the whole wall
client.fetchPriceCandles(asset, "M1"|"H1"|"D1", { limit?, from?, to? })
client.watchPrice(asset) / watchPrices(assets)   // WS
client.getLivePrice(asset)                       // sync, 0 RTT

LivePrice = { price: number, ema: number, decimals: 18, blockTimestamp,
              raw: { price: string, ema: string } }
```

**Use `raw.price` for maths** — `price` is a lossy double. `price` is the spot
median; `ema` is the EMA mark.

Measured: BTC, ETH, BNB, SUI, LINK, NEAR, SOMI, WLD, FIL, ENA, XMR, ASTER all
present, 18 decimals, ticking ~1/s. **Pin `quote: "USDC"`** — the feed also
holds stale USDT rows and matching both double-counts every base.

Freshness: compare `PriceFeedInfo.updatedAtMs` against `sourceUpdatedAtMs` to
distinguish "oracle stopped writing" from "oracle writing stale data". A stalled
asset simply stops pushing — age it against a local clock, don't wait for an event.

**Testnet-only is real:** `ec-core` wires the feed only when
`net === "testnet"`, and there is no `SOMNIA_MAINNET_PRICE_FEED`. The
substitution seam is `restSpotReader({ urlFor, parse })` in `signal.ts`.

### On-chain alternative — what Sigma's reactivity handler uses

```
event MarkPriceUpdated(address indexed asset, uint256 markPrice, uint256 rawMidpoint)
topic0    0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888
BTC pool  0x3605f28aa7c50e7441211e77cb0762d49539326c   (WBTC:USDso)
ETH pool  0xd180195da5459c7a0dea188ed61216ec43682b50   (WETH:USDso)
```

`markPrice` is **1e18 regardless of token decimals** (WBTC is 8dp). One pool
serves exactly one asset, so the `emitter` filter alone disambiguates — no topic
slot spent. Measured **~1 update per asset every ~2 seconds**.

Order-book-derived, not a signed attestation. Cross-checked live against the
perp `FundingUpdated.indexPrice`: **0.12% apart on BTC**, so it tracks closely.

---

## 9. Orders and settlement

```ts
interface PlaceOrderParams {
  pool: Address;
  side: "BUY_YES" | "SELL_YES" | "BUY_NO" | "SELL_NO";
  price: bigint;                 // YES-terms raw, TICK-ALIGNED
  quantity: bigint;              // raw outcome tokens, LOT-ALIGNED
  expireTimestampNs?: bigint;    // default = pool.marketExpiryNs
  orderType?: number;            // 0 LIMIT, 1 FOK, 2 MARKET(IOC), 3 POST_ONLY
  builder?: Address;
  builderFeeBpsTimes1k?: bigint;
  gas?: bigint;                  // default 10_000_000n
}
trader.placeOrder(p): Promise<{ hash, receipt, orderId?, fills }>
trader.cancelOrder(p)
```

> **`expireTimestampNs` defaults to market expiry, not far-future.** There is no
> GTC on binaries; a past value reverts `OrderAlreadyExpired`.

`orderType: 3` (POST_ONLY) is what Sigma uses when seeding a book — it must rest,
never cross.

### Settlement — payouts are pull, not push

```ts
trader.mintSet(p) / burnSet(p)                   // complete-set mint / merge
trader.redeem({ marketId, amount, outcomeIdx? }) // marketId, NOT a pool address
trader.redeemMany({ entries })
client.getClaimable(account)                     // shaped for redeemMany
```

Winners receive `amount × (1 − settlementFee)`. A **voided** market pays both
sides `amount / 2` and `winningOutcome` is meaningless — pass `outcomeIdx`
explicitly there. A bot that never redeems has its balance stranded across
finalized markets.

Measured on the live venue: `makerFee = takerFee = settlementFee = 0`.

### Builder fees — trap #5

```ts
trader.approveBuilder({ pool, builder, maxFeeBpsTimes1k })  // PER POOL
trader.getMaxBuilderFeeBpsTimes1k(pool)
trader.getEffectiveBuilderApproval(pool, builder)
```

Unit is **bps × 1000** (1500 = 1.5 bps).

> **Measured: `maxBuilderFeeBpsTimes1k = 0` on all four live Shannon binary
> pools. Builder fees are DISABLED on testnet** — any non-zero value reverts.
> Mainnet is `100000` (1% cap). `ec-core.placeLimit` deliberately does not
> expose the fields and enforces the untagged path via `assertBuilderDisabled`;
> tagging requires calling `trader.placeOrder` directly.
>
> Consequence for the submission: the revenue model can be **implemented and
> shown in code**, but cannot be demonstrated executing on testnet. Say so.

---

## 10. Historical data

```ts
CANDLE_INTERVALS = [60, 300, 900, 3600, 14400, 86400]
client.getCandles(poolAddress, intervalSeconds, { limit?, from?, to? })  // limit default 500
```

Works for any pool including binaries — but **near-useless for binary
backtesting**: it is keyed by `poolAddress`, and pools are recycled, so one
pool's series concatenates unrelated markets with no boundary marker.

Use instead:

- **`fetchPriceCandles(asset, "M1"|"H1"|"D1", { from, to })`** — underlying
  history, `M1 = 60s`. This is Sigma's backtest input: replay BTC minute bars,
  reconstruct each window's opening price, and price it forward.
- dreamDEX REST OHLCV (spot only):
  `GET https://stg.api.dreamdex.io/v0/markets/{symbol}/candles?interval=…&limit<=1000&endTime=…`,
  client pages backwards to 200k candles.

**The Bot Kit has no event-contract backtester** — all nine backtest adapters
are spot-only. Sigma's has to be written, and `fetchPriceCandles` is the input.

---

## 11. Liquidity on Shannon — corrected, this changed

> **SUPERSEDED 2026-08-27 (later same day).** This section originally read:
> *"Measured across every live binary market probed: `lastPrice: null`, empty
> books on both sides. There is no liquidity on Shannon binaries."* That was
> true when first measured. **It is no longer true.** A later live check
> (against the real Up/Down venue, operator 2) found **all 4 live BTC markets
> have genuine two-sided books right now** — real, non-null bid/ask on both
> sides, real spreads. `lastPrice` is still `null` (no trade has printed yet),
> but the *book* is not empty. Testnet liquidity conditions evidently change
> over the course of a hackathon — don't assume either state without
> re-checking close to demo time.

**Consequence for the demo narrative:** the original plan was "Sigma seeds an
empty market — the demo moment is an empty book turning two-sided." That
moment may no longer be available to film. The fallback narrative, which is
arguably the *stronger* claim anyway, is: **"Sigma competes on an existing
book"** — read the live YES/NO ask, compute the edge against it directly, and
show the mispricing on a real, already-liquid market rather than one Sigma
had to bootstrap itself. Both narratives are legitimate; which one is live
depends on the state of the venue when the demo is actually recorded — check
`getBookTops` for the target markets in the hours before filming, not days
before.

- Anything crossing-price-derived still returns `null` where `lastPrice`
  specifically is read (no trade has printed) — that is unaffected by this
  correction and is a separate, narrower fact.
- Replay evidence (`backtest/`, see `docs/CHECKLIST.md` Phase 8) does not
  depend on live book state either way and remains valid regardless of which
  narrative is filmed.

---

## 12. Residual drift worth knowing

- `unified/symbols.ts` feeds the raw `strike` into symbol synthesis via
  `trimStrike("95000.000000" → "95000")`, a helper written for a
  human-formatted string. On real rows this yields `BTC-7940382-…` or
  `BTC-0-…`. Harmless, but **never parse a strike out of a symbol.**
- `priceToPrecision` **throws** if `loadMarkets()` failed to read the pool —
  deliberately, rather than quantizing against a guess. Call `loadMarkets(true)`
  to refresh after a pool recycle.
- Nothing in the dreamDEX contract set is source-verified on the explorer; ABIs
  come from the SDK's `eventsAbi.ts` / `machineryAbi.ts`. That file documents a
  past incident where two declared perp signatures had the wrong arity and
  silently never matched — so validate any `topic0` against a real log before
  relying on it. Both price topics above were validated this way.
