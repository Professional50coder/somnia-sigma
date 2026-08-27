# Sigma — Brand & Product Identity

---

# 1. Name

## **Sigma**

**σ** is the symbol for volatility. It is the one input that turns a dreamDEX
Event Contract from a coin flip into a priced instrument, and it is the input
nobody in this hackathon is computing. Naming the product after it states the
thesis in a single character.

It also survives every practical test: one word, five letters, unambiguous to
spell aloud, reads correctly to a DeFi audience on first contact, and reduces to
a single glyph that works at 16px.

### Why not the alternatives

| Rejected | Reason |
|---|---|
| **EventArena** | The concept it named lands in the same lane as Rivo, QDS and Vitamin M — a fourth AI-agent entry |
| **Waterline** | Evocative for "the line to beat", but says nothing about fair value or rigour |
| **Fairline** | Descriptive but flat; reads like a utility, not a product |
| **Vega, Delta** | Greek-letter DeFi names are heavily overused and Vega is a live protocol |
| **EventMind, EventOS** | Generic "AI-thing" naming; exactly the register the crowded lane already occupies |

---

# 2. Tagline

> ## One line to beat. Sigma tells you the odds.

Six words. It borrows dreamDEX's own framing of the instrument — *"there are no
preset strikes; there is one line to beat: the window's opening price"* — and
answers it directly. A judge who has read the Event Contracts docs recognises
the reference immediately and understands the product before the next sentence.

**Positioning line** (for the repo header, deck, and DoraHacks summary):

> **The fair-value layer for dreamDEX Event Contracts.**
> Every window has a fair price. Sigma computes it on-chain, publishes it as an
> oracle anyone can read, and trades the gap.

**One-sentence BUIDL submission blurb** (fits the DoraHacks card):

> Event Contract prices *are* probabilities, but nothing tells you whether the
> one you're paying is right — Sigma computes each window's fair probability
> from realised volatility measured on-chain from dreamDEX's own live mark price,
> publishes the edge on-chain for any builder to consume, and trades the
> mispricing through the dreamDEX SDK.

---

# 3. Icon

**Primary mark: `σ` bisected by a horizontal rule.**

The rule is the opening price — the line to beat. The sigma sits across it. The
whole thesis in one glyph.

```
        ╭─────────────╮
        │             │
        │    ┌───     │
        │   σ         │      the horizontal rule runs edge to edge
        │ ──┼──────── │      through the sigma's waist
        │             │
        ╰─────────────╯
```

**Specification**

| Property | Value |
|---|---|
| Mark | Lowercase Greek sigma `σ`, geometric sans, optically centred |
| Rule | 1px (16px) → 2px (32px+) horizontal, full-bleed, at the sigma's x-height midpoint |
| Container | Rounded square, 22% corner radius |
| Favicon fallback | `σ` alone — the rule disappears below 16px, so ship a ruleless variant |
| Emoji stand-in | 📐 (measurement, a straight edge) — used for the artifact favicon |

**Do not:** add a chart line, an upward arrow, a candlestick, or a robot. Every
one of those is what the crowded lane looks like.

---

# 4. Mission

> **Make the fair price of every Event Contract visible, verifiable, and free.**

Event Contract prices are probabilities. That makes them uniquely checkable —
unlike almost any other instrument in DeFi, there is a right answer, and it can
be computed. Sigma exists to compute it and give it away, so that no participant
in this market is trading blind against someone who did the maths.

---

# 5. Vision

> **A prediction market where the fair price is public infrastructure, not private edge.**

In every mature derivatives market, fair value is a shared utility — Black-Scholes
is not proprietary, DVOL is published, implied vol surfaces are on every screen.
Prediction markets have not had that layer, so pricing knowledge stays with
whoever built their own model.

Sigma's end state is that the fair probability of every open window, for every
venue, is a public on-chain feed — read by interfaces to warn users, by market
makers to quote, by risk systems to size, and by the next generation of
strategies as a primitive they never had to build.

The measure of success is not that Sigma trades well. It is that other people's
products get better because Sigma exists.

---

# 6. Goal

## 6.1 Hackathon goal (by 2026-09-08)

Ship a working testnet product that demonstrably does four things:

1. **Measures** realised volatility on-chain, continuously, from dreamDEX's own
   live mark price (`MarkPriceUpdated`, ~2s cadence) — with no keeper process.
2. **Publishes** a fair probability, edge in basis points, and break-even win
   rate for every open window, on-chain and consumable by any contract.
3. **Trades** the mispricing through `@somnia-chain/markets-sdk` and the
   dreamDEX Bot Kit, with correct tick quantization and claim handling.
4. **Shows** all of it in an Edge Radar that a judge understands in ten seconds.

## 6.2 What "winning" requires, mapped to the rubric

| Weight | Criterion | Sigma's answer |
|---|---|---|
| 25% | Technical Implementation | Ships as a Bot Kit strategy on the real SDK; on-chain oracle; reactivity + cron; SciPy-validated pricing math |
| 20% | Innovation & Originality | The only entry that prices the instrument. Exploits the "no strikes" property nobody else noticed |
| 20% | UX & Design | Edge Radar — live fair value vs book, edge highlighted, designed not tabulated |
| 20% | Business & Ecosystem | Public good other builders consume + native builder-fee revenue that grows dreamDEX volume |
| 15% | Presentation & Demo | Live testnet trades with P&L accruing on camera; the vol subscription proven to run unattended |

## 6.3 Beyond the hackathon

- Fair-value feed across all four cadences (15m / 1h / 4h / 24h), every
  underlying, every venue.
- A quoting integration for `ec-maker` — the organiser's market maker currently
  quotes "around fair probability" with nothing supplying that number.
- Builder-fee revenue from originated orders.
- A published volatility index for Somnia, calibrated on the dreamDEX mark feed.

---

# 7. The pitch (for the 2–3 minute demo video)

The 15% Presentation criterion asks for problem → solution → product → demo →
vision. This is that, in order, timed.

**Problem (0:00–0:25).**
> A dreamDEX Event Contract has no strike. There is one line to beat: the price
> the window opened at. So every market starts as a coin flip — and then, as
> price drifts off that line and the clock runs down, the real odds move fast.
> The book shows you a price. Nothing tells you whether that price is right.
> Pay 0.70 and you need to be right more than 70% of the time just to break even.

**Solution (0:25–0:50).**
> Sigma computes the fair probability of every open window. Volatility is
> measured on-chain, continuously, from dreamDEX's own live mark price —
> updating about every two seconds. No keeper, no server, no polling: Somnia
> Reactivity pushes every price update straight into the estimator, and the
> maths runs inside the handler.

**Product (0:50–1:30).**
> Edge Radar. Every live window, the book's implied probability, Sigma's model
> probability, and the gap between them in basis points. Green when the market
> is cheap, red when it is expensive. And the fair value isn't just in our UI —
> it's published on-chain, so any builder here can read it. `ec-maker` quotes
> around a fair probability; nothing in the kit tells it what that is. Sigma does.

**Demo (1:30–2:30).**
> Live on Shannon testnet. Watch a window drift off its opening line — fair
> value moves, the book lags, edge opens up. Sigma places the order through the
> dreamDEX SDK, quantized to the venue tick grid. Window settles, position is
> claimed, track record updates. Predicted edge against realised outcome, on
> screen, no cherry-picking.

**Vision (2:30–2:50).**
> Fair value should be public infrastructure, not private edge. Sigma's goal
> isn't to trade well. It's that everything else built on Event Contracts gets
> better because this number is free.

---

# 8. Voice

**Precise, unshowy, quantitative.** The differentiator is rigour, so the writing
has to sound rigorous. Numbers with units. Assumptions stated next to results.

**Rules**

- Never show an edge figure without the model that produced it.
- Report losses as prominently as wins. A track record that only shows green is
  not a track record.
- Say "model probability", never "prediction". Sigma prices; it does not forecast.
- No "AI-powered". Sigma's core is Φ(d₂) and an EWMA — that is a *stronger*
  claim than AI in this field, and it happens to be true.
- Name the limits: zero-drift GBM understates fat tails; the estimator needs a
  minimum sample count; stale volatility means no trade.

**Register check** — the field is named Vitamin M, Rivo Intelligence, QDS,
Market Dungeon. Sounding like a trading desk rather than a hackathon project is
itself a differentiator.

---

# 9. Visual direction

| Element | Direction |
|---|---|
| **Base** | Near-black ink (`#0B0D10`), not pure black. Terminal seriousness without the cliché. |
| **Surface** | Elevated slate panels, hairline borders — instrument-panel, not dashboard-card |
| **Edge positive** | Single restrained green, used *only* for positive edge |
| **Edge negative** | Single restrained red, used *only* for negative edge |
| **Neutral data** | Warm grey; most of the screen is neutral so the two edge colours mean something |
| **Accent** | One cool accent for the fair-value line itself |
| **Type** | Geometric sans for UI; **tabular-figure mono for every number**, non-negotiable — figures must not jitter as they tick |
| **Motion** | Values interpolate, never snap. The point is that fair value *moves* |
| **Density** | High. This is an instrument, and traders read dense screens |

**The one thing the interface must convey:** fair value is *alive* — it moves
every second as spot drifts and time decays — while the book sits still. That
visual gap **is** the product.

Colour tokens, contrast validation, and chart specifications belong in the
frontend plan, built with the `dataviz` and `frontend-design` skills.

---

# 10. Naming inside the codebase

| Thing | Name |
|---|---|
| Repo | `somnia-sigma` |
| On-chain fair-value feed | `SigmaOracle` |
| Volatility estimator | `RealizedVol` |
| Reactivity bridge | `SigmaReactiveVol` |
| Self-rescheduling cron | `SigmaCron` |
| Bot Kit strategy | `ec-sigma` |
| Frontend | Edge Radar |
| The number itself | **fair probability** (never "prediction", never "signal") |
