import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';

// Mock all dependencies
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  shell: {
    openPath: vi.fn().mockResolvedValue(''),
    openExternal: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../paths', () => ({
  getLogsPath: vi.fn(() => '/mock/logs'),
  getConfigPath: vi.fn(() => '/mock/config.json'),
  getWalletPath: vi.fn(() => '/mock/wallet.enc'),
  setSecureFilePermissions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config', () => ({
  getConfig: vi.fn(() => ({
    version: '1.0.0',
    network: 'testnet',
    language: 'ja',
    alertThresholds: { warning: 1.0, danger: 0.1 },
    walletAddress: '0x1234567890123456789012345678901234567890',
    sessionTimeoutMinutes: 15,
    batchMinterAddresses: { mainnet: '', testnet: '0xBatchMinter' },
  })),
  updateConfig: vi.fn().mockResolvedValue(undefined),
  isInitialized: vi.fn(() => true),
}));

vi.mock('../pin-auth', () => ({
  verifyPin: vi.fn(),
  changePin: vi.fn(),
  getCachedPrivateKey: vi.fn(() => '0x' + 'a'.repeat(64)),
  updateActivity: vi.fn(),
  checkSession: vi.fn(() => true),
  setSessionTimeout: vi.fn(),
  lockApp: vi.fn(),
}));

vi.mock('../crypto', () => ({
  encryptPrivateKey: vi.fn(() => ({
    version: 1,
    salt: 'mocksalt',
    iv: 'mockiv',
    authTag: 'mockauthTag',
    encryptedData: 'mockdata',
  })),
  saveEncryptedWallet: vi.fn().mockResolvedValue(undefined),
  validatePinFormat: vi.fn(() => ({ valid: true })),
  walletExists: vi.fn().mockResolvedValue(true),
}));

vi.mock('../database', () => ({
  getTokens: vi.fn(() => []),
  getTokenByAddress: vi.fn(),
  insertToken: vi.fn(),
  updateToken: vi.fn(),
  getOperationLogs: vi.fn(() => []),
  insertOperationLog: vi.fn(() => 1),
  updateOperationLog: vi.fn(),
}));

vi.mock('../blockchain', () => ({
  getAddressFromPrivateKey: vi.fn(() => '0x1234567890123456789012345678901234567890'),
  getBalance: vi.fn().mockResolvedValue('10.5'),
  getTokenInfo: vi.fn().mockResolvedValue({
    name: 'Test Token',
    symbol: 'TEST',
    decimals: 18,
    maxSupply: null,
  }),
  hasMinterRole: vi.fn().mockResolvedValue(true),
  mint: vi.fn().mockResolvedValue('0xtxhash'),
  estimateMintGas: vi.fn().mockResolvedValue({
    gasLimit: BigInt(100000),
    gasPrice: BigInt(30000000000),
    totalCost: '0.003',
  }),
  isValidAddress: vi.fn((addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr)),
  clearProvider: vi.fn(),
  getPolygonscanUrl: vi.fn((hash: string) => `https://polygonscan.com/tx/${hash}`),
  batchMint: vi.fn().mockResolvedValue({
    txHash: '0xbatchtxhash',
    results: [],
  }),
  estimateBatchMintGas: vi.fn().mockResolvedValue({
    gasLimit: BigInt(500000),
    gasPrice: BigInt(30000000000),
    totalCost: '0.015',
  }),
  deployToken: vi.fn().mockResolvedValue({
    address: '0xNewTokenAddress1234567890123456789012',
    txHash: '0xdeploytxhash',
  }),
  estimateDeployGas: vi.fn().mockResolvedValue({
    gasLimit: BigInt(2000000),
    gasPrice: BigInt(30000000000),
    totalCost: '0.06',
  }),
  grantMinterRole: vi.fn().mockResolvedValue('0xgranttxhash'),
  revokeMinterRole: vi.fn().mockResolvedValue('0xrevoketxhash'),
  getMinters: vi.fn().mockResolvedValue(['0xMinter1', '0xMinter2']),
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../csv-parser', () => ({
  parseMintCsv: vi.fn(() => ({
    validRows: [],
    invalidRows: [],
    validCount: 0,
    invalidCount: 0,
    totalAmount: '0',
  })),
  splitIntoBatches: vi.fn((arr: unknown[], size: number) => {
    const batches = [];
    for (let i = 0; i < arr.length; i += size) {
      batches.push(arr.slice(i, i + size));
    }
    return batches.length > 0 ? batches : [[]];
  }),
  generateFailedCsv: vi.fn(() => 'address,amount,error\n'),
}));

// Store registered handlers
const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

// Capture handlers when registerIpcHandlers is called
vi.mocked(ipcMain.handle).mockImplementation(((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
  handlers[channel] = handler;
  return undefined as unknown as Electron.IpcMain;
}) as typeof ipcMain.handle);

describe('IPC Handlers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear handlers
    Object.keys(handlers).forEach(key => delete handlers[key]);

    // Re-import to register handlers fresh
    vi.resetModules();
    const { registerIpcHandlers } = await import('../ipc-handlers');
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('App Lifecycle Handlers', () => {
    it('TC-IPC-001: app:isInitialized should return true when wallet exists', async () => {
      const { walletExists } = await import('../crypto');
      const { isInitialized } = await import('../config');
      vi.mocked(walletExists).mockResolvedValue(true);
      vi.mocked(isInitialized).mockReturnValue(true);

      const result = await handlers['app:isInitialized']({} as Electron.IpcMainInvokeEvent);
      expect(result).toBe(true);
    });

    it('TC-IPC-002: app:isInitialized should return false when wallet does not exist', async () => {
      const { walletExists } = await import('../crypto');
      vi.mocked(walletExists).mockResolvedValue(false);

      const result = await handlers['app:isInitialized']({} as Electron.IpcMainInvokeEvent);
      expect(result).toBe(false);
    });

    it('TC-IPC-003: app:getConfig should return current config', async () => {
      const result = await handlers['app:getConfig']({} as Electron.IpcMainInvokeEvent);
      expect(result).toHaveProperty('network', 'testnet');
      expect(result).toHaveProperty('language', 'ja');
    });
  });

  describe('Authentication Handlers', () => {
    it('TC-IPC-004: auth:verifyPin should return success on valid PIN', async () => {
      const { verifyPin } = await import('../pin-auth');
      vi.mocked(verifyPin).mockResolvedValue({ success: true });

      const result = await handlers['auth:verifyPin']({} as Electron.IpcMainInvokeEvent, 'ValidPin123');
      expect(result).toEqual({ success: true });
      expect(verifyPin).toHaveBeenCalledWith('ValidPin123');
    });

    it('TC-IPC-005: auth:verifyPin should return failure with remaining attempts', async () => {
      const { verifyPin } = await import('../pin-auth');
      vi.mocked(verifyPin).mockResolvedValue({ success: false, remainingAttempts: 2 });

      const result = await handlers['auth:verifyPin']({} as Electron.IpcMainInvokeEvent, 'WrongPin123');
      expect(result).toEqual({ success: false, remainingAttempts: 2 });
    });

    it('TC-IPC-006: auth:verifyPin should return lockUntil when locked', async () => {
      const { verifyPin } = await import('../pin-auth');
      const lockTime = Date.now() + 300000;
      vi.mocked(verifyPin).mockResolvedValue({ success: false, lockUntil: lockTime });

      const result = await handlers['auth:verifyPin']({} as Electron.IpcMainInvokeEvent, 'WrongPin123');
      expect(result).toEqual({ success: false, lockUntil: lockTime });
    });

    it('TC-IPC-007: auth:setPin should validate PIN format', async () => {
      const { validatePinFormat } = await import('../crypto');
      vi.mocked(validatePinFormat).mockReturnValue({ valid: true });

      const result = await handlers['auth:setPin']({} as Electron.IpcMainInvokeEvent, 'ValidPin123');
      expect(result).toEqual({ success: true });
      expect(validatePinFormat).toHaveBeenCalledWith('ValidPin123');
    });

    it('TC-IPC-008: auth:setPin should reject invalid PIN format', async () => {
      const { validatePinFormat } = await import('../crypto');
      vi.mocked(validatePinFormat).mockReturnValue({ valid: false, message: 'PIN must be at least 8 characters' });

      const result = await handlers['auth:setPin']({} as Electron.IpcMainInvokeEvent, 'short');
      expect(result).toEqual({ success: false, message: 'PIN must be at least 8 characters' });
    });

    it('TC-IPC-009: auth:changePin should change PIN successfully', async () => {
      const { changePin } = await import('../pin-auth');
      vi.mocked(changePin).mockResolvedValue({ success: true });

      const result = await handlers['auth:changePin']({} as Electron.IpcMainInvokeEvent, 'OldPin123', 'NewPin456');
      expect(result).toEqual({ success: true });
      expect(changePin).toHaveBeenCalledWith('OldPin123', 'NewPin456');
    });

    it('TC-IPC-010: auth:checkSession should return session status', async () => {
      const { checkSession } = await import('../pin-auth');
      vi.mocked(checkSession).mockReturnValue(true);

      const result = await handlers['auth:checkSession']({} as Electron.IpcMainInvokeEvent);
      expect(result).toBe(true);
    });

    it('TC-IPC-011: auth:updateActivity should update activity timestamp', async () => {
      const { updateActivity } = await import('../pin-auth');

      await handlers['auth:updateActivity']({} as Electron.IpcMainInvokeEvent);
      expect(updateActivity).toHaveBeenCalled();
    });

    it('TC-IPC-012: auth:lock should lock the app', async () => {
      const { lockApp } = await import('../pin-auth');

      await handlers['auth:lock']({} as Electron.IpcMainInvokeEvent);
      expect(lockApp).toHaveBeenCalled();
    });
  });

  describe('Wallet Handlers', () => {
    it('TC-IPC-013: wallet:import should import valid private key', async () => {
      const validPrivateKey = '0x' + 'a'.repeat(64);
      const { encryptPrivateKey, saveEncryptedWallet } = await import('../crypto');
      const { updateConfig } = await import('../config');

      const result = await handlers['wallet:import']({} as Electron.IpcMainInvokeEvent, validPrivateKey, 'ValidPin123');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('address');
      expect(encryptPrivateKey).toHaveBeenCalled();
      expect(saveEncryptedWallet).toHaveBeenCalled();
      expect(updateConfig).toHaveBeenCalled();
    });

    it('TC-IPC-014: wallet:import should reject invalid private key format', async () => {
      const result = await handlers['wallet:import']({} as Electron.IpcMainInvokeEvent, 'invalid', 'ValidPin123');

      expect(result).toEqual({ success: false, message: 'Invalid private key format' });
    });

    it('TC-IPC-015: wallet:import should reject invalid PIN format', async () => {
      const { validatePinFormat } = await import('../crypto');
      vi.mocked(validatePinFormat).mockReturnValue({ valid: false, message: 'PIN too short' });

      const validPrivateKey = '0x' + 'a'.repeat(64);
      const result = await handlers['wallet:import']({} as Electron.IpcMainInvokeEvent, validPrivateKey, 'short');

      expect(result).toEqual({ success: false, message: 'PIN too short' });
    });

    it('TC-IPC-016: wallet:import should handle private key without 0x prefix', async () => {
      const privateKeyWithoutPrefix = 'a'.repeat(64);

      const result = await handlers['wallet:import']({} as Electron.IpcMainInvokeEvent, privateKeyWithoutPrefix, 'ValidPin123');

      expect(result).toHaveProperty('success', true);
    });

    it('TC-IPC-017: wallet:getInfo should return wallet info', async () => {
      const result = await handlers['wallet:getInfo']({} as Electron.IpcMainInvokeEvent);

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('balance', '10.5');
    });

    it('TC-IPC-018: wallet:getInfo should return null when no wallet address', async () => {
      const { getConfig } = await import('../config');
      vi.mocked(getConfig).mockReturnValue({
        version: '1.0.0',
        network: 'testnet',
        language: 'ja',
        alertThresholds: { warning: 1.0, danger: 0.1 },
        walletAddress: null,
        sessionTimeoutMinutes: 15,
        batchMinterAddresses: { mainnet: '', testnet: '' },
      });

      const result = await handlers['wallet:getInfo']({} as Electron.IpcMainInvokeEvent);
      expect(result).toBeNull();
    });

    it('TC-IPC-019: wallet:getBalance should return balance', async () => {
      const result = await handlers['wallet:getBalance']({} as Electron.IpcMainInvokeEvent);
      expect(result).toBe('10.5');
    });
  });

  describe('Token Handlers', () => {
    it('TC-IPC-020: tokens:getAll should return tokens for current network', async () => {
      const { getTokens } = await import('../database');
      const mockTokens = [
        { id: 1, address: '0xToken1', name: 'Token1', symbol: 'TK1', decimals: 18, network: 'testnet' as const, hasMinterRole: true, maxSupply: null, createdAt: '', updatedAt: '' },
      ];
      vi.mocked(getTokens).mockReturnValue(mockTokens);

      const result = await handlers['tokens:getAll']({} as Electron.IpcMainInvokeEvent);

      expect(result).toEqual(mockTokens);
      expect(getTokens).toHaveBeenCalledWith('testnet');
    });

    it('TC-IPC-021: tokens:add should add new token', async () => {
      const { getTokenByAddress, insertToken } = await import('../database');
      vi.mocked(getTokenByAddress).mockReturnValue(undefined);
      vi.mocked(insertToken).mockReturnValue({
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
        network: 'testnet',
        hasMinterRole: true,
        maxSupply: null,
        createdAt: '',
        updatedAt: '',
      });

      const result = await handlers['tokens:add']({} as Electron.IpcMainInvokeEvent, '0x1234567890123456789012345678901234567890');

      expect(result).toHaveProperty('symbol', 'TEST');
      expect(insertToken).toHaveBeenCalled();
    });

    it('TC-IPC-022: tokens:add should return existing token if already exists', async () => {
      const { getTokenByAddress } = await import('../database');
      const existingToken = {
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        name: 'Existing Token',
        symbol: 'EXIST',
        decimals: 18,
        network: 'testnet' as const,
        hasMinterRole: true,
        maxSupply: null,
        createdAt: '',
        updatedAt: '',
      };
      vi.mocked(getTokenByAddress).mockReturnValue(existingToken);

      const result = await handlers['tokens:add']({} as Electron.IpcMainInvokeEvent, '0x1234567890123456789012345678901234567890');

      expect(result).toEqual(existingToken);
    });

    it('TC-IPC-023: tokens:add should throw on invalid address', async () => {
      await expect(
        handlers['tokens:add']({} as Electron.IpcMainInvokeEvent, 'invalid')
      ).rejects.toThrow('Invalid token address');
    });

    it('TC-IPC-024: tokens:deploy should deploy new token', async () => {
      const { insertToken, insertOperationLog, updateOperationLog } = await import('../database');
      vi.mocked(insertToken).mockReturnValue({
        id: 1,
        address: '0xNewTokenAddress1234567890123456789012',
        name: 'New Token',
        symbol: 'NEW',
        decimals: 18,
        network: 'testnet',
        hasMinterRole: true,
        maxSupply: null,
        createdAt: '',
        updatedAt: '',
      });

      const params = {
        name: 'New Token',
        symbol: 'NEW',
        decimals: 18,
        maxSupply: null,
        initialMint: null,
      };

      const result = await handlers['tokens:deploy']({} as Electron.IpcMainInvokeEvent, params);

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('txHash');
      expect(insertOperationLog).toHaveBeenCalled();
      expect(updateOperationLog).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'success' }));
    });

    it('TC-IPC-025: tokens:estimateDeployGas should estimate gas', async () => {
      const params = {
        name: 'New Token',
        symbol: 'NEW',
        decimals: 18,
        maxSupply: null,
        initialMint: null,
      };

      const result = await handlers['tokens:estimateDeployGas']({} as Electron.IpcMainInvokeEvent, params);

      expect(result).toHaveProperty('gasLimit');
      expect(result).toHaveProperty('gasPrice');
      expect(result).toHaveProperty('totalCost');
    });
  });

  describe('Mint Handlers', () => {
    it('TC-IPC-026: mint:single should mint tokens successfully', async () => {
      const { getTokenByAddress, insertOperationLog, updateOperationLog } = await import('../database');
      vi.mocked(getTokenByAddress).mockReturnValue({
        id: 1,
        address: '0xTokenAddress',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
        network: 'testnet',
        hasMinterRole: true,
        maxSupply: null,
        createdAt: '',
        updatedAt: '',
      });

      const params = {
        tokenAddress: '0xTokenAddress',
        recipient: '0x1234567890123456789012345678901234567890',
        amount: '100',
      };

      const result = await handlers['mint:single']({} as Electron.IpcMainInvokeEvent, params);

      expect(result).toHaveProperty('txHash', '0xtxhash');
      expect(insertOperationLog).toHaveBeenCalled();
      expect(updateOperationLog).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'success' }));
    });

    it('TC-IPC-027: mint:single should throw on invalid recipient', async () => {
      const params = {
        tokenAddress: '0xTokenAddress',
        recipient: 'invalid',
        amount: '100',
      };

      await expect(
        handlers['mint:single']({} as Electron.IpcMainInvokeEvent, params)
      ).rejects.toThrow('Invalid recipient address');
    });

    it('TC-IPC-028: mint:single should throw when token not found', async () => {
      const { getTokenByAddress } = await import('../database');
      vi.mocked(getTokenByAddress).mockReturnValue(undefined);

      const params = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        recipient: '0x1234567890123456789012345678901234567891',
        amount: '100',
      };

      await expect(
        handlers['mint:single']({} as Electron.IpcMainInvokeEvent, params)
      ).rejects.toThrow('Token not found');
    });

    it('TC-IPC-029: mint:estimateGas should estimate mint gas', async () => {
      const { getTokenByAddress } = await import('../database');
      vi.mocked(getTokenByAddress).mockReturnValue({
        id: 1,
        address: '0xTokenAddress',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
        network: 'testnet',
        hasMinterRole: true,
        maxSupply: null,
        createdAt: '',
        updatedAt: '',
      });

      const result = await handlers['mint:estimateGas'](
        {} as Electron.IpcMainInvokeEvent,
        '0xTokenAddress',
        '0x1234567890123456789012345678901234567890',
        '100'
      );

      expect(result).toHaveProperty('gasLimit');
      expect(result).toHaveProperty('totalCost');
    });
  });

  describe('Role Management Handlers', () => {
    it('TC-IPC-030: roles:getMinters should return minters list', async () => {
      const result = await handlers['roles:getMinters']({} as Electron.IpcMainInvokeEvent, '0xTokenAddress');
      expect(result).toEqual(['0xMinter1', '0xMinter2']);
    });

    it('TC-IPC-031: roles:grant should grant minter role', async () => {
      const { getTokenByAddress, insertOperationLog } = await import('../database');
      vi.mocked(getTokenByAddress).mockReturnValue({
        id: 1,
        address: '0xTokenAddress',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
        network: 'testnet',
        hasMinterRole: true,
        maxSupply: null,
        createdAt: '',
        updatedAt: '',
      });

      const result = await handlers['roles:grant'](
        {} as Electron.IpcMainInvokeEvent,
        '0xTokenAddress',
        '0x1234567890123456789012345678901234567890'
      );

      expect(result).toHaveProperty('txHash', '0xgranttxhash');
      expect(insertOperationLog).toHaveBeenCalled();
    });

    it('TC-IPC-032: roles:revoke should revoke minter role', async () => {
      const { getTokenByAddress, insertOperationLog } = await import('../database');
      vi.mocked(getTokenByAddress).mockReturnValue({
        id: 1,
        address: '0xTokenAddress',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
        network: 'testnet',
        hasMinterRole: true,
        maxSupply: null,
        createdAt: '',
        updatedAt: '',
      });

      const result = await handlers['roles:revoke'](
        {} as Electron.IpcMainInvokeEvent,
        '0xTokenAddress',
        '0x1234567890123456789012345678901234567890'
      );

      expect(result).toHaveProperty('txHash', '0xrevoketxhash');
      expect(insertOperationLog).toHaveBeenCalled();
    });
  });

  describe('Settings Handlers', () => {
    it('TC-IPC-033: settings:setNetwork should update network', async () => {
      const { updateConfig } = await import('../config');
      const { clearProvider } = await import('../blockchain');

      await handlers['settings:setNetwork']({} as Electron.IpcMainInvokeEvent, 'mainnet');

      expect(updateConfig).toHaveBeenCalledWith({ network: 'mainnet' });
      expect(clearProvider).toHaveBeenCalled();
    });

    it('TC-IPC-034: settings:setLanguage should update language', async () => {
      const { updateConfig } = await import('../config');

      await handlers['settings:setLanguage']({} as Electron.IpcMainInvokeEvent, 'en');

      expect(updateConfig).toHaveBeenCalledWith({ language: 'en' });
    });

    it('TC-IPC-035: settings:setAlertThresholds should update thresholds', async () => {
      const { updateConfig } = await import('../config');

      await handlers['settings:setAlertThresholds']({} as Electron.IpcMainInvokeEvent, 2.0, 0.5);

      expect(updateConfig).toHaveBeenCalledWith({
        alertThresholds: { warning: 2.0, danger: 0.5 },
      });
    });

    it('TC-IPC-036: settings:setSessionTimeout should update timeout', async () => {
      const { updateConfig } = await import('../config');
      const { setSessionTimeout } = await import('../pin-auth');

      await handlers['settings:setSessionTimeout']({} as Electron.IpcMainInvokeEvent, 30);

      expect(setSessionTimeout).toHaveBeenCalledWith(30);
      expect(updateConfig).toHaveBeenCalledWith({ sessionTimeoutMinutes: 30 });
    });
  });

  describe('Utility Handlers', () => {
    it('TC-IPC-037: utils:validateAddress should validate address', async () => {
      const validResult = await handlers['utils:validateAddress'](
        {} as Electron.IpcMainInvokeEvent,
        '0x1234567890123456789012345678901234567890'
      );
      expect(validResult).toBe(true);

      const invalidResult = await handlers['utils:validateAddress'](
        {} as Electron.IpcMainInvokeEvent,
        'invalid'
      );
      expect(invalidResult).toBe(false);
    });

    it('TC-IPC-038: utils:getPolygonscanUrl should return URL', async () => {
      const result = await handlers['utils:getPolygonscanUrl'](
        {} as Electron.IpcMainInvokeEvent,
        '0xtxhash'
      );
      expect(result).toContain('0xtxhash');
    });

    it('TC-IPC-039: utils:openExternalLink should only open allowed domains', async () => {
      const { shell } = await import('electron');

      // Allowed domain
      await handlers['utils:openExternalLink'](
        {} as Electron.IpcMainInvokeEvent,
        'https://polygonscan.com/tx/0x123'
      );
      expect(shell.openExternal).toHaveBeenCalled();

      vi.mocked(shell.openExternal).mockClear();

      // Blocked domain
      await handlers['utils:openExternalLink'](
        {} as Electron.IpcMainInvokeEvent,
        'https://malicious.com'
      );
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('CSV Handlers', () => {
    it('TC-IPC-040: csv:parse should parse CSV content', async () => {
      const { parseMintCsv } = await import('../csv-parser');
      vi.mocked(parseMintCsv).mockReturnValue({
        rows: [{ lineNumber: 1, address: '0x123', amount: '100', isValid: true }],
        validCount: 1,
        invalidCount: 0,
        totalAmount: '100',
      });

      const result = await handlers['csv:parse']({} as Electron.IpcMainInvokeEvent, 'address,amount\n0x123,100');

      expect(result).toHaveProperty('validCount', 1);
      expect(parseMintCsv).toHaveBeenCalledWith('address,amount\n0x123,100');
    });

    it('TC-IPC-041: csv:generateFailed should generate failed CSV', async () => {
      const failedRows = [
        { address: '0x123', amount: '100', error: 'Failed' },
      ];

      const result = await handlers['csv:generateFailed']({} as Electron.IpcMainInvokeEvent, failedRows);

      expect(typeof result).toBe('string');
    });
  });

  describe('Operations Handlers', () => {
    it('TC-IPC-042: operations:getLogs should return operation logs', async () => {
      const { getOperationLogs } = await import('../database');
      const mockLogs = [
        {
          id: 1,
          operationType: 'mint' as const,
          tokenId: 1,
          tokenAddress: '0x123',
          tokenSymbol: 'TEST',
          details: '{}',
          txHash: '0xtx',
          status: 'success' as const,
          network: 'testnet' as const,
          operatorAddress: '0xoperator',
          createdAt: '',
          updatedAt: '',
        },
      ];
      vi.mocked(getOperationLogs).mockReturnValue(mockLogs);

      const result = await handlers['operations:getLogs']({} as Electron.IpcMainInvokeEvent);

      expect(result).toEqual(mockLogs);
    });

    it('TC-IPC-043: operations:getLogs should apply filter', async () => {
      const { getOperationLogs } = await import('../database');
      const filter = { operationType: 'mint' as const };

      await handlers['operations:getLogs']({} as Electron.IpcMainInvokeEvent, filter);

      expect(getOperationLogs).toHaveBeenCalledWith(filter);
    });

    it('TC-IPC-044: operations:exportCsv should export logs as CSV', async () => {
      const { getOperationLogs } = await import('../database');
      vi.mocked(getOperationLogs).mockReturnValue([
        {
          id: 1,
          operationType: 'mint' as const,
          tokenId: 1,
          tokenAddress: '0x123',
          tokenSymbol: 'TEST',
          details: '{"amount":"100"}',
          txHash: '0xtx',
          status: 'success' as const,
          network: 'testnet' as const,
          operatorAddress: '0xoperator',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]);

      const result = await handlers['operations:exportCsv']({} as Electron.IpcMainInvokeEvent);

      expect(typeof result).toBe('string');
      expect(result).toContain('timestamp');
      expect(result).toContain('operation');
      expect(result).toContain('mint');
    });
  });

  describe('Error Handling', () => {
    it('TC-IPC-045: should log errors on mint failure', async () => {
      const { getTokenByAddress, updateOperationLog } = await import('../database');
      const { mint } = await import('../blockchain');
      const { logger } = await import('../logger');

      vi.mocked(getTokenByAddress).mockReturnValue({
        id: 1,
        address: '0xTokenAddress',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
        network: 'testnet',
        hasMinterRole: true,
        maxSupply: null,
        createdAt: '',
        updatedAt: '',
      });
      vi.mocked(mint).mockRejectedValue(new Error('Transaction failed'));

      const params = {
        tokenAddress: '0xTokenAddress',
        recipient: '0x1234567890123456789012345678901234567890',
        amount: '100',
      };

      await expect(
        handlers['mint:single']({} as Electron.IpcMainInvokeEvent, params)
      ).rejects.toThrow('Transaction failed');

      expect(updateOperationLog).toHaveBeenCalledWith(1, { status: 'failed' });
      expect(logger.error).toHaveBeenCalled();
    });

    it('TC-IPC-046: should log errors on deploy failure', async () => {
      const { deployToken } = await import('../blockchain');
      const { updateOperationLog } = await import('../database');
      const { logger } = await import('../logger');

      vi.mocked(deployToken).mockRejectedValue(new Error('Deploy failed'));

      const params = {
        name: 'New Token',
        symbol: 'NEW',
        decimals: 18,
        maxSupply: null,
        initialMint: null,
      };

      await expect(
        handlers['tokens:deploy']({} as Electron.IpcMainInvokeEvent, params)
      ).rejects.toThrow('Deploy failed');

      expect(updateOperationLog).toHaveBeenCalledWith(1, { status: 'failed' });
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
