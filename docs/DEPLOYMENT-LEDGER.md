# Sigma — Deployment Ledger

Explorer base: `https://shannon-explorer.somnia.network`

## Funded accounts

| Observed | Role | Address | STT | tUSDC |
|---|---|---|---:|---:|
| 2026-08-27 | Deployer | `0x0dDb3093df73Ca59F33420670125e0C686c0A468` | 50.0000 | 500.0000 |
| 2026-08-27 | Bot | `0x7F8F17738f2901D291e465249a177F009E582ad9` | 50.0000 | 500.0000 |

## Deployment records

| UTC | Contract/action | Address | Transaction | Explorer | Gas | Result |
|---|---|---|---|---|---:|---|
| 2026-08-27T13:01:08Z | RealizedVol | `0xbd7eedfa178d8eb094449e3461e83195f4b062ef` | [`0x0935…0436`](https://shannon-explorer.somnia.network/tx/0x0935f529d024352ad408abe4396ba239195748339adfe5f3d0624b1269700436) | [contract](https://shannon-explorer.somnia.network/address/0xbd7eedfa178d8eb094449e3461e83195f4b062ef) | 11,743,565 | Deployed. |
| 2026-08-27T13:01:08Z | SigmaReactiveVol | `0x5f6a29b5717841f6f7b394be6936ea176dc63d28` | [`0x043b…5022`](https://shannon-explorer.somnia.network/tx/0x043b253d170e0c5cf79d325e61632b277cf82b5be32a4b940960982b34cd5022) | [contract](https://shannon-explorer.somnia.network/address/0x5f6a29b5717841f6f7b394be6936ea176dc63d28) | 7,027,987 | Deployed. |
| 2026-08-27T13:01:08Z | SigmaWindowRegistry | `0x16b9d8c364d70f38d0b04b760439efc794a46731` | [`0x0469…eeb5`](https://shannon-explorer.somnia.network/tx/0x046975182d0b40f204174a046f621ef073b39b901c47a9ad86ce8201a930eeb5) | [contract](https://shannon-explorer.somnia.network/address/0x16b9d8c364d70f38d0b04b760439efc794a46731) | 14,292,269 | Deployed. |
| 2026-08-27T13:01:08Z | SigmaOracle | `0xe4c7be7dca5f536cfb18df61b01f3a952e902270` | [`0xd4e1…ed0e`](https://shannon-explorer.somnia.network/tx/0xd4e181e9ba7086ece672a6660c20c50970335d1173d3e6f030f3d64dc35bed0e) | [contract](https://shannon-explorer.somnia.network/address/0xe4c7be7dca5f536cfb18df61b01f3a952e902270) | 21,115,752 | Deployed. |
| 2026-08-27T13:01:08Z | SigmaCron | `0xc573c7b699690d1821aa4156ef7c09ee9ceba0e7` | [`0x20ee…1952`](https://shannon-explorer.somnia.network/tx/0x20eeae735339b73df2b6105a8ebc73855bd5aec6ce6a255135b585047a2d1952) | [contract](https://shannon-explorer.somnia.network/address/0xc573c7b699690d1821aa4156ef7c09ee9ceba0e7) | 4,217,819 | Deployed. |
| 2026-08-27T13:01:08Z | Set RealizedVol writer | `0xbd7e…62ef` | [`0x831b…d146`](https://shannon-explorer.somnia.network/tx/0x831bb558310494cb8c063236483f026ef15d3992214ffa9d6873b9d1db37d146) | — | — | Writer set to SigmaReactiveVol. |

## Upgrade — 2026-09-04: Student-t fair value wired into SigmaOracle

`SigmaOracle` and `SigmaCron` were redeployed to wire the already-tested
Student-t fat-tail model (`BinaryPricer.studentProbUp`) into the live
`_base()`/`_applyBook()` pricing path, alongside the original Gaussian
`probUp`. Both fair values are now published side by side on every
`refresh()`, with an owner-settable `nuWad` (default `5.2e18`, matching the
backtest's method-of-moments estimate). `RealizedVol`, `SigmaReactiveVol`, and
`SigmaWindowRegistry` were **not** redeployed or touched.

| UTC | Contract/action | Address | Transaction | Explorer | Gas | Result |
|---|---|---|---|---|---:|---|
| 2026-09-04T08:1x:xxZ | SigmaOracle (v2, Student-t) | `0x35cd22b3d983329d2ba9131d982a91e528a0b931` | [`0x7d07…6dce`](https://shannon-explorer.somnia.network/tx/0x7d072a33cbe5c07f42d72b848f8e36924376c4c94586acc1b41403a0ea676dce) | [contract](https://shannon-explorer.somnia.network/address/0x35cd22b3d983329d2ba9131d982a91e528a0b931) | 24,375,582 | Deployed. |
| 2026-09-04T08:1x:xxZ | SigmaCron (v2, points at new oracle) | `0x3e30784b649558befbb2897429d5a0e5544c007c` | [`0x7556…194e`](https://shannon-explorer.somnia.network/tx/0x75560fa92ae5ed5c88b8d1b531c6aeee827b92b178df5643d76a889588e0194e) | [contract](https://shannon-explorer.somnia.network/address/0x3e30784b649558befbb2897429d5a0e5544c007c) | 4,217,819 | Deployed. |
| 2026-09-04T08:15:02Z | Fallback pusher — one fresh BTC price tick | `0xbd7e…62ef` (RealizedVol) | [`0xc2ec…32de`](https://shannon-explorer.somnia.network/tx/0xc2ec15bae77492a4c72f6b2908692752ab8503bf27c8e3e05bf039283a0c32de) | — | — | recordPrice, freshened staleness window before the live proof below. |
| 2026-09-04 | Publish live BTC window (24h, real venue) | `0x3563…12baf` (marketId) | [`0x183c…febd`](https://shannon-explorer.somnia.network/tx/0x183c17878ed0dd760c8411ed6eb6de3fe65771e7513bd23a27242d61c607febd) | — | — | Real opening price 81281.9 from the live venue. |
| 2026-09-04 | **refresh() — first live Gaussian + Student-t fair value, same tx** | oracle v2 | [`0x711f…1b6`](https://shannon-explorer.somnia.network/tx/0x711f78ac8c1933d79bcf2fa6176d7c9f0e47e0195185029fb5d9614b53f201b6) | — | — | `fairProbBps=3363` (33.63%, Gaussian), `studentFairProbBps=3564` (35.64%, Student-t), `impliedProbBps=3240` (32.40%, real book), `edgeBps=123`, `studentEdgeBps=324`. |
| 2026-09-04 | Arm new SigmaCron (setCadence, setNextScheduledMs, sweep) | `0x3e30…007c` | [`0xf228…0151`](https://shannon-explorer.somnia.network/tx/0xf228bcc57eefe48a6a404091a1b2c8545e801724093152092f1ef1dced2c0151), [`0x7677…9f871`](https://shannon-explorer.somnia.network/tx/0x7677b8594b2d813d79c59c68d2529a3f9edc8beba6e06e5ed461b66602b9f871), [`0x9d3e…8e65`](https://shannon-explorer.somnia.network/tx/0x9d3ee0e77162f41f5f9684a61b9ae8cda56ca77b6c2f02dcad3044ac5b238e65) | — | — | 900s cadence, next boundary armed. |

**Honest read of the numbers above:** the Student-t model assigns *more*
edge (+324 bps vs +123 bps) than Gaussian on this particular real window —
consistent with the backtest finding that Gaussian is *overconfident* near
the middle of the distribution and underweights realistic moves; this is one
live sample, not a claim that Student-t always finds more edge.

## Evidence procedure

1. Append every live write above with a direct `.../tx/<hash>` link.
2. Store sample-count observations and gas-burn measurements under `docs/evidence/`.
3. Only call the system unattended after two readings show `sampleCount` increased while no Sigma process ran.
