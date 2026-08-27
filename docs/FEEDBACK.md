# SDK & Documentation Feedback — Sigma Team

Submitted alongside our hackathon entry, per the invitation in the hackathon
brief for feedback on the SDK and docs. Everything below was found by
building a real integration (a fair-value oracle for dreamDEX Event
Contracts) against `@somnia-chain/markets-sdk@0.28.1` and
`@somnia-chain/reactivity` on Shannon testnet (chain 50312), and is backed by
a live measurement, a captured log, or a read transaction — not guesswork.
We're reporting this in the spirit the invitation intended: a team that read
the code carefully and hit real friction, not a complaint list.

For each item: what we expected, what actually happened, how we found it, and
a suggested fix.

---

## 1. `OracleHub`'s name suggests a price oracle; it resolves questions instead

**Expected:** a contract named `OracleHub` (`0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b`)
would emit price updates we could subscribe to.

**Actual:** it emits no price event at all. Its richest event,
`AnswerDelivered`, carries a YES/NO payout vector for a resolved question, and
fires on the market-roll cycle (roughly every 12 minutes), not on price
ticks. It's a question-resolution/accounting hub, not a price feed.

**How we found it:** a wide `eth_getLogs` scan of every event topic the
contract emits, decoded against the ABI in the SDK's own bundled
`machineryAbi.ts` (the contract itself isn't source-verified on the
explorer).

**Suggested fix:** either rename the contract to reflect what it does
(`QuestionResolutionHub` or similar), or add a doc note near any mention of
`OracleHub` clarifying that it is not a price source, and pointing
integrators toward the actual price feed (see item 6).

---

## 2. The real Up/Down venue's `strike` field is literally `"0"`

**Expected:** `BinaryMarket.strike` (documented as *"strike the question
resolves against, raw, in the oracle's price scale"*) would hold the
window's opening price for every market.

**Actual:** on the real Up/Down venue (operator 2, venueId
`0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c` — the
one the Bot Kit itself documents), `strike` is `"0"` on every single row. The
real opening price only exists via `client.getOpeningPrices(marketIds)`,
which resolves it through a separate reference-question lookup
(`MarketReferenceLink` → `OracleAnswer`), two round-trips away from the
market row.

**How we found it:** by naively computing `ln(spot/strike)` for a real
market and getting `Infinity`, then reading the SDK source rather than the
docs to find `getOpeningPrices`.

**Suggested fix:** document this explicitly on the `BinaryMarket.strike`
field itself — something like *"0 on markets whose strike is the window's own
opening price; call `getOpeningPrices()` for those."* As written, this costs
a full day to discover for anyone pricing these markets, and produces
`Infinity`/`NaN` rather than a clear error.

---

## 3. Opening price and the price feed are on different scales, undocumented

**Expected:** either a consistent scale across the opening price and the spot
price feed, or an exported constant/field stating the opening price's scale.

**Actual:** measured at the same instant on a real market: the opening price
(via `getOpeningPrices`) reads `"7952897"` → 79,528.97 at **1e2**. The price
feed (`fetchPrice("BTC").raw.price`) reads
`"79419790000000000000000"` → 79,419.79 at **1e18** (`PRICE_FEED_DECIMALS`,
which *is* exported). The opening-price scale is not on the market row, not
in `getOpeningPrices`'s return shape, and not exposed by the indexer's
`Series` or `OracleQuestion` entities — it's the per-series
`numericDecimals`, reachable only through a chain read
(`marketCreatorAdmin.getSeriesOnchain`) that the market row gives you no
`seriesId` to make.

**How we found it:** by comparing the two values side by side and noticing
they were off by roughly 10^16, then instrumenting both reads directly.

**Suggested fix:** export the opening-price scale alongside `getOpeningPrices`
(e.g. return `{ value, decimals }` instead of a bare string), or add it as a
field on `BinaryMarket`. A ratio-based sanity check like the Bot Kit's own
`scaleStrike()` (`ec-oracle-follow/src/signal.ts`) is a reasonable stopgap,
but it's a workaround for a documentation gap, not a real fix.

---

## 4. `ec-core`'s `MM_LOT` constant is stale, and its own comment is out of date

**Expected:** `ec-core/src/config.ts`'s hardcoded `MM_LOT = 1`, with a comment
stating binary tick sizes are "not discoverable through the SDK," to be
accurate at the installed SDK version.

**Actual:** at `@somnia-chain/markets-sdk@0.28.1`, `getBinaryBookParams(pool)`
directly exposes `tickSize`/`lotSize`/`minQuantity`, all measured at `1000`
on every live Shannon pool (both venues) — not `1`. The comment claiming this
isn't discoverable is simply wrong at this SDK version.

**How we found it:** by comparing `MM_LOT`'s value against a live
`getBinaryBookParams` read and finding a 1000x discrepancy.

**Suggested fix:** either remove the hardcoded constant in favor of a runtime
read (what we ended up doing), or update the comment and value to match the
current SDK. A stale comment claiming something is "not discoverable" when it
now is will send the next integrator down the same wrong path.

---

## 5. Builder fees are hard-disabled on testnet with no documentation of that

**Expected:** the builder-fee mechanism on `placeOrder`
(`address builder, uint96 builderFeeBpsTimes1k`) to be testable end-to-end on
Shannon before we rely on it for mainnet.

**Actual:** `getMaxBuilderFeeBpsTimes1k(pool)` reads `0` on all four live
Shannon binary pools — any non-zero builder fee reverts. Mainnet's cap is
documented elsewhere as `100000` (1%), but nothing states that testnet's cap
is zero.

**How we found it:** a direct call to `getMaxBuilderFeeBpsTimes1k` on each
live pool, after `ec-core.placeLimit`'s deliberate omission of the builder
fields (`assertBuilderDisabled`) tipped us off that something was off.

**Suggested fix:** a one-line doc note wherever builder fees are discussed —
*"builder fees are disabled on Shannon testnet; test this path against
mainnet directly, or request a testnet override if you need to validate it
pre-launch."* Anyone building a builder-fee-dependent product currently has
no way to know this without hitting the revert themselves.

---

## 6. Reactivity event-subscription delivery — an elimination trail, in case it's useful

We want to be careful with the framing here: we are **not** claiming
reactivity is broken. We're reporting a complete elimination trail in case
it's useful for debugging on your end, since you likely have server-side
visibility into subscription delivery attempts that we don't have as callers.

**Expected:** a correctly-registered subscription to a live, firing event
delivers its callback.

**Actual:** across **six separately-configured subscriptions**, every one
confirmed correctly registered via `getSubscriptionInfo(subscriptionId)` (not
just "the creation tx succeeded" — we read back the full on-chain record
every time and confirmed emitter, topic, handler address, selector, and fees
all matched exactly what we intended), **zero callbacks were ever delivered**,
against a source event independently confirmed firing continuously
(`MarkPriceUpdated` on a dreamDEX spot pool, ~0.5 Hz, checked via direct
`eth_getLogs` throughout the whole investigation window).

We eliminated, one variable at a time:

| Variable | What we tried | Result |
|---|---|---|
| Topic/emitter/selector correctness | Verified against a real captured log; selector confirmed via `toFunctionSelector("onEvent(address,bytes32[],bytes)")` | Correct |
| `isGuaranteed` | Tried both `false` and `true` | No change |
| Fee levels | Tried 20 gwei priority / 100 gwei max against a measured 6 gwei base fee (well above minimums) | No change |
| Subscription-owner balance | The on-chain-reactivity tutorial states a 32 SOMI minimum "when the subscription is created" — we tried an owner sitting at 50 STT, well clear of that line | No change |
| Handler logic | Swapped the real handler for a maximally minimal diagnostic contract — **no `msg.sender` gate at all**, just an unconditional counter and sender logger | Still zero, and the sender was never even recorded — the function was never invoked, not invoked-and-rejected |
| `msg.sender` semantics | Docs confirm `msg.sender` during a callback is the precompile address itself, so this wasn't the gap — consistent with the diagnostic contract above, which had no gate to fail |

One documentation gap we noticed along the way: the on-chain-reactivity
tutorial states the 32 SOMI balance requirement applies "when the
subscription is created," but doesn't say whether it's checked only at
creation or persistently at delivery time, and there's no documented
behavior for what happens to a correctly-registered, adequately-funded
subscription that simply never fires. If there's a known constraint we
haven't found (a propagation delay, a subcommittee-assignment detail not
visible to the caller, something specific to event subscriptions as opposed
to cron/block-tick subscriptions), we'd genuinely appreciate a pointer — happy
to share subscription IDs and transaction hashes for any of the six attempts
if that helps you look server-side.

---

## 7. Testnet WebSocket path is ambiguous across sources

**Expected:** one canonical WS endpoint for Shannon testnet market data.

**Actual:** different sources give `wss://stg.api.dreamdex.io/v0/ws/public`
and `wss://stg.api.dreamdex.io/ws/public` (missing `/v0`). We didn't fully
resolve which is authoritative — `/v0/ws/public` worked when we tried it, but
the discrepancy across docs is worth tidying up.

---

## 8. The markets indexer GraphQL endpoint isn't exported by the SDK

**Expected:** the Hasura GraphQL indexer URL the SDK's binary-market queries
run against (`https://dev.smk.somnia.host/v1/graphql` on testnet) to be an
exported constant, the way `SOMNIA_TESTNET_PRICE_FEED` is for the price feed.

**Actual:** it exists only in prose documentation and the Bot Kit's own
config; nothing in `@somnia-chain/markets-sdk`'s exports surfaces it, so an
integrator has to already know it before `SomniaMarkets`'s `indexerUrl` field
can be filled in.

**Suggested fix:** export it as `SOMNIA_TESTNET_INDEXER` (or similar),
mirroring the price-feed convention already in place.

---

## 9. `eth_getLogs`'s `topics` filter is not reliably enforced by the RPC endpoint

This is a separate issue from item 6 — almost certainly a different code
path (JSON-RPC log querying vs. the reactivity precompile's own event
matching) — but we flag it because it produces confidently-wrong data rather
than a visible error, which is the costliest kind of bug to catch.

**Expected:** `eth_getLogs({ address, topics: [topic0] })` on
`https://dream-rpc.somnia.network` returns only logs whose first topic
matches `topic0` exactly.

**Actual:** a direct check across a 500-block window found **262 of 286
"filtered" results carried a different `topics[0]` than requested** — other
event types emitted by the same contract address were returned alongside
genuine matches, despite the exact-match filter parameter.

**How we found it:** our own off-chain price-polling script (built as a
fallback once the reactivity issue above was confirmed) decoded one of these
non-matching logs as if it were our requested event, producing an obviously
wrong value (~92 instead of ~79,000 for a BTC price) that briefly reached our
own contract before a downstream sanity check caught it.

**Suggested fix:** worth investigating server-side. In the meantime we'd
suggest documenting this behavior so other integrators know to re-check
`log.topics[0]` client-side rather than trusting the filter parameter alone
— we only caught it because the resulting value was implausible enough to
trip a safety check we'd already built for an unrelated reason.

---

## 10. Minor: `VENUE_ID` churn has no visible changelog

The Bot Kit's own documentation notes `VENUE_ID` changed three times in the
week before we started building, on both networks. We understand this may be
inherent to an actively-developed testnet, but a status page, Discord
pinned-message update, or changelog entry each time this happens would save
every integrator the same "why do I see zero markets" debugging session we
went through before realizing the venue itself had moved.

---

Thank you for building Event Contracts and running this hackathon — the
"no preset strikes, opening price is the line" design is genuinely elegant,
and it's the reason our whole project exists. These are the rough edges we
hit building on it in good faith; we hope they're useful.
