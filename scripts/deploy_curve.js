const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy Token 1
  const Token = await hre.ethers.getContractFactory("Token");
  const token1 = await Token.deploy();
  await token1.deployed();
  console.log(`Token 1 deployed to: ${token1.address}`);

  // Deploy Token 2
  const token2 = await Token.deploy();
  await token2.deployed();
  console.log(`Token 2 deployed to: ${token2.address}`);

  // Deploy AMM
  const AMM = await hre.ethers.getContractFactory("PowerCurveAMM");
  // A = 1 (in wei, so pass 1e18 for mathematical 1.0)
  const amm = await AMM.deploy(token1.address, token2.address, hre.ethers.utils.parseEther("1"));
  await amm.deployed();

  console.log(`PowerCurveAMM deployed to: ${amm.address}`);

  // Optional: Mint some tokens and add initial liquidity
  console.log("Minting initial tokens...");
  await token1.mint(hre.ethers.utils.parseEther("10000"));
  await token2.mint(hre.ethers.utils.parseEther("10000"));

  console.log("Done!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
