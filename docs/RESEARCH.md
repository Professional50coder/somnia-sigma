# Somnia × dreamDEX Event Contracts Hackathon — Research Reference

**Compiled:** 2026-08-27 · **Deadline:** 2026-09-08 23:30 (12 days)
**Prize:** $5,000 USDso · **Platform:** [DoraHacks](https://dorahacks.io/hackathon/event-contracts)
**Required:** working prototype **on testnet** · public repo · **2–3 min** demo video
**Optional:** deck · a feedback report on the SDK and docs

Authoritative fact base for the project. Everything here was cross-verified
across two research passes; the second pass corrected several first-pass
conclusions, and those corrections are recorded in §9 rather than quietly
overwritten.

## Source grading

| Grade | Meaning |
|---|---|
| **A** | Official docs / official repo — exact signatures, addresses, quoted rules |
| **B** | Official marketing site, blog, or press release |
| **C** | Third-party coverage or search summary |
| **U** | Unverified — must be confirmed before it is load-bearing |

---

# 1. Judging criteria (A) — what actually earns points

| Weight | Criterion | What it rewards |
|---|---|---|
| **25%** | Technical Implementation | *"How effectively does the project use DreamDEX Event Contracts and available APIs/SDKs?"* |
| **20%** | Innovation & Originality | Novel use of Event Contracts against a real problem |
| **20%** | User Experience & Design | Intuitive, accessible, compelling |
| **20%** | Business & Ecosystem Impact | New users, trading activity, EC adoption, **sustainable** product |
| **15%** | Presentation & Demo | Problem → solution → product → demo → future vision |

The brief also states: *"We encourage experienced builders to create
production-ready applications rather than simple proof-of-concept."*

**Three consequences that shaped the design:**

1. Technical Implementation is the largest slice and *names the SDK*. A purely
   bespoke on-chain build forfeits points. The project must genuinely use
   `@somnia-chain/markets-sdk` and the Bot Kit.
2. UX is 20%. A data table is not enough; the interface has to be designed.
3. Business Impact is 20% and asks for sustainability. The **builder-fee**
   parameter in `placeOrder` (§4.3) is a native, honest answer.

---

# 2. THE INSTRUMENT — the most important section in this document

## 2.1 There are no strikes

> **"There are no preset strikes. There is one line to beat: the window's opening price."** (A)

Every Event Contract is **at-the-money at open**, by construction.

## 2.2 Settlement (A)

> *"If the settlement price is at or above the opening price → Up wins. If the
> settlement price is below the opening price → Down wins."*

- Settlement uses a **multi-source price reference**, not a single tick.
- **Ties favour Up** ("at or above").
- If no reliable settlement price can be determined the market **voids**, and
  both sides redeem **0.5** per contract.

This closes the Asian-vs-terminal question: settlement compares a terminal
reference against the opening price, **not** an average over the window. The
model is terminal-style.

## 2.3 Mechanics (A)

| Property | Value |
|---|---|
| Windows | **15m, 1h, 4h, 24h** (`intervalSec` 900 / 3600 / 14400 / 86400). The public docs mention only 15m and 1h; the SDK exposes four — see `SDK-NOTES.md` §4 |
| Underlyings | BTC, ETH |
| Book | Up and Down share **one** order book; **Down price = 1 − Up price** |
| Price semantics | Human-readable Up probabilities in (0,1) — **the price literally is a probability** |
| Complete sets | Mint/merge **1 USDso ⇄ 1 Up + 1 Down** |
| Collateral | Mainnet **USDso** · Testnet **tUSDC** — *not* USDC |
| Outcome tokens | **ERC-6909** (`OutcomeToken6909`) — Up/Down are token *ids*, not separate ERC-20s |
| Succession | Markets expire on schedule and **auto-roll to successors** |
| Fees | Zero protocol fee |
| Payout | Winner redeems 1 per contract; loser 0 |

## 2.4 Why "no strikes" is the whole opportunity

Because strike = opening price, at `t = 0` we have `S = K`, so

```
d₂ = −σ√τ ⁄ 2        →        fair probability ≈ 0.50
```

in **every market, every window, always**. Fair value only becomes informative
**during** the window, as spot drifts from the opening line and `τ` decays
toward zero.

Fair value is therefore a **fast-moving, path-dependent, time-decaying**
quantity. Late in a 15-minute window, a small move away from the opening line
combined with little remaining time can push the true probability to 0.85 while
the book still shows 0.70. No human eyeballs that correctly.

**`Φ(d₂)` evaluated with `strike = the window's opening price` is the defining
number of this instrument — and nothing in the ecosystem computes it.**

---

# 3. dreamDEX developer surface

## 3.1 SDK (A)

```bash
npm install @somnia-chain/markets-sdk viem
```

**Minimum version 0.28.0** — earlier versions have critical bugs with indexer
compatibility and price-grid alignment.

The Bot Kit layers `@dreamdex-bot-kit/ec-core` on top of the SDK for Event
Contracts specifically. EC code paths are separate from spot.

## 3.2 Contract addresses (A) — identical on mainnet and testnet via CREATE3

| Contract | Address |
|---|---|
| `BinaryMarketsModule` | `0x3ecC694Cef705358864a646142ac17A90E29e388` |
| `MarketsCore` | `0x2802504314685D89bF6C992CA5a8e7cC78bc0294` |
| `BinarySettlement` | `0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23` |
| `OutcomeToken6909` | `0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9` |
| `OracleHub` | `0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b` |
| `CollateralRouter` | `0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C` |
| Mainnet USDso | `0x00000022dA000002656c64D9eA6011ea952D008A` |
| **Testnet tUSDC** | `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` |

Per-window market and pool addresses resolve **dynamically** via the module
registry. **Do not hard-code them** — fetch via `GET /v0/markets`.

> **CORRECTED 2026-08-27.** An earlier pass assumed `OracleHub` was a price
> source. **It is not.** Verified against live chain logs: it emits no price
> event at all — it is a question-resolution hub whose richest event,
> `AnswerDelivered`, carries a YES/NO payout vector on the ~12-minute
> market-roll cycle. The subscribable BTC/ETH price feed is `MarkPriceUpdated`
> on the dreamDEX **spot pools**. See `INTEGRATION.md` §8.

## 3.3 Venue ID (A) — and a warning

Each network hosts multiple venues; `VENUE_ID` must be set explicitly.

```
Testnet  0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c
Mainnet  0x458b30c2d72bfd2c6317304a4594ecbafe5f729d3111b65fdc3a33bd48e5432d
```

> *"These move"* — both networks changed venue **three times in the first week
> of August**. Treat these as starting points and verify against live market
> rows. Venue drift presents as "no markets found", not as an error.

## 3.4 Network endpoints (A)

| | Mainnet | **Shannon Testnet** |
|---|---|---|
| Chain ID | `5031` | **`50312`** |
| RPC | `https://api.infra.mainnet.somnia.network` | **`https://dream-rpc.somnia.network`** |
| REST | `https://api.dreamdex.io/v0` | **`https://stg.api.dreamdex.io/v0`** |
| WebSocket | `wss://api.dreamdex.io/v0/ws/public` | `wss://stg.api.dreamdex.io/v0/ws/public` |

> Sources disagree on the testnet WS path (`/v0/ws/public` vs `/ws/public`).
> Try `/v0/ws/public` first, fall back. Noted so it is not mistaken for a bug.

## 3.5 Market discovery (A)

```javascript
loadMarkets()                                             // live markets; EXCLUDES finalized
client.listBinaryMarkets({ venueId, status: "Finalized" }) // settled markets, for redemption
```

- Market rows expose **`strike`** and **`intervalSec`**. Read those —
  *"Don't parse question text; wording changes."*
- **But `strike` is `"0"` on the real Up/Down venue** — the opening price comes
  from `getOpeningPrices()`. See `INTEGRATION.md` §4.
- Indexer status is a 7-value string enum and is **unreliable alone** (the
  Listed→Trading transition emits no event). Gate on
  `tradingStart <= now < expiry`.

---

# 4. The sharp edges (A) — each of these would otherwise cost a day

Quoted or paraphrased from the Bot Kit's own EC documentation. These are the
difference between a demo that works and one that fails on camera.

## 4.1 The price grid will silently reject model output

> *"Never hand the SDK a float price on an 18-decimal venue."*

`parseUnits(price.toFixed(18), 18)` introduces precision error:
`(0.05).toFixed(18)` → `"0.050000000000000003"` → three wei off-grid →
rejected as **`InvalidPrice`**. Of typical probabilities, *only 0.25, 0.5 and
0.75 survive* on mainnet.

**This is a direct threat to this project specifically.** A fair-value model
emits arbitrary probabilities like `0.6237`. Every one must be quantized to the
venue tick grid before it reaches the SDK.

- Use **`placeLimit(price, size, side, expireTimestampNs)`** from `ec-core` —
  converts via tick and lot integers, and checks wallet balance before signing
  so an underfunded order fails locally instead of burning gas.
- Size with **`quantize`** from `ec-core`, **not** the SDK's
  `amountToPrecision`, which skips lot sizing on binary markets.

## 4.2 Winnings are claimed, not received

Settled markets pay out only on explicit redemption; positions do not
auto-liquidate into collateral. Extended trading strands balances across
finalized markets.

```bash
AUTO_CLAIM=true
AUTO_CLAIM_INTERVAL_MS=600000        # sweep at most every 10 minutes
CLAIM_SCAN=25                        # recently settled markets to check
CLAIM=1 npm start -w ec-settlement   # one-shot recovery sweep
```

All strategies call `maybeClaim()` each loop. The loop design serialises claims
from one key to prevent nonce races. **Never run two bots on one key.**

## 4.3 Order placement and the builder-fee hook (A)

```solidity
function placeOrder(
    bool    isBid,
    uint64  userData,
    uint256 price,
    uint256 quantity,
    uint64  expireTimestampNs,   // NANOSECONDS
    uint8   orderType,
    uint8   selfMatchingOption,
    address builder,             // <-- builder-fee hook
    uint96  builderFeeBpsTimes1k
) external payable returns (bool success, uint128 orderId);
```

`payable`, with **automatic fund pulling** — no separate deposit step.

The `builder` / `builderFeeBpsTimes1k` pair is a first-class **builder-fee**
mechanism: any interface originating an order can name itself and take a fee.
A real revenue model that *increases* dreamDEX volume rather than diverting it
— the honest answer to the 20% Business & Ecosystem criterion.

## 4.4 The rest of the gotcha list (A)

| # | Trap | Consequence |
|---|---|---|
| 1 | Gate writes on **on-chain** status, not the indexer | Indexer lags seconds; only `Trading` accepts orders |
| 2 | **Reverted writes don't throw** | SDK writes skip simulation and resolve even after reverting — use `ec-core`'s `assertTxOk` |
| 3 | IOC vs resting is explicit | Unfilled limits rest with locked escrow; track open orders |
| 4 | `expireTimestampNs` is mandatory | Capped at market expiry; set just past your requote interval |
| 5 | Wallet reconciliation required | Takers pay the **fill** price, not the offered price |
| 6 | Scale expiry headroom to window length | Fixed thresholds break across 15m vs 1h venues |
| 7 | **Markets die on schedule and respawn** | Key state by `marketId`/symbol — **never** by pool address; pools recycle |
| 8 | `loadMarkets()` cannot see settled positions | Use `listBinaryMarkets({status:"Finalized"})` |

## 4.5 A known gap in the organiser's own code

> `ec-oracle-follow` *"requires underlying BTC/ETH price data, unavailable in
> market rows. The SDK's bundled price-feed works on testnet only."*

Underlying spot is not in market rows. On testnet the bundled feed works; on
mainnet it needs custom wiring. Sigma needs spot too — and reading it from
the dreamDEX spot pool's `MarkPriceUpdated` event on-chain is a cleaner answer
than either. See `INTEGRATION.md` §8.

---

# 5. Somnia platform primitives

## 5.1 Reactivity (A) — on-chain event subscriptions, no keeper

**Precompile:** `0x0000000000000000000000000000000000000100`

```solidity
uint256 subscribe(address handler, SubscriptionFilter filter, SubscriptionOptions options);

struct SubscriptionFilter { bytes32[4] eventTopics; address origin; address emitter; }
struct SubscriptionOptions { uint64 priorityFeePerGas; uint64 maxFeePerGas; uint64 gasLimit; }

function onEvent(address emitter, bytes32[] calldata topics, bytes calldata data) external;

void unsubscribe(uint256 subscriptionId);
SubscriptionData getSubscriptionInfo(uint256 subscriptionId);
```

- Extend the abstract `SomniaEventHandler` and override `_onEvent`.
- Zero filter fields are wildcards; **at least one must be non-zero**.
- **`subscribe` costs 210,000 gas**, charged to the sender.
- Handler gas is charged to the **subscription owner** — the handler contract
  must hold a balance.
- **Handler gas ceiling: 200,000,000 per invocation** — real computation fits.

Precedent: dreamDEX's own `SpotStopOrderRegistry` subscribes to `SpotPool`'s
`MarkPriceUpdated` through this precompile for conditional orders. (C)

## 5.2 Cron subscriptions (A) — callable from Solidity

```solidity
SomniaExtensions.scheduleSubscriptionAtBlock(address handler, uint64 blockNumber, SubscriptionOptions options);
SomniaExtensions.scheduleSubscriptionAtTimestamp(address handler, uint256 timestampMs, SubscriptionOptions options);
```

TypeScript equivalents: `sdk.scheduleSubscriptionAtBlock({...})` and
`sdk.scheduleSubscriptionAtTimestamp({...})`, with `isGuaranteed` /
`isCoalesced` flags.

- Handler interface is the same `onEvent(address,bytes32[],bytes)`.
- Timestamps are **milliseconds** and must be **at least 12 seconds ahead**.
- Omitting `blockNumber` gives **recurring every-block** execution; specifying
  one gives a **one-shot**.
- Docs example uses `gasLimit: 2_000_000n`; subscriptions require **at least
  32 SOMI** funded in the owning EOA.
- Prefer the Solidity path for contract-owned subscriptions.

> One-shot timestamp scheduling gives a clean **self-rescheduling** pattern: the
> handler does its work, then schedules its own next invocation at the next
> window boundary. No keeper, no external process, no cron server.

## 5.3 Agents (A) — consensus-validated off-chain compute

**`IAgentRequester`:** testnet `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` ·
mainnet `0x5E5205CF39E766118C01636bED000A54D93163E6`

```solidity
function createRequest(uint256 agentId, address callbackAddress, bytes4 callbackSelector, bytes payload)
    external payable returns (uint256 requestId);
function createAdvancedRequest(..., uint256 subcommitteeSize, uint256 threshold, ConsensusType, uint256 timeout)
    external payable returns (uint256 requestId);
function getRequestDeposit() external view returns (uint256);
```

Results arrive **asynchronously** via callback:

```solidity
function handleResponse(uint256 requestId, Response[] responses, ResponseStatus status, Request details) external;
```

`ResponseStatus`: `Success(2)` · `Failed(3)` · `TimedOut(4)`.

An invoked agent runs on a **subcommittee** of nodes; each executes
independently and submits an ABI-encoded result on-chain; the network agrees by
majority or configurable threshold. Default: **size 3, majority**. Base agents:
**JSON API Request · LLM Inference · LLM Parse Website**. LLM inference uses
fixed seeds and controlled temperature so outputs are deterministic across
nodes, which is what makes consensus over AI output possible. (B)

> **COST RISK (U).** Docs cite roughly **0.03 ETH** per agent execution, not
> confirmed in testnet STT terms. Call `getRequestDeposit()` before designing
> anything that invokes an agent per window. Agents stay **optional and
> non-load-bearing** here for exactly this reason.

## 5.4 Other Somnia primitives (A)

Data Streams (`@somnia-chain/streams`) · Reactivity SDK
(`@somnia-chain/reactivity`) · oracles (DIA, Protofire, Chainlink, VRF) ·
Ormi/Protofire subgraphs · testnet faucet at `testnet.somnia.network`.

---

# 6. The Bot Kit (A)

TypeScript **and** Python, pnpm workspace.

- `packages/core` — auth, REST, WebSocket, order execution, gotcha guards, nonce manager
- `packages/backtest` — bar-by-bar simulation with fill model and metrics
- `@dreamdex-bot-kit/ec-core` — the Event Contract layer over `markets-sdk`

**Shipped EC strategies:**

| Strategy | What it does |
|---|---|
| `ec-starter` | *"The hello world: read a market, cross a resting quote"* |
| `ec-maker` | **Two-sided post-only quoting around fair probability** |
| `ec-passive` | Single resting bid at your price |
| `ec-laddering-bot` | Resting probability ladder, flattens before expiry |
| `ec-oracle-follow` | Prices from underlying spot with a directional view |
| `ec-settlement` | Follows one market to expiry, or sweeps settled ones |

```bash
git clone https://github.com/somnia-chain/dreamdex-bot-kit && cd dreamdex-bot-kit
npm install && cp .env.example .env          # PRIVATE_KEY, NETWORK=testnet, VENUE_ID
npx tsx scripts/doctor.ts                    # read-only setup check
npm start -w ec-maker                        # DRY_RUN=true by default
npm run backtest -- run momentum --days 3 --quiet
```

## 6.1 What this means competitively — read before choosing a direction

**"An autonomous bot that trades Event Contracts" ships in the box.** Any
submission whose core is a trading bot competes against the organiser's own
sample code, and several of the seven appear to be close to exactly that.

What the Bot Kit does **not** contain is a **fair-value model**. No `Φ(d₂)`, no
volatility estimate, no edge computation, no published fair price.

And note the description of `ec-maker`: *"two-sided post-only quoting around
**fair probability**."* The organiser's own market maker quotes around a fair
probability — **and nothing in the kit tells it what that number is.**

That gap is the product. Shipping into it as a Bot Kit strategy also converts
"uses the SDK effectively" from a risk into a scored strength.

`packages/backtest` additionally provides backtest evidence nearly for free.

---

# 7. Competitive field — the 7 BUIDLs

All seven are in **Open Track**.

| # | BUIDL | Builder | Angle |
|---|---|---|---|
| 1 | **Branch** | nftking | Conditional/parlay paths; each leg signed only after the prior settles as predicted |
| 2 | **rampart** | Edy Cu | Protocol-locked resting quotes → provable "% of book that cannot be withdrawn" |
| 3 | **SLUICE MARKETS** | Tajudeeen | Max acceptable loss → largest policy-valid signed order |
| 4 | **Vitamin M** | Ram | Two AI agents (audit + adversarial) → GREEN/YELLOW/RED verdict |
| 5 | **Rivo Intelligence** | Rzbyte | Validates whether agents have real economic edge via shadow testing |
| 6 | **Market Dungeon** | CryptoMickle | EC outcomes as the survival gate of a roguelite |
| 7 | **QDS** | Martin | AI-powered analysis/trading platform |

## 7.1 Reading of the field

**Crowded.** Three of seven (Vitamin M, Rivo, QDS) are variants of *point an AI
at the market, emit a verdict*. Differentiating inside that lane in 12 days is
hard and judges will notice the repetition.

**Claimed.** Conditional chaining (Branch) · liquidity verification (rampart) ·
position sizing (Sluice) · gamification (Market Dungeon).

**Uncontested.** Nothing in the field:

- computes what a contract **should** cost;
- estimates volatility at all;
- publishes a reusable signal other builders can consume — all seven are closed
  end-user apps;
- addresses the fact that **strike = opening price**, the one feature that makes
  fair value non-obvious and worth computing.

## 7.2 The gap, stated plainly

> Every submission competes on **"what will happen?"**
> None competes on **"what should this cost, and is the book wrong right now?"**

The second question has a real answer, it is specific to short-window
at-the-money binaries, it produces a striking live demo, and it is useful to the
whole ecosystem rather than to one app.

---

# 8. Open questions

| # | Question | Status |
|---|---|---|
| 1 | dreamDEX addresses + ABI | **CLOSED** — §3.2 |
| 2 | Judging criteria | **CLOSED** — §1 |
| 3 | Live on testnet? | **CLOSED** — Shannon 50312, `stg.api.dreamdex.io` |
| 4 | Agent cost per call on testnet | **OPEN** — agents stay optional; call `getRequestDeposit()` if pursued |
| 5 | Cron subscription API | **CLOSED** — §5.2 |
| 6 | Historical data for backtest | **CLOSED** — `packages/backtest` + REST candles |
| 7 | Settlement rule | **CLOSED** — terminal vs opening price, multi-source. Not Asian. |
| 8 | Exact market-row schema (`strike`, `intervalSec`, status enum values) | **PARTIAL** — field names confirmed; resolve shapes by calling `GET /v0/markets` on day one |
| 9 | Testnet WS path | **OPEN, trivial** — `/v0/ws/public` vs `/ws/public` |
| 10 | Does `OracleHub` emit a subscribable price event? | **CLOSED — NO.** Verified against live logs: it emits no price event; it is a question-resolution hub. The subscribable feed is `MarkPriceUpdated` on the dreamDEX spot pools (BTC `0x3605f28a…326c`), ~2s cadence, 1e18. See `INTEGRATION.md` §8. |

Question 10 is the only remaining unknown that could force a design change, and
it has two workable fallbacks. Resolve it first.

---

# 9. Corrections made between passes

Recorded so the reasoning stays auditable.

| First pass said | Corrected to |
|---|---|
| Settlement asset is USDC | **USDso** (mainnet) / **tUSDC** (testnet) |
| Settlement rule unknown; possibly Asian — *"getting this wrong invalidates every number"* | **Terminal vs opening price**, multi-source reference. Terminal is correct. |
| Contracts have preset strikes | **No strikes.** Strike = the window's opening price; every market is ATM at open. |
| dreamDEX addresses unknown — top risk | **All published** — §3.2 |
| Judging criteria unknown | **Published** — §1; reweighted the design toward SDK use and UX |
| RPC `https://dream-rpc.somnia.network` was a guess | **Confirmed correct** |
| Autonomous trading is a differentiator | **It is not** — six EC bot strategies ship in the box. Fair value is the differentiator. |

---

# 10. Sources

**Hackathon**
- [DoraHacks — Event Contracts Hackathon](https://dorahacks.io/hackathon/event-contracts)
- [Eventbrite listing](https://www.eventbrite.com/e/event-contracts-hackathon-tickets-1998344868295)
- [Dev Telegram](https://t.me/+XHq0F0JXMyhmMzM0)

**dreamDEX**
- [Event Contracts developer docs](https://docs.dreamdex.io/developers/event-contracts)
- [Bot Kit](https://github.com/somnia-chain/dreamdex-bot-kit) · [EC guide](https://github.com/somnia-chain/dreamdex-bot-kit/blob/main/docs/event-contracts.md)
- [dreamDEX](https://www.dreamdex.io/) · [app](https://app.dreamdex.io/)
- [Hacken audit, Apr 2026](https://hacken.io/audits/somnia/sca-somnia-dreamdex-dream-dex-apr2026/)

**Somnia**
- [Agents — invoking from Solidity](https://docs.somnia.network/agents/invoking-agents/from-solidity) · [LLM inference](https://docs.somnia.network/agents/base-agents/llm-inference) · [Agents overview](https://somnia.network/agents)
- [Reactivity](https://docs.somnia.network/developer/reactivity) · [on-chain](https://docs.somnia.network/concepts/somnia-blockchain/on-chain-reactivity) · [cron via SDK](https://docs.somnia.network/developer/reactivity/tutorials/cron-subscriptions-via-sdk)
- [Network overview](https://docs.somnia.network/developer/network-info/network-overview-mainnet-testnet) · [WebSocket events](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying/listening-to-blockchain-events-websocket) · [Testnet hub](https://testnet.somnia.network/)
- [Somnia](https://somnia.network/)
