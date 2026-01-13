import fs from 'fs/promises';
import { getConfigPath, setSecureFilePermissions } from './paths';
import type { AppConfig } from '../shared/types';

const DEFAULT_CONFIG: AppConfig = {
  version: '1.0.0',
  network: 'mainnet',
  language: 'ja',
  alertThresholds: {
    warning: 1.0,
    danger: 0.1,
  },
  walletAddress: null,
  sessionTimeoutMinutes: 15, // Auto-lock after 15 minutes of inactivity
  batchMinterAddresses: {
    mainnet: '', // Set after deploying BatchMinter to mainnet
    testnet: '', // Set after deploying BatchMinter to testnet (Amoy)
  },
};

let config: AppConfig | null = null;

export async function initializeConfig(): Promise<void> {
  const configPath = getConfigPath();

  try {
    const data = await fs.readFile(configPath, 'utf-8');
    config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    // Config doesn't exist, create default
    config = { ...DEFAULT_CONFIG };
    await saveConfig();
  }
}

export function getConfig(): AppConfig {
  if (!config) {
    throw new Error('Config not initialized');
  }
  return { ...config };
}

export async function updateConfig(updates: Partial<AppConfig>): Promise<void> {
  if (!config) {
    throw new Error('Config not initialized');
  }
  config = { ...config, ...updates };
  await saveConfig();
}

async function saveConfig(): Promise<void> {
  if (!config) {
    throw new Error('Config not initialized');
  }

  const configPath = getConfigPath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  await setSecureFilePermissions(configPath);
}

export function isInitialized(): boolean {
  return config?.walletAddress !== null;
}
