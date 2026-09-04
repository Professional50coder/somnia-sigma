# Changelog

All notable changes follow Keep a Changelog conventions. Versions are not
released or tagged until local verification and the corresponding evidence are
complete.

## [Unreleased]

### Added

- `SigmaOracle`: Student-t fat-tail fair value (`studentFairProbBps`,
  `studentEdgeBps`) computed and published alongside the original Gaussian
  fair value on every `refresh()`, using an owner-settable `nuWad` (default
  5.2, matching the backtest's method-of-moments estimate). Redeployed as
  SigmaOracle v2 / SigmaCron v2 on Shannon testnet; see
  `docs/DEPLOYMENT-LEDGER.md` for the live proof transaction.
- `SigmaReactiveVol`: precompile-authorised bridge from dreamDEX mark prices to
  the realised-volatility estimator.
- `SigmaWindowRegistry`: publisher-auditable on-chain window metadata.
- `SigmaOracle`: public fair probability, edge, break-even and Kelly feed.
- `SigmaCron`: protected sweep handler for a Somnia cron subscription.
- Deployment, balance and unattended-operation verification scripts.
- Project status and deployment-ledger documentation.

### Changed

- Removed the obsolete observation-count window volatility path; all window
  volatility is now time-based.
- Updated the Somnia subscription interface to the current `SubscriptionData`
  shape, including handler selector, caller filter and execution options.

### Security

- Separated deployer and bot roles; private keys remain environment-only.
- Every oracle state includes an explicit reason when it is not safe to trade.

## [0.1.0] - 2026-08-27

### Added

- SciPy-validated fixed-point binary pricing library and reference vectors.
- Time-aware EWMA realised volatility estimator with cold/stale/outlier guards.
- Hardhat scaffold, Somnia Shannon configuration, market research and SDK notes.
