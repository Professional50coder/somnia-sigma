# Phase 3 — Fair-Value Oracle

**Goal:** publish a fair probability, edge, and break-even win rate for every
open window, on-chain, readable by any contract.

**Depends on:** Phase 2 · **Blocks:** Phase 4
**This is the product.** Everything else demonstrates or consumes it.

> **Corrects the superseded plan**, which read the opening price from
> `market.strike` and had the oracle enumerate markets itself. Both are wrong:
> **`strike` is `"0"`** on the real Up/Down venue, and binary markets are only
> discoverable through the off-chain indexer. Measured 2026-08-27.

---

## The constraint that shapes this phase

Two findings, both measured live:

1. **Binary markets have no on-chain enumeration.** Discovery is
   `listBinaryMarkets` against a Hasura GraphQL indexer
   (`https://dev.smk.somnia.host/v1/graphql`).
2. **`strike` is `"0"`** on operator 2 — the real "closes at or above its
   opening price" venue. The opening price lives on the oracle's *reference
   question* and is reached with `client.getOpeningPrices(marketIds)`, a
   two-round-trip off-chain read.

Measured example: market `0x…afc1` (BTC, `strike: "0"`) → `referenceQuestionId
45668` → `numericValue "7952897"` → **79,528.97**.

So the oracle cannot self-discover a window's opening price. Pretending
otherwise would produce `ln(S/0) = Infinity` on every market.

### The split

| Concern | Where | Why |
|---|---|---|
| Window metadata | **pushed on-chain** by a permissioned publisher | only obtainable off-chain |
| σ | **on-chain**, reactivity | the genuinely keeper-free part |
| Fair value, edge, break-even, Kelly | **on-chain** | must be readable by other contracts to be a public good |
| Orders, quantization, claims | off-chain, SDK | the SDK solves these; 25% of the rubric names it |

The publisher is a trust boundary. It is made **explicit** — the registry
records who published each window and when — rather than obscured. A judge
asking "how does the contract know the opening price?" gets a straight answer.

---

## Task 3.1 — `SigmaWindowRegistry.sol`

**File:** `contracts/SigmaWindowRegistry.sol`

**Responsibility:** hold the off-chain-sourced facts about each window. Nothing
computed here.

```solidity
struct Window {
    bytes32 marketId;
    bytes32 asset;          // bytes32("BTC")
    address priceKey;       // the RealizedVol key for this asset
    address poolAddress;    // the window's BinaryMarket pool — the ON-CHAIN book
    uint256 openingPrice;   // from getOpeningPrices(), scale = openingScale
    uint8   openingScale;   // MEASURED as 2. Stored, never assumed.
    uint64  tradingStart;   // unix seconds
    uint64  expiry;         // unix seconds
    uint32  intervalSec;    // 900 | 3600 | 14400 | 86400
    address publisher;
    uint64  publishedAt;
    bool    exists;
}

function publishWindow(Window calldata w) external onlyPublisher;
function publishWindows(Window[] calldata ws) external onlyPublisher;
function getWindow(bytes32 marketId) external view returns (Window memory);
function openWindows() external view returns (bytes32[] memory);
function retire(bytes32 marketId) external onlyPublisher;
```

**Validation on publish — reject rather than store nonsense**

- [ ] `openingPrice != 0` — the `strike: "0"` trap, caught at the door
- [ ] `poolAddress != address(0)` — the oracle reads the book from it
- [ ] `expiry > tradingStart`
- [ ] `intervalSec` in `{900, 3600, 14400, 86400}` — the four measured cadences
- [ ] `expiry - tradingStart` is consistent with `intervalSec`
- [ ] republishing the same `marketId` updates rather than duplicates
- [ ] `openWindows()` excludes anything past `expiry`

**Tests**

- [ ] non-publisher cannot publish
- [ ] `openingPrice == 0` reverts
- [ ] bad `intervalSec` reverts
- [ ] `expiry <= tradingStart` reverts
- [ ] batch publish stores all
- [ ] expired windows drop out of `openWindows()`
- [ ] publisher and timestamp are recorded and readable

---

## Task 3.2 — the scale guard

**The 1e16 trap.** Opening price is **1e2**; the price feed is **1e18**. Nothing
on the market row states the scale, and the SDK exports no constant for it.

Measured at one instant:

```
opening price   "7952897"                    -> 79,528.97   (1e2)
feed spot       "79419790000000000000000"    -> 79,419.79   (1e18)
```

Because `d2` uses `ln(S/K)`, **a common scale cancels** — the absolute scale is
irrelevant provided both sides share it. The danger is a *mismatch*, which does
not error; it produces a confident, wrong, plausible-looking number.

**Guard, in `SigmaOracle` before pricing:**

```
ratio = spot / openingPrice        (both normalised to WAD)
require 0.5 < ratio < 2, else publish ok=false with reason ScaleMismatch
```

A BTC 15-minute window cannot move 2×. A ratio outside that band is a scale bug,
not a market move. **Refuse to publish rather than emit a wrong number** — this
is the single highest-value assertion in the codebase, because it is the one
failure that otherwise looks like success.

- [ ] `normalise(price, scale) -> WAD` helper, tested at scales 2, 8, 18
- [ ] a deliberate 1e16 mismatch is rejected
- [ ] a genuine 0.3% move passes untouched

---

## Task 3.3 — `SigmaOracle.sol`

**File:** `contracts/SigmaOracle.sol`

```solidity
struct FairValue {
    uint256 fairProbBps;
    uint256 impliedProbBps;
    int256  edgeBps;
    uint256 breakEvenBps;
    uint256 kellyWad;
    uint256 sigmaWad;
    uint256 tauWad;
    uint64  updatedAt;
    uint8   reason;     // 0 OK, 1 NoWindow, 2 Expired, 3 VolNotReady,
                        // 4 NoSpot, 5 ScaleMismatch, 6 NoBook
    bool    ok;
}

function refresh(bytes32 marketId) external returns (FairValue memory);
function refreshAll() external returns (uint256 count);
function getFairValue(bytes32 marketId) external view returns (FairValue memory);
function quote(bytes32 marketId, uint256 bookPriceWad) external view returns (FairValue memory);

event FairValuePublished(bytes32 indexed marketId, int256 edgeBps, uint256 fairProbBps, uint256 impliedProbBps, uint8 reason);
```

**Computation**

```
w      = registry.getWindow(marketId)
sigma  = realizedVol.sigmaForSecondsWad(w.priceKey, w.intervalSec)
spot   = realizedVol.lastPriceWad(w.priceKey)          // 1e18 from MarkPriceUpdated
K      = normalise(w.openingPrice, w.openingScale)     // -> WAD
tau    = (expiry - now) * WAD / (expiry - tradingStart)
fair   = BinaryPricer.probUp(spot, K, sigma, tau, Terminal)
```

Then edge, break-even and Kelly against the book price.

**Where the book price comes from — a correction found in re-verification.**
The first draft of this plan had `refresh()` publishing `impliedProbBps` and
`edgeBps` with no source for the book price — only `quote()` took one, supplied
externally. As written, `refresh` could not compute the edge it claimed to
publish.

The fix is better than the bug: dreamDEX is a **fully on-chain CLOB**, so the
book is readable on-chain. Each pool exposes

```solidity
getBookLevels(bool isBid, uint64 numLevels)   // note uint64 — wrong width reverts
```

The registry stores `poolAddress` per window (published alongside the opening
price, from the same indexer row), and `refresh` reads the best YES ask
directly:

```
ask = pool.getBookLevels(false, 1)      // best ask, YES terms, raw 6dp
askWad = ask.price * 1e12               // 6dp -> WAD
```

- Empty book (the normal Shannon state) → `ok = false, reason = NoBook` — and
  `fairProbBps` is STILL published, because fair value exists without a book.
  A consumer seeding an empty market needs exactly that number.
- `quote(marketId, bookPriceWad)` remains as a pure view for callers that carry
  their own price (the bot mid-quote, the frontend on an indexer read).
- Pool recycling is why `poolAddress` lives on the Window rather than anywhere
  global: it is valid only for that window's lifetime, and all state is keyed
  by `marketId` regardless.

This makes the pipeline on-chain end to end: σ (reactivity) → fair value
(BinaryPricer) → edge against the live book (pool read). Nothing off-chain in
the read path at all — a strictly stronger claim for the demo.

**Design rules**

- [ ] **`refresh` never reverts on missing data.** It publishes `ok = false`
      with a `reason`. Silence is indistinguishable from "no edge"; a typed
      reason is debuggable and honest.
- [ ] `quote()` is a pure view taking an externally supplied book price — for
      callers that already hold one (the bot's own mid, the frontend's indexer
      read). `refresh()` reads the book itself, on-chain, from the window's
      pool (see the correction above); `quote()` is the complement, not the
      only path.
- [ ] `tau == 0` (expired) → `ok = false, reason = Expired`
- [ ] `refreshAll` bounded and `try/catch` per window; one bad window must not
      abort the sweep. Sized against the 200,000,000 gas handler ceiling.

**Tests**

- [ ] unknown market → `NoWindow`
- [ ] empty book → `NoBook`, but `fairProbBps` still published and non-zero
- [ ] cold σ → `VolNotReady`
- [ ] expired window → `Expired`
- [ ] scale mismatch → `ScaleMismatch`
- [ ] happy path: ATM at open → fair ≈ 0.4980 (matches the SciPy anchor)
- [ ] **the demo case**: +0.3% with 10% of window left, book 0.70 → fair ≈ 0.828,
      edge ≈ +1278 bps, break-even 7000 bps
- [ ] `edgeBps == fairProbBps - impliedProbBps` exactly
- [ ] event emitted on every refresh, including not-ok
- [ ] `refreshAll` continues past a failing window and reports the count

---

## Exit criteria

- [ ] Fair value computed on-chain from pushed metadata + on-chain σ
- [ ] All six not-ok reasons reachable and tested
- [ ] Scale guard rejects a 1e16 mismatch
- [ ] Demo case reproduces the SciPy anchor **on-chain**
- [ ] `FairValuePublished` emitted for every window, ok or not
- [ ] Gas per `refresh` measured; `refreshAll` bound established
- [ ] Suite green

---

## Risks

| Risk | Mitigation |
|---|---|
| Publisher reads as centralised | Recorded on-chain per window; stated plainly. Roadmap: a Somnia Agent could publish under consensus — deliberately out of scope, cost unmeasured |
| Opening-price scale is not 2 on some series | Stored per window, never assumed; `scaleStrike`-style inference cross-check off-chain before publishing |
| σ stale during a quiet market | `ok = false, VolNotReady`. Correct behaviour, not a bug |
| `refreshAll` exceeds gas | Bound the batch; expose `refreshRange` |
| Spot from `MarkPriceUpdated` vs opening price from the settlement oracle | Different sources — that is the 0.12% divergence. The scale guard catches gross mismatch; the residual is disclosed |

---

## Why this phase is the differentiator

The other seven submissions are closed end-user apps. This is the only artefact
another builder can consume.

`ec-maker` is documented as *"two-sided post-only quoting around **fair
probability**"* — and nothing in the Bot Kit tells it what that number is. After
this phase, one contract call does.
