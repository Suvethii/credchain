import hre from "hardhat";
import fs from "fs";
import path from "path";

// Deploys MiniCredChain and saves its address and ABI so a website (Dev B) can use it.
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const { chainId } = await hre.ethers.provider.getNetwork();
  console.log("Network: ", hre.network.name, `(chainId ${chainId})`);
  console.log("Deployer:", deployer.address);

  const Cred = await hre.ethers.getContractFactory("MiniCredChain");
  const cred = await Cred.deploy();
  await cred.waitForDeployment();
  const address = await cred.getAddress();
  console.log("MiniCredChain deployed to:", address);

  // 1) Deployment record: where and when it was deployed
  const info = {
    network: hre.network.name,
    chainId: Number(chainId),
    address,
    deployer: deployer.address,
    txHash: cred.deploymentTransaction()?.hash,
    deployedAt: new Date().toISOString(),
  };
  fs.mkdirSync("deployments", { recursive: true });
  const infoFile = path.join("deployments", `${hre.network.name}.json`);
  fs.writeFileSync(infoFile, JSON.stringify(info, null, 2));

  // 2) ABI file: the "menu" of functions the website needs to call the contract
  const artifact = await hre.artifacts.readArtifact("MiniCredChain");
  fs.mkdirSync("abi", { recursive: true });
  const abiFile = path.join("abi", "MiniCredChain.json");
  fs.writeFileSync(abiFile, JSON.stringify({ address, abi: artifact.abi }, null, 2));

  console.log("Saved:", infoFile, "and", abiFile);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
