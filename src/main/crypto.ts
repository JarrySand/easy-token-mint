/**
 * @module crypto
 * @description Cryptographic utilities for secure wallet encryption and PIN management.
 *
 * This module implements AES-256-GCM authenticated encryption for private key storage,
 * with PBKDF2-SHA256 key derivation following OWASP 2024 recommendations.
 *
 * Security features:
 * - AES-256-GCM for authenticated encryption (prevents tampering)
 * - PBKDF2 with 600,000 iterations (OWASP 2024 recommended minimum)
 * - Cryptographically secure random salt and IV generation
 * - Memory zeroing of sensitive key material
 * - Timing-safe string comparison
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import { getWalletPath, setSecureFilePermissions } from './paths';

/** Encryption algorithm: AES-256 in GCM mode (authenticated encryption) */
const ALGORITHM = 'aes-256-gcm';
/** Key length in bytes (256 bits) */
const KEY_LENGTH = 32;
/** Initialization vector length in bytes (96 bits - GCM recommended) */
const IV_LENGTH = 12;
/** Authentication tag length in bytes (128 bits) */
const AUTH_TAG_LENGTH = 16;
/** Salt length in bytes (256 bits) */
const SALT_LENGTH = 32;

/** PBKDF2 iteration count (OWASP 2024 recommended minimum) */
const PBKDF2_ITERATIONS = 600000;
/** PBKDF2 hash algorithm */
const PBKDF2_DIGEST = 'sha256';

/**
 * Structure representing an encrypted wallet stored on disk.
 * All binary data is hex-encoded for JSON serialization.
 */
interface EncryptedWallet {
  /** Schema version for future migration support */
  version: number;
  /** Hex-encoded PBKDF2 salt (256 bits) */
  salt: string;
  /** Hex-encoded AES-GCM initialization vector (96 bits) */
  iv: string;
  /** Hex-encoded GCM authentication tag (128 bits) */
  authTag: string;
  /** Hex-encoded encrypted private key ciphertext */
  encryptedData: string;
}

/**
 * Derives an encryption key from a PIN using PBKDF2-SHA256.
 *
 * @param pin - The user's PIN (minimum 8 characters, alphanumeric)
 * @param salt - A cryptographically random salt (256 bits)
 * @returns A 256-bit derived key suitable for AES-256
 * @internal
 */
function deriveKey(pin: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(pin, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

/**
 * Encrypts a private key using AES-256-GCM with a PIN-derived key.
 *
 * @param privateKey - The Ethereum private key to encrypt (hex string with 0x prefix)
 * @param pin - The user's PIN for key derivation
 * @returns An encrypted wallet structure ready for storage
 *
 * @example
 * ```typescript
 * const encrypted = encryptPrivateKey('0x123...abc', 'MySecurePin123');
 * await saveEncryptedWallet(encrypted);
 * ```
 */
export function encryptPrivateKey(privateKey: string, pin: string): EncryptedWallet {
  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from PIN
  const key = deriveKey(pin, salt);

  // Encrypt
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Zero out key from memory
  key.fill(0);

  return {
    version: 1,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encryptedData: encrypted.toString('hex'),
  };
}

/**
 * Decrypts a private key using AES-256-GCM with a PIN-derived key.
 *
 * @param wallet - The encrypted wallet structure loaded from storage
 * @param pin - The user's PIN for key derivation
 * @returns The decrypted private key (hex string with 0x prefix)
 * @throws {Error} If decryption fails (wrong PIN or data corruption)
 *
 * @example
 * ```typescript
 * const wallet = await loadEncryptedWallet();
 * if (wallet) {
 *   const privateKey = decryptPrivateKey(wallet, userPin);
 * }
 * ```
 */
export function decryptPrivateKey(wallet: EncryptedWallet, pin: string): string {
  const salt = Buffer.from(wallet.salt, 'hex');
  const iv = Buffer.from(wallet.iv, 'hex');
  const authTag = Buffer.from(wallet.authTag, 'hex');
  const encryptedData = Buffer.from(wallet.encryptedData, 'hex');

  // Derive key from PIN
  const key = deriveKey(pin, salt);

  // Decrypt
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted: string;
  try {
    decrypted = decipher.update(encryptedData).toString('utf8') + decipher.final('utf8');
  } finally {
    // Zero out key from memory
    key.fill(0);
  }

  return decrypted;
}

/**
 * Save encrypted wallet to file
 */
export async function saveEncryptedWallet(wallet: EncryptedWallet): Promise<void> {
  const walletPath = getWalletPath();
  await fs.writeFile(walletPath, JSON.stringify(wallet, null, 2), 'utf8');
  await setSecureFilePermissions(walletPath);
}

/**
 * Load encrypted wallet from file
 */
export async function loadEncryptedWallet(): Promise<EncryptedWallet | null> {
  const walletPath = getWalletPath();
  try {
    const data = await fs.readFile(walletPath, 'utf8');
    return JSON.parse(data) as EncryptedWallet;
  } catch {
    return null;
  }
}

/**
 * Check if wallet file exists
 */
export async function walletExists(): Promise<boolean> {
  const walletPath = getWalletPath();
  try {
    await fs.access(walletPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate PIN format
 * Requirements:
 * - Minimum 8 characters
 * - Must contain at least one letter
 * - Must contain at least one number
 */
export function validatePinFormat(pin: string): { valid: boolean; message?: string } {
  if (pin.length < 8) {
    return { valid: false, message: 'PIN must be at least 8 characters long' };
  }

  if (!/[a-zA-Z]/.test(pin)) {
    return { valid: false, message: 'PIN must contain at least one letter' };
  }

  if (!/[0-9]/.test(pin)) {
    return { valid: false, message: 'PIN must contain at least one number' };
  }

  return { valid: true };
}

/**
 * Calculate PIN strength (0-100)
 */
export function calculatePinStrength(pin: string): number {
  let score = 0;

  // Length scoring
  if (pin.length >= 8) score += 20;
  if (pin.length >= 12) score += 10;
  if (pin.length >= 16) score += 10;

  // Character variety
  if (/[a-z]/.test(pin)) score += 10;
  if (/[A-Z]/.test(pin)) score += 10;
  if (/[0-9]/.test(pin)) score += 10;
  if (/[^a-zA-Z0-9]/.test(pin)) score += 15;

  // Deductions for weak patterns
  if (/(.)\1{2,}/.test(pin)) score -= 10; // Repeated characters
  if (/^(123|abc|qwerty)/i.test(pin)) score -= 20; // Common sequences

  return Math.max(0, Math.min(100, score));
}

/**
 * Zero out sensitive string from memory
 * Note: This is best-effort in JavaScript due to string immutability
 */
export function zeroOutString(str: string): void {
  // In JavaScript, strings are immutable, so we can't truly zero them out
  // This is documented as a limitation. For true security, consider using
  // Buffer or TypedArray for sensitive data
  // The best we can do is let the string go out of scope for GC
}

/**
 * Securely compare two strings (timing-safe)
 */
export function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    // Still do comparison to prevent timing attack
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}
