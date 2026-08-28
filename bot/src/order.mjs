/**
 * Sigma order placement — places real orders on dreamDEX via the SDK.
 *
 * Taker mode: hits the best ask when edge exceeds threshold.
 * Builder fee is always 0 (Shannon cap is 0; non-zero reverts).
 */

import { VENUE_ID_REAL } from "./client.mjs";
import { quantizePrice, quantizeSize, complementPrice } from "./quantize.mjs";

const ONE_COLLATERAL = 1_000_000n; // 6-decimal tUSDC
const TICK_SIZE = 1000n;
const LOT_SIZE = 1000n;

/**
 * Place a taker order (hitting the ask) on dreamDEX.
 *
 * @param {object} exchange - SomniaMarkets instance with privateKey
 * @param {object} market - BinaryMarket from SDK
 * @param {object} decision - from strategy.evaluate()
 * @param {object} opts - { dryRun?: boolean }
 * @returns {object} { hash, receipt?, fills?, dryRun? }
 */
export async function placeTakerOrder(exchange, market, decision, opts = {}) {
  const { dryRun = false } = opts;

  if (decision.action !== "trade") {
    return { error: "no trade to place", decision };
  }

  const pool = market.poolAddress ?? market.marketAddress;
  const side = decision.side === "buyYes" ? "BUY_YES" : "BUY_NO";
  const price = decision.priceRaw;
  const quantity = decision.sizeRaw;

  if (dryRun) {
    return {
      dryRun: true,
      side,
      price: price.toString(),
      quantity: quantity.toString(),
      pool,
      marketId: market.marketId,
      edgeBps: decision.edge,
      kelly: decision.kelly,
    };
  }

  try {
    const result = await exchange.trader.placeOrder({
      pool,
      side,
      price,
      quantity,
      orderType: 0, // LIMIT
      builderFeeBpsTimes1k: 0n, // must be 0 on Shannon
    });

    return {
      hash: result.hash,
      receipt: result.receipt,
      fills: result.fills,
      orderId: result.orderId,
      side,
      price: price.toString(),
      quantity: quantity.toString(),
    };
  } catch (err) {
    return { error: err.message, side, price: price.toString(), quantity: quantity.toString() };
  }
}

/**
 * Place maker orders (POST_ONLY) to seed a two-sided book.
 * Returns orders for both YES and NO sides around fair value.
 */
export async function placeMakerOrders(exchange, market, fairValue, opts = {}) {
  const { dryRun = false, halfSpreadBps = 100 } = opts;

  const pool = market.poolAddress ?? market.marketAddress;
  const fairProb = fairValue.fairProbBps / 10_000;

  // Half-spread in probability terms
  const halfSpread = halfSpreadBps / 10_000;
  const bidProb = Math.max(0.001, fairProb - halfSpread);
  const askProb = Math.min(0.999, fairProb + halfSpread);

  const bp = await exchange.client.getBinaryBookParams(pool);

  const priceYesBid = quantizePrice(bidProb, TICK_SIZE, ONE_COLLATERAL);
  const priceYesAsk = quantizePrice(askProb, TICK_SIZE, ONE_COLLATERAL);

  const results = [];

  // YES side bid and ask
  const bidQuantity = quantizeSize(10, LOT_SIZE, ONE_COLLATERAL); // 10 USDC default
  const askQuantity = quantizeSize(10, LOT_SIZE, ONE_COLLATERAL);

  if (bidQuantity > 0n) {
    if (dryRun) {
      results.push({
        dryRun: true,
        side: "BUY_YES",
        price: priceYesBid.toString(),
        quantity: bidQuantity.toString(),
        pool,
      });
    } else {
      try {
        const r = await exchange.trader.placeOrder({
          pool,
          side: "BUY_YES",
          price: priceYesBid,
          quantity: bidQuantity,
          orderType: 3, // POST_ONLY
          builderFeeBpsTimes1k: 0n,
        });
        results.push({ hash: r.hash, side: "BUY_YES", price: priceYesBid.toString() });
      } catch (err) {
        results.push({ error: err.message, side: "BUY_YES" });
      }
    }
  }

  if (askQuantity > 0n) {
    const priceNoAsk = complementPrice(priceYesAsk, ONE_COLLATERAL);
    if (dryRun) {
      results.push({
        dryRun: true,
        side: "BUY_NO",
        price: priceNoAsk.toString(),
        quantity: askQuantity.toString(),
        pool,
      });
    } else {
      try {
        const r = await exchange.trader.placeOrder({
          pool,
          side: "BUY_NO",
          price: priceNoAsk,
          quantity: askQuantity,
          orderType: 3, // POST_ONLY
          builderFeeBpsTimes1k: 0n,
        });
        results.push({ hash: r.hash, side: "BUY_NO", price: priceNoAsk.toString() });
      } catch (err) {
        results.push({ error: err.message, side: "BUY_NO" });
      }
    }
  }

  return results;
}

/**
 * Cancel all open orders for a given pool.
 */
export async function cancelAllOrders(exchange, pool) {
  try {
    await exchange.trader.cancelAllOrders({ pool });
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
}
