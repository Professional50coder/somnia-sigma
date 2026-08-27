# Draft — Somnia dev Telegram post

**Not sent. For your review before you post it yourself.** Written to be
pasted as-is into the hackathon dev channel. Every fact below is backed by an
on-chain read or tx hash — see `FINDINGS.md` for the full trail if anyone
asks for more detail.

---

Hi — building on Shannon (50312) for the Event Contracts hackathon. Hit a
reactivity issue that survives every fix I can find in the docs, so flagging
in case it's a known gap or I'm missing something non-obvious.

**Setup:** subscribing a handler contract to `MarkPriceUpdated` events from a
dreamDEX spot pool (BTC/USDso, `0x3605f28aA7C50e7441211e77Cb0762d49539326C`),
topic0 `0x2f0f7e3d58a217d311f516b216fa2f75081e17821bebb5f007fa57ff4e71f888`,
via `@somnia-chain/reactivity`'s `subscribeRaw`. The source event is
independently confirmed firing continuously (~1 every 2s via direct
`eth_getLogs`).

**Problem:** the handler's `onEvent` never gets invoked. Not "gets invoked and
reverts" — never invoked at all.

**What I've ruled out**, each individually tested:

- Wrong topic0/emitter/selector — verified against a real captured log;
  selector confirmed == `keccak256("onEvent(address,bytes32[],bytes)")[:4]`
- `isGuaranteed` — tried both `false` and `true`
- Fee insufficiency — tried up to 20 gwei priority / 100 gwei max against a
  measured 6 gwei base fee (10x+ headroom)
- Subscription-owner balance under the documented 32 SOMI/STT minimum — tried
  an owner sitting at 50 STT, well clear of that line
- A bug in my own handler logic — swapped in a maximally minimal diagnostic
  contract with **no gating at all** (not even the `msg.sender == precompile`
  check), just an unconditional counter + sender logger. Still zero.
- `msg.sender` mismatch — a moot point per your own docs (confirmed
  `msg.sender` during a callback is the precompile address), and consistent
  with the ungated probe: it never even recorded a caller, not a wrong one

Every subscription was confirmed correctly registered via
`getSubscriptionInfo(subscriptionId)` — not just "the create tx succeeded."
Six subscriptions total, two different owning wallets, three fee
configurations, same result every time.

**Question:** is there a known issue with event-subscription delivery on
Shannon right now, or something not covered in the reactivity docs/tutorials
that I should check? Happy to share subscription IDs / tx hashes / test
contract addresses if useful for debugging on your end — I assume you have
visibility into delivery attempts server-side that I don't have from the
caller's side.

For now I'm falling back to an off-chain scheduled read of the same on-chain
event (pull instead of push) so the project isn't blocked, but would rather
get reactivity working properly if there's a fix.

---

## If asked for more detail, have ready:

- Subscription IDs: `14222133`, `14222827`, `14223428`, `14225100`, `14225414`, `14225960`
- Handler contracts: `0x5F6a29B5717841f6F7B394Be6936ea176dC63D28` (real),
  `0x836bf06dc54c470fdcb6fb0533998de493e1c89a` (ungated diagnostic probe)
- A sample creation tx: `0x58f7fec8a60216f8e3611c50fb7f4fb407428d7bfda12497eda802383ffa76a2`
