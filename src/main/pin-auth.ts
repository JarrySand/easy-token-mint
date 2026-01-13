/**
 * @module pin-auth
 * @description PIN-based authentication and session management.
 *
 * This module handles:
 * - PIN verification with rate limiting (3 attempts, then progressive lockout)
 * - Session timeout management (configurable, default 15 minutes)
 * - Secure private key caching in memory
 * - PIN change functionality
 *
 * Security features:
 * - Progressive lockout: 5 min → 10 min → 20 min → 30 min (max)
 * - Automatic session timeout on inactivity
 * - In-memory key storage only (never persisted in plaintext)
 *
 * @example
 * ```typescript
 * // Verify PIN and unlock
 * const result = await verifyPin('MySecurePin123');
 * if (result.success) {
 *   const privateKey = getCachedPrivateKey();
 * }
 *
 * // Lock the app
 * lockApp();
 * ```
 */

import {
  loadEncryptedWallet,
  decryptPrivateKey,
  encryptPrivateKey,
  saveEncryptedWallet,
  validatePinFormat,
} from './crypto';

/** Internal authentication state */
interface AuthState {
  failedAttempts: number;
  lockUntil: number | null;
  consecutiveLocks: number;
  lastActivityTime: number | null;
}

const MAX_ATTEMPTS = 3;
const BASE_LOCK_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_LOCK_DURATION = 30 * 60 * 1000; // 30 minutes

let authState: AuthState = {
  failedAttempts: 0,
  lockUntil: null,
  consecutiveLocks: 0,
  lastActivityTime: null,
};

// Cached private key (only kept in memory while app is running)
let cachedPrivateKey: string | null = null;

// Session timeout in minutes (0 = disabled)
let sessionTimeoutMinutes = 15;

/**
 * Set session timeout configuration
 */
export function setSessionTimeout(minutes: number): void {
  sessionTimeoutMinutes = minutes;
}

/**
 * Update last activity timestamp
 */
export function updateActivity(): void {
  if (cachedPrivateKey !== null) {
    authState.lastActivityTime = Date.now();
  }
}

/**
 * Check if session has timed out due to inactivity
 */
export function isSessionTimedOut(): boolean {
  if (sessionTimeoutMinutes <= 0) {
    return false;
  }
  if (cachedPrivateKey === null) {
    return false;
  }
  if (authState.lastActivityTime === null) {
    return false;
  }

  const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
  const elapsed = Date.now() - authState.lastActivityTime;
  return elapsed >= timeoutMs;
}

/**
 * Check if session is active and not timed out
 * Auto-locks if session has timed out
 */
export function checkSession(): boolean {
  if (cachedPrivateKey === null) {
    return false;
  }

  if (isSessionTimedOut()) {
    lockApp();
    return false;
  }

  return true;
}

/**
 * Check if account is currently locked
 */
export function isLocked(): boolean {
  if (authState.lockUntil === null) {
    return false;
  }
  if (Date.now() >= authState.lockUntil) {
    // Lock expired
    authState.lockUntil = null;
    return false;
  }
  return true;
}

/**
 * Get remaining lock time in milliseconds
 */
export function getRemainingLockTime(): number {
  if (authState.lockUntil === null) {
    return 0;
  }
  return Math.max(0, authState.lockUntil - Date.now());
}

/**
 * Verify PIN and unlock private key
 */
export async function verifyPin(
  pin: string
): Promise<{ success: boolean; remainingAttempts?: number; lockUntil?: number }> {
  // Check if locked
  if (isLocked()) {
    return { success: false, lockUntil: authState.lockUntil! };
  }

  // Load encrypted wallet
  const wallet = await loadEncryptedWallet();
  if (!wallet) {
    return { success: false };
  }

  try {
    // Try to decrypt
    const privateKey = decryptPrivateKey(wallet, pin);

    // Success - cache the private key
    cachedPrivateKey = privateKey;
    authState.failedAttempts = 0;
    authState.consecutiveLocks = 0;
    authState.lastActivityTime = Date.now();

    return { success: true };
  } catch {
    // Decryption failed - wrong PIN
    authState.failedAttempts++;

    if (authState.failedAttempts >= MAX_ATTEMPTS) {
      // Lock the account
      authState.consecutiveLocks++;
      const lockDuration = Math.min(
        BASE_LOCK_DURATION * Math.pow(2, authState.consecutiveLocks - 1),
        MAX_LOCK_DURATION
      );
      authState.lockUntil = Date.now() + lockDuration;
      authState.failedAttempts = 0;

      return { success: false, lockUntil: authState.lockUntil };
    }

    return {
      success: false,
      remainingAttempts: MAX_ATTEMPTS - authState.failedAttempts,
    };
  }
}

/**
 * Get cached private key (must be authenticated first)
 */
export function getCachedPrivateKey(): string | null {
  return cachedPrivateKey;
}

/**
 * Clear cached private key
 */
export function clearCachedPrivateKey(): void {
  cachedPrivateKey = null;
}

/**
 * Change PIN
 */
export async function changePin(
  currentPin: string,
  newPin: string
): Promise<{ success: boolean; message?: string }> {
  // Validate new PIN format
  const validation = validatePinFormat(newPin);
  if (!validation.valid) {
    return { success: false, message: validation.message };
  }

  // Verify current PIN
  const wallet = await loadEncryptedWallet();
  if (!wallet) {
    return { success: false, message: 'Wallet not found' };
  }

  let privateKey: string;
  try {
    privateKey = decryptPrivateKey(wallet, currentPin);
  } catch {
    return { success: false, message: 'Current PIN is incorrect' };
  }

  // Re-encrypt with new PIN
  const newWallet = encryptPrivateKey(privateKey, newPin);
  await saveEncryptedWallet(newWallet);

  // Update cached private key
  cachedPrivateKey = privateKey;

  return { success: true };
}

/**
 * Lock the app (clear cached key)
 */
export function lockApp(): void {
  clearCachedPrivateKey();
}

/**
 * Reset auth state (for testing)
 */
export function resetAuthState(): void {
  authState = {
    failedAttempts: 0,
    lockUntil: null,
    consecutiveLocks: 0,
    lastActivityTime: null,
  };
  cachedPrivateKey = null;
}
