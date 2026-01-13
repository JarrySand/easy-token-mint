/**
 * @module blockchain
 * @description Ethereum/Polygon blockchain interaction utilities using ethers.js.
 *
 * This module provides all blockchain-related functionality including:
 * - RPC provider management with automatic fallback and retry logic
 * - Token contract interactions (deploy, mint, role management)
 * - Gas estimation for transactions
 * - Batch minting via BatchMinter contract
 *
 * Network support:
 * - Polygon Mainnet (chain ID: 137)
 * - Polygon Amoy Testnet (chain ID: 80002)
 *
 * @example
 * ```typescript
 * // Deploy a new token
 * const result = await deployToken({
 *   name: 'MyToken',
 *   symbol: 'MTK',
 *   decimals: 18,
 *   maxSupply: '1000000'
 * });
 *
 * // Mint tokens
 * const txHash = await mint(tokenAddress, recipientAddress, '100', 18);
 * ```
 */

import { ethers, JsonRpcProvider, Wallet, Contract, ContractFactory, formatEther, parseUnits } from 'ethers';
import type { NetworkType, DeployTokenParams } from '../shared/types';
import { getCachedPrivateKey } from './pin-auth';
import { getConfig } from './config';
import MintableTokenArtifact from '../../artifacts/contracts/MintableToken.sol/MintableToken.json';

/** RPC endpoints with fallbacks for each network */
const RPC_ENDPOINTS: Record<NetworkType, string[]> = {
  mainnet: [
    'https://polygon-rpc.com',
    'https://rpc-mainnet.matic.quiknode.pro',
    'https://polygon-mainnet.public.blastapi.io',
  ],
  testnet: [
    'https://rpc-amoy.polygon.technology',
    'https://polygon-amoy.public.blastapi.io',
  ],
};

const CHAIN_IDS: Record<NetworkType, number> = {
  mainnet: 137,
  testnet: 80002,
};

// Configuration constants
const MAX_RPC_RETRIES = 3;
const RPC_TIMEOUT_MS = 30000; // 30 seconds
const TX_CONFIRMATION_TIMEOUT_MS = 300000; // 5 minutes

// ERC20 + AccessControl ABI (minimal for our needs)
const TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function mint(address to, uint256 amount)',
  'function cap() view returns (uint256)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function grantRole(bytes32 role, address account)',
  'function revokeRole(bytes32 role, address account)',
  'function MINTER_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function getRoleMemberCount(bytes32 role) view returns (uint256)',
  'function getRoleMember(bytes32 role, uint256 index) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)',
  'event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)',
];

// BatchMinter ABI (matches our deployed contract)
const BATCH_MINTER_ABI = [
  'function batchMint(address token, tuple(address recipient, uint256 amount)[] requests) external returns (uint256 successCount, uint256[] failedIndices)',
  'event BatchMintExecuted(address indexed token, address indexed operator, uint256 totalRecipients, uint256 totalAmount)',
  'event MintFailed(address indexed token, address indexed recipient, uint256 amount, string reason)',
];

let provider: JsonRpcProvider | null = null;
let currentRpcIndex = 0;
let providerRetryCount = 0;

/**
 * Create a promise that rejects after a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), timeoutMs)
    ),
  ]);
}

/**
 * Get or create provider with fallback support and retry limits
 */
export async function getProvider(): Promise<JsonRpcProvider> {
  const config = getConfig();
  const network = config.network;
  const endpoints = RPC_ENDPOINTS[network];

  if (provider) {
    try {
      // Test if provider is still working with timeout
      await withTimeout(
        provider.getBlockNumber(),
        RPC_TIMEOUT_MS,
        'RPC health check timed out'
      );
      providerRetryCount = 0; // Reset on success
      return provider;
    } catch {
      // Provider failed, try next endpoint
      provider = null;
      currentRpcIndex = (currentRpcIndex + 1) % endpoints.length;
      providerRetryCount++;
    }
  }

  // Check if we've exceeded max retries
  if (providerRetryCount >= MAX_RPC_RETRIES * endpoints.length) {
    providerRetryCount = 0; // Reset for next attempt cycle
    throw new Error('All RPC endpoints failed after maximum retries');
  }

  // Try each endpoint until one works
  for (let i = 0; i < endpoints.length; i++) {
    const index = (currentRpcIndex + i) % endpoints.length;
    const endpoint = endpoints[index];

    try {
      const testProvider = new JsonRpcProvider(endpoint, CHAIN_IDS[network]);
      await withTimeout(
        testProvider.getBlockNumber(),
        RPC_TIMEOUT_MS,
        `RPC endpoint timed out: ${endpoint}`
      );
      provider = testProvider;
      currentRpcIndex = index;
      providerRetryCount = 0; // Reset on success
      return provider;
    } catch (error) {
      console.error(`RPC endpoint failed: ${endpoint}`, error);
      providerRetryCount++;
    }
  }

  throw new Error('All RPC endpoints failed');
}

/**
 * Wait for transaction confirmation with timeout
 */
async function waitForTransaction(tx: { wait: () => Promise<unknown>; hash: string }): Promise<unknown> {
  return withTimeout(
    tx.wait(),
    TX_CONFIRMATION_TIMEOUT_MS,
    `Transaction confirmation timed out (hash: ${tx.hash})`
  );
}

/**
 * Get wallet from cached private key
 */
export async function getWallet(): Promise<Wallet> {
  const privateKey = getCachedPrivateKey();
  if (!privateKey) {
    throw new Error('Not authenticated');
  }

  const prov = await getProvider();
  return new Wallet(privateKey, prov);
}

/**
 * Get wallet address from private key
 */
export function getAddressFromPrivateKey(privateKey: string): string {
  const wallet = new Wallet(privateKey);
  return wallet.address;
}

/**
 * Get MATIC balance
 */
export async function getBalance(address: string): Promise<string> {
  const prov = await getProvider();
  const balance = await prov.getBalance(address);
  return formatEther(balance);
}

/**
 * Get token contract instance
 */
export async function getTokenContract(tokenAddress: string): Promise<Contract> {
  const wallet = await getWallet();
  return new Contract(tokenAddress, TOKEN_ABI, wallet);
}

/**
 * Get read-only token contract
 */
export async function getTokenContractReadOnly(tokenAddress: string): Promise<Contract> {
  const prov = await getProvider();
  return new Contract(tokenAddress, TOKEN_ABI, prov);
}

/**
 * Check if address is valid
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Get token info from contract
 */
export async function getTokenInfo(
  tokenAddress: string
): Promise<{ name: string; symbol: string; decimals: number; maxSupply: string | null }> {
  const contract = await getTokenContractReadOnly(tokenAddress);

  const [name, symbol, decimals] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.decimals(),
  ]);

  let maxSupply: string | null = null;
  try {
    const cap = await contract.cap();
    maxSupply = cap.toString();
  } catch {
    // Contract doesn't have cap (unlimited supply)
  }

  return {
    name,
    symbol,
    decimals: Number(decimals),
    maxSupply,
  };
}

/**
 * Check if address has MINTER_ROLE
 */
export async function hasMinterRole(tokenAddress: string, address: string): Promise<boolean> {
  const contract = await getTokenContractReadOnly(tokenAddress);

  try {
    const minterRole = await contract.MINTER_ROLE();
    return await contract.hasRole(minterRole, address);
  } catch {
    return false;
  }
}

/**
 * Mint tokens
 */
export async function mint(
  tokenAddress: string,
  recipient: string,
  amount: string,
  decimals: number
): Promise<string> {
  const contract = await getTokenContract(tokenAddress);
  const amountInWei = parseUnits(amount, decimals);

  const tx = await contract.mint(recipient, amountInWei);
  await waitForTransaction(tx);

  return tx.hash;
}

/**
 * Grant MINTER_ROLE
 */
export async function grantMinterRole(tokenAddress: string, address: string): Promise<string> {
  const contract = await getTokenContract(tokenAddress);
  const minterRole = await contract.MINTER_ROLE();

  const tx = await contract.grantRole(minterRole, address);
  await waitForTransaction(tx);

  return tx.hash;
}

/**
 * Revoke MINTER_ROLE
 */
export async function revokeMinterRole(tokenAddress: string, address: string): Promise<string> {
  const contract = await getTokenContract(tokenAddress);
  const minterRole = await contract.MINTER_ROLE();

  const tx = await contract.revokeRole(minterRole, address);
  await waitForTransaction(tx);

  return tx.hash;
}

/**
 * Get all addresses with MINTER_ROLE
 */
export async function getMinters(tokenAddress: string): Promise<string[]> {
  const contract = await getTokenContractReadOnly(tokenAddress);

  try {
    const minterRole = await contract.MINTER_ROLE();
    const count = await contract.getRoleMemberCount(minterRole);
    const minters: string[] = [];

    for (let i = 0; i < Number(count); i++) {
      const minter = await contract.getRoleMember(minterRole, i);
      minters.push(minter);
    }

    return minters;
  } catch {
    return [];
  }
}

/**
 * Estimate gas for mint transaction
 */
export async function estimateMintGas(
  tokenAddress: string,
  recipient: string,
  amount: string,
  decimals: number
): Promise<{ gasLimit: bigint; gasPrice: bigint; totalCost: string }> {
  const contract = await getTokenContract(tokenAddress);
  const amountInWei = parseUnits(amount, decimals);

  const [gasLimit, feeData] = await Promise.all([
    contract.mint.estimateGas(recipient, amountInWei),
    (await getProvider()).getFeeData(),
  ]);

  const gasPrice = feeData.gasPrice || BigInt(0);
  const totalCost = gasLimit * gasPrice;

  return {
    gasLimit,
    gasPrice,
    totalCost: formatEther(totalCost),
  };
}

/**
 * Get Polygonscan URL for transaction
 */
export function getPolygonscanUrl(txHash: string, network: NetworkType): string {
  const baseUrl = network === 'mainnet'
    ? 'https://polygonscan.com'
    : 'https://amoy.polygonscan.com';
  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Clear provider (for network switch)
 */
export function clearProvider(): void {
  provider = null;
  currentRpcIndex = 0;
  providerRetryCount = 0;
}

export interface BatchMintRequest {
  address: string;
  amount: string;
}

export interface BatchMintResultItem {
  address: string;
  amount: string;
  success: boolean;
  error?: string;
}

/**
 * Execute batch mint using the BatchMinter contract
 */
export async function batchMint(
  batchMinterAddress: string,
  tokenAddress: string,
  requests: BatchMintRequest[],
  decimals: number
): Promise<{ txHash: string; results: BatchMintResultItem[] }> {
  const wallet = await getWallet();
  const batchMinterContract = new Contract(batchMinterAddress, BATCH_MINTER_ABI, wallet);

  // Convert amounts to wei
  const mintRequests = requests.map(req => ({
    recipient: req.address,
    amount: parseUnits(req.amount, decimals),
  }));

  const tx = await batchMinterContract.batchMint(tokenAddress, mintRequests);
  const receipt = await waitForTransaction(tx) as { logs: Array<{ topics: readonly string[]; data: string }> };

  // Parse results from events
  const results: BatchMintResultItem[] = requests.map(req => ({
    address: req.address,
    amount: req.amount,
    success: true,
  }));

  // Check for MintFailed events
  const mintFailedInterface = new ethers.Interface(BATCH_MINTER_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = mintFailedInterface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === 'MintFailed') {
        const failedAddress = parsed.args[1] as string;
        const failedIndex = results.findIndex(
          r => r.address.toLowerCase() === failedAddress.toLowerCase()
        );
        if (failedIndex !== -1) {
          results[failedIndex].success = false;
          results[failedIndex].error = parsed.args[3] as string;
        }
      }
    } catch {
      // Not a MintFailed event, ignore
    }
  }

  return { txHash: tx.hash, results };
}

/**
 * Estimate gas for batch mint
 */
export async function estimateBatchMintGas(
  batchMinterAddress: string,
  tokenAddress: string,
  requests: BatchMintRequest[],
  decimals: number
): Promise<{ gasLimit: bigint; gasPrice: bigint; totalCost: string }> {
  const wallet = await getWallet();
  const batchMinterContract = new Contract(batchMinterAddress, BATCH_MINTER_ABI, wallet);
  const prov = await getProvider();

  const mintRequests = requests.map(req => ({
    recipient: req.address,
    amount: parseUnits(req.amount, decimals),
  }));

  const [gasLimit, feeData] = await Promise.all([
    batchMinterContract.batchMint.estimateGas(tokenAddress, mintRequests),
    prov.getFeeData(),
  ]);

  const gasPrice = feeData.gasPrice || BigInt(0);
  const totalCost = gasLimit * gasPrice;

  return {
    gasLimit,
    gasPrice,
    totalCost: formatEther(totalCost),
  };
}

/**
 * Deploy a new MintableToken contract
 */
export async function deployToken(params: DeployTokenParams): Promise<{ address: string; txHash: string }> {
  const wallet = await getWallet();

  const factory = new ContractFactory(
    MintableTokenArtifact.abi,
    MintableTokenArtifact.bytecode,
    wallet
  );

  // Prepare constructor arguments
  const decimals = params.decimals;
  const cap = params.maxSupply ? parseUnits(params.maxSupply, decimals) : BigInt(0);
  const initialSupply = params.initialMint
    ? parseUnits(params.initialMint.amount, decimals)
    : BigInt(0);
  const initialHolder = params.initialMint?.recipient || wallet.address;

  const contract = await factory.deploy(
    params.name,
    params.symbol,
    decimals,
    cap,
    initialSupply,
    initialHolder
  );

  const deployTxHash = contract.deploymentTransaction()?.hash || '';

  // Wait for deployment with timeout
  await withTimeout(
    contract.waitForDeployment(),
    TX_CONFIRMATION_TIMEOUT_MS,
    `Token deployment confirmation timed out (hash: ${deployTxHash})`
  );

  const address = await contract.getAddress();

  return { address, txHash: deployTxHash };
}

/**
 * Estimate gas for token deployment
 */
export async function estimateDeployGas(params: DeployTokenParams): Promise<{
  gasLimit: bigint;
  gasPrice: bigint;
  totalCost: string;
}> {
  const wallet = await getWallet();
  const prov = await getProvider();

  const factory = new ContractFactory(
    MintableTokenArtifact.abi,
    MintableTokenArtifact.bytecode,
    wallet
  );

  // Prepare constructor arguments
  const decimals = params.decimals;
  const cap = params.maxSupply ? parseUnits(params.maxSupply, decimals) : BigInt(0);
  const initialSupply = params.initialMint
    ? parseUnits(params.initialMint.amount, decimals)
    : BigInt(0);
  const initialHolder = params.initialMint?.recipient || wallet.address;

  // Estimate gas
  const deployTx = await factory.getDeployTransaction(
    params.name,
    params.symbol,
    decimals,
    cap,
    initialSupply,
    initialHolder
  );

  const [gasLimit, feeData] = await Promise.all([
    prov.estimateGas({ ...deployTx, from: wallet.address }),
    prov.getFeeData(),
  ]);

  const gasPrice = feeData.gasPrice || BigInt(0);
  const totalCost = gasLimit * gasPrice;

  return {
    gasLimit,
    gasPrice,
    totalCost: formatEther(totalCost),
  };
}
