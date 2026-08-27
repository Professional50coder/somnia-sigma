import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
const rpc = process.env.SOMNIA_TESTNET_RPC ?? "https://dream-rpc.somnia.network";
if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY missing");
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const client = createPublicClient({ transport: http(rpc) }); const wallet = createWalletClient({ account, transport: http(rpc) });
const artifact = (name) => JSON.parse(readFileSync(`artifacts/sigma/${name}.json`, "utf8"));
const deployed = {};
async function deploy(name, args = []) { const a = artifact(name); const hash = await wallet.deployContract({ abi:a.abi, bytecode:a.bytecode, args }); const receipt = await client.waitForTransactionReceipt({ hash }); if (receipt.status !== "success") throw new Error(`${name} deployment reverted: ${hash}`); deployed[name] = { address: receipt.contractAddress, hash, gasUsed: receipt.gasUsed.toString() }; return receipt.contractAddress; }
const owner = account.address;
const vol = await deploy("RealizedVol", [owner, owner]); const reactive = await deploy("SigmaReactiveVol", [vol, owner]);
const volAbi = artifact("RealizedVol").abi; const wire = await wallet.writeContract({ address:vol, abi:volAbi, functionName:"setWriter", args:[reactive] }); await client.waitForTransactionReceipt({hash:wire});
const registry = await deploy("SigmaWindowRegistry", [owner, owner]); const oracle = await deploy("SigmaOracle", [vol, registry]); const cron = await deploy("SigmaCron", [oracle, owner]);
const output = { chainId:50312, deployedAt:new Date().toISOString(), deployer:owner, realizedVol:vol, reactiveVol:reactive, registry, oracle, cron, transactions:deployed, writerWiringTx:wire };
mkdirSync("deployments",{recursive:true}); writeFileSync("deployments/somniaTestnet.json",JSON.stringify(output,null,2)+"\n"); console.log(JSON.stringify(output,null,2));
