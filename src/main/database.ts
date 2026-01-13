/**
 * @fileoverview Database Module
 *
 * Handles all SQLite database operations for storing tokens and operation logs.
 * Uses better-sqlite3 for synchronous operations and WAL mode for performance.
 *
 * @module database
 */

import Database from 'better-sqlite3';
import fs from 'fs/promises';
import path from 'path';
import { getDatabasePath, getBackupPath, setSecureFilePermissions } from './paths';
import type { Token, OperationLog, NetworkType, OperationLogFilter } from '../shared/types';

/** Database instance (null until initialized) */
let db: Database.Database | null = null;

/**
 * Initializes the SQLite database.
 *
 * This function:
 * 1. Creates a backup of the existing database (if any)
 * 2. Opens/creates the database file
 * 3. Enables WAL mode for better concurrency
 * 4. Creates tables and indexes if they don't exist
 * 5. Sets secure file permissions (600)
 *
 * @throws {Error} If database initialization fails
 *
 * @example
 * await initializeDatabase();
 * // Database is now ready to use
 */
export async function initializeDatabase(): Promise<void> {
  const dbPath = getDatabasePath();

  // Create backup before opening
  await createBackup();

  // Open database
  db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  createTables();

  // Set file permissions
  await setSecureFilePermissions(dbPath);
}

function createTables(): void {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      decimals INTEGER NOT NULL DEFAULT 18,
      network TEXT NOT NULL CHECK (network IN ('mainnet', 'testnet')),
      has_minter_role INTEGER NOT NULL DEFAULT 0,
      max_supply TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(address, network)
    )
  `);

  // Operation logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL CHECK (operation_type IN ('deploy', 'mint', 'batch_mint', 'grant_role', 'revoke_role')),
      token_id INTEGER,
      token_address TEXT NOT NULL,
      token_symbol TEXT NOT NULL,
      details TEXT NOT NULL,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirming', 'success', 'failed', 'timeout')),
      network TEXT NOT NULL CHECK (network IN ('mainnet', 'testnet')),
      operator_address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (token_id) REFERENCES tokens(id)
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tokens_network ON tokens(network);
    CREATE INDEX IF NOT EXISTS idx_tokens_address ON tokens(address);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_network ON operation_logs(network);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_token_id ON operation_logs(token_id);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_status ON operation_logs(status);
  `);
}

async function createBackup(): Promise<void> {
  const dbPath = getDatabasePath();
  const backupDir = getBackupPath();

  try {
    await fs.access(dbPath);
  } catch {
    // Database doesn't exist yet, no need to backup
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `data_${timestamp}.db`);

  await fs.copyFile(dbPath, backupPath);

  // Keep only last 3 backups
  const files = await fs.readdir(backupDir);
  const backups = files
    .filter((f) => f.startsWith('data_') && f.endsWith('.db'))
    .sort()
    .reverse();

  for (const backup of backups.slice(3)) {
    await fs.unlink(path.join(backupDir, backup));
  }
}

// ============================================================================
// Token Operations
// ============================================================================

/**
 * Gets all tokens for a specific network.
 *
 * @param network - The network to filter by ('mainnet' or 'testnet')
 * @returns Array of tokens sorted by creation date (newest first)
 * @throws {Error} If database is not initialized
 *
 * @example
 * const tokens = getTokens('mainnet');
 * console.log(tokens.length); // Number of mainnet tokens
 */
export function getTokens(network: NetworkType): Token[] {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const stmt = db.prepare(`
    SELECT id, address, name, symbol, decimals, network,
           has_minter_role as hasMinterRole, max_supply as maxSupply,
           created_at as createdAt, updated_at as updatedAt
    FROM tokens
    WHERE network = ?
    ORDER BY created_at DESC
  `);

  return stmt.all(network) as Token[];
}

/**
 * Gets a token by its address and network.
 *
 * @param address - The token contract address
 * @param network - The network ('mainnet' or 'testnet')
 * @returns The token if found, undefined otherwise
 * @throws {Error} If database is not initialized
 *
 * @example
 * const token = getTokenByAddress('0x1234...', 'mainnet');
 * if (token) {
 *   console.log(token.symbol);
 * }
 */
export function getTokenByAddress(address: string, network: NetworkType): Token | undefined {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const stmt = db.prepare(`
    SELECT id, address, name, symbol, decimals, network,
           has_minter_role as hasMinterRole, max_supply as maxSupply,
           created_at as createdAt, updated_at as updatedAt
    FROM tokens
    WHERE address = ? AND network = ?
  `);

  return stmt.get(address, network) as Token | undefined;
}

/**
 * Inserts a new token into the database.
 *
 * @param token - The token data (without id, createdAt, updatedAt)
 * @returns The newly created token with all fields populated
 * @throws {Error} If database is not initialized
 * @throws {Error} If a token with the same address/network combination exists
 *
 * @example
 * const newToken = insertToken({
 *   address: '0x1234...',
 *   name: 'My Token',
 *   symbol: 'MTK',
 *   decimals: 18,
 *   network: 'testnet',
 *   hasMinterRole: true,
 *   maxSupply: '1000000000000000000000'
 * });
 */
export function insertToken(token: Omit<Token, 'id' | 'createdAt' | 'updatedAt'>): Token {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const stmt = db.prepare(`
    INSERT INTO tokens (address, name, symbol, decimals, network, has_minter_role, max_supply)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    token.address,
    token.name,
    token.symbol,
    token.decimals,
    token.network,
    token.hasMinterRole ? 1 : 0,
    token.maxSupply
  );

  return getTokenByAddress(token.address, token.network)!;
}

/**
 * Updates an existing token.
 *
 * Only hasMinterRole, name, and symbol can be updated.
 * The updated_at field is automatically set to the current time.
 *
 * @param id - The token ID
 * @param updates - Partial token object with fields to update
 * @throws {Error} If database is not initialized
 *
 * @example
 * updateToken(1, { hasMinterRole: true });
 * updateToken(2, { name: 'New Name', symbol: 'NEW' });
 */
export function updateToken(id: number, updates: Partial<Token>): void {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.hasMinterRole !== undefined) {
    fields.push('has_minter_role = ?');
    values.push(updates.hasMinterRole ? 1 : 0);
  }
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.symbol !== undefined) {
    fields.push('symbol = ?');
    values.push(updates.symbol);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`UPDATE tokens SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

// ============================================================================
// Operation Log Operations
// ============================================================================

/**
 * Gets operation logs with optional filtering.
 *
 * Supports filtering by operation type, token ID, network, and date range.
 * Results are sorted by creation date (newest first).
 *
 * @param filter - Optional filter criteria
 * @param filter.operationType - Filter by operation type (e.g., 'deploy', 'mint')
 * @param filter.tokenId - Filter by token ID
 * @param filter.network - Filter by network ('mainnet' or 'testnet')
 * @param filter.startDate - Filter logs created on or after this date (ISO string)
 * @param filter.endDate - Filter logs created on or before this date (ISO string)
 * @returns Array of operation logs matching the filter criteria
 * @throws {Error} If database is not initialized
 *
 * @example
 * // Get all logs
 * const allLogs = getOperationLogs();
 *
 * // Get mint operations for testnet
 * const mintLogs = getOperationLogs({
 *   operationType: 'mint',
 *   network: 'testnet'
 * });
 */
export function getOperationLogs(filter?: OperationLogFilter): OperationLog[] {
  if (!db) {
    throw new Error('Database not initialized');
  }

  let query = `
    SELECT id, operation_type as operationType, token_id as tokenId,
           token_address as tokenAddress, token_symbol as tokenSymbol,
           details, tx_hash as txHash, status, network,
           operator_address as operatorAddress,
           created_at as createdAt, updated_at as updatedAt
    FROM operation_logs
    WHERE 1=1
  `;

  const params: unknown[] = [];

  if (filter?.operationType) {
    query += ' AND operation_type = ?';
    params.push(filter.operationType);
  }
  if (filter?.tokenId) {
    query += ' AND token_id = ?';
    params.push(filter.tokenId);
  }
  if (filter?.network) {
    query += ' AND network = ?';
    params.push(filter.network);
  }
  if (filter?.startDate) {
    query += ' AND created_at >= ?';
    params.push(filter.startDate);
  }
  if (filter?.endDate) {
    query += ' AND created_at <= ?';
    params.push(filter.endDate);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params) as OperationLog[];
}

/**
 * Inserts a new operation log entry.
 *
 * @param log - The operation log data (without id, createdAt, updatedAt)
 * @returns The ID of the newly created log entry
 * @throws {Error} If database is not initialized
 *
 * @example
 * const logId = insertOperationLog({
 *   operationType: 'mint',
 *   tokenId: 1,
 *   tokenAddress: '0x1234...',
 *   tokenSymbol: 'MTK',
 *   details: 'Minted 1000 tokens to 0x5678...',
 *   txHash: '0xabcd...',
 *   status: 'pending',
 *   network: 'testnet',
 *   operatorAddress: '0x9999...'
 * });
 */
export function insertOperationLog(
  log: Omit<OperationLog, 'id' | 'createdAt' | 'updatedAt'>
): number {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const stmt = db.prepare(`
    INSERT INTO operation_logs (
      operation_type, token_id, token_address, token_symbol,
      details, tx_hash, status, network, operator_address
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    log.operationType,
    log.tokenId,
    log.tokenAddress,
    log.tokenSymbol,
    log.details,
    log.txHash,
    log.status,
    log.network,
    log.operatorAddress
  );

  return Number(result.lastInsertRowid);
}

/**
 * Updates an existing operation log.
 *
 * Supports updating status, txHash, tokenAddress, and tokenId.
 * The updated_at field is automatically set to the current time.
 *
 * @param id - The operation log ID
 * @param updates - Object containing fields to update
 * @param updates.status - New status ('pending', 'confirming', 'success', 'failed', 'timeout')
 * @param updates.txHash - Transaction hash
 * @param updates.tokenAddress - Token contract address
 * @param updates.tokenId - Token ID (database reference)
 * @throws {Error} If database is not initialized
 *
 * @example
 * // Update status after transaction confirmation
 * updateOperationLog(1, { status: 'success', txHash: '0xabcd...' });
 *
 * // Link operation to token after deployment
 * updateOperationLog(2, { tokenAddress: '0x1234...', tokenId: 5 });
 */
export function updateOperationLog(
  id: number,
  updates: {
    status?: OperationLog['status'];
    txHash?: string;
    tokenAddress?: string;
    tokenId?: number;
  }
): void {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.status) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.txHash) {
    fields.push('tx_hash = ?');
    values.push(updates.txHash);
  }
  if (updates.tokenAddress) {
    fields.push('token_address = ?');
    values.push(updates.tokenAddress);
  }
  if (updates.tokenId !== undefined) {
    fields.push('token_id = ?');
    values.push(updates.tokenId);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`UPDATE operation_logs SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

/**
 * Gets all pending or confirming operations.
 *
 * Returns operations that are still in progress (status 'pending' or 'confirming').
 * Results are sorted by creation date (oldest first) to process in order.
 *
 * @returns Array of pending/confirming operation logs
 * @throws {Error} If database is not initialized
 *
 * @example
 * const pendingOps = getPendingOperations();
 * for (const op of pendingOps) {
 *   await checkTransactionStatus(op.txHash);
 * }
 */
export function getPendingOperations(): OperationLog[] {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const stmt = db.prepare(`
    SELECT id, operation_type as operationType, token_id as tokenId,
           token_address as tokenAddress, token_symbol as tokenSymbol,
           details, tx_hash as txHash, status, network,
           operator_address as operatorAddress,
           created_at as createdAt, updated_at as updatedAt
    FROM operation_logs
    WHERE status IN ('pending', 'confirming')
    ORDER BY created_at ASC
  `);

  return stmt.all() as OperationLog[];
}

/**
 * Closes the database connection.
 *
 * Should be called when the application is shutting down.
 * Safe to call multiple times.
 *
 * @example
 * app.on('before-quit', () => {
 *   closeDatabase();
 * });
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
