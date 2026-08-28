/**
 * Sigma settlement — claims winnings from settled markets.
 *
 * Payouts are pull, not push. A bot that never redeems strands its balance
 * across finalized markets. This module sweeps claimable positions.
 *
 * Voided markets pay both sides 0.5 × amount, and winningOutcome is
 * meaningless — pass outcomeIdx explicitly there.
 */

/**
 * Check for claimable positions and redeem them.
 *
 * @param {object} exchange - SomniaMarkets instance with privateKey
 * @param {object} opts - { autoClaimIntervalMs?, dryRun? }
 * @returns {object} { redeemed: number, total: number, results: [] }
 */
export async function maybeClaim(exchange, opts = {}) {
  const { dryRun = false } = opts;

  try {
    const account = exchange.trader?.account?.address;
    if (!account) {
      return { error: "no account configured", redeemed: 0, total: 0, results: [] };
    }

    const claimable = await exchange.client.getClaimable(account);
    if (!claimable || claimable.length === 0) {
      return { redeemed: 0, total: 0, results: [], message: "nothing claimable" };
    }

    const results = [];
    let redeemed = 0;

    for (const entry of claimable) {
      if (dryRun) {
        results.push({
          dryRun: true,
          marketId: entry.marketId,
          amount: entry.amount?.toString() ?? "0",
          outcomeIdx: entry.outcomeIdx,
        });
        redeemed++;
        continue;
      }

      try {
        const result = await exchange.trader.redeem({
          marketId: entry.marketId,
          amount: entry.amount,
          outcomeIdx: entry.outcomeIdx,
        });
        results.push({
          hash: result.hash,
          marketId: entry.marketId,
          amount: entry.amount?.toString(),
          outcomeIdx: entry.outcomeIdx,
        });
        redeemed++;
      } catch (err) {
        results.push({
          error: err.message,
          marketId: entry.marketId,
        });
      }
    }

    return { redeemed, total: claimable.length, results };
  } catch (err) {
    return { error: err.message, redeemed: 0, total: 0, results: [] };
  }
}

/**
 * Check if a specific market is settled and claimable.
 */
export async function isSettled(exchange, marketId) {
  try {
    const resolution = await exchange.client.getMarketResolution(marketId);
    return {
      settled: !!resolution?.resolvedAtTimestamp,
      winningOutcome: resolution?.winningOutcome ?? null,
      resolvedAt: resolution?.resolvedAtTimestamp ?? null,
    };
  } catch (err) {
    return { settled: false, error: err.message };
  }
}
