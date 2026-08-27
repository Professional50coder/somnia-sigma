import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

const WAD = 10n ** 18n;
const BTC = "0x0000000000000000000000000000000000000001";
const INTERVAL = 900;

// Reason enum order in SigmaOracle.sol: Ok, NoWindow, Expired, VolNotReady, NoSpot, ScaleMismatch, NoBook
const Reason = { Ok: 0, NoWindow: 1, Expired: 2, VolNotReady: 3, NoSpot: 4, ScaleMismatch: 5, NoBook: 6 };

async function seedVol(vol: any, asset: string, ticks = 40, bps = 10n, start = 100_000n * WAD) {
  let p = start;
  for (let i = 0; i < ticks; i++) {
    p = i % 2 === 0 ? (p * (10_000n + bps)) / 10_000n : (p * 10_000n) / (10_000n + bps);
    await vol.write.recordPrice([asset, p]);
  }
  return p;
}

describe("SigmaOracle", () => {
  let viem: any;
  let networkHelpers: any;
  let owner: any;
  let vol: any;
  let registry: any;
  let oracle: any;
  let pool: any;
  let harness: any;
  let marketId = "0x" + "11".repeat(32);

  beforeEach(async () => {
    ({ viem, networkHelpers } = await network.connect());
    [owner] = await viem.getWalletClients();
    vol = await viem.deployContract("RealizedVol", [owner.account.address, owner.account.address]);
    registry = await viem.deployContract("SigmaWindowRegistry", [owner.account.address, owner.account.address]);
    oracle = await viem.deployContract("SigmaOracle", [vol.address, registry.address]);
    pool = await viem.deployContract("MockBinaryPool");
    harness = await viem.deployContract("BinaryPricerHarness");
  });

  function windowInput(overrides: Record<string, unknown> = {}) {
    return {
      marketId, asset: "0x" + "01".padStart(64, "0"), priceKey: BTC, poolAddress: pool.address,
      openingPrice: 10_000_000n, openingScale: 2, // -> 100,000 WAD
      tradingStart: 0n, expiry: 900n, intervalSec: INTERVAL,
      publisher: "0x0000000000000000000000000000000000000000", publishedAt: 0n, exists: false,
      ...overrides,
    };
  }

  async function publishAt(now: bigint, tauFraction: number) {
    const remaining = BigInt(Math.round(INTERVAL * tauFraction));
    const tradingStart = now - BigInt(INTERVAL) + remaining;
    const expiry = tradingStart + BigInt(INTERVAL);
    await registry.write.publishWindow([windowInput({ tradingStart, expiry })]);
    return expiry;
  }

  it("reports NoWindow for an unpublished market", async () => {
    await oracle.write.refresh([marketId]);
    const fv = await oracle.read.getFairValue([marketId]);
    assert.equal(fv.reason, Reason.NoWindow);
    assert.equal(fv.ok, false);
  });

  it("reports VolNotReady before enough samples exist", async () => {
    const now = await networkHelpers.time.latest();
    await publishAt(BigInt(now), 0.1);
    await oracle.write.refresh([marketId]);
    const fv = await oracle.read.getFairValue([marketId]);
    assert.equal(fv.reason, Reason.VolNotReady);
    assert.equal(fv.ok, false);
  });

  it("reports Expired once the window has closed", async () => {
    await seedVol(vol, BTC, 40, 10n, 100_300n * WAD);
    const now = await networkHelpers.time.latest();
    // Publish a window that already ended.
    await registry.write.publishWindow([windowInput({ tradingStart: BigInt(now) - 1000n, expiry: BigInt(now) - 100n })]);
    await oracle.write.refresh([marketId]);
    const fv = await oracle.read.getFairValue([marketId]);
    assert.equal(fv.reason, Reason.Expired);
  });

  it("rejects a gross scale mismatch between opening price and spot instead of mispricing", async () => {
    await seedVol(vol, BTC, 40, 10n, 100_300n * WAD);
    const now = await networkHelpers.time.latest();
    // openingScale left at the default (2) but openingPrice given as if it were WAD-scaled:
    // this makes the normalised opening price ~1e16x too large, well outside the 0.5x-2x band.
    await registry.write.publishWindow([windowInput({
      tradingStart: BigInt(now) - 810n, expiry: BigInt(now) + 90n, openingPrice: 100_000n * WAD,
    })]);
    await oracle.write.refresh([marketId]);
    const fv = await oracle.read.getFairValue([marketId]);
    assert.equal(fv.reason, Reason.ScaleMismatch);
    assert.equal(fv.ok, false);
  });

  it("publishes a fair value that exactly matches BinaryPricer for the same inputs", async () => {
    const spot = await seedVol(vol, BTC, 40, 10n, 100_300n * WAD);
    const now = BigInt(await networkHelpers.time.latest()) + 5n;
    const tradingStart = now - 810n;
    const expiry = now + 90n;
    await registry.write.publishWindow([windowInput({ tradingStart, expiry })]);
    await pool.write.setBestAsk([500_000n, WAD]); // 0.50, raw 6dp -> oracle scales by 1e12

    await networkHelpers.time.setNextBlockTimestamp(now);
    await oracle.write.refresh([marketId]);
    const fv = await oracle.read.getFairValue([marketId]);

    assert.equal(fv.reason, Reason.Ok);
    const [sigma] = await vol.read.sigmaForSecondsWad([BTC, INTERVAL]);
    const tau = ((expiry - now) * WAD) / BigInt(INTERVAL);
    const expectedProb: bigint = await harness.read.probUp([spot, 100_000n * WAD, sigma, tau, 0]);
    assert.equal(fv.fairProbBps, (expectedProb * 10_000n) / WAD);
    assert.equal(fv.sigmaWad, sigma);
  });

  it("still publishes a usable fair value when the book is empty (NoBook, not silence)", async () => {
    const spot = await seedVol(vol, BTC, 40, 10n, 100_300n * WAD);
    const now = BigInt(await networkHelpers.time.latest()) + 5n;
    const tradingStart = now - 810n;
    const expiry = now + 90n;
    await registry.write.publishWindow([windowInput({ tradingStart, expiry })]);
    // pool has no asks set -> empty book

    await networkHelpers.time.setNextBlockTimestamp(now);
    await oracle.write.refresh([marketId]);
    const fv = await oracle.read.getFairValue([marketId]);

    assert.equal(fv.reason, Reason.NoBook);
    assert.equal(fv.ok, false);
    assert.ok(fv.fairProbBps > 0n, "fair value must still be published even with no book to compare against");
  });

  it("falls back to NoBook rather than reverting when the pool itself reverts", async () => {
    await seedVol(vol, BTC, 40, 10n, 100_300n * WAD);
    const now = BigInt(await networkHelpers.time.latest()) + 5n;
    await registry.write.publishWindow([windowInput({ tradingStart: now - 810n, expiry: now + 90n })]);
    await pool.write.setShouldRevert([true]);

    await networkHelpers.time.setNextBlockTimestamp(now);
    await oracle.write.refresh([marketId]); // must not revert
    const fv = await oracle.read.getFairValue([marketId]);
    assert.equal(fv.reason, Reason.NoBook);
    assert.ok(fv.fairProbBps > 0n);
  });

  it("computes edge as exactly fairProbBps minus impliedProbBps", async () => {
    await seedVol(vol, BTC, 40, 10n, 100_300n * WAD);
    const now = BigInt(await networkHelpers.time.latest()) + 5n;
    await registry.write.publishWindow([windowInput({ tradingStart: now - 810n, expiry: now + 90n })]);
    await pool.write.setBestAsk([700_000n, WAD]); // 0.70, raw 6dp -> oracle scales by 1e12

    await networkHelpers.time.setNextBlockTimestamp(now);
    await oracle.write.refresh([marketId]);
    const fv = await oracle.read.getFairValue([marketId]);

    assert.equal(fv.reason, Reason.Ok);
    assert.equal(fv.ok, true);
    assert.equal(fv.impliedProbBps, 7000n);
    assert.equal(fv.edgeBps, BigInt(fv.fairProbBps) - BigInt(fv.impliedProbBps));
    assert.equal(fv.breakEvenBps, 7000n);
    // The exact magnitude of edge for this seeded series is covered by the
    // dedicated demo scenario in test/BinaryPricer.test.ts; this test only
    // needs the wiring identity above to hold, which it does regardless of
    // the realised sigma from seedVol.
  });

  it("emits FairValuePublished on every refresh, including not-ok ones", async () => {
    const hash = await oracle.write.refresh([marketId]);
    const receipt = await (await viem.getPublicClient()).waitForTransactionReceipt({ hash });
    assert.ok(receipt.logs.length > 0, "an event must be emitted even when the market is unknown");
  });

  it("refreshAll processes every open window without one bad window blocking the rest", async () => {
    const marketA = "0x" + "aa".repeat(32);
    const marketB = "0x" + "bb".repeat(32);
    await seedVol(vol, BTC, 40, 10n, 100_300n * WAD);
    const now = BigInt(await networkHelpers.time.latest()) + 5n;

    await registry.write.publishWindow([windowInput({ marketId: marketA, tradingStart: now - 810n, expiry: now + 90n })]);
    // marketB references a pool that reverts -> should still be counted, not abort the batch.
    await pool.write.setShouldRevert([true]);
    await registry.write.publishWindow([windowInput({ marketId: marketB, tradingStart: now - 810n, expiry: now + 90n })]);

    await networkHelpers.time.setNextBlockTimestamp(now);
    const count = await oracle.simulate.refreshAll();
    assert.equal(count.result, 2n, "both windows must be processed even though one has a reverting pool");
  });

  it("quote() prices an externally supplied book price without needing a registered pool book", async () => {
    await seedVol(vol, BTC, 40, 10n, 100_300n * WAD);
    const now = BigInt(await networkHelpers.time.latest()) + 5n;
    await registry.write.publishWindow([windowInput({ tradingStart: now - 810n, expiry: now + 90n })]);
    await networkHelpers.time.setNextBlockTimestamp(now);
    await networkHelpers.mine();
    const fv = await oracle.read.quote([marketId, 700_000_000_000_000_000n]);
    assert.equal(fv.reason, Reason.Ok);
    assert.equal(fv.impliedProbBps, 7000n);
  });
});
