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

## Evidence procedure

1. Append every live write above with a direct `.../tx/<hash>` link.
2. Store sample-count observations and gas-burn measurements under `docs/evidence/`.
3. Only call the system unattended after two readings show `sampleCount` increased while no Sigma process ran.
