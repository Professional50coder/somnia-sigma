> # SUPERSEDED — do not execute
>
> Written 2026-08-27 **before** the dreamDEX SDK and live-chain findings landed.
> It contains assumptions since proven wrong:
>
> - reads the opening price from `market.strike` — which is **`"0"`** on the real venue
> - treats `OracleHub` as a price source — it **emits no price event**
> - omits tick quantization, the venue filter, and the empty-book reality
>
> Kept only as an audit trail. The live plan is `00-MASTER-PLAN.md`.

# Sigma — Contracts & Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the on-chain fair-value engine for dreamDEX Event Contracts — a pricing library, a continuously-updated realised-volatility accumulator driven by Somnia Reactivity, a public fair-value oracle, and an autonomous cron-driven policy vault.

**Architecture:** A pure math library (`BinaryPricer`) computes a binary option's fair probability from spot, strike, remaining time and volatility. `RealizedVol` maintains an EWMA of squared log returns, updated by a Reactivity handler subscribed to the underlying's price-update events — no keeper. `SigmaOracle` combines the two into a published fair value that any contract can read. `SigmaPolicyVault` is woken by a cron subscription at each window open, reads the oracle, and trades through an adapter interface that isolates the unresolved dreamDEX integration.

**Tech Stack:** Solidity 0.8.28 · Hardhat 3 (TypeScript, `node:test`) · viem · solady `FixedPointMathLib` · Python 3.11 + SciPy (reference oracle for test vectors)

**Spec:** [`docs/DESIGN.md`](../../DESIGN.md) · **Research:** [`docs/RESEARCH.md`](../../RESEARCH.md)

## Global Constraints

- **Solidity version:** `0.8.28` exactly, in every contract and in `hardhat.config.ts`.
- **Fixed point:** WAD = `1e18` throughout. Probabilities are WAD in library internals, basis points (`1e4`) at every external boundary.
- **Target chain:** Somnia **testnet, chain ID `50312`**, test token STT. Mainnet is `5031` (SOMI) — never a deploy target during the hackathon.
- **Reactivity precompile:** `0x0000000000000000000000000000000000000100`.
- **Agent registry (`IAgentRequester`):** testnet `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`, mainnet `0x5E5205CF39E766118C01636bED000A54D93163E6`.
- **Reactivity gas facts:** `subscribe` costs 210,000 gas charged to the sender; handler execution is charged to the subscription owner; handler gas ceiling is 200,000,000.
- **Never install Python packages into the PATH `python`** — it is a hermes venv. Create a dedicated venv at `D:\somnia-sigma\.venv`.
- **Repo lives at `D:\somnia-sigma`** — never on the OneDrive-synced Desktop.
- **No numeric claim without a model label.** Any function returning an edge or probability must also expose which model and settlement style produced it.
- **Do not commit** unless explicitly asked. Steps below stage and describe commits; run them only on request.

---

### Task 1: Repository, Hardhat, and verified Somnia testnet connectivity

**Files:**
- Create: `package.json`, `hardhat.config.ts`, `tsconfig.json`, `.gitignore`, `.env.example`
- Create: `test/network.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npx hardhat test` command; network alias `somniaTestnet` usable by all later tasks

- [ ] **Step 1: Initialise the project**

```bash
cd /d/somnia-sigma
npm init -y
npm install --save-dev hardhat@^3 @nomicfoundation/hardhat-toolbox-viem typescript ts-node @types/node dotenv
npm install solady
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
.env
artifacts/
cache/
typechain-types/
.venv/
frontend/.next/
```

- [ ] **Step 3: Write `hardhat.config.ts`**

The RPC URL is the one value here not confirmed by documentation — Step 5 verifies it before anything depends on it.

```typescript
import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViem],
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
  },
  networks: {
    somniaTestnet: {
      type: "http",
      chainId: 50312,
      url: process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};

export default config;
```

- [ ] **Step 4: Write `.env.example`**

```
SOMNIA_TESTNET_RPC=https://dream-rpc.somnia.network
SOMNIA_TESTNET_WS=wss://api.infra.testnet.somnia.network/ws
DEPLOYER_PRIVATE_KEY=
```

- [ ] **Step 5: Verify the RPC endpoint and chain ID**

The WebSocket URL `wss://api.infra.testnet.somnia.network/ws` is confirmed by Somnia docs; the HTTP RPC is not. Confirm it returns chain ID `50312` before continuing.

```bash
curl -s -X POST https://dream-rpc.somnia.network \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
```

Expected: `{"jsonrpc":"2.0","id":1,"result":"0xc488"}` — `0xc488` is 50312.

If this fails, find the correct endpoint at `testnet.somnia.network` or `docs.somnia.network/developer/network-info` and update `.env` before proceeding. **Do not continue with an unverified RPC.**

- [ ] **Step 6: Write the connectivity test**

```typescript
// test/network.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("somnia testnet config", () => {
  it("targets chain id 50312", async () => {
    const hre = await import("hardhat");
    const net = hre.default.config.networks.somniaTestnet as { chainId: number };
    assert.equal(net.chainId, 50312);
  });
});
```

- [ ] **Step 7: Run the test**

Run: `npx hardhat test`
Expected: PASS.

- [ ] **Step 8: Stage the commit (run only if asked)**

```bash
git init && git add . && git commit -m "chore: hardhat project targeting somnia testnet 50312"
```

---

### Task 2: Python reference oracle for test vectors

The Solidity math must be checked against something known-correct. SciPy is that
reference. This task produces a JSON file of golden vectors that Tasks 3–5 assert against.

**Files:**
- Create: `reference/pricer_reference.py`
- Create: `test/vectors/binary_pricer.json` (generated)

**Interfaces:**
- Produces: `test/vectors/binary_pricer.json` — array of `{S, K, sigma, tau, d2, prob}` with all values as decimal strings scaled by 1e18

- [ ] **Step 1: Create an isolated venv and install SciPy**

The PATH `python` is a hermes venv — do not install into it.

```bash
cd /d/somnia-sigma
python -m venv .venv
./.venv/Scripts/python.exe -m pip install --upgrade pip scipy
```

- [ ] **Step 2: Write the reference implementation**

```python
# reference/pricer_reference.py
"""Reference implementation of the Sigma binary pricer, used to generate
golden test vectors for the Solidity library. SciPy is the source of truth."""
import json, math, os
from scipy.stats import norm

WAD = 10**18


def d2(S: float, K: float, sigma: float, tau: float) -> float:
    """Zero-drift GBM d2 for a terminal-price binary."""
    return (math.log(S / K) - 0.5 * sigma * sigma * tau) / (sigma * math.sqrt(tau))


def prob_up(S: float, K: float, sigma: float, tau: float) -> float:
    """P(S_T > K) under zero-drift GBM."""
    return float(norm.cdf(d2(S, K, sigma, tau)))


def to_wad(x: float) -> str:
    return str(int(round(x * WAD)))


CASES = [
    # (spot, strike, sigma_per_window, tau_fraction_of_window)
    (100_000.0, 100_000.0, 0.01, 1.0),   # at the money
    (100_000.0,  99_500.0, 0.01, 1.0),   # in the money
    (100_000.0, 100_500.0, 0.01, 1.0),   # out of the money
    (100_000.0, 100_000.0, 0.02, 1.0),   # higher vol, ATM
    (100_000.0, 100_000.0, 0.01, 0.25),  # quarter of window remaining
    (100_000.0, 100_000.0, 0.01, 0.05),  # near expiry
    (100_000.0, 101_000.0, 0.005, 0.5),  # deep OTM, low vol
    (100_000.0,  98_000.0, 0.03, 1.0),   # deep ITM, high vol
    (  3_500.0,   3_500.0, 0.015, 1.0),  # ETH scale, ATM
    (  3_500.0,   3_520.0, 0.015, 0.4),  # ETH scale, OTM, partial window
]


def main() -> None:
    out = []
    for S, K, sigma, tau in CASES:
        out.append({
            "S": to_wad(S), "K": to_wad(K),
            "sigma": to_wad(sigma), "tau": to_wad(tau),
            "d2": to_wad(d2(S, K, sigma, tau)),
            "prob": to_wad(prob_up(S, K, sigma, tau)),
        })
    # Standard normal CDF vectors, for the Phi implementation specifically.
    phi = []
    for x in [-4.0, -3.0, -2.0, -1.5, -1.0, -0.5, -0.1, 0.0,
              0.1, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0]:
        phi.append({"x": to_wad(x), "cdf": to_wad(float(norm.cdf(x)))})

    os.makedirs("test/vectors", exist_ok=True)
    with open("test/vectors/binary_pricer.json", "w") as f:
        json.dump({"pricer": out, "phi": phi}, f, indent=2)
    print(f"wrote {len(out)} pricer vectors and {len(phi)} phi vectors")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Generate the vectors**

```bash
./.venv/Scripts/python.exe reference/pricer_reference.py
```

Expected: `wrote 10 pricer vectors and 15 phi vectors`

- [ ] **Step 4: Sanity-check one value by hand**

Open `test/vectors/binary_pricer.json`. The first case is at-the-money with
sigma 0.01 over a full window. `d2 = -0.5·σ·√τ = -0.005`, so `prob` must be
just under 0.5 — expect roughly `498004...` in the leading digits of the WAD
value (≈0.498). If it is not close to 0.5, the reference is wrong and every
downstream test would inherit the error.

- [ ] **Step 5: Stage the commit (run only if asked)**

```bash
git add reference/ test/vectors/ && git commit -m "test: scipy reference oracle and golden vectors"
```

---

### Task 3: `BinaryPricer` — standard normal CDF

**Files:**
- Create: `contracts/libraries/BinaryPricer.sol`
- Create: `contracts/test/BinaryPricerHarness.sol`
- Create: `test/BinaryPricer.phi.test.ts`

**Interfaces:**
- Consumes: `test/vectors/binary_pricer.json` from Task 2
- Produces: `BinaryPricer.normalCdf(int256 xWad) internal pure returns (uint256 probWad)`

- [ ] **Step 1: Write the failing test**

```typescript
// test/BinaryPricer.phi.test.ts
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import vectors from "./vectors/binary_pricer.json" with { type: "json" };

const TOLERANCE = 2_000_000_000n; // 2e-9 in WAD

describe("BinaryPricer.normalCdf", () => {
  let harness: any;

  before(async () => {
    const { viem } = await network.connect();
    harness = await viem.deployContract("BinaryPricerHarness");
  });

  for (const v of vectors.phi) {
    it(`matches scipy at x=${v.x}`, async () => {
      const got: bigint = await harness.read.normalCdf([BigInt(v.x)]);
      const want = BigInt(v.cdf);
      const diff = got > want ? got - want : want - got;
      assert.ok(diff <= TOLERANCE, `x=${v.x} got=${got} want=${want} diff=${diff}`);
    });
  }
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx hardhat test test/BinaryPricer.phi.test.ts`
Expected: FAIL — artifact `BinaryPricerHarness` not found.

- [ ] **Step 3: Implement `normalCdf`**

Uses the Abramowitz & Stegun 26.2.17 rational approximation, absolute error
below 7.5e-8 — comfortably inside the 2e-9-per-term tolerance once accumulated,
and far inside the precision that matters for a basis-point edge figure.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @title BinaryPricer
/// @notice Pure pricing math for fixed-payout binary (Up/Down) event contracts.
/// @dev All values are WAD (1e18) fixed point unless the name says Bps.
library BinaryPricer {
    using FixedPointMathLib for uint256;
    using FixedPointMathLib for int256;

    uint256 internal constant WAD = 1e18;

    // A&S 26.2.17 coefficients.
    int256 private constant P  =  231641900000000000;   // 0.2316419
    int256 private constant B1 =  319381530000000000;   // 0.319381530
    int256 private constant B2 = -356563782000000000;   // -0.356563782
    int256 private constant B3 = 1781477937000000000;   // 1.781477937
    int256 private constant B4 = -1821255978000000000;  // -1.821255978
    int256 private constant B5 = 1330274429000000000;   // 1.330274429
    // 1/sqrt(2*pi)
    int256 private constant INV_SQRT_2PI = 398942280401432677;

    /// @notice Standard normal cumulative distribution function.
    /// @param xWad The point at which to evaluate, WAD signed.
    /// @return probWad Phi(x) in WAD, always within [0, WAD].
    function normalCdf(int256 xWad) internal pure returns (uint256 probWad) {
        bool negative = xWad < 0;
        int256 x = negative ? -xWad : xWad;

        // t = 1 / (1 + p*x)
        int256 t = int256(WAD).sDivWad(int256(WAD) + P.sMulWad(x));

        // density = exp(-x^2 / 2) / sqrt(2*pi)
        int256 density = INV_SQRT_2PI.sMulWad((-x.sMulWad(x) / 2).expWad());

        // Horner evaluation of b1*t + b2*t^2 + b3*t^3 + b4*t^4 + b5*t^5
        int256 poly = B5;
        poly = poly.sMulWad(t) + B4;
        poly = poly.sMulWad(t) + B3;
        poly = poly.sMulWad(t) + B2;
        poly = poly.sMulWad(t) + B1;
        poly = poly.sMulWad(t);

        int256 upper = int256(WAD) - density.sMulWad(poly); // Phi(|x|)
        int256 result = negative ? int256(WAD) - upper : upper;

        if (result < 0) return 0;
        if (uint256(result) > WAD) return WAD;
        return uint256(result);
    }
}
```

- [ ] **Step 4: Write the test harness**

A library's `internal` functions are not externally callable, so tests go
through a thin harness contract.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BinaryPricer} from "../libraries/BinaryPricer.sol";

/// @dev Test-only external surface for the BinaryPricer library.
contract BinaryPricerHarness {
    function normalCdf(int256 xWad) external pure returns (uint256) {
        return BinaryPricer.normalCdf(xWad);
    }
}
```

- [ ] **Step 5: Run the test**

Run: `npx hardhat test test/BinaryPricer.phi.test.ts`
Expected: PASS, 15 cases.

If cases near x = ±4 fail while the centre passes, the A&S coefficients are
correct but tail precision is the limit of the approximation — widen `TOLERANCE`
to `1e11` (1e-7) and note it in the test, since that error is still three orders
of magnitude below one basis point.

- [ ] **Step 6: Stage the commit (run only if asked)**

```bash
git add contracts/ test/ && git commit -m "feat: normal CDF in BinaryPricer, validated against scipy"
```

---

### Task 4: `BinaryPricer` — model probability from spot, strike, vol, time

**Files:**
- Modify: `contracts/libraries/BinaryPricer.sol`
- Modify: `contracts/test/BinaryPricerHarness.sol`
- Create: `test/BinaryPricer.prob.test.ts`

**Interfaces:**
- Consumes: `BinaryPricer.normalCdf` from Task 3
- Produces:
  - `enum SettlementStyle { Terminal, Average }`
  - `BinaryPricer.d2(uint256 spotWad, uint256 strikeWad, uint256 sigmaWad, uint256 tauWad, SettlementStyle style) internal pure returns (int256)`
  - `BinaryPricer.probUp(uint256 spotWad, uint256 strikeWad, uint256 sigmaWad, uint256 tauWad, SettlementStyle style) internal pure returns (uint256 probWad)`

- [ ] **Step 1: Write the failing test**

```typescript
// test/BinaryPricer.prob.test.ts
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import vectors from "./vectors/binary_pricer.json" with { type: "json" };

const TOLERANCE = 100_000_000_000n; // 1e-7 WAD
const TERMINAL = 0;

describe("BinaryPricer.probUp", () => {
  let harness: any;

  before(async () => {
    const { viem } = await network.connect();
    harness = await viem.deployContract("BinaryPricerHarness");
  });

  for (const v of vectors.pricer) {
    it(`matches scipy for S=${v.S} K=${v.K}`, async () => {
      const got: bigint = await harness.read.probUp([
        BigInt(v.S), BigInt(v.K), BigInt(v.sigma), BigInt(v.tau), TERMINAL,
      ]);
      const want = BigInt(v.prob);
      const diff = got > want ? got - want : want - got;
      assert.ok(diff <= TOLERANCE, `got=${got} want=${want} diff=${diff}`);
    });
  }

  it("is monotonically decreasing in strike", async () => {
    const S = 100_000n * 10n ** 18n;
    const sigma = 10n ** 16n; // 0.01
    const tau = 10n ** 18n;
    const low: bigint  = await harness.read.probUp([S, 99_000n * 10n ** 18n, sigma, tau, TERMINAL]);
    const mid: bigint  = await harness.read.probUp([S, 100_000n * 10n ** 18n, sigma, tau, TERMINAL]);
    const high: bigint = await harness.read.probUp([S, 101_000n * 10n ** 18n, sigma, tau, TERMINAL]);
    assert.ok(low > mid && mid > high, `expected ${low} > ${mid} > ${high}`);
  });

  it("reverts when volatility is zero", async () => {
    await assert.rejects(() =>
      harness.read.probUp([100_000n * 10n ** 18n, 100_000n * 10n ** 18n, 0n, 10n ** 18n, TERMINAL]),
    );
  });

  it("reverts when time remaining is zero", async () => {
    await assert.rejects(() =>
      harness.read.probUp([100_000n * 10n ** 18n, 100_000n * 10n ** 18n, 10n ** 16n, 0n, TERMINAL]),
    );
  });

  it("average settlement gives a different price than terminal settlement", async () => {
    const args = [100_000n * 10n ** 18n, 99_000n * 10n ** 18n, 10n ** 16n, 10n ** 18n] as const;
    const terminal: bigint = await harness.read.probUp([...args, 0]);
    const average: bigint  = await harness.read.probUp([...args, 1]);
    assert.notEqual(terminal, average);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx hardhat test test/BinaryPricer.prob.test.ts`
Expected: FAIL — `probUp` is not a function on the harness.

- [ ] **Step 3: Add the implementation to `BinaryPricer.sol`**

Insert inside the library, after `normalCdf`:

```solidity
    /// @notice How the contract's settlement price is determined.
    /// @dev Terminal uses the price at expiry. Average uses the mean price over
    ///      the window (an Asian-style binary), whose effective volatility is
    ///      lower by a factor of sqrt(3). See RESEARCH.md open question #7 —
    ///      the dreamDEX settlement rule must be confirmed before any live claim.
    enum SettlementStyle { Terminal, Average }

    /// @dev 1/sqrt(3) in WAD.
    uint256 private constant INV_SQRT_3 = 577350269189625764;

    error ZeroVolatility();
    error ZeroTimeRemaining();
    error ZeroPrice();

    /// @notice Effective volatility for the given settlement style.
    function effectiveSigma(uint256 sigmaWad, SettlementStyle style)
        internal pure returns (uint256)
    {
        if (style == SettlementStyle.Average) return sigmaWad.mulWad(INV_SQRT_3);
        return sigmaWad;
    }

    /// @notice Zero-drift GBM d2 term.
    /// @param spotWad Current price of the underlying, WAD.
    /// @param strikeWad Contract strike, WAD.
    /// @param sigmaWad Volatility over the full window, WAD (not annualised).
    /// @param tauWad Fraction of the window remaining, WAD in (0, 1].
    function d2(
        uint256 spotWad,
        uint256 strikeWad,
        uint256 sigmaWad,
        uint256 tauWad,
        SettlementStyle style
    ) internal pure returns (int256) {
        if (spotWad == 0 || strikeWad == 0) revert ZeroPrice();
        if (sigmaWad == 0) revert ZeroVolatility();
        if (tauWad == 0) revert ZeroTimeRemaining();

        uint256 sigma = effectiveSigma(sigmaWad, style);
        // sigma scaled to the remaining fraction of the window: sigma * sqrt(tau)
        uint256 sigmaSqrtTau = sigma.mulWad(tauWad.sqrtWad());

        int256 logMoneyness = int256(spotWad.divWad(strikeWad)).lnWad();
        int256 drift = int256(sigmaSqrtTau.mulWad(sigmaSqrtTau) / 2);

        return (logMoneyness - drift).sDivWad(int256(sigmaSqrtTau));
    }

    /// @notice Probability the underlying finishes above the strike.
    function probUp(
        uint256 spotWad,
        uint256 strikeWad,
        uint256 sigmaWad,
        uint256 tauWad,
        SettlementStyle style
    ) internal pure returns (uint256 probWad) {
        return normalCdf(d2(spotWad, strikeWad, sigmaWad, tauWad, style));
    }
```

- [ ] **Step 4: Extend the harness**

Add to `BinaryPricerHarness`:

```solidity
    function d2(
        uint256 spotWad, uint256 strikeWad, uint256 sigmaWad,
        uint256 tauWad, BinaryPricer.SettlementStyle style
    ) external pure returns (int256) {
        return BinaryPricer.d2(spotWad, strikeWad, sigmaWad, tauWad, style);
    }

    function probUp(
        uint256 spotWad, uint256 strikeWad, uint256 sigmaWad,
        uint256 tauWad, BinaryPricer.SettlementStyle style
    ) external pure returns (uint256) {
        return BinaryPricer.probUp(spotWad, strikeWad, sigmaWad, tauWad, style);
    }
```

- [ ] **Step 5: Run the tests**

Run: `npx hardhat test test/BinaryPricer.prob.test.ts`
Expected: PASS — 10 vector cases plus 5 behavioural cases.

- [ ] **Step 6: Stage the commit (run only if asked)**

```bash
git add contracts/ test/ && git commit -m "feat: model probability with settlement-style parameter"
```

---

### Task 5: `BinaryPricer` — edge, break-even, and Kelly sizing

The economics of a fixed-payout binary are unusually clean, and this task
encodes that. Buying YES at price `a` costs `a` to win `1 - a`. Expected value is
`p(1-a) - (1-p)a = p - a`. So:

- the **break-even win rate is exactly the price** `a`;
- the **edge is exactly `p - a`**;
- payout odds are `b = (1-a)/a`, giving Kelly `f* = p - (1-p)·a/(1-a)`.

**Files:**
- Modify: `contracts/libraries/BinaryPricer.sol`
- Modify: `contracts/test/BinaryPricerHarness.sol`
- Create: `test/BinaryPricer.edge.test.ts`

**Interfaces:**
- Consumes: `BinaryPricer.probUp` from Task 4
- Produces:
  - `edgeBps(uint256 modelProbWad, uint256 priceWad) internal pure returns (int256)`
  - `breakEvenWinRateBps(uint256 priceWad) internal pure returns (uint256)`
  - `kellyFractionWad(uint256 modelProbWad, uint256 priceWad) internal pure returns (uint256)`

- [ ] **Step 1: Write the failing test**

```typescript
// test/BinaryPricer.edge.test.ts
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

const WAD = 10n ** 18n;
const wad = (n: number) => BigInt(Math.round(n * 1e18));

describe("BinaryPricer economics", () => {
  let h: any;
  before(async () => {
    const { viem } = await network.connect();
    h = await viem.deployContract("BinaryPricerHarness");
  });

  it("edge is model probability minus price, in bps", async () => {
    // model 0.70, price 0.60 -> +0.10 -> +1000 bps
    assert.equal(await h.read.edgeBps([wad(0.70), wad(0.60)]), 1000n);
  });

  it("edge is negative when the book is above the model", async () => {
    assert.equal(await h.read.edgeBps([wad(0.40), wad(0.55)]), -1500n);
  });

  it("edge is zero at fair value", async () => {
    assert.equal(await h.read.edgeBps([wad(0.5), wad(0.5)]), 0n);
  });

  it("break-even win rate equals the price", async () => {
    assert.equal(await h.read.breakEvenWinRateBps([wad(0.6)]), 6000n);
  });

  it("kelly is zero when there is no edge", async () => {
    assert.equal(await h.read.kellyFractionWad([wad(0.5), wad(0.5)]), 0n);
  });

  it("kelly is zero when the edge is negative", async () => {
    assert.equal(await h.read.kellyFractionWad([wad(0.4), wad(0.6)]), 0n);
  });

  it("kelly matches the closed form for a positive edge", async () => {
    // p = 0.70, a = 0.60 -> f* = 0.70 - 0.30*0.60/0.40 = 0.70 - 0.45 = 0.25
    const got: bigint = await h.read.kellyFractionWad([wad(0.70), wad(0.60)]);
    const want = wad(0.25);
    const diff = got > want ? got - want : want - got;
    assert.ok(diff < 10n ** 9n, `got=${got} want=${want}`);
  });

  it("kelly never exceeds one", async () => {
    const got: bigint = await h.read.kellyFractionWad([wad(0.99), wad(0.01)]);
    assert.ok(got <= WAD, `got=${got}`);
  });

  it("rejects a price outside (0,1)", async () => {
    await assert.rejects(() => h.read.edgeBps([wad(0.5), 0n]));
    await assert.rejects(() => h.read.edgeBps([wad(0.5), WAD]));
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx hardhat test test/BinaryPricer.edge.test.ts`
Expected: FAIL — `edgeBps` is not a function on the harness.

- [ ] **Step 3: Add the implementation to `BinaryPricer.sol`**

```solidity
    uint256 internal constant BPS = 1e4;

    error InvalidPrice();

    /// @notice Model edge over the book, in basis points. Positive means the
    ///         contract is cheap relative to the model.
    /// @dev For a fixed payout of 1, expected value is exactly (p - a).
    function edgeBps(uint256 modelProbWad, uint256 priceWad)
        internal pure returns (int256)
    {
        if (priceWad == 0 || priceWad >= WAD) revert InvalidPrice();
        int256 diff = int256(modelProbWad) - int256(priceWad);
        return (diff * int256(BPS)) / int256(WAD);
    }

    /// @notice The win rate required merely to break even at this price.
    /// @dev For a fixed-payout binary this is exactly the price.
    function breakEvenWinRateBps(uint256 priceWad)
        internal pure returns (uint256)
    {
        if (priceWad == 0 || priceWad >= WAD) revert InvalidPrice();
        return (priceWad * BPS) / WAD;
    }

    /// @notice Kelly-optimal fraction of bankroll to stake.
    /// @dev f* = p - (1-p)*a/(1-a). Returns 0 when the edge is not positive.
    function kellyFractionWad(uint256 modelProbWad, uint256 priceWad)
        internal pure returns (uint256)
    {
        if (priceWad == 0 || priceWad >= WAD) revert InvalidPrice();
        if (modelProbWad <= priceWad) return 0;

        uint256 lossTerm = (WAD - modelProbWad).mulWad(priceWad.divWad(WAD - priceWad));
        if (lossTerm >= modelProbWad) return 0;

        uint256 f = modelProbWad - lossTerm;
        return f > WAD ? WAD : f;
    }
```

- [ ] **Step 4: Extend the harness**

```solidity
    function edgeBps(uint256 p, uint256 a) external pure returns (int256) {
        return BinaryPricer.edgeBps(p, a);
    }
    function breakEvenWinRateBps(uint256 a) external pure returns (uint256) {
        return BinaryPricer.breakEvenWinRateBps(a);
    }
    function kellyFractionWad(uint256 p, uint256 a) external pure returns (uint256) {
        return BinaryPricer.kellyFractionWad(p, a);
    }
```

- [ ] **Step 5: Run the tests**

Run: `npx hardhat test test/BinaryPricer.edge.test.ts`
Expected: PASS, 9 cases.

- [ ] **Step 6: Run the whole suite**

Run: `npx hardhat test`
Expected: PASS — Tasks 1, 3, 4, 5 all green. The mathematical core is now
provably correct against SciPy, which is the single most defensible thing in the
submission.

- [ ] **Step 7: Stage the commit (run only if asked)**

```bash
git add contracts/ test/ && git commit -m "feat: edge, break-even and Kelly sizing"
```

---

### Task 6: dreamDEX adapter interface and mock

This is the isolation boundary for the project's biggest unknown. Everything
downstream is written against `IDreamDexEventContracts`, so the real integration
is a single implementation swapped in at Task 12 — and if the addresses never
arrive, the whole system still runs and demos on the mock.

**Files:**
- Create: `contracts/interfaces/IDreamDexEventContracts.sol`
- Create: `contracts/mocks/MockEventContracts.sol`
- Create: `test/MockEventContracts.test.ts`

**Interfaces:**
- Produces: the `Market` struct and the `IDreamDexEventContracts` interface consumed by Tasks 9 and 10

- [ ] **Step 1: Write the interface**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IDreamDexEventContracts
/// @notice Minimal surface Sigma needs from a dreamDEX Event Contract venue.
/// @dev Deliberately narrow. The real dreamDEX addresses and ABI are not yet
///      confirmed (RESEARCH.md open question #1); this interface is the seam
///      that keeps that unknown from blocking the rest of the system.
interface IDreamDexEventContracts {
    struct Market {
        bytes32 marketId;
        address underlying;   // price-feed identity for the underlying
        uint256 strikeWad;    // strike price, WAD
        uint64  openTime;     // unix seconds, window open
        uint64  expiryTime;   // unix seconds, window close
        bool    settled;
        bool    outcomeUp;    // meaningful only when settled
    }

    /// @notice All markets currently open for trading.
    function openMarkets() external view returns (bytes32[] memory);

    /// @notice Full detail for one market.
    function getMarket(bytes32 marketId) external view returns (Market memory);

    /// @notice Best ask for the UP side, WAD in (0,1). Reverts if no book.
    function bestAskUpWad(bytes32 marketId) external view returns (uint256);

    /// @notice Current spot price of the market's underlying, WAD.
    function spotWad(bytes32 marketId) external view returns (uint256);

    /// @notice Buy `sizeWad` of the UP (or DOWN) side at no worse than maxPriceWad.
    /// @return filledWad Size actually filled.
    /// @return costWad Total cost paid.
    function buy(bytes32 marketId, bool up, uint256 sizeWad, uint256 maxPriceWad)
        external returns (uint256 filledWad, uint256 costWad);
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// test/MockEventContracts.test.ts
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

const WAD = 10n ** 18n;

describe("MockEventContracts", () => {
  let mock: any;
  before(async () => {
    const { viem } = await network.connect();
    mock = await viem.deployContract("MockEventContracts");
  });

  it("starts with no open markets", async () => {
    assert.equal((await mock.read.openMarkets()).length, 0);
  });

  it("lists a created market as open", async () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    await mock.write.createMarket([
      "0x" + "11".padStart(64, "0"),
      "0x0000000000000000000000000000000000000001",
      100_000n * WAD, now, now + 900n,
    ]);
    const open = await mock.read.openMarkets();
    assert.equal(open.length, 1);
  });

  it("reverts on bestAsk when no book has been set", async () => {
    await assert.rejects(() => mock.read.bestAskUpWad(["0x" + "22".padStart(64, "0")]));
  });

  it("fills a buy at the quoted ask", async () => {
    const id = "0x" + "11".padStart(64, "0");
    await mock.write.setBook([id, 600_000_000_000_000_000n]); // 0.60
    await mock.write.setSpot([id, 100_000n * WAD]);
    const res = await mock.simulate.buy([id, true, WAD, 700_000_000_000_000_000n]);
    assert.equal(res.result[0], WAD);
    assert.equal(res.result[1], 600_000_000_000_000_000n);
  });

  it("reverts a buy above the caller's limit price", async () => {
    const id = "0x" + "11".padStart(64, "0");
    await assert.rejects(() =>
      mock.simulate.buy([id, true, WAD, 500_000_000_000_000_000n]),
    );
  });

  it("drops a market from openMarkets once settled", async () => {
    const id = "0x" + "11".padStart(64, "0");
    await mock.write.settle([id, true]);
    assert.equal((await mock.read.openMarkets()).length, 0);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx hardhat test test/MockEventContracts.test.ts`
Expected: FAIL — artifact `MockEventContracts` not found.

- [ ] **Step 4: Implement the mock**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IDreamDexEventContracts} from "../interfaces/IDreamDexEventContracts.sol";

/// @notice Deterministic stand-in for dreamDEX Event Contracts, used for tests
///         and for the demo while the real integration is unresolved.
contract MockEventContracts is IDreamDexEventContracts {
    error NoBook();
    error PriceAboveLimit();
    error UnknownMarket();

    mapping(bytes32 => Market) private _markets;
    mapping(bytes32 => uint256) private _askUp;
    mapping(bytes32 => uint256) private _spot;
    bytes32[] private _all;

    function createMarket(
        bytes32 marketId,
        address underlying,
        uint256 strikeWad,
        uint64 openTime,
        uint64 expiryTime
    ) external {
        _markets[marketId] = Market({
            marketId: marketId,
            underlying: underlying,
            strikeWad: strikeWad,
            openTime: openTime,
            expiryTime: expiryTime,
            settled: false,
            outcomeUp: false
        });
        _all.push(marketId);
    }

    function setBook(bytes32 marketId, uint256 askUpWad) external {
        _askUp[marketId] = askUpWad;
    }

    function setSpot(bytes32 marketId, uint256 priceWad) external {
        _spot[marketId] = priceWad;
    }

    function settle(bytes32 marketId, bool outcomeUp) external {
        Market storage m = _markets[marketId];
        if (m.marketId == bytes32(0)) revert UnknownMarket();
        m.settled = true;
        m.outcomeUp = outcomeUp;
    }

    function openMarkets() external view returns (bytes32[] memory) {
        uint256 n;
        for (uint256 i; i < _all.length; ++i) {
            if (!_markets[_all[i]].settled) ++n;
        }
        bytes32[] memory out = new bytes32[](n);
        uint256 j;
        for (uint256 i; i < _all.length; ++i) {
            if (!_markets[_all[i]].settled) out[j++] = _all[i];
        }
        return out;
    }

    function getMarket(bytes32 marketId) external view returns (Market memory) {
        return _markets[marketId];
    }

    function bestAskUpWad(bytes32 marketId) external view returns (uint256) {
        uint256 a = _askUp[marketId];
        if (a == 0) revert NoBook();
        return a;
    }

    function spotWad(bytes32 marketId) external view returns (uint256) {
        return _spot[marketId];
    }

    function buy(bytes32 marketId, bool, uint256 sizeWad, uint256 maxPriceWad)
        external view returns (uint256 filledWad, uint256 costWad)
    {
        uint256 ask = _askUp[marketId];
        if (ask == 0) revert NoBook();
        if (ask > maxPriceWad) revert PriceAboveLimit();
        return (sizeWad, (sizeWad * ask) / 1e18);
    }
}
```

- [ ] **Step 5: Run the tests**

Run: `npx hardhat test test/MockEventContracts.test.ts`
Expected: PASS, 6 cases.

- [ ] **Step 6: Stage the commit (run only if asked)**

```bash
git add contracts/ test/ && git commit -m "feat: dreamDEX adapter interface and deterministic mock"
```

---

### Task 7: `RealizedVol` — EWMA volatility accumulator

Written first without Reactivity so the mathematics can be tested in isolation;
Task 8 adds the subscription that drives it.

**Files:**
- Create: `contracts/RealizedVol.sol`
- Create: `test/RealizedVol.test.ts`

**Interfaces:**
- Consumes: solady `FixedPointMathLib`
- Produces:
  - `recordPrice(address underlying, uint256 priceWad)` — permissioned
  - `sigmaWad(address underlying) external view returns (uint256 sigma, uint64 updatedAt, bool ok)`
  - `error InsufficientSamples()`, `MIN_SAMPLES`, `STALENESS_SECONDS`

- [ ] **Step 1: Write the failing test**

```typescript
// test/RealizedVol.test.ts
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

const WAD = 10n ** 18n;
const UNDERLYING = "0x0000000000000000000000000000000000000001";

describe("RealizedVol", () => {
  let vol: any, wallet: any;

  beforeEach(async () => {
    const { viem } = await network.connect();
    [wallet] = await viem.getWalletClients();
    vol = await viem.deployContract("RealizedVol", [wallet.account.address]);
  });

  it("reports not-ok before the minimum sample count", async () => {
    await vol.write.recordPrice([UNDERLYING, 100_000n * WAD]);
    const [, , ok] = await vol.read.sigmaWad([UNDERLYING]);
    assert.equal(ok, false);
  });

  it("rejects a price update from an unauthorised caller", async () => {
    const { viem } = await network.connect();
    const [, other] = await viem.getWalletClients();
    await assert.rejects(() =>
      vol.write.recordPrice([UNDERLYING, 100_000n * WAD], { account: other.account }),
    );
  });

  it("converges towards the volatility of a known series", async () => {
    // 60 alternating +/-0.1% moves: per-step |log return| ~= 0.001
    let price = 100_000n * WAD;
    for (let i = 0; i < 60; i++) {
      price = i % 2 === 0 ? (price * 1001n) / 1000n : (price * 1000n) / 1001n;
      await vol.write.recordPrice([UNDERLYING, price]);
    }
    const [sigma, , ok] = await vol.read.sigmaWad([UNDERLYING]);
    assert.equal(ok, true);
    // Expect the same order of magnitude as 0.001 (1e15 in WAD).
    assert.ok(sigma > 5n * 10n ** 14n, `sigma too low: ${sigma}`);
    assert.ok(sigma < 3n * 10n ** 15n, `sigma too high: ${sigma}`);
  });

  it("reports a larger sigma for a more volatile series", async () => {
    const other = "0x0000000000000000000000000000000000000002";
    let a = 100_000n * WAD, b = 100_000n * WAD;
    for (let i = 0; i < 60; i++) {
      a = i % 2 === 0 ? (a * 1001n) / 1000n : (a * 1000n) / 1001n;   // 0.1%
      b = i % 2 === 0 ? (b * 1010n) / 1000n : (b * 1000n) / 1010n;   // 1.0%
      await vol.write.recordPrice([UNDERLYING, a]);
      await vol.write.recordPrice([other, b]);
    }
    const [sigmaA] = await vol.read.sigmaWad([UNDERLYING]);
    const [sigmaB] = await vol.read.sigmaWad([other]);
    assert.ok(sigmaB > sigmaA, `expected ${sigmaB} > ${sigmaA}`);
  });

  it("ignores a zero price rather than corrupting the estimate", async () => {
    await assert.rejects(() => vol.write.recordPrice([UNDERLYING, 0n]));
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx hardhat test test/RealizedVol.test.ts`
Expected: FAIL — artifact `RealizedVol` not found.

- [ ] **Step 3: Implement `RealizedVol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @title RealizedVol
/// @notice Exponentially-weighted realised volatility per underlying, updated
///         from a stream of price observations.
/// @dev On Somnia these observations arrive through the Reactivity precompile
///      (see SigmaReactiveVol in Task 8), so volatility accumulates on-chain
///      with no off-chain keeper.
contract RealizedVol {
    using FixedPointMathLib for uint256;
    using FixedPointMathLib for int256;

    uint256 private constant WAD = 1e18;

    /// @notice EWMA decay. 0.94 is the RiskMetrics convention.
    uint256 public constant LAMBDA = 940_000_000_000_000_000;

    /// @notice Observations required before sigma is considered meaningful.
    uint256 public constant MIN_SAMPLES = 30;

    /// @notice Age beyond which sigma is treated as stale.
    uint64 public constant STALENESS_SECONDS = 300;

    struct VolState {
        uint256 lastPriceWad;
        uint256 varianceWad;  // EWMA of squared log returns
        uint64  updatedAt;
        uint32  samples;
    }

    mapping(address => VolState) private _state;

    address public writer;

    error NotWriter();
    error ZeroPrice();

    event PriceRecorded(address indexed underlying, uint256 priceWad, uint256 varianceWad, uint32 samples);
    event WriterChanged(address indexed writer);

    constructor(address writer_) {
        writer = writer_;
        emit WriterChanged(writer_);
    }

    modifier onlyWriter() {
        if (msg.sender != writer) revert NotWriter();
        _;
    }

    function setWriter(address writer_) external onlyWriter {
        writer = writer_;
        emit WriterChanged(writer_);
    }

    /// @notice Fold one price observation into the EWMA estimate.
    function recordPrice(address underlying, uint256 priceWad) external onlyWriter {
        if (priceWad == 0) revert ZeroPrice();
        VolState storage s = _state[underlying];

        if (s.lastPriceWad != 0) {
            int256 logReturn = int256(priceWad.divWad(s.lastPriceWad)).lnWad();
            uint256 absLog = uint256(logReturn < 0 ? -logReturn : logReturn);
            uint256 squared = absLog.mulWad(absLog);

            s.varianceWad = s.varianceWad.mulWad(LAMBDA) + squared.mulWad(WAD - LAMBDA);
            unchecked { s.samples = s.samples < type(uint32).max ? s.samples + 1 : s.samples; }
        }

        s.lastPriceWad = priceWad;
        s.updatedAt = uint64(block.timestamp);
        emit PriceRecorded(underlying, priceWad, s.varianceWad, s.samples);
    }

    /// @notice Current per-observation volatility estimate.
    /// @return sigma sqrt of the EWMA variance, WAD.
    /// @return updatedAt Timestamp of the most recent observation.
    /// @return ok False when there are too few samples or the data is stale —
    ///         callers must refuse to trade on a not-ok reading.
    function sigmaWad(address underlying)
        external view returns (uint256 sigma, uint64 updatedAt, bool ok)
    {
        VolState storage s = _state[underlying];
        sigma = s.varianceWad.sqrtWad();
        updatedAt = s.updatedAt;
        ok = s.samples >= MIN_SAMPLES
            && s.updatedAt != 0
            && block.timestamp - s.updatedAt <= STALENESS_SECONDS;
    }

    function sampleCount(address underlying) external view returns (uint32) {
        return _state[underlying].samples;
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx hardhat test test/RealizedVol.test.ts`
Expected: PASS, 5 cases.

If the convergence bounds in case 3 fail, print the actual sigma first and check
it against the analytic expectation — for an alternating ±0.1% series the EWMA
variance converges to roughly `(0.001)^2`, so sigma should land near `1e15`.
Adjust the assertion bounds only after confirming the number is right; never
loosen a bound to make a wrong number pass.

- [ ] **Step 5: Stage the commit (run only if asked)**

```bash
git add contracts/ test/ && git commit -m "feat: EWMA realised volatility accumulator"
```

---

### Task 8: Reactivity handler — volatility with no keeper

This is the task that makes the project Somnia-native rather than a generic dApp.

**Files:**
- Create: `contracts/somnia/ISomniaReactivity.sol`
- Create: `contracts/SigmaReactiveVol.sol`
- Create: `test/SigmaReactiveVol.test.ts`

**Interfaces:**
- Consumes: `RealizedVol.recordPrice` from Task 7
- Produces: `SigmaReactiveVol.onEvent(address,bytes32[],bytes)`, `subscribeTo(address emitter, bytes32 topic0, address underlying)`

- [ ] **Step 1: Write the Reactivity interface**

Signatures are from the Somnia on-chain reactivity docs; see RESEARCH.md §2.2.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

address constant SOMNIA_REACTIVITY_PRECOMPILE = 0x0000000000000000000000000000000000000100;

struct SubscriptionFilter {
    bytes32[4] eventTopics;  // zero entries are wildcards; at least one field must be set
    address origin;
    address emitter;
}

struct SubscriptionOptions {
    uint64 priorityFeePerGas;
    uint64 maxFeePerGas;
    uint64 gasLimit;
}

interface ISomniaReactivity {
    /// @dev Costs 210,000 gas, charged to the caller. Handler execution is
    ///      charged to the subscription owner.
    function subscribe(
        address handler,
        SubscriptionFilter memory filter,
        SubscriptionOptions memory options
    ) external returns (uint256 subscriptionId);

    function unsubscribe(uint256 subscriptionId) external;
}

/// @notice Interface the Reactivity precompile calls back into.
interface ISomniaEventHandler {
    function onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) external;
}
```

- [ ] **Step 2: Write the failing test**

The precompile cannot be exercised on a local Hardhat chain, so the test drives
`onEvent` directly from an impersonated precompile address. That proves the
decode-and-forward logic; Task 12 proves the live subscription on testnet.

```typescript
// test/SigmaReactiveVol.test.ts
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { encodeAbiParameters, parseAbiParameters, keccak256, toHex } from "viem";

const WAD = 10n ** 18n;
const PRECOMPILE = "0x0000000000000000000000000000000000000100";
const EMITTER = "0x00000000000000000000000000000000000000AA";
const UNDERLYING = "0x0000000000000000000000000000000000000001";

describe("SigmaReactiveVol", () => {
  let vol: any, reactive: any, viem: any, testClient: any;

  beforeEach(async () => {
    const conn = await network.connect();
    viem = conn.viem;
    testClient = await conn.networkHelpers;
    const [wallet] = await viem.getWalletClients();

    vol = await viem.deployContract("RealizedVol", [wallet.account.address]);
    reactive = await viem.deployContract("SigmaReactiveVol", [vol.address, wallet.account.address]);
    await vol.write.setWriter([reactive.address]);
  });

  it("rejects onEvent from anyone but the reactivity precompile", async () => {
    const topic = keccak256(toHex("MarkPriceUpdated(uint256)"));
    const data = encodeAbiParameters(parseAbiParameters("uint256"), [100_000n * WAD]);
    await assert.rejects(() => reactive.write.onEvent([EMITTER, [topic], data]));
  });

  it("forwards a decoded price to RealizedVol", async () => {
    const [wallet] = await viem.getWalletClients();
    const topic = keccak256(toHex("MarkPriceUpdated(uint256)"));
    await reactive.write.mapEmitter([EMITTER, topic, UNDERLYING]);

    await testClient.impersonateAccount(PRECOMPILE);
    await testClient.setBalance(PRECOMPILE, 10n ** 18n);

    const data = encodeAbiParameters(parseAbiParameters("uint256"), [100_000n * WAD]);
    await reactive.write.onEvent([EMITTER, [topic], data], { account: PRECOMPILE });

    assert.equal(await vol.read.sampleCount([UNDERLYING]), 0); // first price sets the baseline

    const data2 = encodeAbiParameters(parseAbiParameters("uint256"), [100_100n * WAD]);
    await reactive.write.onEvent([EMITTER, [topic], data2], { account: PRECOMPILE });
    assert.equal(await vol.read.sampleCount([UNDERLYING]), 1);
  });

  it("ignores an event from an unmapped emitter", async () => {
    await testClient.impersonateAccount(PRECOMPILE);
    await testClient.setBalance(PRECOMPILE, 10n ** 18n);
    const topic = keccak256(toHex("MarkPriceUpdated(uint256)"));
    const data = encodeAbiParameters(parseAbiParameters("uint256"), [100_000n * WAD]);
    await reactive.write.onEvent(["0x00000000000000000000000000000000000000BB", [topic], data], {
      account: PRECOMPILE,
    });
    assert.equal(await vol.read.sampleCount([UNDERLYING]), 0);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx hardhat test test/SigmaReactiveVol.test.ts`
Expected: FAIL — artifact `SigmaReactiveVol` not found.

- [ ] **Step 4: Implement the handler**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {RealizedVol} from "./RealizedVol.sol";
import {
    ISomniaReactivity, ISomniaEventHandler,
    SubscriptionFilter, SubscriptionOptions,
    SOMNIA_REACTIVITY_PRECOMPILE
} from "./somnia/ISomniaReactivity.sol";

/// @title SigmaReactiveVol
/// @notice Bridges Somnia Reactivity into the volatility accumulator: price
///         events emitted anywhere on chain update sigma with no keeper, no
///         polling and no off-chain infrastructure.
contract SigmaReactiveVol is ISomniaEventHandler {
    RealizedVol public immutable vol;
    address public owner;

    /// @dev emitter => topic0 => underlying identity. Unmapped events are ignored.
    mapping(address => mapping(bytes32 => address)) public emitterUnderlying;

    uint256[] public subscriptionIds;

    error NotPrecompile();
    error NotOwner();
    error BadPayload();

    event Subscribed(uint256 indexed subscriptionId, address indexed emitter, bytes32 topic0, address underlying);
    event EmitterMapped(address indexed emitter, bytes32 indexed topic0, address underlying);
    event PriceForwarded(address indexed underlying, uint256 priceWad);
    event EventIgnored(address indexed emitter, bytes32 topic0);

    constructor(address vol_, address owner_) {
        vol = RealizedVol(vol_);
        owner = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function mapEmitter(address emitter, bytes32 topic0, address underlying) public onlyOwner {
        emitterUnderlying[emitter][topic0] = underlying;
        emit EmitterMapped(emitter, topic0, underlying);
    }

    /// @notice Subscribe to an emitter's price event through the Reactivity precompile.
    /// @dev Costs 210,000 gas. Handler gas is billed to this contract as the
    ///      subscription owner, so it must hold a balance.
    function subscribeTo(
        address emitter,
        bytes32 topic0,
        address underlying,
        uint64 priorityFeePerGas,
        uint64 maxFeePerGas,
        uint64 gasLimit
    ) external onlyOwner returns (uint256 subscriptionId) {
        mapEmitter(emitter, topic0, underlying);

        bytes32[4] memory topics;
        topics[0] = topic0;

        subscriptionId = ISomniaReactivity(SOMNIA_REACTIVITY_PRECOMPILE).subscribe(
            address(this),
            SubscriptionFilter({eventTopics: topics, origin: address(0), emitter: emitter}),
            SubscriptionOptions({
                priorityFeePerGas: priorityFeePerGas,
                maxFeePerGas: maxFeePerGas,
                gasLimit: gasLimit
            })
        );
        subscriptionIds.push(subscriptionId);
        emit Subscribed(subscriptionId, emitter, topic0, underlying);
    }

    /// @inheritdoc ISomniaEventHandler
    function onEvent(address emitter, bytes32[] calldata eventTopics, bytes calldata data)
        external
    {
        if (msg.sender != SOMNIA_REACTIVITY_PRECOMPILE) revert NotPrecompile();
        if (eventTopics.length == 0) revert BadPayload();

        address underlying = emitterUnderlying[emitter][eventTopics[0]];
        if (underlying == address(0)) {
            emit EventIgnored(emitter, eventTopics[0]);
            return;
        }
        if (data.length < 32) revert BadPayload();

        uint256 priceWad = abi.decode(data, (uint256));
        vol.recordPrice(underlying, priceWad);
        emit PriceForwarded(underlying, priceWad);
    }

    receive() external payable {}
}
```

- [ ] **Step 5: Run the tests**

Run: `npx hardhat test test/SigmaReactiveVol.test.ts`
Expected: PASS, 3 cases.

- [ ] **Step 6: Stage the commit (run only if asked)**

```bash
git add contracts/ test/ && git commit -m "feat: reactivity-driven volatility, no keeper required"
```

---

### Task 9: `SigmaOracle` — the public fair-value feed

The strategic centre of the submission: the only artefact in this hackathon that
other builders can consume.

**Files:**
- Create: `contracts/SigmaOracle.sol`
- Create: `test/SigmaOracle.test.ts`

**Interfaces:**
- Consumes: `RealizedVol.sigmaWad`, `BinaryPricer`, `IDreamDexEventContracts`
- Produces:
  - `struct FairValue { uint256 modelProbBps; uint256 impliedProbBps; int256 edgeBps; uint256 breakEvenBps; uint256 sigmaWad; uint64 updatedAt; uint8 settlementStyle; bool ok; }`
  - `refresh(bytes32 marketId) external returns (FairValue memory)`
  - `getFairValue(bytes32 marketId) external view returns (FairValue memory)`
  - `event FairValuePublished(bytes32 indexed marketId, int256 edgeBps, uint256 modelProbBps, uint256 impliedProbBps)`

- [ ] **Step 1: Write the failing test**

```typescript
// test/SigmaOracle.test.ts
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

const WAD = 10n ** 18n;
const MARKET = "0x" + "11".padStart(64, "0");
const UNDERLYING = "0x0000000000000000000000000000000000000001";

async function seedVol(vol: any, price0 = 100_000n * WAD) {
  let p = price0;
  for (let i = 0; i < 40; i++) {
    p = i % 2 === 0 ? (p * 1002n) / 1000n : (p * 1000n) / 1002n;
    await vol.write.recordPrice([UNDERLYING, p]);
  }
}

describe("SigmaOracle", () => {
  let vol: any, mock: any, oracle: any, wallet: any, now: bigint;

  beforeEach(async () => {
    const { viem } = await network.connect();
    [wallet] = await viem.getWalletClients();
    vol = await viem.deployContract("RealizedVol", [wallet.account.address]);
    mock = await viem.deployContract("MockEventContracts");
    oracle = await viem.deployContract("SigmaOracle", [vol.address, mock.address, wallet.account.address]);

    now = BigInt(Math.floor(Date.now() / 1000));
    await mock.write.createMarket([MARKET, UNDERLYING, 100_000n * WAD, now, now + 900n]);
    await mock.write.setSpot([MARKET, 100_000n * WAD]);
    await mock.write.setBook([MARKET, 600_000_000_000_000_000n]); // 0.60
  });

  it("reports not-ok while volatility has too few samples", async () => {
    await oracle.write.refresh([MARKET]);
    const fv = await oracle.read.getFairValue([MARKET]);
    assert.equal(fv.ok, false);
  });

  it("publishes a fair value once volatility is ready", async () => {
    await seedVol(vol);
    await oracle.write.refresh([MARKET]);
    const fv = await oracle.read.getFairValue([MARKET]);
    assert.equal(fv.ok, true);
    assert.equal(fv.impliedProbBps, 6000n);
    assert.ok(fv.modelProbBps > 0n && fv.modelProbBps < 10000n);
  });

  it("computes edge as model minus implied", async () => {
    await seedVol(vol);
    await oracle.write.refresh([MARKET]);
    const fv = await oracle.read.getFairValue([MARKET]);
    assert.equal(fv.edgeBps, BigInt(fv.modelProbBps) - BigInt(fv.impliedProbBps));
  });

  it("sets break-even win rate equal to the price", async () => {
    await seedVol(vol);
    await oracle.write.refresh([MARKET]);
    const fv = await oracle.read.getFairValue([MARKET]);
    assert.equal(fv.breakEvenBps, 6000n);
  });

  it("emits FairValuePublished on refresh", async () => {
    await seedVol(vol);
    const hash = await oracle.write.refresh([MARKET]);
    const { viem } = await network.connect();
    const pub = await viem.getPublicClient();
    const receipt = await pub.waitForTransactionReceipt({ hash });
    assert.ok(receipt.logs.length > 0);
  });

  it("marks an expired market as not ok", async () => {
    await seedVol(vol);
    const expired = "0x" + "99".padStart(64, "0");
    await mock.write.createMarket([expired, UNDERLYING, 100_000n * WAD, now - 1800n, now - 900n]);
    await mock.write.setSpot([expired, 100_000n * WAD]);
    await mock.write.setBook([expired, 500_000_000_000_000_000n]);
    await oracle.write.refresh([expired]);
    const fv = await oracle.read.getFairValue([expired]);
    assert.equal(fv.ok, false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx hardhat test test/SigmaOracle.test.ts`
Expected: FAIL — artifact `SigmaOracle` not found.

- [ ] **Step 3: Implement `SigmaOracle`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BinaryPricer} from "./libraries/BinaryPricer.sol";
import {RealizedVol} from "./RealizedVol.sol";
import {IDreamDexEventContracts} from "./interfaces/IDreamDexEventContracts.sol";

/// @title SigmaOracle
/// @notice Publishes a model fair value for each open Event Contract, alongside
///         the book's implied probability and the resulting edge.
/// @dev Any contract may read `getFairValue` or subscribe to
///      `FairValuePublished` through Somnia Reactivity. This is the shared
///      infrastructure piece: other builders consume it without asking.
contract SigmaOracle {
    uint256 private constant WAD = 1e18;
    uint256 private constant BPS = 1e4;

    struct FairValue {
        uint256 modelProbBps;
        uint256 impliedProbBps;
        int256  edgeBps;
        uint256 breakEvenBps;
        uint256 sigmaWad;
        uint64  updatedAt;
        uint8   settlementStyle; // mirrors BinaryPricer.SettlementStyle
        bool    ok;
    }

    RealizedVol public immutable vol;
    IDreamDexEventContracts public immutable venue;
    address public owner;

    /// @notice Settlement style assumed by the model. Until the dreamDEX rule is
    ///         confirmed (RESEARCH.md #7) this stays configurable and is
    ///         reported with every reading.
    BinaryPricer.SettlementStyle public settlementStyle = BinaryPricer.SettlementStyle.Terminal;

    mapping(bytes32 => FairValue) private _fair;

    error NotOwner();

    event FairValuePublished(
        bytes32 indexed marketId,
        int256 edgeBps,
        uint256 modelProbBps,
        uint256 impliedProbBps
    );
    event SettlementStyleChanged(uint8 style);

    constructor(address vol_, address venue_, address owner_) {
        vol = RealizedVol(vol_);
        venue = IDreamDexEventContracts(venue_);
        owner = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setSettlementStyle(BinaryPricer.SettlementStyle style) external onlyOwner {
        settlementStyle = style;
        emit SettlementStyleChanged(uint8(style));
    }

    /// @notice Recompute and store the fair value for one market.
    /// @dev Never reverts on missing data — it publishes an `ok == false`
    ///      reading instead, so consumers can distinguish "no edge" from
    ///      "we do not know". Silence would be indistinguishable from zero edge.
    function refresh(bytes32 marketId) external returns (FairValue memory) {
        FairValue memory fv;
        fv.updatedAt = uint64(block.timestamp);
        fv.settlementStyle = uint8(settlementStyle);

        IDreamDexEventContracts.Market memory m = venue.getMarket(marketId);
        if (m.marketId == bytes32(0) || m.settled || block.timestamp >= m.expiryTime) {
            _fair[marketId] = fv;
            emit FairValuePublished(marketId, 0, 0, 0);
            return fv;
        }

        (uint256 sigma, , bool volOk) = vol.sigmaWad(m.underlying);
        fv.sigmaWad = sigma;
        if (!volOk) {
            _fair[marketId] = fv;
            emit FairValuePublished(marketId, 0, 0, 0);
            return fv;
        }

        uint256 spot = venue.spotWad(marketId);
        if (spot == 0) {
            _fair[marketId] = fv;
            emit FairValuePublished(marketId, 0, 0, 0);
            return fv;
        }

        // Fraction of the window still to run.
        uint256 total = uint256(m.expiryTime - m.openTime);
        uint256 left = uint256(m.expiryTime) - block.timestamp;
        uint256 tauWad = (left * WAD) / total;
        if (tauWad == 0) {
            _fair[marketId] = fv;
            emit FairValuePublished(marketId, 0, 0, 0);
            return fv;
        }

        uint256 modelProbWad =
            BinaryPricer.probUp(spot, m.strikeWad, sigma, tauWad, settlementStyle);
        uint256 priceWad = venue.bestAskUpWad(marketId);

        fv.modelProbBps   = (modelProbWad * BPS) / WAD;
        fv.impliedProbBps = (priceWad * BPS) / WAD;
        fv.edgeBps        = BinaryPricer.edgeBps(modelProbWad, priceWad);
        fv.breakEvenBps   = BinaryPricer.breakEvenWinRateBps(priceWad);
        fv.ok             = true;

        _fair[marketId] = fv;
        emit FairValuePublished(marketId, fv.edgeBps, fv.modelProbBps, fv.impliedProbBps);
        return fv;
    }

    function getFairValue(bytes32 marketId) external view returns (FairValue memory) {
        return _fair[marketId];
    }

    /// @notice Refresh every currently open market in one call.
    /// @dev Sized for a Reactivity handler, which has a 200,000,000 gas ceiling.
    function refreshAll() external returns (uint256 count) {
        bytes32[] memory ids = venue.openMarkets();
        for (uint256 i; i < ids.length; ++i) {
            this.refresh(ids[i]);
        }
        return ids.length;
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx hardhat test test/SigmaOracle.test.ts`
Expected: PASS, 6 cases.

- [ ] **Step 5: Stage the commit (run only if asked)**

```bash
git add contracts/ test/ && git commit -m "feat: SigmaOracle publishes consumable fair values"
```

---

### Task 10: `SigmaPolicyVault` — autonomous, threshold-gated trading

**Files:**
- Create: `contracts/SigmaPolicyVault.sol`
- Create: `test/SigmaPolicyVault.test.ts`

**Interfaces:**
- Consumes: `SigmaOracle.refresh`, `BinaryPricer.kellyFractionWad`, `IDreamDexEventContracts.buy`
- Produces:
  - `struct Policy { uint256 minEdgeBps; uint256 maxStakeWad; uint256 kellyCapWad; bool enabled; }`
  - `setPolicy(Policy calldata)`, `evaluate(bytes32 marketId) external returns (bool traded, uint256 stakeWad)`
  - `struct Record { uint32 trades; uint32 wins; int256 pnlWad; int256 predictedEdgeBpsSum; }`

- [ ] **Step 1: Write the failing test**

```typescript
// test/SigmaPolicyVault.test.ts
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

const WAD = 10n ** 18n;
const MARKET = "0x" + "11".padStart(64, "0");
const UNDERLYING = "0x0000000000000000000000000000000000000001";

describe("SigmaPolicyVault", () => {
  let vol: any, mock: any, oracle: any, vault: any, wallet: any, now: bigint;

  beforeEach(async () => {
    const { viem } = await network.connect();
    [wallet] = await viem.getWalletClients();
    vol = await viem.deployContract("RealizedVol", [wallet.account.address]);
    mock = await viem.deployContract("MockEventContracts");
    oracle = await viem.deployContract("SigmaOracle", [vol.address, mock.address, wallet.account.address]);
    vault = await viem.deployContract("SigmaPolicyVault", [oracle.address, mock.address, wallet.account.address]);

    now = BigInt(Math.floor(Date.now() / 1000));
    await mock.write.createMarket([MARKET, UNDERLYING, 100_000n * WAD, now, now + 900n]);
    await mock.write.setSpot([MARKET, 100_000n * WAD]);

    let p = 100_000n * WAD;
    for (let i = 0; i < 40; i++) {
      p = i % 2 === 0 ? (p * 1002n) / 1000n : (p * 1000n) / 1002n;
      await vol.write.recordPrice([UNDERLYING, p]);
    }
    await vault.write.setPolicy([{
      minEdgeBps: 200n, maxStakeWad: 100n * WAD, kellyCapWad: WAD / 2n, enabled: true,
    }]);
    await vault.write.deposit([1000n * WAD]);
  });

  it("does not trade when the edge is below the policy threshold", async () => {
    // Book at ~fair value: an ATM market with the model near 0.50.
    await mock.write.setBook([MARKET, 500_000_000_000_000_000n]);
    const res = await vault.simulate.evaluate([MARKET]);
    assert.equal(res.result[0], false);
  });

  it("trades when the edge clears the threshold", async () => {
    // Book far below the ATM model value -> large positive edge on UP.
    await mock.write.setBook([MARKET, 200_000_000_000_000_000n]); // 0.20
    const res = await vault.simulate.evaluate([MARKET]);
    assert.equal(res.result[0], true);
    assert.ok(res.result[1] > 0n);
  });

  it("never stakes more than maxStakeWad", async () => {
    await mock.write.setBook([MARKET, 100_000_000_000_000_000n]); // 0.10, huge edge
    const res = await vault.simulate.evaluate([MARKET]);
    assert.ok(res.result[1] <= 100n * WAD, `stake ${res.result[1]}`);
  });

  it("refuses to trade when the policy is disabled", async () => {
    await vault.write.setPolicy([{
      minEdgeBps: 200n, maxStakeWad: 100n * WAD, kellyCapWad: WAD / 2n, enabled: false,
    }]);
    await mock.write.setBook([MARKET, 200_000_000_000_000_000n]);
    const res = await vault.simulate.evaluate([MARKET]);
    assert.equal(res.result[0], false);
  });

  it("refuses to trade on a not-ok fair value", async () => {
    const fresh = "0x" + "77".padStart(64, "0");
    const other = "0x0000000000000000000000000000000000000009";
    await mock.write.createMarket([fresh, other, 100_000n * WAD, now, now + 900n]);
    await mock.write.setSpot([fresh, 100_000n * WAD]);
    await mock.write.setBook([fresh, 200_000_000_000_000_000n]);
    const res = await vault.simulate.evaluate([fresh]); // no vol samples for `other`
    assert.equal(res.result[0], false);
  });

  it("records a win and updates the track record on settlement", async () => {
    await mock.write.setBook([MARKET, 200_000_000_000_000_000n]);
    await vault.write.evaluate([MARKET]);
    await mock.write.settle([MARKET, true]);
    await vault.write.recordSettlement([MARKET]);
    const rec = await vault.read.record();
    assert.equal(rec.trades, 1);
    assert.equal(rec.wins, 1);
    assert.ok(rec.pnlWad > 0n);
  });

  it("records a loss when the outcome goes against the position", async () => {
    await mock.write.setBook([MARKET, 200_000_000_000_000_000n]);
    await vault.write.evaluate([MARKET]);
    await mock.write.settle([MARKET, false]);
    await vault.write.recordSettlement([MARKET]);
    const rec = await vault.read.record();
    assert.equal(rec.trades, 1);
    assert.equal(rec.wins, 0);
    assert.ok(rec.pnlWad < 0n);
  });

  it("does not double-count a settlement", async () => {
    await mock.write.setBook([MARKET, 200_000_000_000_000_000n]);
    await vault.write.evaluate([MARKET]);
    await mock.write.settle([MARKET, true]);
    await vault.write.recordSettlement([MARKET]);
    await assert.rejects(() => vault.write.recordSettlement([MARKET]));
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx hardhat test test/SigmaPolicyVault.test.ts`
Expected: FAIL — artifact `SigmaPolicyVault` not found.

- [ ] **Step 3: Implement `SigmaPolicyVault`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BinaryPricer} from "./libraries/BinaryPricer.sol";
import {SigmaOracle} from "./SigmaOracle.sol";
import {IDreamDexEventContracts} from "./interfaces/IDreamDexEventContracts.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @title SigmaPolicyVault
/// @notice A standing policy that participates in every window whose edge
///         clears a threshold, sizes by Kelly, and keeps an auditable record of
///         predicted edge against realised outcome.
/// @dev Woken by a Somnia cron subscription — see SigmaCron in Task 11. There is
///      no off-chain bot anywhere in this design.
contract SigmaPolicyVault {
    using FixedPointMathLib for uint256;

    uint256 private constant WAD = 1e18;
    uint256 private constant BPS = 1e4;

    struct Policy {
        uint256 minEdgeBps;   // trade only when edge is at least this
        uint256 maxStakeWad;  // hard cap per window
        uint256 kellyCapWad;  // fraction of full Kelly to use (0.5 = half Kelly)
        bool    enabled;
    }

    struct Position {
        uint256 stakeWad;
        uint256 priceWad;
        int256  predictedEdgeBps;
        bool    up;
        bool    open;
        bool    settled;
    }

    struct Record {
        uint32 trades;
        uint32 wins;
        int256 pnlWad;
        int256 predictedEdgeBpsSum;
    }

    SigmaOracle public immutable oracle;
    IDreamDexEventContracts public immutable venue;
    address public owner;

    Policy public policy;
    Record public record;
    uint256 public bankrollWad;

    mapping(bytes32 => Position) public positions;

    error NotOwner();
    error NoPosition();
    error AlreadySettled();
    error NotSettledYet();

    event PolicySet(uint256 minEdgeBps, uint256 maxStakeWad, uint256 kellyCapWad, bool enabled);
    event Skipped(bytes32 indexed marketId, string reason);
    event Traded(bytes32 indexed marketId, bool up, uint256 stakeWad, uint256 priceWad, int256 edgeBps);
    event Settled(bytes32 indexed marketId, bool won, int256 pnlWad);

    constructor(address oracle_, address venue_, address owner_) {
        oracle = SigmaOracle(oracle_);
        venue = IDreamDexEventContracts(venue_);
        owner = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setPolicy(Policy calldata p) external onlyOwner {
        policy = p;
        emit PolicySet(p.minEdgeBps, p.maxStakeWad, p.kellyCapWad, p.enabled);
    }

    /// @dev Bankroll is tracked as a plain figure for the hackathon demo. A
    ///      production vault would escrow real USDC here; that is out of scope
    ///      and deliberately not pretended otherwise.
    function deposit(uint256 amountWad) external onlyOwner {
        bankrollWad += amountWad;
    }

    /// @notice Evaluate one market and trade it if the policy allows.
    /// @dev Skips are emitted, never silent — a skipped window and a window that
    ///      was never looked at must be distinguishable after the fact.
    function evaluate(bytes32 marketId) external returns (bool traded, uint256 stakeWad) {
        if (!policy.enabled) {
            emit Skipped(marketId, "disabled");
            return (false, 0);
        }
        if (positions[marketId].open) {
            emit Skipped(marketId, "already positioned");
            return (false, 0);
        }

        SigmaOracle.FairValue memory fv = oracle.refresh(marketId);
        if (!fv.ok) {
            emit Skipped(marketId, "fair value not available");
            return (false, 0);
        }

        // Edge on the UP side; a sufficiently negative edge is an edge on DOWN.
        bool up = fv.edgeBps > 0;
        uint256 absEdge = uint256(fv.edgeBps > 0 ? fv.edgeBps : -fv.edgeBps);
        if (absEdge < policy.minEdgeBps) {
            emit Skipped(marketId, "edge below threshold");
            return (false, 0);
        }

        uint256 modelProbWad = (fv.modelProbBps * WAD) / BPS;
        uint256 priceWad = (fv.impliedProbBps * WAD) / BPS;
        if (!up) {
            // Mirror the market to price the DOWN side.
            modelProbWad = WAD - modelProbWad;
            priceWad = WAD - priceWad;
        }
        if (priceWad == 0 || priceWad >= WAD) {
            emit Skipped(marketId, "degenerate price");
            return (false, 0);
        }

        uint256 kelly = BinaryPricer.kellyFractionWad(modelProbWad, priceWad);
        if (kelly == 0) {
            emit Skipped(marketId, "no kelly stake");
            return (false, 0);
        }

        stakeWad = bankrollWad.mulWad(kelly).mulWad(policy.kellyCapWad);
        if (stakeWad > policy.maxStakeWad) stakeWad = policy.maxStakeWad;
        if (stakeWad > bankrollWad) stakeWad = bankrollWad;
        if (stakeWad == 0) {
            emit Skipped(marketId, "stake rounds to zero");
            return (false, 0);
        }

        venue.buy(marketId, up, stakeWad, priceWad);

        positions[marketId] = Position({
            stakeWad: stakeWad,
            priceWad: priceWad,
            predictedEdgeBps: fv.edgeBps,
            up: up,
            open: true,
            settled: false
        });
        bankrollWad -= stakeWad;

        emit Traded(marketId, up, stakeWad, priceWad, fv.edgeBps);
        return (true, stakeWad);
    }

    /// @notice Fold a settled market's outcome into the track record.
    function recordSettlement(bytes32 marketId) external {
        Position storage pos = positions[marketId];
        if (!pos.open) revert NoPosition();
        if (pos.settled) revert AlreadySettled();

        IDreamDexEventContracts.Market memory m = venue.getMarket(marketId);
        if (!m.settled) revert NotSettledYet();

        bool won = (m.outcomeUp == pos.up);
        int256 pnl;
        if (won) {
            // Stake s at price a returns s/a units of payout 1 -> profit s*(1-a)/a.
            uint256 profit = pos.stakeWad.mulWad((WAD - pos.priceWad).divWad(pos.priceWad));
            bankrollWad += pos.stakeWad + profit;
            pnl = int256(profit);
            record.wins += 1;
        } else {
            pnl = -int256(pos.stakeWad);
        }

        pos.settled = true;
        record.trades += 1;
        record.pnlWad += pnl;
        record.predictedEdgeBpsSum += pos.predictedEdgeBps;

        emit Settled(marketId, won, pnl);
    }

    /// @notice Average edge the model predicted across all recorded trades.
    /// @dev Shown next to realised win rate so the two can be compared honestly.
    function averagePredictedEdgeBps() external view returns (int256) {
        if (record.trades == 0) return 0;
        return record.predictedEdgeBpsSum / int256(uint256(record.trades));
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx hardhat test test/SigmaPolicyVault.test.ts`
Expected: PASS, 8 cases.

- [ ] **Step 5: Run the whole suite**

Run: `npx hardhat test`
Expected: all green. The backend is now feature-complete against the mock.

- [ ] **Step 6: Stage the commit (run only if asked)**

```bash
git add contracts/ test/ && git commit -m "feat: autonomous threshold-gated policy vault with track record"
```

---

### Task 11: Cron subscription — participate in every window

**Files:**
- Create: `contracts/SigmaCron.sol`
- Create: `test/SigmaCron.test.ts`
- Modify: `contracts/somnia/ISomniaReactivity.sol`

**Interfaces:**
- Consumes: `SigmaPolicyVault.evaluate`, `SigmaOracle.refreshAll`, `IDreamDexEventContracts.openMarkets`
- Produces: `SigmaCron.onEvent(...)` sweeping all open markets

**Blocking unknown:** the exact cron-subscription API is RESEARCH.md open question
#5. Before writing code, read `docs.somnia.network` → Reactivity → Tutorials →
cron subscriptions and record the real signature in `ISomniaReactivity.sol`. The
task below assumes cron arrives as a normal handler callback; if the API differs,
adjust the subscription call only — the sweep logic is unaffected.

- [ ] **Step 1: Confirm the cron API and record it**

Read the cron subscription tutorial. Write the exact signature into
`ISomniaReactivity.sol` as `subscribeCron(...)` with a comment citing the doc
page. If cron turns out to be unavailable, fall back to subscribing to the
venue's market-open event and note the substitution in the README — do not
invent an API.

- [ ] **Step 2: Write the failing test**

```typescript
// test/SigmaCron.test.ts
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

const WAD = 10n ** 18n;
const PRECOMPILE = "0x0000000000000000000000000000000000000100";
const UNDERLYING = "0x0000000000000000000000000000000000000001";

describe("SigmaCron", () => {
  let vol: any, mock: any, oracle: any, vault: any, cron: any, helpers: any, now: bigint;

  beforeEach(async () => {
    const conn = await network.connect();
    const viem = conn.viem;
    helpers = conn.networkHelpers;
    const [wallet] = await viem.getWalletClients();

    vol = await viem.deployContract("RealizedVol", [wallet.account.address]);
    mock = await viem.deployContract("MockEventContracts");
    oracle = await viem.deployContract("SigmaOracle", [vol.address, mock.address, wallet.account.address]);
    vault = await viem.deployContract("SigmaPolicyVault", [oracle.address, mock.address, wallet.account.address]);
    cron = await viem.deployContract("SigmaCron", [vault.address, mock.address, wallet.account.address]);

    await vault.write.setOperator([cron.address]);
    await vault.write.setPolicy([{
      minEdgeBps: 200n, maxStakeWad: 100n * WAD, kellyCapWad: WAD / 2n, enabled: true,
    }]);
    await vault.write.deposit([1000n * WAD]);

    now = BigInt(Math.floor(Date.now() / 1000));
    let p = 100_000n * WAD;
    for (let i = 0; i < 40; i++) {
      p = i % 2 === 0 ? (p * 1002n) / 1000n : (p * 1000n) / 1002n;
      await vol.write.recordPrice([UNDERLYING, p]);
    }
    for (const id of ["0x" + "aa".padStart(64, "0"), "0x" + "bb".padStart(64, "0")]) {
      await mock.write.createMarket([id, UNDERLYING, 100_000n * WAD, now, now + 900n]);
      await mock.write.setSpot([id, 100_000n * WAD]);
      await mock.write.setBook([id, 200_000_000_000_000_000n]); // 0.20 -> big edge
    }
  });

  it("rejects a sweep from anyone but the precompile", async () => {
    await assert.rejects(() => cron.write.onEvent([PRECOMPILE, [], "0x"]));
  });

  it("evaluates every open market in one sweep", async () => {
    await helpers.impersonateAccount(PRECOMPILE);
    await helpers.setBalance(PRECOMPILE, 10n ** 18n);
    await cron.write.onEvent([PRECOMPILE, [], "0x"], { account: PRECOMPILE });

    const a = await vault.read.positions(["0x" + "aa".padStart(64, "0")]);
    const b = await vault.read.positions(["0x" + "bb".padStart(64, "0")]);
    assert.equal(a.open, true);
    assert.equal(b.open, true);
  });

  it("continues the sweep when one market fails", async () => {
    const bad = "0x" + "cc".padStart(64, "0");
    await mock.write.createMarket([bad, UNDERLYING, 100_000n * WAD, now, now + 900n]);
    await mock.write.setSpot([bad, 100_000n * WAD]);
    // no book set -> bestAskUpWad reverts

    await helpers.impersonateAccount(PRECOMPILE);
    await helpers.setBalance(PRECOMPILE, 10n ** 18n);
    await cron.write.onEvent([PRECOMPILE, [], "0x"], { account: PRECOMPILE });

    const a = await vault.read.positions(["0x" + "aa".padStart(64, "0")]);
    assert.equal(a.open, true); // the good markets still traded
  });
});
```

- [ ] **Step 3: Add an operator role to the vault**

`SigmaCron` must be able to call `evaluate`. Add to `SigmaPolicyVault`:

```solidity
    address public operator;

    event OperatorChanged(address indexed operator);

    function setOperator(address operator_) external onlyOwner {
        operator = operator_;
        emit OperatorChanged(operator_);
    }

    modifier onlyOwnerOrOperator() {
        if (msg.sender != owner && msg.sender != operator) revert NotOwner();
        _;
    }
```

Change `evaluate`'s modifier to `onlyOwnerOrOperator`.

- [ ] **Step 4: Implement `SigmaCron`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SigmaPolicyVault} from "./SigmaPolicyVault.sol";
import {IDreamDexEventContracts} from "./interfaces/IDreamDexEventContracts.sol";
import {ISomniaEventHandler, SOMNIA_REACTIVITY_PRECOMPILE} from "./somnia/ISomniaReactivity.sol";

/// @title SigmaCron
/// @notice Woken by a Somnia cron subscription; sweeps every open Event
///         Contract through the vault's policy.
/// @dev 96 fifteen-minute windows per underlying per day is more than any human
///      trades by hand. The 200,000,000 gas handler ceiling is what makes a
///      full sweep viable inside a single reactive invocation.
contract SigmaCron is ISomniaEventHandler {
    SigmaPolicyVault public immutable vault;
    IDreamDexEventContracts public immutable venue;
    address public owner;

    error NotPrecompile();
    error NotOwner();

    event SweepCompleted(uint256 marketsSeen, uint256 traded, uint256 failed);
    event MarketFailed(bytes32 indexed marketId);

    constructor(address vault_, address venue_, address owner_) {
        vault = SigmaPolicyVault(vault_);
        venue = IDreamDexEventContracts(venue_);
        owner = owner_;
    }

    function onEvent(address, bytes32[] calldata, bytes calldata) external {
        if (msg.sender != SOMNIA_REACTIVITY_PRECOMPILE) revert NotPrecompile();
        _sweep();
    }

    /// @notice Manual sweep, for the demo and for recovery if a cron tick is missed.
    function sweep() external {
        if (msg.sender != owner) revert NotOwner();
        _sweep();
    }

    /// @dev One failing market must never abort the sweep — the other 95 windows
    ///      still deserve to be evaluated.
    function _sweep() private {
        bytes32[] memory ids = venue.openMarkets();
        uint256 traded;
        uint256 failed;
        for (uint256 i; i < ids.length; ++i) {
            try vault.evaluate(ids[i]) returns (bool didTrade, uint256) {
                if (didTrade) ++traded;
            } catch {
                ++failed;
                emit MarketFailed(ids[i]);
            }
        }
        emit SweepCompleted(ids.length, traded, failed);
    }

    receive() external payable {}
}
```

- [ ] **Step 5: Run the tests**

Run: `npx hardhat test test/SigmaCron.test.ts`
Expected: PASS, 3 cases.

- [ ] **Step 6: Stage the commit (run only if asked)**

```bash
git add contracts/ test/ && git commit -m "feat: cron-driven sweep across all open windows"
```

---

### Task 12: Deployment to Somnia testnet

**Files:**
- Create: `scripts/deploy.ts`
- Create: `deployments/somniaTestnet.json` (generated)
- Create: `README.md`

**Interfaces:**
- Consumes: every contract from Tasks 3–11
- Produces: `deployments/somniaTestnet.json` — the address book the frontend reads

- [ ] **Step 1: Fund the deployer**

Get STT from the faucet at `testnet.somnia.network`. Confirm the balance:

```bash
npx hardhat console --network somniaTestnet
```

- [ ] **Step 2: Write the deploy script**

```typescript
// scripts/deploy.ts
import { network } from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";

async function main() {
  const { viem } = await network.connect({ network: "somniaTestnet" });
  const [wallet] = await viem.getWalletClients();
  const owner = wallet.account.address;
  console.log("deployer:", owner);

  const vol = await viem.deployContract("RealizedVol", [owner]);
  console.log("RealizedVol:", vol.address);

  const reactive = await viem.deployContract("SigmaReactiveVol", [vol.address, owner]);
  console.log("SigmaReactiveVol:", reactive.address);
  await vol.write.setWriter([reactive.address]);

  const venue = await viem.deployContract("MockEventContracts");
  console.log("MockEventContracts:", venue.address);

  const oracle = await viem.deployContract("SigmaOracle", [vol.address, venue.address, owner]);
  console.log("SigmaOracle:", oracle.address);

  const vault = await viem.deployContract("SigmaPolicyVault", [oracle.address, venue.address, owner]);
  console.log("SigmaPolicyVault:", vault.address);

  const cron = await viem.deployContract("SigmaCron", [vault.address, venue.address, owner]);
  console.log("SigmaCron:", cron.address);
  await vault.write.setOperator([cron.address]);

  mkdirSync("deployments", { recursive: true });
  writeFileSync("deployments/somniaTestnet.json", JSON.stringify({
    chainId: 50312,
    RealizedVol: vol.address,
    SigmaReactiveVol: reactive.address,
    MockEventContracts: venue.address,
    SigmaOracle: oracle.address,
    SigmaPolicyVault: vault.address,
    SigmaCron: cron.address,
  }, null, 2));
  console.log("wrote deployments/somniaTestnet.json");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
```

- [ ] **Step 3: Deploy**

Run: `npx hardhat run scripts/deploy.ts --network somniaTestnet`
Expected: six addresses printed and the address book written.

- [ ] **Step 4: Prove Reactivity works on the live chain**

This is the moment the central technical claim is either true or not. Fund
`SigmaReactiveVol` with STT (it pays for its own handler gas as subscription
owner), call `subscribeTo` against a live price-emitting contract, wait for
price events, then read `sampleCount` and confirm it is climbing **without any
process of ours running**.

Record the transaction hash and the climbing sample count. This is the single
most persuasive artefact in the demo video — do not skip it, and do not claim it
until the number has actually moved on its own.

- [ ] **Step 5: Write the README**

Cover: what Sigma is, the one-line pitch, chain ID 50312, deployed addresses,
how to run tests, the model and its stated assumptions, the settlement-style
caveat, and an explicit list of what is mocked versus live. Overstating what is
live is the fastest way to lose a judge's trust — say plainly that the venue is
mocked until dreamDEX addresses land.

- [ ] **Step 6: Stage the commit (run only if asked)**

```bash
git add scripts/ deployments/ README.md && git commit -m "chore: deploy to somnia testnet 50312"
```

---

### Task 13: Real dreamDEX adapter — swap in when addresses are known

**Files:**
- Create: `contracts/adapters/DreamDexAdapter.sol`
- Create: `test/DreamDexAdapter.test.ts`

**Interfaces:**
- Produces: a second `IDreamDexEventContracts` implementation, address-compatible with the mock

**Blocked on:** RESEARCH.md open question #1 (addresses and ABI) and #7
(settlement rule). Everything else in this plan completes without it.

- [ ] **Step 1: Obtain the real surface**

From the hackathon resources tab, the Somnia Discord, or by reading a live
Event Contract in the testnet explorer, record the contract address, the ABI,
the market-identifier scheme, and the settlement rule.

- [ ] **Step 2: Confirm the settlement rule and set the style**

If settlement uses the terminal price, leave `SettlementStyle.Terminal`. If it
averages across the window, call `oracle.setSettlementStyle(Average)`. Getting
this wrong makes every published edge figure wrong — confirm it from the
contract source or the docs, not from an assumption.

- [ ] **Step 3: Implement the adapter**

Translate dreamDEX's real functions into the six methods of
`IDreamDexEventContracts`. The interface was designed to be narrow precisely so
this is a small, mechanical file.

- [ ] **Step 4: Test against a forked testnet**

Fork Somnia testnet at a recent block and assert the adapter returns sane values
for a real open market: an ask strictly inside (0,1), a non-zero spot, and an
expiry in the future.

- [ ] **Step 5: Redeploy pointing at the adapter**

Run the deploy script with the adapter address in place of the mock, and update
`deployments/somniaTestnet.json`.

- [ ] **Step 6: Stage the commit (run only if asked)**

```bash
git add contracts/ test/ && git commit -m "feat: live dreamDEX adapter"
```

---

## Self-review notes

**Spec coverage.** DESIGN.md §3.1 lists seven units. `BinaryPricer` → Tasks 3–5.
`RealizedVol` → Task 7. `SigmaOracle` → Task 9. `SigmaPolicyVault` → Task 10.
`IDreamDexEventContracts` and `MockEventContracts` → Task 6. Reactivity wiring →
Tasks 8 and 11. `SigmaAgentEnricher` (DESIGN.md, marked optional) is **not**
planned here — it is deliberately deferred because per-call agent cost on testnet
is unmeasured (RESEARCH.md #4), and the spec states agents must never be
load-bearing. It is a stretch task, not a gap.

**Error handling coverage.** DESIGN.md §5 lists five cases: stale volatility
(Task 7 `ok` flag, Task 9 honours it, Task 10 refuses to trade), insufficient
samples (Task 7 `MIN_SAMPLES`), agent failure (deferred with the enricher),
adapter unavailable (Task 11 `try/catch` with `MarketFailed`, Task 10 `Skipped`),
displayed limits (Task 12 README, and the frontend plan).

**Frontend.** DESIGN.md §4 is covered by a separate plan —
`2026-08-27-sigma-frontend.md` — because it is independently testable and
shippable, and mixing it here would make both plans harder to execute.

**Backtest harness.** DESIGN.md §6 mentions it; it belongs with the frontend plan
since it shares the TypeScript reference implementation.
