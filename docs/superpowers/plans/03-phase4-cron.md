# Phase 4 — Self-Rescheduling Cron

**Goal:** refresh the oracle at every window boundary with no keeper anywhere in
the system.

**Depends on:** Phase 3 · **Blocks:** Phase 5

---

## Why this matters

15-minute windows mean **96 markets per underlying per day**. No human trades
them all, and a hackathon submission that needs a laptop running to work is not
infrastructure.

Somnia is the only place this is possible in-protocol.

---

## The API — verified in the docs

```solidity
SomniaExtensions.scheduleSubscriptionAtBlock(address handler, uint64 blockNumber, SubscriptionOptions options);
SomniaExtensions.scheduleSubscriptionAtTimestamp(address handler, uint256 timestampMs, SubscriptionOptions options);
```

| Property | Value |
|---|---|
| Callable from Solidity | **Yes** — preferred for contract-owned subscriptions |
| Handler interface | the same `onEvent(address,bytes32[],bytes)` |
| Timestamp units | **milliseconds** |
| Minimum lead time | **≥ 12 seconds ahead** |
| Omitting `blockNumber` | recurring **every block** — far too often here |
| Specifying it | **one-shot** ← what we use |
| Docs example gas | `gasLimit: 2_000_000n` |
| Funding | docs state **≥ 32 SOMI** in the owning EOA |

> **Verify before building on it:** the "omit `blockNumber` → recurring"
> behaviour is documented for the **block** variant. The plan assumes the
> timestamp variant is one-shot. Confirm on testnet with a throwaway handler
> before wiring `SigmaCron` — if the timestamp variant also recurs, the handler
> must `unsubscribe` its own subscription id or every boundary doubles the
> firing rate.

**One-shot gives the pattern:** the handler does its work, then schedules its
own next invocation. Self-rescheduling, no cron server, no external process.

---

## Task 4.1 — `SigmaCron.sol`

**File:** `contracts/SigmaCron.sol`

```solidity
function onEvent(address, bytes32[] calldata, bytes calldata) external;  // precompile-only
function sweep() external onlyOwner;                                     // manual, for demo/recovery
function scheduleNext() public;                                          // arms the next boundary
function setCadence(uint32 seconds_) external onlyOwner;
uint256 public nextScheduledMs;
uint32  public cadenceSeconds;                                           // default 900
```

**Flow**

1. Precompile invokes `onEvent`
2. `oracle.refreshAll()` inside `try/catch`
3. `scheduleNext()` — **always**, even if the refresh reverted
4. Emit `SweepCompleted(windows, refreshed, failed, gasUsed)`

**The rule that matters:** rescheduling must happen even when the sweep fails.
A cron that stops arming itself after one bad window is a cron that silently
dies mid-demo. Order the calls so the reschedule cannot be skipped.

**Boundary alignment**

```
nextBoundary = ((now / cadence) + 1) * cadence
nextMs       = nextBoundary * 1000
require(nextMs >= now*1000 + 12_000)   // else skip to the following boundary
```

Refresh **shortly after** each boundary, not exactly on it — a window's opening
price must exist before it can be priced.

**Steps**

- [ ] Failing test first; confirm it fails
- [ ] Implement
- [ ] Tests pass
- [ ] Measure gas for a sweep of 1, 5, 20 windows

---

## Task 4.2 — Tests

**File:** `test/SigmaCron.test.ts`

The precompile does not exist locally, so `onEvent` is driven from an
impersonated `0x0100`. Live scheduling is proven in **Phase 5**, not here.

- [ ] rejects `onEvent` from a non-precompile caller
- [ ] a sweep refreshes every open window
- [ ] **a failing window does not abort the sweep** — the others still refresh,
      and a `WindowFailed` event names the failure
- [ ] `scheduleNext` still runs when `refreshAll` reverts
- [ ] `nextScheduledMs` lands on the next cadence boundary
- [ ] the ≥12s lead requirement is respected; a too-near boundary is skipped
- [ ] only the owner may `sweep()` or `setCadence()`
- [ ] `SweepCompleted` reports accurate counts

---

## Task 4.3 — Funding reality check

**Do this before writing any claim about unattended operation.**

- [ ] Read the actual deposit requirement on testnet
- [ ] Compare against the 50 STT we hold
- [ ] Compute daily burn: 96 sweeps/day × measured gas
- [ ] Decide and **record the decision**

| Outcome | Action |
|---|---|
| Affordable | Ship as designed. Claim unattended operation — it is true |
| Too expensive | Reduce cadence to 1h (24 sweeps/day) and say so |
| Unaffordable | **Fall back to an off-chain scheduled `refreshAll()`, and state that plainly in the README.** Do not describe a keeper-driven system as keeper-free |

The reactivity **volatility** subscription is the stronger and cheaper claim,
and it is independent of this phase. If cron proves unaffordable, Phase 5's
proof still stands on its own — σ accumulating unattended is the headline, and
cron is the convenience layer on top.

---

## Exit criteria

- [ ] Sweep survives a failing window, with a per-failure event
- [ ] Rescheduling asserted, including after a failed refresh
- [ ] Boundary alignment and the 12s minimum both tested
- [ ] Gas measured for 1 / 5 / 20 windows
- [ ] Funding decision recorded in `DEPLOYMENT.md`
- [ ] Suite green

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| ≥32 SOMI requirement unaffordable on testnet | **High** | Task 4.3 decides early; documented off-chain fallback |
| Reschedule skipped after a revert | **High** | Ordered so it cannot be; explicitly tested |
| Sweep exceeds the gas ceiling | Medium | Bound the batch; `refreshRange`; measured at 20 windows |
| Cron fires before the opening price exists | Medium | Refresh shortly after the boundary; `NoWindow`/`VolNotReady` are correct refusals |
| Cadence mismatch across the four window lengths | Low | Cadence 900 covers all four — longer windows simply refresh more often than strictly needed |
