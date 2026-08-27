# Sigma — The Value, in Plain English

**One line to beat. Sigma tells you the odds.**

This is the explain-it-to-anyone document. No maths until you want it.

---

# 1. Explain it in one breath

> **dreamDEX lets you bet whether Bitcoin ends the next 15 minutes higher than
> it started. The price you pay is supposed to be the probability. Nobody checks
> whether it's the right probability. Sigma checks — and publishes the answer
> for free.**

---

# 2. Explain it to a non-trader

You're offered a bet: *will Bitcoin be higher in 15 minutes than it is right now?*

Someone charges you **70 cents** to win **1 dollar**.

Here's the thing almost nobody realises: paying 70 cents means you need to be
right **more than 70% of the time** just to break even. Not to profit — just to
stop losing.

So the only question that matters is: **is the real chance actually above 70%?**

That's a computable number. It depends on how far Bitcoin has already moved from
its starting line, how much time is left, and how jumpy the market is right now.
**Sigma computes it, every second, for every market.**

If the real chance is 83% and they're charging you 70 cents, that's a good bet.
If the real chance is 55%, you're being overcharged and nobody told you.

---

# 3. Explain it to a trader

Event Contracts have **no strikes**. The strike *is* the window's opening price.
So:

- At `t = 0`, every market is at-the-money — fair value is 0.50 by construction.
  There is nothing to know.
- Mid-window, `Φ(d₂)` with `K = openPrice` moves **fast and non-linearly** as
  spot drifts and `τ` decays.
- The book lags it. **That lag is the edge.**

Because the payout is fixed, the economics are exact rather than approximate:

| Quantity | Value |
|---|---|
| Break-even win rate | exactly the price |
| Edge | exactly `p − a` |
| Kelly | `f* = p − (1−p)·a/(1−a)` |

Real numbers from our own SciPy-validated engine:

| Situation | Fair probability |
|---|---|
| At the money, full window | **0.4980** |
| +0.3% with 10% of the window left | **0.8278** |
| −0.3% with 10% of the window left | **0.1706** |

A 0.3% BTC move is noise. Near expiry it's 83%. **If the book says 0.70, that's
1,278 bps of edge** — and no human eyeballs that correctly.

---

# 4. Why this is worth building at all

Three facts, each measured, that together make the case:

**1. There is a right answer.** Prediction market prices *are* probabilities.
Unlike almost anything else in DeFi, you can check whether the number is
correct. Sigma is validated against `scipy.stats.norm` across a grid of inputs.

**2. Nobody computes it.** Not the seven competing submissions. Not the six
Event Contract bots that ship in dreamDEX's own Bot Kit. There is no `Φ(d₂)`, no
volatility estimate, no fair price anywhere in the ecosystem.

**3. The organiser's own code needs it.** `ec-maker` is documented as
*"two-sided post-only quoting around **fair probability**"* — and nothing in the
kit tells it what that number is.

> **Sigma is the missing input to dreamDEX's own market maker.**

---

# 5. The value, by who gets it

| Who | What they get today |
|---|---|
| **A retail trader** | "You're paying 0.70. You need to be right 70% of the time. The real odds are 83% — this is cheap." One sentence, before they commit money. |
| **A market maker** | A number to quote around on a market with no book. Currently they have nothing to anchor to. |
| **Another builder** | A free on-chain read. Any of the other six submissions could consume it in one call — no model, no volatility pipeline, no maths. |
| **dreamDEX** | Empty markets become quotable, which is how a venue bootstraps liquidity. Volume it does not have today. |
| **Somnia** | A live showcase of Reactivity doing something that genuinely cannot be done off-chain as cleanly. |

---

# 6. Features

## Shipping for the hackathon

| Feature | What it does | Why it matters |
|---|---|---|
| **Fair-value engine** | `Φ(d₂)` with `K` = opening price, in Solidity | The number that defines the instrument |
| **On-chain volatility** | σ from dreamDEX's live mark price, ~2s cadence, **no keeper** | Runs unattended; impossible to do this cleanly elsewhere |
| **Public oracle** | Fair value, edge (bps), break-even, Kelly — readable by any contract | The public good. Nothing else here is shared infrastructure |
| **Edge Radar** | Every live window: book vs fair value, edge highlighted | Makes an invisible number obvious in ten seconds |
| **`ec-sigma` bot** | Trades the gap through the official SDK | Correct tick quantization, claim handling, real orders |
| **Book seeding** | Quotes around fair value on empty markets | Turns a dead market into a live one, on camera |
| **Track record** | Predicted edge vs realised outcome | Evidence, not assertion — losses included |
| **Backtest** | Calibration curve over hundreds of BTC windows | Answers "was that just luck?" |

## What we deliberately did **not** build

- No AI verdict or score — three of seven submissions already do that, and
  "validated against SciPy" is a **stronger** claim than "our AI thinks so."
- No agent leaderboard — same lane as two other entries.
- No generic trading bot — six ship in the box.
- **No profitability claim.** Sigma claims a measurable, auditable *signal*.

---

# 7. Why it wins the hackathon

| Weight | Criterion | Sigma |
|---|---|---|
| **25%** | Technical Implementation | Ships as a Bot Kit strategy on SDK 0.28.1; on-chain oracle; Reactivity + Solidity cron; **three independent implementations agreeing on one set of SciPy vectors** |
| **20%** | Innovation | The only entry that prices the instrument, built on the "no strikes" property nobody else noticed |
| **20%** | UX | Fair value visibly alive against a static book — the gap *is* the product |
| **20%** | Business & Ecosystem | A public good the other six can consume, plus an empty market made two-sided on camera |
| **15%** | Presentation | Volatility accumulating with nothing running; a real tx; a loss shown honestly |

**The differentiator in one sentence:**

> Every other submission competes on *"what will happen?"*
> Sigma competes on *"what should this cost, and is the book wrong right now?"*

The second question has an answer, and the answer is checkable.

---

# 8. Why it still matters after the hackathon

A hackathon project dies when the demo stops. This one has a reason to exist on
day 13.

**The analogy that makes it obvious:** in every mature derivatives market, fair
value is a **shared utility**. Black-Scholes isn't proprietary. Deribit
publishes DVOL. Implied-vol surfaces are on every screen at every desk.

Prediction markets never got that layer. Pricing knowledge stays private, with
whoever happened to build their own model.

**Sigma is that layer for Event Contracts.**

## The path

| Stage | What it becomes |
|---|---|
| **Now** | Fair value for BTC/ETH windows on one venue |
| **Next** | All four cadences (15m / 1h / 4h / 24h), every asset, every venue |
| **Then** | A **term structure** — the same asset priced across cadences at once, exposing whether the book prices short and long horizons consistently. Nothing in this ecosystem shows that |
| **Then** | Quoting integration for `ec-maker` and any other maker |
| **Then** | A published volatility index for Somnia |

## How it sustains itself

The `placeOrder` signature carries a **builder-fee** hook:

```solidity
address builder, uint96 builderFeeBpsTimes1k
```

Any interface originating an order can take a fee. Sigma earns from orders it
*causes* — which means its revenue grows dreamDEX's volume rather than
diverting it. Interests aligned by construction.

> **Stated honestly:** builder fees are **disabled on Shannon testnet**
> (`maxBuilderFeeBpsTimes1k = 0`, verified — any non-zero value reverts).
> Mainnet caps at 1%. So the path is implemented and visible in code, but
> **cannot be demonstrated executing** during this hackathon. We say so rather
> than imply otherwise.

## The measure of success

> **Not that Sigma trades well. That other people's products get better because
> Sigma exists.**

If `ec-maker` quotes better, if an interface warns a user before a bad fill, if
a risk system sizes correctly — that's the win, whether or not any of them ever
mention us.

---

# 9. What we will not overstate

The credibility of a fair-value product *is* the product. So:

- **Zero-drift GBM understates fat tails.** Stated in the UI and README.
- **σ comes from an order-book mark price, not a signed oracle attestation.**
  Cross-checked against the perp index: 0.12% apart on BTC. Close, not identical.
- **Builder fees can't be demoed on testnet.**
- **Shannon binaries have no liquidity** — which is why Sigma seeds the book.
- **Stale or cold volatility means no number**, never a guess.
- **Losses shown as prominently as wins.**
- **The calibration curve gets published either way.** If the model is
  mis-calibrated, that's the finding, and an honest curve beats a hidden one.

---

# 10. The thirty-second pitch

> dreamDEX Event Contracts have no strikes — there's one line to beat, the price
> the window opened at. So every market starts as a coin flip, and then the real
> odds move fast as price drifts and the clock runs down.
>
> The price you pay *is* a probability. Pay 0.70 and you need to be right 70% of
> the time to break even. Nothing tells you whether that's the right price.
>
> Sigma computes it. Volatility measured on-chain from dreamDEX's own price
> feed, every two seconds, with no server running anywhere. Fair value published
> on-chain so any builder can read it free.
>
> Their own market maker quotes "around fair probability" — and nothing in the
> kit tells it what that is. **We're that number.**
>
> We didn't predict the market. We priced it, and gave the price away.
