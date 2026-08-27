import { mkdirSync, writeFileSync } from "node:fs";
import { network } from "hardhat";

/** Deploy Sigma's on-chain stack and write the single shared address book. */
const { viem } = await network.connect({ network: "somniaTestnet" });
const [deployer] = await viem.getWalletClients();
if (!deployer?.account) throw new Error("DEPLOYER_PRIVATE_KEY is required for somniaTestnet deployment");

const owner = deployer.account.address;
const realizedVol = await viem.deployContract("RealizedVol", [owner, owner]);
const reactiveVol = await viem.deployContract("SigmaReactiveVol", [realizedVol.address, owner]);
await realizedVol.write.setWriter([reactiveVol.address]);

const registry = await viem.deployContract("SigmaWindowRegistry", [owner, owner]);
const oracle = await viem.deployContract("SigmaOracle", [realizedVol.address, registry.address]);
const cron = await viem.deployContract("SigmaCron", [oracle.address, owner]);

const deployment = {
  chainId: 50312,
  deployedAt: new Date().toISOString(),
  deployer: owner,
  realizedVol: realizedVol.address,
  reactiveVol: reactiveVol.address,
  registry: registry.address,
  oracle: oracle.address,
  cron: cron.address,
};
mkdirSync("deployments", { recursive: true });
writeFileSync("deployments/somniaTestnet.json", `${JSON.stringify(deployment, null, 2)}\n`);
console.log(JSON.stringify(deployment, null, 2));
