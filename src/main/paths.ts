import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const _APP_NAME = 'easy-token-mint';

/**
 * Get the base data directory based on OS
 * - Windows: %APPDATA%\easy-token-mint\
 * - macOS: ~/Library/Application Support/easy-token-mint/
 * - Linux: ~/.config/easy-token-mint/
 */
export function getDataPath(): string {
  return path.join(app.getPath('userData'));
}

export function getConfigPath(): string {
  return path.join(getDataPath(), 'config.json');
}

export function getDatabasePath(): string {
  return path.join(getDataPath(), 'data.db');
}

export function getWalletPath(): string {
  return path.join(getDataPath(), 'wallet.enc');
}

export function getLogsPath(): string {
  return path.join(getDataPath(), 'logs');
}

export function getBackupPath(): string {
  return path.join(getDataPath(), 'backups');
}

/**
 * Ensure all required data directories exist with proper permissions
 */
export async function ensureDataDirectories(): Promise<void> {
  const dataPath = getDataPath();
  const logsPath = getLogsPath();
  const backupPath = getBackupPath();

  // Create directories
  await fs.mkdir(dataPath, { recursive: true });
  await fs.mkdir(logsPath, { recursive: true });
  await fs.mkdir(backupPath, { recursive: true });

  // Set permissions based on platform
  if (process.platform === 'win32') {
    // Set Windows ACL permissions for data directory only
    // Sub-directories will inherit from parent
    await setWindowsDirectoryPermissions(dataPath);
  } else {
    try {
      // 700 for directories (rwx------)
      await fs.chmod(dataPath, 0o700);
      await fs.chmod(logsPath, 0o700);
      await fs.chmod(backupPath, 0o700);
    } catch (error) {
      console.error('Failed to set directory permissions:', error);
    }
  }
}

/**
 * Set secure file permissions on Windows using icacls
 * Removes inherited permissions and grants full control only to current user
 */
async function setWindowsFilePermissions(filePath: string): Promise<void> {
  try {
    const username = process.env.USERNAME || process.env.USER;
    if (!username) {
      console.warn('Unable to determine username for Windows ACL');
      return;
    }

    // Remove inheritance and grant full control only to current user
    // /inheritance:r - Remove all inherited ACLs
    // /grant:r - Replace existing permissions
    // (F) - Full control
    await execAsync(`icacls "${filePath}" /inheritance:r /grant:r "${username}:(F)"`);
  } catch (error) {
    console.error('Failed to set Windows file permissions:', error);
  }
}

/**
 * Set secure directory permissions on Windows using icacls
 */
async function setWindowsDirectoryPermissions(dirPath: string): Promise<void> {
  try {
    const username = process.env.USERNAME || process.env.USER;
    if (!username) {
      console.warn('Unable to determine username for Windows ACL');
      return;
    }

    // (OI) - Object inherit (files in directory)
    // (CI) - Container inherit (subdirectories)
    // (F) - Full control
    await execAsync(`icacls "${dirPath}" /inheritance:r /grant:r "${username}:(OI)(CI)(F)"`);
  } catch (error) {
    console.error('Failed to set Windows directory permissions:', error);
  }
}

/**
 * Set secure file permissions
 * - Unix: 600 (rw-------)
 * - Windows: Restricts access to current user only
 */
export async function setSecureFilePermissions(filePath: string): Promise<void> {
  if (process.platform === 'win32') {
    await setWindowsFilePermissions(filePath);
  } else {
    try {
      await fs.chmod(filePath, 0o600);
    } catch (error) {
      console.error('Failed to set file permissions:', error);
    }
  }
}
