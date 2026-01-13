import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    polygon: {
      url: "https://polygon-rpc.com",
      chainId: 137,
    },
    amoy: {
      url: "https://rpc-amoy.polygon.technology",
      chainId: 80002,
    },
  },
};

export default config;
