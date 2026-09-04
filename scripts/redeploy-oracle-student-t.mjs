/**
 * Redeploy SigmaOracle (now with the Student-t fair value wired in) and
 * SigmaCron (which immutably points at SigmaOracle), reusing the existing
 * live RealizedVol/SigmaReactiveVol/SigmaWindowRegistry deployment untouched.
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rpc = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY missing");
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const client = createPublicClient({ transport: http(rpc) });
const wallet = createWalletClient({ account, transport: http(rpc) });

const artifact = (name) => JSON.parse(readFileSync(`artifacts/sigma/${name}.json`, "utf8"));

async function deploy(name, args = []) {
  const a = artifact(name);
  const hash = await wallet.deployContract({ abi: a.abi, bytecode: a.bytecode, args });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${name} deployment reverted: ${hash}`);
  return { address: receipt.contractAddress, hash, gasUsed: receipt.gasUsed.toString() };
}

const existing = JSON.parse(readFileSync("deployments/somniaTestnet.json", "utf8"));
const owner = account.address;

console.log(`Deploying new SigmaOracle(vol=${existing.realizedVol}, registry=${existing.registry})...`);
const oracle = await deploy("SigmaOracle", [existing.realizedVol, existing.registry]);
console.log(`  -> ${oracle.address} (tx ${oracle.hash}, gas ${oracle.gasUsed})`);

console.log(`Deploying new SigmaCron(oracle=${oracle.address}, owner=${owner})...`);
const cron = await deploy("SigmaCron", [oracle.address, owner]);
console.log(`  -> ${cron.address} (tx ${cron.hash}, gas ${cron.gasUsed})`);

const upgrades = existing.upgrades ?? [];
upgrades.push({
  upgradedAt: new Date().toISOString(),
  reason: "Wire Student-t fat-tail model (BinaryPricer.studentProbUp) into SigmaOracle; add owner-settable nuWad",
  previous: { oracle: existing.oracle, cron: existing.cron },
});

const output = {
  ...existing,
  oracle: oracle.address,
  cron: cron.address,
  transactions: {
    ...existing.transactions,
    SigmaOracle: oracle,
    SigmaCron: cron,
  },
  upgrades,
};

writeFileSync("deployments/somniaTestnet.json", `${JSON.stringify(output, null, 2)}\n`);
console.log("\nUpdated deployments/somniaTestnet.json");
console.log(JSON.stringify({ oracle: oracle.address, cron: cron.address }, null, 2));
