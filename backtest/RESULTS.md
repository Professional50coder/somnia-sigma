# Sigma — Phase 8 Backtest Results

**Status: partial, time-boxed.** Steps 1–5 of the plan are done with real
data; step 6 (policy simulation) ran but its result should be **discarded**,
not reported as a finding — see §6. Everything below is honest about what
was and wasn't achieved.

## 1. Data

**Real data was obtained** — the live fetch to dreamDEX's price-feed indexer
succeeded on the first attempt (no synthetic fallback needed):

- Source: `https://price-feed.dev.oracle.somnia.host/v1/graphql`, BTC/USDC, M1 resolution
- **3,000 one-minute candles** (~50 hours, ~2.08 days) — this was the max returned by
  a single `limit:3000` request; deeper history/pagination via `from`/`to` was
  not explored under the time-box. **State this sample size honestly: ~2 days,
  not weeks.** Conclusions below are directional, not statistically bulletproof.

## 2. Pricer port — validated against the SciPy golden vectors

`backtest/pricer.mjs` implements `Φ(d₂)`, edge, break-even, and Kelly in plain
JS (float-based; a full TypeScript build was skipped under the time-box, this
is semantically the same port). Validated directly against
`test/vectors/binary_pricer.json` — the same vectors the Solidity is tested
against:

```
45/45 vectors matched within tolerance. Max abs error: 6.925e-8
PASS
```

This is three independent implementations (Solidity via solady fixed-point +
Abramowitz-Stegun rational approx, this erf-based JS port, and the original
SciPy reference) agreeing on one shared vector set — the strongest available
correctness claim, now extended to a third implementation.

## 3. Window reconstruction + volatility estimator

Reconstructed non-overlapping 15m and 1h windows from the minute bars: each
window's strike = its own opening bar's close (dreamDEX has no preset
strikes). Settlement: `close_at_end >= open` → Up, ties favor Up — the exact
rule dreamDEX uses.

**Volatility:** a single continuous EWMA of squared-log-return **per second**
runs across the whole bar series (matching `RealizedVol.recordPrice`'s
`rate = squared/dt` step), updated once per 60-second bar. Critically, the
decay constant was **converted by half-life, not copied raw** — this project's
own Phase 8 plan flagged copying `LAMBDA=0.94` across a different sampling
cadence as a bug to avoid. The contract applies λ=0.94 per real observation
(~2s cadence); converting to a 60s bar step:

```
λ_bar = 0.94 ^ (60/2) = 0.94^30 ≈ 0.15626
```

used exactly as computed, not tuned. `MIN_SAMPLES=30` (bar-observations, i.e.
30 minutes of warm-up) gates every checkpoint, matching `RealizedVol`'s own
refusal to price on a cold estimator.

**5,620 (τ, cadence, predicted, outcome) checkpoints** produced across both
cadences (2,758 from 15m windows, 2,862 from 1h windows) — one checkpoint per
minute-bar within each window's life, evaluated with the volatility state
*as of that bar*, exactly mirroring how the live oracle would price it.

## 4. Calibration — the headline finding

**Aggregate: Brier score 0.2071, log loss 0.7426** (over 5,620 checkpoints).

Decile table (predicted mean vs realised frequency, n=562/bucket):

| Bucket | Mean predicted | Realised freq | Gap |
|---|---|---|---|
| 0 (lowest) | 0.0021 | **0.1406** | model far too confident low |
| 1 | 0.0635 | 0.2242 | overconfident |
| 2 | 0.1995 | 0.3060 | overconfident |
| 3 | 0.3214 | 0.3594 | mild overconfidence |
| 4 | 0.4124 | 0.4235 | **well calibrated** |
| 5 | 0.4991 | 0.4093 | mild reversal (small n effect likely) |
| 6 | 0.5961 | 0.5142 | mild overconfidence |
| 7 | 0.7211 | 0.6068 | overconfident |
| 8 | 0.8944 | 0.7669 | overconfident |
| 9 (highest) | 0.9960 | **0.9146** | model far too confident high |

**Clear, symmetric pattern: the model is systematically overconfident in the
tails and well-calibrated in the middle.** Predicted ~0.2% at the low end
realises ~14%; predicted ~99.6% at the high end realises ~91%. This is
*exactly* the documented, expected failure mode of zero-drift GBM — it
understates fat tails — and this backtest is the first time that's been
measured rather than just asserted in the docs. **Reported as found, not
tuned away.**

By τ (time remaining): Brier improves monotonically as expiry approaches
(0.260 at τ>0.8, down to 0.109 at τ≤0.2) — the model gets more accurate
near expiry, which is expected (more of the path is realised, less
uncertainty to misjudge) but is a real, measured effect, not assumed.

By cadence: 15m windows (Brier 0.192) calibrate somewhat better than 1h
windows (Brier 0.222) in this sample — plausibly because the volatility
estimator's continuous EWMA is a better match to a shorter horizon, but with
only ~2 days of data this could easily be noise rather than a structural
effect. Do not over-read it.

## 5. What this means for the project

The tail overconfidence is real and should be stated plainly in the README/UI
(it already is, per `docs/DESIGN.md` §5.1's stated model limits) — this
backtest is the evidence behind that disclosure, not a new problem. A
reasonable roadmap item: a fat-tailed alternative (e.g. Student-t innovations)
would likely narrow the tail gap at some cost to middle-bucket simplicity —
worth a mention as future work, not something to build now.

## 6. Policy simulation — RUN BUT DISCARD, do not cite this number

A threshold-swept trade simulation ran (edge threshold vs a synthetic "book"),
but the book proxy used — **the model's own prediction from 2 bars earlier**
— is not a real market maker and is highly self-correlated with the model's
own eventual prediction. The resulting negative average P&L per trade
(`avgPnlPerTrade` around −0.02 to −0.09 in the raw JSON) is an artifact of
that weak assumption, not a finding about Sigma's trading edge. **This number
should not appear in any pitch, doc, or demo.** A real policy simulation needs
either genuine historical book/order data (not available for binaries per
`docs/INTEGRATION.md` — pools recycle, no clean history) or a more principled
synthetic book (e.g., a slower-reacting model with realistic staleness, not a
short lag of the same estimator). This is flagged as unfinished, not hidden.

## 7. Assumptions and limitations, stated explicitly

- **~2 days of BTC history only.** Directional evidence, not a large-sample proof.
- **Checkpoints within one window are not independent** — they share the same
  final settlement outcome, so decile buckets pool across many *different*
  windows (independent outcomes) but each window contributes many correlated
  points. This inflates the effective sample size somewhat; the reported n's
  are checkpoint counts, not independent-window counts (there are only
  ~184 fifteen-minute windows and ~46 one-hour windows in ~2 days of data —
  far fewer than 5,620). **The true independent sample size for the
  calibration claim is closer to ~230 windows, not 5,620** — this matters and
  should be the number quoted if this is cited anywhere.
- Volatility estimator is a single continuous run across the whole series,
  not reset per window — matches the live design intent.
- Policy simulation (§6) is explicitly discarded, not a result.
- No TypeScript build step was used (plain ESM `.mjs` instead) — a deliberate
  time-box tradeoff; semantically identical to the planned TS port.

## Files

- `backtest/pricer.mjs` — the ported pricing library
- `backtest/validate-pricer.mjs` — golden-vector validation (45/45 pass)
- `backtest/fetch-data.mjs` — live data fetch with synthetic fallback
- `backtest/run-backtest.mjs` — window reconstruction, calibration, sweep
- `backtest/data/btc_m1.json` — the 3,000 real M1 candles used
- `backtest/results.json` — full machine-readable output
