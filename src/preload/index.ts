import { contextBridge, ipcRenderer } from 'electron';
import type {
  ElectronAPI,
  AppConfig,
  WalletInfo,
  Token,
  OperationLog,
  OperationLogFilter,
  MintParams,
  BatchMintParams,
  DeployTokenParams,
  NetworkType,
} from '../shared/types';

// CSV Parse result type
interface CsvParseResult {
  rows: Array<{
    lineNumber: number;
    address: string;
    amount: string;
    isValid: boolean;
    error?: string;
  }>;
  validCount: number;
  invalidCount: number;
  totalAmount: string;
}

// Batch mint result type
interface BatchMintFullResult {
  txHashes: string[];
  results: Array<{
    address: string;
    amount: string;
    success: boolean;
    error?: string;
  }>;
  successCount: number;
  failedCount: number;
}

// Update status types
interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  data?: unknown;
}

// Extended API interface for preload
interface ExtendedElectronAPI extends ElectronAPI {
  // Session management
  checkSession: () => Promise<boolean>;
  updateActivity: () => Promise<void>;
  lockApp: () => Promise<void>;

  // Settings extensions
  setSessionTimeout: (minutes: number) => Promise<void>;
  setBatchMinterAddress: (network: NetworkType, address: string) => Promise<void>;

  validateAddress: (address: string) => Promise<boolean>;
  estimateMintGas: (
    tokenAddress: string,
    recipient: string,
    amount: string
  ) => Promise<{ gasLimit: bigint; gasPrice: bigint; totalCost: string }>;
  getPolygonscanUrl: (txHash: string) => Promise<string>;

  // CSV operations
  parseCsv: (csvContent: string) => Promise<CsvParseResult>;
  generateFailedCsv: (failedRows: Array<{ address: string; amount: string; error: string }>) => Promise<string>;

  // Batch minting
  batchMintFull: (params: BatchMintParams & { batchMinterAddress: string }) => Promise<BatchMintFullResult>;
  estimateBatchMintGas: (
    batchMinterAddress: string,
    tokenAddress: string,
    recipients: Array<{ address: string; amount: string }>
  ) => Promise<{ gasLimit: bigint; gasPrice: bigint; totalCost: string }>;

  // Token deployment
  estimateDeployGas: (params: DeployTokenParams) => Promise<{ gasLimit: bigint; gasPrice: bigint; totalCost: string }>;

  // Role management
  getMinters: (tokenAddress: string) => Promise<string[]>;
  grantMinterRole: (tokenAddress: string, targetAddress: string) => Promise<{ txHash: string }>;
  revokeMinterRole: (tokenAddress: string, targetAddress: string) => Promise<{ txHash: string }>;

  // Auto-updater
  checkForUpdates: () => Promise<{ success: boolean; updateInfo?: unknown; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  getAppVersion: () => Promise<string>;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
}

const api: ExtendedElectronAPI = {
  // App lifecycle
  isInitialized: () => ipcRenderer.invoke('app:isInitialized'),
  getConfig: () => ipcRenderer.invoke('app:getConfig'),

  // PIN authentication
  verifyPin: (pin: string) => ipcRenderer.invoke('auth:verifyPin', pin),
  setPin: (pin: string) => ipcRenderer.invoke('auth:setPin', pin),
  changePin: (currentPin: string, newPin: string) =>
    ipcRenderer.invoke('auth:changePin', currentPin, newPin),

  // Session management
  checkSession: () => ipcRenderer.invoke('auth:checkSession'),
  updateActivity: () => ipcRenderer.invoke('auth:updateActivity'),
  lockApp: () => ipcRenderer.invoke('auth:lock'),

  // Wallet
  importPrivateKey: (privateKey: string, pin: string) =>
    ipcRenderer.invoke('wallet:import', privateKey, pin),
  getWalletInfo: () => ipcRenderer.invoke('wallet:getInfo'),
  getBalance: () => ipcRenderer.invoke('wallet:getBalance'),

  // Tokens
  getTokens: () => ipcRenderer.invoke('tokens:getAll'),
  addToken: (address: string) => ipcRenderer.invoke('tokens:add', address),
  deployToken: (params) => ipcRenderer.invoke('tokens:deploy', params),

  // Minting
  mint: (params: MintParams) => ipcRenderer.invoke('mint:single', params),
  batchMint: (params) => ipcRenderer.invoke('mint:batch', params),

  // Operations
  getOperationLogs: (filter?: OperationLogFilter) =>
    ipcRenderer.invoke('operations:getLogs', filter),
  exportOperationLogs: (filter?: OperationLogFilter) =>
    ipcRenderer.invoke('operations:exportCsv', filter),

  // Settings
  setNetwork: (network: NetworkType) => ipcRenderer.invoke('settings:setNetwork', network),
  setLanguage: (language: 'ja' | 'en') => ipcRenderer.invoke('settings:setLanguage', language),
  setAlertThresholds: (warning: number, danger: number) =>
    ipcRenderer.invoke('settings:setAlertThresholds', warning, danger),
  setSessionTimeout: (minutes: number) => ipcRenderer.invoke('settings:setSessionTimeout', minutes),
  setBatchMinterAddress: (network: NetworkType, address: string) =>
    ipcRenderer.invoke('settings:setBatchMinterAddress', network, address),

  // Utilities
  openLogsFolder: () => ipcRenderer.invoke('utils:openLogsFolder'),
  openExternalLink: (url: string) => ipcRenderer.invoke('utils:openExternalLink', url),
  validateAddress: (address: string) => ipcRenderer.invoke('utils:validateAddress', address),
  estimateMintGas: (tokenAddress: string, recipient: string, amount: string) =>
    ipcRenderer.invoke('mint:estimateGas', tokenAddress, recipient, amount),
  getPolygonscanUrl: (txHash: string) => ipcRenderer.invoke('utils:getPolygonscanUrl', txHash),

  // CSV operations
  parseCsv: (csvContent: string) => ipcRenderer.invoke('csv:parse', csvContent),
  generateFailedCsv: (failedRows: Array<{ address: string; amount: string; error: string }>) =>
    ipcRenderer.invoke('csv:generateFailed', failedRows),

  // Batch minting
  batchMintFull: (params) => ipcRenderer.invoke('mint:batch', params),
  estimateBatchMintGas: (batchMinterAddress: string, tokenAddress: string, recipients) =>
    ipcRenderer.invoke('mint:estimateBatchGas', batchMinterAddress, tokenAddress, recipients),

  // Token deployment
  estimateDeployGas: (params: DeployTokenParams) => ipcRenderer.invoke('tokens:estimateDeployGas', params),

  // Role management
  getMinters: (tokenAddress: string) => ipcRenderer.invoke('roles:getMinters', tokenAddress),
  grantMinterRole: (tokenAddress: string, targetAddress: string) =>
    ipcRenderer.invoke('roles:grant', tokenAddress, targetAddress),
  revokeMinterRole: (tokenAddress: string, targetAddress: string) =>
    ipcRenderer.invoke('roles:revoke', tokenAddress, targetAddress),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status);
    ipcRenderer.on('update-status', handler);
    return () => {
      ipcRenderer.removeListener('update-status', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

// Type augmentation for window.electronAPI
declare global {
  interface Window {
    electronAPI: ExtendedElectronAPI;
  }
}
