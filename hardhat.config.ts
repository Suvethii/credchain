import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Secrets are read from environment variables (loaded from ~/credchain-secrets.env
// just before running Hardhat). They are never written in this file.
const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun", // OpenZeppelin v5 needs Cancun
      optimizer: { enabled: true, runs: 200 }, // smaller, cheaper contract
    },
  },
  networks: {
    // Only added when both values are present, so tests still work without secrets
    ...(SEPOLIA_RPC_URL && DEPLOYER_PRIVATE_KEY
      ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: [DEPLOYER_PRIVATE_KEY] } }
      : {}),
  },
  etherscan: { apiKey: ETHERSCAN_API_KEY ?? "" },
  sourcify: { enabled: false },
};

export default config;
