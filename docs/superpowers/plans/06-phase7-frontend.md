# Phase 7 — Edge Radar

**Goal:** make Sigma legible in ten seconds.

**Depends on:** Phase 5 · **Parallel with:** Phases 6, 8
**20% of the rubric** — "How intuitive, accessible, and usable is the product?"

> **Load the `frontend-design` and `dataviz` skills before writing any UI code.**
> Chart colour, stat tiles, and dashboard layout are decided there, not here.

---

## The one idea the interface must convey

> **Fair value is alive. The book is not.**

Fair value moves every second as spot drifts off the opening line and time
decays. The book sits still. **That gap is the product**, and the design exists
to make it impossible to miss.

Everything else is supporting material.

---

## Stack

Next.js (App Router) · viem + wagmi · TypeScript · static export (no server
component). Reads `deployments/somniaTestnet.json` — never a hard-coded address.

```
NEXT_PUBLIC_CHAIN_ID=50312
NEXT_PUBLIC_RPC=https://dream-rpc.somnia.network
NEXT_PUBLIC_INDEXER=https://dev.smk.somnia.host/v1/graphql
NEXT_PUBLIC_PRICE_FEED=https://price-feed.dev.oracle.somnia.host/v1/graphql
NEXT_PUBLIC_VENUE_ID=0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c
```

---

## Screen 1 — Edge Radar (the money screen)

One row per live window, sorted **closing soonest first** — `closingSoon` is
already the default ordering of `listLiveBinaryMarkets`, and it puts the rows
where fair value diverges most at the top for free.

| Column | Notes |
|---|---|
| Asset / cadence | BTC · 15m |
| **Opening line** | the strike — the thing to beat |
| Spot | live, from the price feed |
| Δ from line | in **bps**, signed |
| Time left | counts down; drives the urgency |
| **Book implied** | from `getBookTops`; `—` when the book is empty |
| **Sigma fair** | the number nobody else has |
| **Edge (bps)** | signed, the only green/red on screen |
| Break-even | the win rate the price demands |
| Status | `LIVE` · `SEEDED BY SIGMA` · `NO BOOK` |

**Rules**

- [ ] Tabular figures throughout — digits must not jitter as they tick
- [ ] Values **interpolate**, never snap. The point is that fair value moves
- [ ] Green and red used **only** for edge sign; everything else neutral, so the
      two colours carry meaning
- [ ] Not-ok rows render the **reason** (`VolNotReady`, `NoBook`, `Expired`), not
      a blank. "We don't know" is information; an empty cell is not
- [ ] An empty book shows `—`, never `0.00` — they mean opposite things

---

## Screen 2 — Window detail

One market, its whole life. **This is where the thesis becomes visible.**

- [ ] Dual-axis chart over the window: spot against the opening line, and fair
      value against the book
- [ ] The opening line drawn as a horizontal rule — the same motif as the logo
- [ ] Shade the region between fair value and book: **that area is the edge**
- [ ] Time-decay is the story: annotate that the *same* Δ-from-line means
      something different with 12 minutes left than with 40 seconds
- [ ] Mark Sigma's orders on the timeline
- [ ] Show the model and its assumptions **on the same screen as the numbers**

---

## Screen 3 — Track record

Credibility, not marketing.

- [ ] Trades, win rate, P&L curve
- [ ] **Predicted edge vs realised outcome** — the honesty artefact
- [ ] Calibration scatter: predicted probability against realised frequency
- [ ] **Losses as visually prominent as wins.** A green-only record is not a
      record, and a judge will notice
- [ ] Label clearly: live · seeded · replayed

---

## Screen 4 — Backtest

- [ ] Calibration curve from Phase 8
- [ ] Parameters exposed (λ, min samples, staleness, edge threshold)
- [ ] Sample size stated — an edge over 20 windows is not an edge
- [ ] Labelled **REPLAY**, unambiguously

---

## Visual direction

Per `BRAND.md` §9. Near-black ink `#0B0D10`, hairline-bordered slate panels,
instrument-panel rather than dashboard-card. One restrained green, one
restrained red, reserved for edge. Cool accent for the fair-value line. **Mono
tabular figures for every number.** High density — traders read dense screens.

Favicon and mark: `σ` bisected by the opening-price rule (`brand/`).

---

## Task list

- [ ] Scaffold Next.js in `frontend/`
- [ ] `lib/sigma.ts` — read `SigmaOracle` via viem
- [ ] `lib/dreamdex.ts` — markets, book tops, price feed
- [ ] `lib/format.ts` — bps, probabilities, countdowns; **one place** for
      number formatting so scales cannot drift between screens
- [ ] Design tokens + layout shell
- [ ] Screen 1, then 2, then 3, then 4 — in that order, so a slip loses the
      least important screen
- [ ] Empty / cold / stale states for every screen
- [ ] Responsive: table scrolls in its own container; body never scrolls sideways
- [ ] Deploy (Vercel, or Hostinger via the MCP tooling already connected)

---

## Exit criteria

- [ ] Live fair value against a live book, updating
- [ ] The gap between them is the most legible thing on screen
- [ ] Every not-ok state renders a reason
- [ ] Track record shows losses
- [ ] Model assumptions visible beside the numbers
- [ ] Deployed to a public URL
- [ ] Readable on a laptop screen in a screen-share — **the judging context**

---

## Risks

| Risk | Mitigation |
|---|---|
| No live book → screen looks empty | Seeded rows are labelled `SEEDED BY SIGMA`; replay tab always has content |
| Numbers jitter and look unstable | Tabular figures + interpolation |
| Looks like every other trading dashboard | The opening-line motif, the shaded edge region, and the deliberate two-colour restraint |
| Scale bug between UI and chain | Single `format.ts`; assert UI value equals `getFairValue` on load |
| Too much scope for the time | Build in screen order; screens 3 and 4 are cuttable, 1 and 2 are not |
