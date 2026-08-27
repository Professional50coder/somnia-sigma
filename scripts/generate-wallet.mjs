/**
 * Generate fresh burner wallets for Somnia Shannon testnet (chain id 50312).
 *
 * Everything is generated locally with viem's audited key generation. Nothing
 * is transmitted. Output goes to .secrets/WALLET.md, which .gitignore excludes.
 *
 * TWO wallets are created on purpose:
 *   - DEPLOYER  deploys contracts, owns and funds the reactivity subscription
 *   - BOT       runs ec-sigma
 * The dreamDEX Bot Kit serialises claims per key, so a bot sharing a key with
 * anything else causes nonce races. Keep them separate.
 *
 * Run:  node scripts/generate-wallet.mjs
 */
import { generateMnemonic, mnemonicToAccount, english } from "viem/accounts";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";

const OUT_DIR = ".secrets";
const OUT_FILE = `${OUT_DIR}/WALLET.md`;

if (existsSync(OUT_FILE)) {
  console.error(
    `\nREFUSING TO OVERWRITE: ${OUT_FILE} already exists.\n` +
      `Overwriting would destroy keys that may already hold testnet funds.\n` +
      `Delete it deliberately if you really want new wallets.\n`,
  );
  process.exit(1);
}

function makeWallet(role) {
  // 256-bit entropy -> 24 words.
  const mnemonic = generateMnemonic(english, 256);
  const account = mnemonicToAccount(mnemonic);
  const hdKey = account.getHdKey();
  const privateKey = `0x${Buffer.from(hdKey.privateKey).toString("hex")}`;
  const publicKey = `0x${Buffer.from(hdKey.publicKey).toString("hex")}`;
  return {
    role,
    address: account.address,
    mnemonic,
    privateKey,
    publicKey,
    path: "m/44'/60'/0'/0/0",
  };
}

const deployer = makeWallet("DEPLOYER");
const bot = makeWallet("BOT");

const section = (w) => `
## ${w.role}

| Field | Value |
|---|---|
| **Address** (public, safe to share) | \`${w.address}\` |
| Derivation path | \`${w.path}\` |
| Public key | \`${w.publicKey}\` |

**Private key**

\`\`\`
${w.privateKey}
\`\`\`

**Recovery phrase (24 words)**

\`\`\`
${w.mnemonic}
\`\`\`
`;

const doc = `# Sigma — Wallet Secrets

> # STOP
> **This file contains private keys and recovery phrases in plaintext.**
> Anyone who reads it controls these wallets completely.
>
> - It lives in \`.secrets/\`, which \`.gitignore\` excludes. **Never commit it.**
> - **Never** paste its contents into a chat, an issue, a screen share, or a demo video.
> - These are **TESTNET BURNER** wallets. Never send mainnet assets or anything of value to them.
> - If a key here is ever exposed, generate new wallets and move on — do not reuse.

**Network:** Somnia Shannon testnet
**Chain ID:** \`50312\`
**RPC:** \`https://dream-rpc.somnia.network\`
**Generated:** locally via viem, never transmitted
${section(deployer)}
${section(bot)}

---

## Funding

1. **STT** (gas) — faucet at https://testnet.somnia.network
   Both wallets need STT. The deployer additionally funds \`SigmaReactiveVol\`,
   which pays its own reactivity handler gas as subscription owner.
2. **tUSDC** (collateral) — \`0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E\`
   Needed by the **BOT** wallet only, to place Event Contract orders.

## Wiring these into the project

\`.env\` (also gitignored):

\`\`\`
SOMNIA_TESTNET_RPC=https://dream-rpc.somnia.network
DEPLOYER_PRIVATE_KEY=${deployer.privateKey}
\`\`\`

Bot Kit \`.env\` (in the dreamdex-bot-kit checkout):

\`\`\`
NETWORK=testnet
PRIVATE_KEY=${bot.privateKey}
\`\`\`

## Before making the repo public

- [ ] \`git status\` shows no \`.secrets/\` and no \`.env\`
- [ ] \`git log -p | grep -i "0x[0-9a-f]\\{64\\}"\` finds no private key in history
- [ ] Demo video contains no terminal frame showing a key or phrase
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, doc, { encoding: "utf8" });

// Deliberately print ONLY public data. Chat transcripts and terminal
// scrollback get copied around; secrets stay in the gitignored file.
console.log("\nWrote " + OUT_FILE + " (gitignored)\n");
console.log("  DEPLOYER  " + deployer.address);
console.log("  BOT       " + bot.address);
console.log("\nSecrets are in the file only. Fund both with STT from https://testnet.somnia.network\n");
