/**
 * @fileoverview IPC Handler Registration
 *
 * This module registers all IPC handlers for communication between
 * the renderer process and main process. Handlers are grouped by
 * functionality: authentication, wallet, tokens, minting, roles,
 * settings, and utilities.
 *
 * @module ipc-handlers
 */

import { ipcMain, shell } from 'electron';
import { getConfig, updateConfig, isInitialized } from './config';
import { verifyPin, changePin, getCachedPrivateKey, updateActivity, checkSession, setSessionTimeout, lockApp } from './pin-auth';
import {
  encryptPrivateKey,
  saveEncryptedWallet,
  validatePinFormat,
  walletExists,
} from './crypto';
import {
  getTokens,
  getTokenByAddress,
  insertToken,
  updateToken,
  getOperationLogs,
  insertOperationLog,
  updateOperationLog,
} from './database';
import {
  getAddressFromPrivateKey,
  getBalance,
  getTokenInfo,
  hasMinterRole,
  mint,
  estimateMintGas,
  isValidAddress,
  clearProvider,
  getPolygonscanUrl,
  batchMint as executeBatchMint,
  estimateBatchMintGas,
  deployToken,
  estimateDeployGas,
  grantMinterRole,
  revokeMinterRole,
  getMinters,
} from './blockchain';
import { getLogsPath } from './paths';
import { logger } from './logger';
import { parseMintCsv, splitIntoBatches, generateFailedCsv } from './csv-parser';
import type { NetworkType, OperationLogFilter, MintParams, Token, BatchMintParams, DeployTokenParams } from '../shared/types';

/**
 * Registers all IPC handlers for the application.
 *
 * This function should be called once during application initialization.
 * It sets up handlers for:
 * - App lifecycle (isInitialized, getConfig)
 * - Authentication (verifyPin, setPin, changePin, checkSession, lock)
 * - Wallet operations (import, getInfo, getBalance)
 * - Token operations (getAll, add, deploy, refreshMinterRole)
 * - Minting (single, batch, estimateGas)
 * - Role management (getMinters, grant, revoke)
 * - Settings (network, language, thresholds, timeout)
 * - Utilities (openLogsFolder, openExternalLink, validateAddress)
 *
 * @example
 * // In main/index.ts
 * import { registerIpcHandlers } from './ipc-handlers';
 *
 * app.whenReady().then(() => {
 *   registerIpcHandlers();
 *   createWindow();
 * });
 */
export function registerIpcHandlers(): void {
  // App lifecycle
  ipcMain.handle('app:isInitialized', async () => {
    return isInitialized() && (await walletExists());
  });

  ipcMain.handle('app:getConfig', async () => {
    return getConfig();
  });

  // PIN authentication
  ipcMain.handle('auth:verifyPin', async (_, pin: string) => {
    const result = await verifyPin(pin);
    if (result.success) {
      logger.info('PIN verification successful');
    } else {
      logger.warn('PIN verification failed', {
        remainingAttempts: result.remainingAttempts,
        lockUntil: result.lockUntil,
      });
    }
    return result;
  });

  ipcMain.handle('auth:setPin', async (_, pin: string) => {
    const validation = validatePinFormat(pin);
    return { success: validation.valid, message: validation.message };
  });

  ipcMain.handle('auth:changePin', async (_, currentPin: string, newPin: string) => {
    return changePin(currentPin, newPin);
  });

  ipcMain.handle('auth:checkSession', async () => {
    return checkSession();
  });

  ipcMain.handle('auth:updateActivity', async () => {
    updateActivity();
  });

  ipcMain.handle('auth:lock', async () => {
    lockApp();
    logger.info('App locked by user');
  });

  // Wallet
  ipcMain.handle('wallet:import', async (_, privateKey: string, pin: string) => {
    logger.info('Wallet import started');

    // Validate private key format
    let cleanKey = privateKey.trim();
    if (cleanKey.startsWith('0x')) {
      cleanKey = cleanKey.slice(2);
    }

    if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
      logger.warn('Wallet import failed: invalid private key format');
      return { success: false, message: 'Invalid private key format' };
    }

    // Validate PIN
    const pinValidation = validatePinFormat(pin);
    if (!pinValidation.valid) {
      logger.warn('Wallet import failed: invalid PIN format');
      return { success: false, message: pinValidation.message };
    }

    try {
      // Get address from private key
      const address = getAddressFromPrivateKey('0x' + cleanKey);

      // Encrypt and save
      const encryptedWallet = encryptPrivateKey('0x' + cleanKey, pin);
      await saveEncryptedWallet(encryptedWallet);

      // Update config with wallet address
      await updateConfig({ walletAddress: address });

      logger.info('Wallet imported successfully', { address });
      return { success: true, address };
    } catch (error) {
      logger.error('Wallet import failed', { error: String(error) });
      return { success: false, message: 'Failed to import private key' };
    }
  });

  ipcMain.handle('wallet:getInfo', async () => {
    const config = getConfig();
    if (!config.walletAddress) {
      return null;
    }

    try {
      const balance = await getBalance(config.walletAddress);
      return {
        address: config.walletAddress,
        balance,
      };
    } catch {
      return {
        address: config.walletAddress,
        balance: '0',
      };
    }
  });

  ipcMain.handle('wallet:getBalance', async () => {
    const config = getConfig();
    if (!config.walletAddress) {
      return '0';
    }

    try {
      return await getBalance(config.walletAddress);
    } catch {
      return '0';
    }
  });

  // Tokens
  ipcMain.handle('tokens:getAll', async () => {
    const config = getConfig();
    return getTokens(config.network);
  });

  ipcMain.handle('tokens:add', async (_, tokenAddress: string) => {
    if (!isValidAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }

    const config = getConfig();

    // Check if token already exists
    const existing = getTokenByAddress(tokenAddress, config.network);
    if (existing) {
      return existing;
    }

    // Get token info from blockchain
    const tokenInfo = await getTokenInfo(tokenAddress);
    const hasMinter = config.walletAddress
      ? await hasMinterRole(tokenAddress, config.walletAddress)
      : false;

    // Save to database
    const token = insertToken({
      address: tokenAddress,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals,
      network: config.network,
      hasMinterRole: hasMinter,
      maxSupply: tokenInfo.maxSupply,
    });

    return token;
  });

  ipcMain.handle('tokens:refreshMinterRole', async (_, tokenId: number, tokenAddress: string) => {
    const config = getConfig();
    if (!config.walletAddress) return;

    const hasMinter = await hasMinterRole(tokenAddress, config.walletAddress);
    updateToken(tokenId, { hasMinterRole: hasMinter });
  });

  // Token deployment
  ipcMain.handle('tokens:deploy', async (_, params: DeployTokenParams) => {
    logger.info('Token deployment started', {
      name: params.name,
      symbol: params.symbol,
      decimals: params.decimals,
    });

    const config = getConfig();

    // Create operation log
    const logId = insertOperationLog({
      operationType: 'deploy',
      tokenId: null,
      tokenAddress: '',
      tokenSymbol: params.symbol,
      details: JSON.stringify({
        name: params.name,
        decimals: params.decimals,
        maxSupply: params.maxSupply,
        initialMint: params.initialMint,
      }),
      txHash: null,
      status: 'pending',
      network: config.network,
      operatorAddress: config.walletAddress!,
    });

    try {
      const { address, txHash } = await deployToken(params);

      // Save token to database
      const token = insertToken({
        address,
        name: params.name,
        symbol: params.symbol,
        decimals: params.decimals,
        network: config.network,
        hasMinterRole: true, // Deployer gets MINTER_ROLE
        maxSupply: params.maxSupply,
      });

      // Update operation log
      updateOperationLog(logId, {
        status: 'success',
        txHash,
        tokenAddress: address,
        tokenId: token.id,
      });

      logger.info('Token deployed successfully', { address, txHash });
      return { address, txHash };
    } catch (error) {
      updateOperationLog(logId, { status: 'failed' });
      logger.error('Token deployment failed', { error: String(error) });
      throw error;
    }
  });

  ipcMain.handle('tokens:estimateDeployGas', async (_, params: DeployTokenParams) => {
    return estimateDeployGas(params);
  });

  // Role management
  ipcMain.handle('roles:getMinters', async (_, tokenAddress: string) => {
    return getMinters(tokenAddress);
  });

  ipcMain.handle('roles:grant', async (_, tokenAddress: string, targetAddress: string) => {
    logger.info('Granting minter role', { tokenAddress, targetAddress });

    const config = getConfig();
    const token = getTokenByAddress(tokenAddress, config.network);

    const logId = insertOperationLog({
      operationType: 'grant_role',
      tokenId: token?.id || null,
      tokenAddress,
      tokenSymbol: token?.symbol || '',
      details: JSON.stringify({ targetAddress }),
      txHash: null,
      status: 'pending',
      network: config.network,
      operatorAddress: config.walletAddress!,
    });

    try {
      const txHash = await grantMinterRole(tokenAddress, targetAddress);
      updateOperationLog(logId, { status: 'success', txHash });
      logger.info('Minter role granted', { txHash });
      return { txHash };
    } catch (error) {
      updateOperationLog(logId, { status: 'failed' });
      logger.error('Failed to grant minter role', { error: String(error) });
      throw error;
    }
  });

  ipcMain.handle('roles:revoke', async (_, tokenAddress: string, targetAddress: string) => {
    logger.info('Revoking minter role', { tokenAddress, targetAddress });

    const config = getConfig();
    const token = getTokenByAddress(tokenAddress, config.network);

    const logId = insertOperationLog({
      operationType: 'revoke_role',
      tokenId: token?.id || null,
      tokenAddress,
      tokenSymbol: token?.symbol || '',
      details: JSON.stringify({ targetAddress }),
      txHash: null,
      status: 'pending',
      network: config.network,
      operatorAddress: config.walletAddress!,
    });

    try {
      const txHash = await revokeMinterRole(tokenAddress, targetAddress);
      updateOperationLog(logId, { status: 'success', txHash });
      logger.info('Minter role revoked', { txHash });
      return { txHash };
    } catch (error) {
      updateOperationLog(logId, { status: 'failed' });
      logger.error('Failed to revoke minter role', { error: String(error) });
      throw error;
    }
  });

  // Minting
  ipcMain.handle('mint:single', async (_, params: MintParams) => {
    logger.info('Mint operation started', {
      tokenAddress: params.tokenAddress,
      recipient: params.recipient,
      amount: params.amount,
    });

    if (!isValidAddress(params.recipient)) {
      logger.warn('Mint failed: invalid recipient address', { recipient: params.recipient });
      throw new Error('Invalid recipient address');
    }

    const config = getConfig();
    const token = getTokenByAddress(params.tokenAddress, config.network);
    if (!token) {
      logger.warn('Mint failed: token not found', { tokenAddress: params.tokenAddress });
      throw new Error('Token not found');
    }

    // Create operation log
    const logId = insertOperationLog({
      operationType: 'mint',
      tokenId: token.id,
      tokenAddress: params.tokenAddress,
      tokenSymbol: token.symbol,
      details: JSON.stringify({
        recipient: params.recipient,
        amount: params.amount,
      }),
      txHash: null,
      status: 'pending',
      network: config.network,
      operatorAddress: config.walletAddress!,
    });

    try {
      // Execute mint
      const txHash = await mint(
        params.tokenAddress,
        params.recipient,
        params.amount,
        token.decimals
      );

      // Update log with success
      updateOperationLog(logId, { status: 'success', txHash });

      logger.info('Mint operation successful', {
        tokenSymbol: token.symbol,
        recipient: params.recipient,
        amount: params.amount,
        txHash,
      });

      return { txHash };
    } catch (error) {
      // Update log with failure
      updateOperationLog(logId, { status: 'failed' });
      logger.error('Mint operation failed', {
        tokenSymbol: token.symbol,
        recipient: params.recipient,
        amount: params.amount,
        error: String(error),
      });
      throw error;
    }
  });

  ipcMain.handle('mint:estimateGas', async (_, tokenAddress: string, recipient: string, amount: string) => {
    const config = getConfig();
    const token = getTokenByAddress(tokenAddress, config.network);
    if (!token) {
      throw new Error('Token not found');
    }

    return estimateMintGas(tokenAddress, recipient, amount, token.decimals);
  });

  // CSV parsing
  ipcMain.handle('csv:parse', async (_, csvContent: string) => {
    logger.info('Parsing CSV content');
    const result = parseMintCsv(csvContent);
    logger.info('CSV parsed', {
      validCount: result.validCount,
      invalidCount: result.invalidCount,
      totalAmount: result.totalAmount,
    });
    return result;
  });

  // Batch minting
  ipcMain.handle('mint:batch', async (_, params: BatchMintParams & { batchMinterAddress: string }) => {
    logger.info('Batch mint operation started', {
      tokenAddress: params.tokenAddress,
      recipientCount: params.recipients.length,
      skipInvalid: params.skipInvalid,
    });

    const config = getConfig();
    const token = getTokenByAddress(params.tokenAddress, config.network);
    if (!token) {
      logger.warn('Batch mint failed: token not found');
      throw new Error('Token not found');
    }

    // Filter invalid addresses if skipInvalid is true
    let recipients = params.recipients;
    if (params.skipInvalid) {
      recipients = recipients.filter(r => isValidAddress(r.address));
    }

    // Split into batches of 100
    const BATCH_SIZE = 100;
    const batches = splitIntoBatches(recipients, BATCH_SIZE);

    const allResults: Array<{ address: string; amount: string; success: boolean; error?: string }> = [];
    const txHashes: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.info(`Processing batch ${i + 1}/${batches.length}`, { count: batch.length });

      // Create operation log
      const logId = insertOperationLog({
        operationType: 'batch_mint',
        tokenId: token.id,
        tokenAddress: params.tokenAddress,
        tokenSymbol: token.symbol,
        details: JSON.stringify({
          batchNumber: i + 1,
          totalBatches: batches.length,
          recipientCount: batch.length,
        }),
        txHash: null,
        status: 'pending',
        network: config.network,
        operatorAddress: config.walletAddress!,
      });

      try {
        const { txHash, results } = await executeBatchMint(
          params.batchMinterAddress,
          params.tokenAddress,
          batch.map(r => ({ address: r.address, amount: r.amount })),
          token.decimals
        );

        txHashes.push(txHash);
        allResults.push(...results);
        updateOperationLog(logId, { status: 'success', txHash });

        logger.info(`Batch ${i + 1} completed`, {
          txHash,
          successCount: results.filter(r => r.success).length,
          failedCount: results.filter(r => !r.success).length,
        });
      } catch (error) {
        updateOperationLog(logId, { status: 'failed' });
        logger.error(`Batch ${i + 1} failed`, { error: String(error) });

        // Mark all in this batch as failed
        allResults.push(...batch.map(r => ({
          address: r.address,
          amount: r.amount,
          success: false,
          error: String(error),
        })));
      }
    }

    return {
      txHashes,
      results: allResults,
      successCount: allResults.filter(r => r.success).length,
      failedCount: allResults.filter(r => !r.success).length,
    };
  });

  // Estimate batch mint gas
  ipcMain.handle('mint:estimateBatchGas', async (
    _,
    batchMinterAddress: string,
    tokenAddress: string,
    recipients: Array<{ address: string; amount: string }>
  ) => {
    const config = getConfig();
    const token = getTokenByAddress(tokenAddress, config.network);
    if (!token) {
      throw new Error('Token not found');
    }

    // Estimate for first batch (100 items max)
    const sampleBatch = recipients.slice(0, Math.min(100, recipients.length));
    return estimateBatchMintGas(batchMinterAddress, tokenAddress, sampleBatch, token.decimals);
  });

  // Generate failed CSV
  ipcMain.handle('csv:generateFailed', async (
    _,
    failedRows: Array<{ address: string; amount: string; error: string }>
  ) => {
    return generateFailedCsv(failedRows);
  });

  // Operations
  ipcMain.handle('operations:getLogs', async (_, filter?: OperationLogFilter) => {
    return getOperationLogs(filter);
  });

  ipcMain.handle('operations:exportCsv', async (_, filter?: OperationLogFilter) => {
    const logs = getOperationLogs(filter);

    const header = 'timestamp,operation,token_symbol,token_address,details,tx_hash,operator_address\n';
    const rows = logs.map((log) => {
      return [
        log.createdAt,
        log.operationType,
        log.tokenSymbol,
        log.tokenAddress,
        `"${log.details.replace(/"/g, '""')}"`,
        log.txHash || '',
        log.operatorAddress,
      ].join(',');
    });

    return header + rows.join('\n');
  });

  // Settings
  ipcMain.handle('settings:setNetwork', async (_, network: NetworkType) => {
    logger.info('Network changed', { network });
    await updateConfig({ network });
    clearProvider();
  });

  ipcMain.handle('settings:setLanguage', async (_, language: 'ja' | 'en') => {
    logger.info('Language changed', { language });
    await updateConfig({ language });
  });

  ipcMain.handle('settings:setAlertThresholds', async (_, warning: number, danger: number) => {
    await updateConfig({
      alertThresholds: { warning, danger },
    });
  });

  ipcMain.handle('settings:setSessionTimeout', async (_, minutes: number) => {
    logger.info('Session timeout changed', { minutes });
    setSessionTimeout(minutes);
    await updateConfig({ sessionTimeoutMinutes: minutes });
  });

  ipcMain.handle('settings:setBatchMinterAddress', async (_, network: NetworkType, address: string) => {
    logger.info('BatchMinter address updated', { network, address });
    const config = getConfig();
    await updateConfig({
      batchMinterAddresses: {
        ...config.batchMinterAddresses,
        [network]: address,
      },
    });
  });

  // Utilities
  ipcMain.handle('utils:openLogsFolder', async () => {
    const logsPath = getLogsPath();
    await shell.openPath(logsPath);
  });

  ipcMain.handle('utils:openExternalLink', async (_, url: string) => {
    // Only allow specific domains
    const allowedDomains = ['polygonscan.com', 'amoy.polygonscan.com'];
    try {
      const parsedUrl = new URL(url);
      if (allowedDomains.some((d) => parsedUrl.hostname.endsWith(d))) {
        await shell.openExternal(url);
      }
    } catch {
      // Invalid URL
    }
  });

  ipcMain.handle('utils:getPolygonscanUrl', async (_, txHash: string) => {
    const config = getConfig();
    return getPolygonscanUrl(txHash, config.network);
  });

  ipcMain.handle('utils:validateAddress', async (_, address: string) => {
    return isValidAddress(address);
  });
}
