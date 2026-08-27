# Phase 8 — Replay Backtest

**Goal:** evidence that the edge is structural, not one lucky window.

**Depends on:** Phase 1 only — **can start any time**
**Parallel with:** Phases 6, 7

---

## Why this phase exists

The demo shows fair value diverging from a book on one live window. A judge is
entitled to ask whether that was luck.

This phase answers with hundreds of windows of BTC history and a **calibration
curve**: when Sigma says 70%, does it happen about 70% of the time?

That question has a right answer, and publishing it — favourable or not — is
worth more than any performance claim.

---

## What is NOT available

Two dead ends, confirmed by measurement, recorded so nobody re-walks them:

1. **The Bot Kit has no event-contract backtester.** All nine adapters are
   spot-only; there is no `strategies/ec-*/src/backtest.ts`.
2. **Binary candles are useless here.** `getCandles` is keyed by `poolAddress`,
   and **pools are recycled across successive markets** — one pool's series is a
   concatenation of unrelated 60s–3600s markets with no boundary marker. Add
   `lastPrice: null` and empty books on every live market, and there is no
   meaningful binary price history on Shannon.

So the backtest is built from the **underlying**, not from market history.

---

## The approach — reconstruct windows from BTC minute bars

Because dreamDEX has **no strikes** — the strike *is* the window's opening price
— a window can be reconstructed exactly from the underlying alone. Nothing about
the venue is needed.

```
for each synthetic window of length L in {900, 3600}:
    K       = price at window open                     <- the strike, by definition
    ticks   = minute bars within the window
    sigma   = EWMA variance rate over a trailing lookback, scaled to L
    for each tick t:
        tau  = (end - t) / L
        fair = Phi(d2(spot_t, K, sigma, tau))
        record (fair, tau, spot_t/K)
    outcome = close >= K                               <- settlement rule, exactly
```

Settlement is *"at or above the opening price"* — **ties resolve Up**. Encode
that; an off-by-one on the tie changes the calibration at the most common point.

**Input:** `client.fetchPriceCandles("BTC", "M1", { from, to })`
(`PRICE_RESOLUTION_SECONDS = { M1: 60, H1: 3600, D1: 86400 }`). Backfill depth
is undocumented — **probe it first** and size the study to what actually exists.

---

## Task 8.1 — Data

- [ ] Probe how far `fetchPriceCandles("BTC","M1")` reaches; record it
- [ ] Pull the maximum available; cache to `data/btc-m1.json`
- [ ] Validate: monotonic timestamps, no gaps, plausible prices
- [ ] **Report the sample size honestly.** If only a few days exist, the study is
      small and must say so rather than imply significance it does not have
- [ ] Fall back to the dreamDEX REST OHLCV
      (`/v0/markets/{symbol}/candles`, ≤1000 per page, pages backwards to ~200k)
      if the feed's history is too shallow

---

## Task 8.2 — TypeScript pricer port

- [ ] Port `BinaryPricer` to TypeScript (`backtest/pricer.ts`)
- [ ] **Validate against the same SciPy golden vectors the Solidity uses** —
      three implementations, one set of vectors
- [ ] Assert the TS port agrees with the deployed contract on live inputs

Three independent implementations agreeing is the strongest correctness claim in
the submission, and it costs almost nothing once the vectors exist.

---

## Task 8.3 — Window reconstruction

- [ ] Slice minute bars into non-overlapping 15m and 1h windows
- [ ] `K` = opening price of each window
- [ ] EWMA variance rate over a trailing lookback, **matched to the contract by
      half-life, not by raw λ**. The contract applies λ = 0.94 per ~2-second
      observation (half-life ≈ 11 ticks ≈ 22 s of feed); the backtest steps in
      60-second bars. Copying λ = 0.94 per bar would give a ~11-minute half-life
      — a different estimator wearing the same number. Convert:
      `λ_bar = 0.94 ** (barSeconds / obsSeconds)` and state both values in the
      results
- [ ] **Exclude windows whose lookback is shorter than `MIN_SAMPLES`** — the
      contract refuses these, so the backtest must too. A backtest that prices
      windows the live system would skip is measuring a different strategy
- [ ] Outcome: `close >= K` (ties Up)

---

## Task 8.4 — Calibration

The headline output.

- [ ] Bucket predictions into deciles
- [ ] Per bucket: predicted mean vs realised frequency, with counts
- [ ] Brier score; log loss
- [ ] Plot calibration against the diagonal
- [ ] Break out by `τ` — the model matters most near expiry, and that is exactly
      where it should be checked hardest
- [ ] Break out by cadence (15m vs 1h)

**Honesty gate.** If the model is not calibrated, **publish the curve anyway**
and say what it shows. Zero-drift GBM understates fat tails; a curve that bends
away from the diagonal in the tails is the *expected* result and is far more
credible than a suspiciously perfect line.

---

## Task 8.5 — Strategy simulation

- [ ] Simulate a book: fair value plus a spread and a lag, since real books lag
      fast-moving fair value — that lag **is** the edge
- [ ] Apply the live policy: `|edge| >= threshold`, capped Kelly
- [ ] Report trades, win rate, P&L, mean predicted vs realised edge
- [ ] Sweep the edge threshold and report the curve, not one flattering point
- [ ] **State the assumptions loudly** — the simulated book is an assumption,
      and results are only as good as it is

---

## Exit criteria

- [ ] Calibration curve over hundreds of windows, with sample size stated
- [ ] Brier score and log loss reported
- [ ] Broken out by τ and by cadence
- [ ] TS port agrees with SciPy **and** with the deployed contract
- [ ] Threshold sweep, not a single cherry-picked number
- [ ] Assumptions and limitations written next to the results
- [ ] Feeds Screen 4 of the Edge Radar

---

## Risks

| Risk | Mitigation |
|---|---|
| Too little history | Probe first; state sample size; REST OHLCV fallback |
| Model poorly calibrated | Publish it. Honest error beats hidden error, and the fix (a vol-of-vol or drift term) is a credible roadmap item |
| Simulated book flatters the result | State the assumption; sweep spread and lag; never present one setting as *the* result |
| Overfitting λ or lookback | Fix them to the contract's values **converted by half-life to the bar cadence** — the backtest must measure what is deployed, not a tuned variant |
| Survivorship in window selection | Non-overlapping windows, no filtering on outcome |

---

## What this earns

Every other submission asserts its idea works. This one **measures** whether its
central number is right, publishes the measurement, and states the conditions
under which it fails.

In a field where three of seven entries are AI verdicts, a calibration curve is
a different category of claim.
