import { ethers } from "hardhat";

async function main() {
  // Uniswap V3 SwapRouter address - replace with correct address for your network
  const SWAP_ROUTER = "0xe2DB835566F8677d6889ffFC4F3304e8Df5Fc1df";

  const DeFAI = await ethers.getContractFactory("DeFAI");
  const defai = await DeFAI.deploy(SWAP_ROUTER);
  await defai.waitForDeployment();

  const address = await defai.getAddress();
  console.log(`DeFAI deployed to: ${address}`);

  // Whitelist the SwapRouter
  await defai.whitelistDex(SWAP_ROUTER, true);
  console.log("SwapRouter whitelisted");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
