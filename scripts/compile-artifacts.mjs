/** Compile the deployable Sigma contracts with the pinned solc-js dependency. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import solc from "solc";

const root = process.cwd();
const entries = ["contracts/ReactivityProbe.sol", "contracts/ReactivityProbeV2.sol", "contracts/RealizedVol.sol", "contracts/SigmaReactiveVol.sol", "contracts/SigmaWindowRegistry.sol", "contracts/SigmaOracle.sol", "contracts/SigmaCron.sol"];
const sources = Object.fromEntries(entries.map((file) => [file, { content: readFileSync(resolve(root, file), "utf8") }]));
const input = { language: "Solidity", sources, settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: (path) => {
  for (const candidate of [resolve(root, path), resolve(root, "node_modules", path)]) {
    try { return { contents: readFileSync(candidate, "utf8") }; } catch {}
  }
  return { error: `Import not found: ${path}` };
}}));
for (const item of output.errors ?? []) console[item.severity === "error" ? "error" : "warn"](item.formattedMessage);
if ((output.errors ?? []).some((item) => item.severity === "error")) process.exit(1);
mkdirSync("artifacts/sigma", { recursive: true });
for (const [source, contracts] of Object.entries(output.contracts)) for (const [name, contract] of Object.entries(contracts)) {
  if (!contract.evm.bytecode.object) continue;
  const artifact = { contractName: name, sourceName: source, abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` };
  writeFileSync(`artifacts/sigma/${name}.json`, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`compiled ${name} (${relative(root, source)})`);
}
