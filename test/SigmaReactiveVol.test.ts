import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters } from "viem";
import { network } from "hardhat";

const PRECOMPILE = "0x0000000000000000000000000000000000000100";
const BTC_POOL = "0x3605f28aa7c50e7441211e77cb0762d49539326c";
const BTC = "0x0000000000000000000000000000000000000001";
const MARK_PRICE_UPDATED = "0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888";
const OTHER_TOPIC = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WAD = 10n ** 18n;

const eventData = (markPrice: bigint) =>
  encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], [markPrice, 0n]);

describe("SigmaReactiveVol", () => {
  let owner: any;
  let other: any;
  let reactive: any;
  let vol: any;
  let precompile: any;

  beforeEach(async () => {
    const { viem, networkHelpers } = await network.connect();
    [owner, other] = await viem.getWalletClients();
    vol = await viem.deployContract("RealizedVol", [owner.account.address, "0x0000000000000000000000000000000000000000"]);
    reactive = await viem.deployContract("SigmaReactiveVol", [vol.address, owner.account.address]);
    await vol.write.setWriter([reactive.address]);
    await reactive.write.mapEmitter([BTC_POOL, MARK_PRICE_UPDATED, BTC]);

    await networkHelpers.impersonateAccount(PRECOMPILE);
    await networkHelpers.setBalance(PRECOMPILE, WAD);
    precompile = await viem.getWalletClient(PRECOMPILE);
  });

  it("only accepts callbacks from the reactivity precompile", async () => {
    await assert.rejects(() => reactive.write.onEvent([BTC_POOL, [MARK_PRICE_UPDATED], eventData(80_000n * WAD)]));
  });

  it("decodes the MarkPriceUpdated data words and forwards markPrice", async () => {
    const mark = 79_438n * WAD;
    await reactive.write.onEvent([BTC_POOL, [MARK_PRICE_UPDATED], eventData(mark)], { account: precompile.account });
    assert.equal(await vol.read.lastPriceWad([BTC]), mark);
    assert.equal(await vol.read.sampleCount([BTC]), 0);

    await reactive.write.onEvent([BTC_POOL, [MARK_PRICE_UPDATED], eventData(mark + 10n * WAD)], { account: precompile.account });
    assert.equal(await vol.read.sampleCount([BTC]), 1);
  });

  it("ignores an unmapped emitter or topic without reverting", async () => {
    await reactive.write.onEvent([BTC_POOL, [OTHER_TOPIC], eventData(80_000n * WAD)], { account: precompile.account });
    assert.equal(await vol.read.lastPriceWad([BTC]), 0n);
  });

  it("rejects a malformed callback payload", async () => {
    await assert.rejects(() =>
      reactive.write.onEvent([BTC_POOL, [MARK_PRICE_UPDATED], "0x1234"], { account: precompile.account }),
    );
  });

  it("allows only the owner to configure subscribed emitters", async () => {
    await assert.rejects(() => reactive.write.mapEmitter([BTC_POOL, OTHER_TOPIC, BTC], { account: other.account }));
  });
});
