import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

const PRECOMPILE = "0x0000000000000000000000000000000000000100";
const WAD = 10n ** 18n;

describe("SigmaCron", () => {
  let viem: any;
  let networkHelpers: any;
  let owner: any;
  let other: any;
  let precompile: any;

  beforeEach(async () => {
    ({ viem, networkHelpers } = await network.connect());
    [owner, other] = await viem.getWalletClients();
    await networkHelpers.impersonateAccount(PRECOMPILE);
    await networkHelpers.setBalance(PRECOMPILE, WAD);
    precompile = await viem.getWalletClient(PRECOMPILE);
  });

  it("only the reactivity precompile may invoke onEvent", async () => {
    const vol = await viem.deployContract("RealizedVol", [owner.account.address, owner.account.address]);
    const registry = await viem.deployContract("SigmaWindowRegistry", [owner.account.address, owner.account.address]);
    const oracle = await viem.deployContract("SigmaOracle", [vol.address, registry.address]);
    const cron = await viem.deployContract("SigmaCron", [oracle.address, owner.account.address]);

    await assert.rejects(() => cron.write.onEvent(["0x0000000000000000000000000000000000000000", [], "0x"]));
    // Precompile-invoked calls succeed (return value is the refreshed count).
    await cron.write.onEvent(["0x0000000000000000000000000000000000000000", [], "0x"], { account: precompile.account });
  });

  it("a sweep never reverts even when the underlying oracle reverts", async () => {
    const reverting = await viem.deployContract("MockRevertingOracle");
    const cron = await viem.deployContract("SigmaCron", [reverting.address, owner.account.address]);

    // Must not throw: the precompile-facing entrypoint must never fail
    // because of an oracle-side problem, or Somnia may stop delivering to it.
    await cron.write.onEvent(["0x0000000000000000000000000000000000000000", [], "0x"], { account: precompile.account });

    const hash = await cron.write.sweep();
    const receipt = await (await viem.getPublicClient()).waitForTransactionReceipt({ hash });
    assert.ok(receipt.logs.length > 0, "SweepCompleted must still be emitted with refreshed=0");
  });

  it("reports the real refreshed count from a working oracle", async () => {
    const vol = await viem.deployContract("RealizedVol", [owner.account.address, owner.account.address]);
    const registry = await viem.deployContract("SigmaWindowRegistry", [owner.account.address, owner.account.address]);
    const oracle = await viem.deployContract("SigmaOracle", [vol.address, registry.address]);
    const cron = await viem.deployContract("SigmaCron", [oracle.address, owner.account.address]);

    const marketId = "0x" + "cc".repeat(32);
    const pool = await viem.deployContract("MockBinaryPool");
    const now = BigInt(await networkHelpers.time.latest()) + 5n;
    await registry.write.publishWindow([{
      marketId, asset: "0x" + "01".padStart(64, "0"), priceKey: "0x0000000000000000000000000000000000000001",
      poolAddress: pool.address, openingPrice: 10_000_000n, openingScale: 2,
      tradingStart: now - 810n, expiry: now + 90n, intervalSec: 900,
      publisher: "0x0000000000000000000000000000000000000000", publishedAt: 0n, exists: false,
    }]);

    await networkHelpers.time.setNextBlockTimestamp(now);
    const count = await cron.simulate.sweep({ account: owner.account });
    assert.equal(count.result, 1n);
  });

  it("owner-gated controls reject non-owners and accept the owner", async () => {
    const oracle = await viem.deployContract("MockRevertingOracle");
    const cron = await viem.deployContract("SigmaCron", [oracle.address, owner.account.address]);

    await assert.rejects(() => cron.write.setCadence([300], { account: other.account }));
    await cron.write.setCadence([300]);
    assert.equal(await cron.read.cadenceSeconds(), 300);

    await assert.rejects(() => cron.write.setCadence([0]));

    await assert.rejects(() => cron.write.setNextScheduledMs([123n], { account: other.account }));
    await cron.write.setNextScheduledMs([123n]);
    assert.equal(await cron.read.nextScheduledMs(), 123n);

    await assert.rejects(() => cron.write.sweep({ account: other.account }));
  });
});
