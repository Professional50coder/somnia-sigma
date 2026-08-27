import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

/**
 * RealizedVol maintains an EWMA of squared log returns.
 *
 * The assertions below check three things in order of importance:
 *   1. It refuses to answer when it does not know (too few samples, or stale).
 *   2. The number it produces is the right order of magnitude for a series
 *      whose volatility we constructed and therefore know.
 *   3. Bad data cannot poison it.
 */
const WAD = 10n ** 18n;
const BTC = "0x0000000000000000000000000000000000000001";
const ETH = "0x0000000000000000000000000000000000000002";

const wad = (n: number) => BigInt(Math.round(n * 1e18));

/**
 * Feed an alternating +/- series of a known per-step magnitude.
 * A step of `bps` basis points gives |log return| ~= bps/10000 per observation,
 * so the EWMA sigma should converge near that value.
 */
async function feed(vol: any, asset: string, steps: number, bps: bigint, start = 100_000n * WAD) {
  let p = start;
  const num = 10_000n + bps;
  for (let i = 0; i < steps; i++) {
    p = i % 2 === 0 ? (p * num) / 10_000n : (p * 10_000n) / num;
    await vol.write.recordPrice([asset, p]);
  }
  return p;
}

describe("RealizedVol", () => {
  let vol: any;
  let owner: any;
  let other: any;

  beforeEach(async () => {
    const { viem } = await network.connect();
    [owner, other] = await viem.getWalletClients();
    // owner is also the writer, so tests can submit observations directly.
    vol = await viem.deployContract("RealizedVol", [
      owner.account.address,
      owner.account.address,
    ]);
  });

  describe("refusing to answer when it does not know", () => {
    it("is not ok before any observation at all", async () => {
      const [sigma, updatedAt, ok] = await vol.read.sigmaWad([BTC]);
      assert.equal(ok, false);
      assert.equal(sigma, 0n);
      assert.equal(updatedAt, 0n);
    });

    it("is not ok after a single price — one price is not a return", async () => {
      await vol.write.recordPrice([BTC, 100_000n * WAD]);
      const [, , ok] = await vol.read.sigmaWad([BTC]);
      assert.equal(ok, false);
      assert.equal(await vol.read.sampleCount([BTC]), 0);
    });

    it("is not ok below MIN_SAMPLES", async () => {
      const min = await vol.read.MIN_SAMPLES();
      await feed(vol, BTC, Number(min) - 5, 10n);
      const [, , ok] = await vol.read.sigmaWad([BTC]);
      assert.equal(ok, false);
      assert.ok((await vol.read.sampleCount([BTC])) < min);
    });

    it("becomes ok once MIN_SAMPLES observations have accrued", async () => {
      const min = Number(await vol.read.MIN_SAMPLES());
      await feed(vol, BTC, min + 2, 10n);
      const [sigma, updatedAt, ok] = await vol.read.sigmaWad([BTC]);
      assert.equal(ok, true);
      assert.ok(sigma > 0n, "a ready estimator must report a non-zero sigma");
      assert.ok(updatedAt > 0n);
    });

    it("tracks each underlying independently", async () => {
      const min = Number(await vol.read.MIN_SAMPLES());
      await feed(vol, BTC, min + 2, 10n);
      const [, , btcOk] = await vol.read.sigmaWad([BTC]);
      const [, , ethOk] = await vol.read.sigmaWad([ETH]);
      assert.equal(btcOk, true);
      assert.equal(ethOk, false, "ETH has no observations and must not be ok");
    });
  });

  describe("the estimate itself", () => {
    it("converges near the known volatility of a constructed series", async () => {
      // 10 bps per step => |log return| ~= 0.001 => sigma ~= 1e15 in WAD.
      await feed(vol, BTC, 80, 10n);
      const [sigma, , ok] = await vol.read.sigmaWad([BTC]);
      assert.equal(ok, true);
      assert.ok(sigma > wad(0.0005), `sigma too low: ${sigma}`);
      assert.ok(sigma < wad(0.003), `sigma too high: ${sigma}`);
    });

    it("reports a larger sigma for a more volatile series", async () => {
      await feed(vol, BTC, 80, 10n); // 0.10% steps
      await feed(vol, ETH, 80, 100n); // 1.00% steps
      const [calm] = await vol.read.sigmaWad([BTC]);
      const [wild] = await vol.read.sigmaWad([ETH]);
      assert.ok(wild > calm, `expected ${wild} > ${calm}`);
      // An order of magnitude more movement should show up as roughly an
      // order of magnitude more sigma, not a rounding difference.
      assert.ok(wild > calm * 5n, `expected a clear separation: ${wild} vs ${calm}`);
    });

  });

  describe("resistance to bad data", () => {
    it("rejects a zero price outright", async () => {
      await assert.rejects(() => vol.write.recordPrice([BTC, 0n]));
    });

    it("skips an implausible jump instead of poisoning the estimate", async () => {
      await feed(vol, BTC, 60, 10n);
      const [before] = await vol.read.sigmaWad([BTC]);
      const samplesBefore = await vol.read.sampleCount([BTC]);

      // A 10x print. Squaring that log return would dominate the EWMA for a
      // very long time, so it must be rejected rather than absorbed.
      await vol.write.recordPrice([BTC, 1_000_000n * WAD]);

      const [after] = await vol.read.sigmaWad([BTC]);
      assert.equal(after, before, "an outlier must not move sigma");
      assert.equal(await vol.read.sampleCount([BTC]), samplesBefore, "and must not count as a sample");
    });

    it("adopts the outlier price so the NEXT return is not also enormous", async () => {
      await feed(vol, BTC, 60, 10n);
      await vol.write.recordPrice([BTC, 1_000_000n * WAD]);
      assert.equal(await vol.read.lastPriceWad([BTC]), 1_000_000n * WAD);
    });

    it("accepts a large but plausible move", async () => {
      await feed(vol, BTC, 60, 10n);
      const before = await vol.read.sampleCount([BTC]);
      const last = await vol.read.lastPriceWad([BTC]);
      // ~5%, well inside MAX_ABS_LOG_RETURN.
      await vol.write.recordPrice([BTC, (last * 105n) / 100n]);
      assert.equal(await vol.read.sampleCount([BTC]), before + 1);
    });
  });

  describe("access control", () => {
    it("rejects observations from a non-writer", async () => {
      await assert.rejects(() =>
        vol.write.recordPrice([BTC, 100_000n * WAD], { account: other.account }),
      );
    });

    it("lets the owner repoint the writer", async () => {
      await vol.write.setWriter([other.account.address]);
      assert.equal(
        (await vol.read.writer()).toLowerCase(),
        other.account.address.toLowerCase(),
      );
      await vol.write.recordPrice([BTC, 100_000n * WAD], { account: other.account });
    });

    it("does not let a non-owner repoint the writer", async () => {
      await assert.rejects(() =>
        vol.write.setWriter([other.account.address], { account: other.account }),
      );
    });

    it("stops accepting from the previous writer once repointed", async () => {
      await vol.write.setWriter([other.account.address]);
      // owner was the writer and is no longer.
      await assert.rejects(() => vol.write.recordPrice([BTC, 100_000n * WAD]));
    });
  });
});
