## Blockchain Project: DEX with Custom Bonding Curve

Install package

```
yarn install
```

Run a local Ethereum network node

```
yarn hardhat node
```

Deploy token smart contract on local network

```
yarn hardhat run scripts/deploy_token.js --network localhost
```

Copy token smart contract's address and paste in `contracts/exchange.sol` . After that, deploy exchange contract on local network

```
yarn hardhat run scripts/deploy_token.js --network localhost
```

Copy abi, smart contract's address (You can find them in folder `artifacts/contracts/contract_name.sol`)


