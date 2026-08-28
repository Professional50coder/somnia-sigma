/**
 * DreamDEX market data — reads live markets from the indexer GraphQL,
 * order books, and price feeds.
 */

const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER ?? "https://dev.smk.somnia.host/v1/graphql";
const VENUE_ID_REAL = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c";

export interface DreamDexMarket {
  id: string;
  marketId: string;
  symbol: string;
  asset: string;
  venueId: string;
  tradingStart: number;
  expiry: number;
  intervalSec: number;
  strike: string;
  poolAddress: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Fetch live binary markets from the dreamDEX indexer.
 */
export async function fetchLiveMarkets(asset?: string): Promise<DreamDexMarket[]> {
  const query = `
    query ListLiveBinaryMarkets($venueId: String!, $asset: String) {
      binaryMarkets(
        where: { venueId: $venueId, asset: $asset, status: "Trading" }
        orderBy: "expiry"
        orderDirection: "asc"
      ) {
        items {
          id
          marketId
          symbol
          asset
          venueId
          tradingStart
          expiry
          intervalSec
          strike
          poolAddress
        }
      }
    }
  `;

  try {
    const res = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { venueId: VENUE_ID_REAL, asset: asset ?? null },
      }),
    });

    const json: GraphQLResponse<{ binaryMarkets: { items: DreamDexMarket[] } }> = await res.json();
    if (json.errors?.length) {
      console.error("[dreamdex] GraphQL errors:", json.errors);
      return [];
    }

    const now = Math.floor(Date.now() / 1000);
    const markets = json.data?.binaryMarkets?.items ?? [];

    return markets.filter((m) => {
      const start = Number(m.tradingStart ?? 0);
      const exp = Number(m.expiry ?? 0);
      return start <= now && now < exp;
    });
  } catch (err) {
    console.error("[dreamdex] Failed to fetch markets:", err);
    return [];
  }
}

/**
 * Fetch opening prices for a set of market IDs.
 */
export async function fetchOpeningPrices(
  marketIds: string[]
): Promise<Record<string, string>> {
  if (marketIds.length === 0) return {};

  const query = `
    query GetOpeningPrices($marketIds: [String!]!) {
      openingPrices(marketIds: $marketIds) {
        marketId
        price
      }
    }
  `;

  try {
    const res = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { marketIds },
      }),
    });

    const json: GraphQLResponse<{
      openingPrices: Array<{ marketId: string; price: string }>;
    }> = await res.json();

    if (json.errors?.length) {
      console.error("[dreamdex] Opening prices errors:", json.errors);
      return {};
    }

    const map: Record<string, string> = {};
    for (const item of json.data?.openingPrices ?? []) {
      map[item.marketId] = item.price;
    }
    return map;
  } catch (err) {
    console.error("[dreamdex] Failed to fetch opening prices:", err);
    return {};
  }
}

/**
 * Fetch BTC spot price from the price feed.
 */
export async function fetchBtcSpot(): Promise<number | null> {
  const PRICE_FEED_URL = process.env.NEXT_PUBLIC_PRICE_FEED ?? "https://price-feed.dev.oracle.somnia.host/v1/graphql";

  const query = `
    query LatestPrice($symbol: String!) {
      latestPrice(symbol: $symbol) {
        price
        timestamp
      }
    }
  `;

  try {
    const res = await fetch(PRICE_FEED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { symbol: "BTCUSDC" },
      }),
    });

    const json: GraphQLResponse<{
      latestPrice: { price: number; timestamp: number };
    }> = await res.json();

    return json.data?.latestPrice?.price ?? null;
  } catch (err) {
    console.error("[dreamdex] Failed to fetch BTC spot:", err);
    return null;
  }
}
