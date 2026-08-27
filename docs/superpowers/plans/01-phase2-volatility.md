# Phase 2 — Volatility Engine + Reactivity

**Goal:** σ accumulating on-chain, continuously, from dreamDEX's live mark price,
with no keeper process anywhere.

**Depends on:** Phase 1 (done) · **Blocks:** Phase 3
**Status:** `RealizedVol.sol` done (18 tests). Reactivity bridge remaining.

> **Corrects the superseded plan.** That plan had `SigmaReactiveVol` subscribing
> to `OracleHub`. **`OracleHub` emits no price event** — it resolves questions,
> not prices; its richest event `AnswerDelivered` carries a YES/NO payout vector
> and fires only on the ~12-minute market-roll cycle. Verified against live
> chain logs. The correct emitters are the dreamDEX **spot pools**.

---

## The feed — validated against a real log

```
event MarkPriceUpdated(address indexed asset, uint256 markPrice, uint256 rawMidpoint)

topic0    0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888
BTC pool  0x3605f28aa7c50e7441211e77cb0762d49539326c   (WBTC:USDso)
ETH pool  0xd180195da5459c7a0dea188ed61216ec43682b50   (WETH:USDso)
```

| Field | Location | Scale |
|---|---|---|
| `asset` | `topics[1]` (indexed) | address |
| `markPrice` | `data[0:32]` | **1e18, USD** |
| `rawMidpoint` | `data[32:64]` | 1e18, USD |

`markPrice` is **1e18 regardless of token decimals** — WBTC is an 8-decimal
token and its price is still 1e18. Measured cadence: **~1 update per asset every
~2 seconds**, continuously.

**One pool serves exactly one asset**, so filtering on `emitter` alone
disambiguates BTC from ETH. No topic slot is spent on `topics[1]`, leaving three
free.

**Provenance caveat, to be stated in the README:** `markPrice` is order-book
derived, not a signed oracle attestation. Cross-checked live against the perp
`FundingUpdated.indexPrice`: 79,438 vs 79,537 on BTC — **0.12% apart** — so it
tracks the real oracle closely and is not a thin-book artefact. The alternative
(`indexPrice`) fires only on funding settlement, ~5 minutes per asset, which is
too slow to estimate short-window volatility.

---

## Already delivered

`RealizedVol.sol`, 18 tests passing.

**The design decision worth keeping visible:** variance accumulates **per
second**, not per observation. The mark feed fires irregularly, so weighting
each tick equally would make σ a function of how chatty the feed happened to be
— which is not a property of the market. Volatility scales with time:

```
sigma(T) = sqrt(varianceRate * T)
```

`sigmaForSecondsWad(asset, intervalSec)` is what Phase 3 consumes, because a
window is defined by `intervalSec` (900 / 3600 / 14400 / 86400) — seconds, not
ticks.

> **Cleanup found in re-verification:** the earlier `sigmaForWindowWad(asset,
> observations)` — which scales by tick *count* — is still in the contract. It
> is exactly the mistake the per-second rate exists to avoid, and leaving two
> scaling paths invites the wrong one being used. Remove it (and its tests)
> when touching the contract next; `sigmaForSecondsWad` is the only window
> scaler.

> **Known approximation, stated rather than hidden:** the EWMA weights by
> *observation*, so with irregular tick spacing the effective lookback drifts
> with feed chattiness even though each increment is time-correct (`r²/dt`).
> Over the ~2 s cadence this is second-order; the irregular-vs-regular test
> below asserts equality to a loose (~20%) tolerance for exactly this reason.

Guards: `MIN_SAMPLES = 30`, `STALENESS_SECONDS = 300`,
`MAX_ABS_LOG_RETURN = 0.2`. An outlier is **skipped but its price adopted**, so
one bad print does not make the next return look enormous too.

---

## Task 2.1 — `ISomniaReactivity.sol` *(written, needs verification)*

**File:** `contracts/somnia/ISomniaReactivity.sol`

```solidity
address constant SOMNIA_REACTIVITY_PRECOMPILE = 0x0000000000000000000000000000000000000100;
bytes4  constant SOMNIA_ON_EVENT_SELECTOR     = 0x53edf33d;  // onEvent(address,bytes32[],bytes)

struct SubscriptionFilter { bytes32[4] eventTopics; address origin; address emitter; }
struct SubscriptionOptions { uint64 priorityFeePerGas; uint64 maxFeePerGas; uint64 gasLimit; }

function subscribe(address handler, SubscriptionFilter, SubscriptionOptions) external returns (uint256);
function unsubscribe(uint256 subscriptionId) external;
```

Selector `0x53edf33d` was read off **live subscriptions** on-chain via
`somnia_reactivityGetSubscriptionInfo`, not inferred.

- [ ] Confirm the selector equals `bytes4(keccak256("onEvent(address,bytes32[],bytes)"))`
- [ ] Confirm `subscribe` costs ~210,000 gas
- [ ] Note: handler gas is billed to the **subscription owner** — the handler
      contract must hold a balance or it silently stops being invoked

---

## Task 2.2 — `SigmaReactiveVol.sol`

**File:** `contracts/SigmaReactiveVol.sol`

**Responsibility:** receive `MarkPriceUpdated`, decode, forward to `RealizedVol`.
Nothing else. It is the narrowest possible bridge because every line runs
~43,000 times a day.

**Interface it produces**

```solidity
function onEvent(address emitter, bytes32[] calldata topics, bytes calldata data) external;
function subscribeTo(address pool, bytes32 topic0, address asset, uint64 priorityFee, uint64 maxFee, uint64 gasLimit)
    external returns (uint256 subscriptionId);
function mapEmitter(address pool, bytes32 topic0, address asset) external;
mapping(address => mapping(bytes32 => address)) public emitterAsset;
```

**Decode**

```solidity
// MarkPriceUpdated: asset indexed in topics[1]; markPrice = first word of data
uint256 markPrice = abi.decode(data[0:32], (uint256));   // 1e18
```

**Behaviour**

| Condition | Action |
|---|---|
| caller is not the precompile | revert `NotPrecompile()` |
| `topics.length == 0` | revert `BadPayload()` |
| emitter/topic pair unmapped | emit `EventIgnored`, **return** — never revert |
| `data.length < 32` | revert `BadPayload()` |
| otherwise | forward to `RealizedVol.recordPrice` |

Reverting on an unmapped emitter would waste the whole handler allowance on
noise. Ignoring must be **observable**, hence the event.

### Gas mitigation — required, not optional

~0.5 events/sec/asset ≈ **43,000 handler invocations per day per asset**, each
billed to this contract.

- [ ] Subscribe to **BTC only** for the demo. ETH doubles the burn for no
      additional narrative.
- [ ] Add `minMoveBps`: if `|priceChange|` is below threshold, update
      `lastPrice`/`updatedAt` and return **before** touching variance storage.
      The invocation still costs gas; the SSTOREs are what dominate.
- [ ] Add `receive() external payable` so the contract can be topped up.
- [ ] Emit `LowBalance` below a floor, so the demo fails loudly rather than
      silently going quiet.

### Steps

- [ ] Write the failing test (Task 2.3), run it, confirm it fails
- [ ] Implement `SigmaReactiveVol`
- [ ] Tests pass
- [ ] Measure handler gas with `gasUsed` on the local harness; record it

---

## Task 2.3 — Tests

**File:** `test/SigmaReactiveVol.test.ts`

The precompile does not exist on a local Hardhat chain, so `onEvent` is driven
from an **impersonated** `0x0100`. That proves decode-and-forward. Live
subscription behaviour is proven in Phase 5, not here — and the plan should not
pretend otherwise.

- [ ] rejects `onEvent` from any caller other than the precompile
- [ ] decodes a **real captured `MarkPriceUpdated` log** and forwards the price
      *(use actual bytes from the chain, not a hand-built payload — a
      hand-built payload tests our own assumption, not the venue's encoding)*
- [ ] ignores an unmapped emitter without reverting, and emits `EventIgnored`
- [ ] rejects a truncated payload
- [ ] first price sets the baseline and produces **no** sample
- [ ] second price produces exactly one sample
- [ ] a sub-threshold move does not touch variance storage
- [ ] only the owner can `mapEmitter` / `subscribeTo`

**File:** `test/RealizedVol.time.test.ts` — the time-aware path, which current
tests do not cover.

- [ ] `sigmaForSecondsWad` scales as √T: σ(3600) ≈ 2×σ(900)
- [ ] not-ok when cold, stale, or `seconds_ == 0`
- [ ] two observations in the same second do not corrupt the rate (`dt == 0`)
- [ ] irregular spacing gives ~the same σ as regular spacing of equal total
      elapsed time — **this is the whole point of the rate formulation, so it
      must be asserted, not assumed**

---

## Exit criteria

- [ ] Full suite green (83 existing + new)
- [ ] A real captured log decodes to the correct price
- [ ] Handler gas measured and recorded
- [ ] Unauthorised callers rejected; unmapped emitters ignored observably
- [ ] √T scaling asserted
- [ ] Docs updated with measured handler gas

---

## Risks

| Risk | Mitigation |
|---|---|
| Handler gas drains the deployer | BTC only; threshold gate; measure in P5; faucet re-claim is 24h-limited, so budget from day one |
| `topic0` wrong | Already validated against a real log. The SDK's own ABI file documents a past incident where two perp signatures had wrong arity and silently never matched — re-validate if anything changes |
| Mark price diverges from settlement price | 0.12% measured. Stated in README; not hidden |
| Subscription silently stops when balance hits zero | `LowBalance` event + balance check in the Phase 5 verify script |

---

## What this phase does **not** do

- Does not discover markets — that is off-chain, Phase 3.
- Does not compute fair value — Phase 3.
- Does not place orders — Phase 6.
- Does not prove unattended operation. **That is Phase 5**, and no claim of
  continuous operation may be made before `sampleCount` has been observed
  climbing on its own.
