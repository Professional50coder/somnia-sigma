// Shared read-only client construction. NO privateKey is ever passed here,
// which makes it structurally impossible for this module to sign or send a
// transaction -- there is no wallet client at all in this build.
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES, SOMNIA_TESTNET_PRICE_FEED } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

export const VENUE_ID_REAL = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c"; // operator 2 -- real Up/Down
export const VENUE_ID_TEST_DECOY = "0x1a1e6821cde7d0159c0d293177871e09677b4e42307c7db3ba94f8648a5a050f"; // operator 4 -- do not trade

export async function makeReadOnlyExchange() {
  const exchange = new SomniaMarkets({
    indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
    chain: somniaShannon,
    addresses: SOMNIA_TESTNET_ADDRESSES,
    priceFeed: SOMNIA_TESTNET_PRICE_FEED,
    // privateKey intentionally omitted -- read-only by construction.
  });
  await exchange.loadMarkets();
  return exchange;
}
