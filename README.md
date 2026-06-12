## Blockchain Project: DEX with Custom Bonding Curve

Install package

```
yarn install
```

Run a local Ethereum network node

```
npx hardhat node
```

Deploy token smart contract on local network

```
npx hardhat run scripts/deploy_token.js --network localhost
```

Copy token smart contract's address and paste in `contracts/exchange.sol` . After that, deploy exchange contract on local network

```
npx hardhat run scripts/deploy_token.js --network localhost
```

Copy abi, smart contract's address (You can find them in folder `artifacts/contracts/contract_name.sol`)

To run the web app, run html file

```
\web_app\index.html  
```

