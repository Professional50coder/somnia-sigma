# Sigma — Release and Evidence Checklist

## Versioning

- Update `VERSION` using semantic versioning: `MAJOR.MINOR.PATCH[-pre]`.
- Add an Unreleased changelog entry before implementing a user-visible change.
- On a release, move only verified entries into a dated version section.
- Do not tag, commit or push without explicit user approval.

## Local gate

- [ ] Solidity compiler runs against the current source tree.
- [ ] Full Hardhat suite is green.
- [ ] Contracts and scripts have no uncommitted generated artifacts required at runtime.
- [ ] Deployment script writes a complete `deployments/somniaTestnet.json`.

## Testnet gate

- [ ] Deployer and bot balances are recorded before deployment.
- [ ] Every deployment tx and address is recorded in `DEPLOYMENT-LEDGER.md`.
- [ ] Reactive handler is funded and its subscription ID is recorded.
- [ ] Two unattended sample readings are stored and show an increase.
- [ ] Gas burn and cron outcome are documented.
- [ ] Oracle output is compared with the SciPy reference for identical inputs.

## Submission gate

- [ ] UI labels model assumptions and all not-ok states.
- [ ] Strategy is dry-run verified before any order is sent.
- [ ] Losses and model limitations are represented alongside results.
- [ ] Demo links and all explorer links work.
