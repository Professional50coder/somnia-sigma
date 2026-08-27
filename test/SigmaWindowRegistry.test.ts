import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

const MARKET = "0x" + "11".repeat(32);
const ASSET = "0x" + "42".repeat(32);
const PRICE_KEY = "0x0000000000000000000000000000000000000001";
const POOL = "0x0000000000000000000000000000000000000002";

describe("SigmaWindowRegistry", () => {
  let registry: any; let owner: any; let other: any;
  const window = (overrides: Record<string, unknown> = {}) => ({
    marketId: MARKET, asset: ASSET, priceKey: PRICE_KEY, poolAddress: POOL,
    openingPrice: 7_952_897n, openingScale: 2, tradingStart: 1_000_000_000n,
    expiry: 1_000_000_900n, intervalSec: 900, publisher: "0x0000000000000000000000000000000000000000",
    publishedAt: 0n, exists: false, ...overrides,
  });
  beforeEach(async () => { const { viem } = await network.connect(); [owner, other] = await viem.getWalletClients(); registry = await viem.deployContract("SigmaWindowRegistry", [owner.account.address, owner.account.address]); });
  it("rejects non-publishers", async () => assert.rejects(() => registry.write.publishWindow([window()], { account: other.account })));
  it("rejects zero opening prices and invalid durations", async () => {
    await assert.rejects(() => registry.write.publishWindow([window({ openingPrice: 0n })]));
    await assert.rejects(() => registry.write.publishWindow([window({ intervalSec: 60 })]));
  });
  it("records published metadata and its publisher", async () => {
    await registry.write.publishWindow([window()]);
    const stored = await registry.read.getWindow([MARKET]);
    assert.equal(stored.openingPrice, 7_952_897n);
    assert.equal(stored.publisher.toLowerCase(), owner.account.address.toLowerCase());
  });
});
