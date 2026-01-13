// Application types shared between main and renderer

export type NetworkType = 'mainnet' | 'testnet';

export interface AppConfig {
  version: string;
  network: NetworkType;
  language: 'ja' | 'en';
  alertThresholds: {
    warning: number;  // MATIC
    danger: number;   // MATIC
  };
  walletAddress: string | null;
  sessionTimeoutMinutes: number;  // Auto-lock timeout in minutes (0 = disabled)
  batchMinterAddresses: {
    mainnet: string;
    testnet: string;
  };
}

export interface Token {
  id: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  network: NetworkType;
  hasMinterRole: boolean;
  maxSupply: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationLog {
  id: number;
  operationType: 'deploy' | 'mint' | 'batch_mint' | 'grant_role' | 'revoke_role';
  tokenId: number | null;
  tokenAddress: string;
  tokenSymbol: string;
  details: string;
  txHash: string | null;
  status: 'pending' | 'confirming' | 'success' | 'failed' | 'timeout';
  network: NetworkType;
  operatorAddress: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletInfo {
  address: string;
  balance: string;
}

// IPC API types
export interface ElectronAPI {
  // App lifecycle
  isInitialized: () => Promise<boolean>;
  getConfig: () => Promise<AppConfig>;

  // PIN authentication
  verifyPin: (pin: string) => Promise<{ success: boolean; remainingAttempts?: number; lockUntil?: number }>;
  setPin: (pin: string) => Promise<{ success: boolean }>;
  changePin: (currentPin: string, newPin: string) => Promise<{ success: boolean }>;

  // Wallet
  importPrivateKey: (privateKey: string, pin: string) => Promise<{ success: boolean; address: string }>;
  getWalletInfo: () => Promise<WalletInfo | null>;
  getBalance: () => Promise<string>;

  // Tokens
  getTokens: () => Promise<Token[]>;
  addToken: (address: string) => Promise<Token>;
  deployToken: (params: DeployTokenParams) => Promise<{ address: string; txHash: string }>;

  // Minting
  mint: (params: MintParams) => Promise<{ txHash: string }>;
  batchMint: (params: BatchMintParams) => Promise<{ txHash: string; results: BatchMintResult[] }>;

  // Operations
  getOperationLogs: (filter?: OperationLogFilter) => Promise<OperationLog[]>;
  exportOperationLogs: (filter?: OperationLogFilter) => Promise<string>;

  // Settings
  setNetwork: (network: NetworkType) => Promise<void>;
  setLanguage: (language: 'ja' | 'en') => Promise<void>;
  setAlertThresholds: (warning: number, danger: number) => Promise<void>;

  // Utilities
  openLogsFolder: () => Promise<void>;
  openExternalLink: (url: string) => Promise<void>;
}

export interface DeployTokenParams {
  name: string;
  symbol: string;
  decimals: number;
  maxSupply: string | null;
  initialMint: {
    amount: string;
    recipient: string;
  } | null;
}

export interface MintParams {
  tokenAddress: string;
  recipient: string;
  amount: string;
}

export interface BatchMintParams {
  tokenAddress: string;
  recipients: Array<{ address: string; amount: string }>;
  skipInvalid: boolean;
}

export interface BatchMintResult {
  address: string;
  amount: string;
  success: boolean;
  error?: string;
}

export interface OperationLogFilter {
  operationType?: OperationLog['operationType'];
  tokenId?: number;
  startDate?: string;
  endDate?: string;
  network?: NetworkType;
}
