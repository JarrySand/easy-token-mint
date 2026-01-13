import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock paths module before importing crypto module
vi.mock('../paths', () => ({
  getWalletPath: vi.fn(() => '/mock/wallet.enc'),
  setSecureFilePermissions: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking
import {
  encryptPrivateKey,
  decryptPrivateKey,
  validatePinFormat,
  calculatePinStrength,
  secureCompare,
} from '../crypto';

describe('crypto module', () => {
  // Test private key (DO NOT use real private keys in tests)
  const testPrivateKey = '0x' + 'a'.repeat(64);
  const validPin = 'Test1234';

  describe('encryptPrivateKey / decryptPrivateKey', () => {
    it('TC-CRYPTO-001: should encrypt and decrypt private key correctly', () => {
      const encrypted = encryptPrivateKey(testPrivateKey, validPin);
      const decrypted = decryptPrivateKey(encrypted, validPin);

      expect(decrypted).toBe(testPrivateKey);
    });

    it('TC-CRYPTO-002: should fail to decrypt with wrong PIN', () => {
      const encrypted = encryptPrivateKey(testPrivateKey, validPin);

      expect(() => decryptPrivateKey(encrypted, 'WrongPin1')).toThrow();
    });

    it('TC-CRYPTO-003: should fail to decrypt corrupted data', () => {
      const encrypted = encryptPrivateKey(testPrivateKey, validPin);
      // Corrupt the encrypted data
      encrypted.encryptedData = 'corrupted' + encrypted.encryptedData.slice(9);

      expect(() => decryptPrivateKey(encrypted, validPin)).toThrow();
    });

    it('TC-CRYPTO-004: should handle empty private key', () => {
      const encrypted = encryptPrivateKey('', validPin);
      const decrypted = decryptPrivateKey(encrypted, validPin);

      expect(decrypted).toBe('');
    });

    it('should return correct encrypted wallet structure', () => {
      const encrypted = encryptPrivateKey(testPrivateKey, validPin);

      expect(encrypted).toHaveProperty('version', 1);
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('encryptedData');

      // Verify hex encoding
      expect(encrypted.salt).toMatch(/^[0-9a-f]+$/);
      expect(encrypted.iv).toMatch(/^[0-9a-f]+$/);
      expect(encrypted.authTag).toMatch(/^[0-9a-f]+$/);
      expect(encrypted.encryptedData).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique salt and IV for each encryption', () => {
      const encrypted1 = encryptPrivateKey(testPrivateKey, validPin);
      const encrypted2 = encryptPrivateKey(testPrivateKey, validPin);

      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should produce different ciphertext for same plaintext due to random IV', () => {
      const encrypted1 = encryptPrivateKey(testPrivateKey, validPin);
      const encrypted2 = encryptPrivateKey(testPrivateKey, validPin);

      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
    });
  });

  describe('validatePinFormat', () => {
    it('TC-CRYPTO-005: should accept valid PIN (8+ chars, alphanumeric)', () => {
      expect(validatePinFormat('Test1234')).toEqual({ valid: true });
      expect(validatePinFormat('Abcd1234567')).toEqual({ valid: true });
      expect(validatePinFormat('MyP@ss123')).toEqual({ valid: true });
    });

    it('TC-CRYPTO-006: should reject PIN shorter than 8 characters', () => {
      const result = validatePinFormat('Test123');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least 8 characters');
    });

    it('TC-CRYPTO-007: should reject PIN without letters', () => {
      const result = validatePinFormat('12345678');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least one letter');
    });

    it('TC-CRYPTO-008: should reject PIN without numbers', () => {
      const result = validatePinFormat('TestTest');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least one number');
    });

    it('should accept PIN with special characters', () => {
      expect(validatePinFormat('Test@123!')).toEqual({ valid: true });
    });

    it('should accept PIN with exactly 8 characters', () => {
      expect(validatePinFormat('Test1234')).toEqual({ valid: true });
    });
  });

  describe('calculatePinStrength', () => {
    it('TC-CRYPTO-009: should return high score for strong PIN', () => {
      // Long PIN with mixed case, numbers, and special chars
      const strength = calculatePinStrength('MyStr0ng!Pass');

      expect(strength).toBeGreaterThanOrEqual(60);
    });

    it('TC-CRYPTO-010: should return lower score for weak PIN', () => {
      // Short PIN with pattern
      const strength = calculatePinStrength('abc12345');

      expect(strength).toBeLessThan(50);
    });

    it('should add points for length >= 8', () => {
      const short = calculatePinStrength('Ab1');
      const medium = calculatePinStrength('Abcdefg1');

      // Both have same character types, but medium is 8+ chars which adds 20 points
      expect(medium).toBeGreaterThanOrEqual(short);
    });

    it('should add points for length >= 12', () => {
      const medium = calculatePinStrength('Abcdefg1');
      const long = calculatePinStrength('Abcdefghijk1');

      expect(long).toBeGreaterThan(medium);
    });

    it('should add points for length >= 16', () => {
      const long = calculatePinStrength('Abcdefghijk1');
      const veryLong = calculatePinStrength('Abcdefghijklmno1');

      expect(veryLong).toBeGreaterThan(long);
    });

    it('should add points for lowercase letters', () => {
      const withoutLower = calculatePinStrength('ABCD1234');
      const withLower = calculatePinStrength('ABCd1234');

      expect(withLower).toBeGreaterThan(withoutLower);
    });

    it('should add points for uppercase letters', () => {
      const withoutUpper = calculatePinStrength('abcd1234');
      const withUpper = calculatePinStrength('Abcd1234');

      expect(withUpper).toBeGreaterThan(withoutUpper);
    });

    it('should add points for numbers', () => {
      const withoutNum = calculatePinStrength('Abcdefgh');
      const withNum = calculatePinStrength('Abcdefg1');

      expect(withNum).toBeGreaterThan(withoutNum);
    });

    it('should add points for special characters', () => {
      const withoutSpecial = calculatePinStrength('Abcd1234');
      const withSpecial = calculatePinStrength('Abcd123!');

      expect(withSpecial).toBeGreaterThan(withoutSpecial);
    });

    it('should deduct points for repeated characters', () => {
      // Test that repeated characters pattern triggers a penalty
      // Use 'Xyzw1234' to avoid common sequence penalty (abc, 123, qwerty)
      // 'Xyzw1234': length>=8(20) + lower(10) + upper(10) + num(10) = 50
      // 'Xzzz1234': length>=8(20) + lower(10) + upper(10) + num(10) - repeat(10) = 40
      const noRepeat = calculatePinStrength('Xyzw1234');
      const withRepeat = calculatePinStrength('Xzzz1234'); // 'zzz' triggers -10

      // Both should have similar base scores, but withRepeat loses 10 for repeated chars
      expect(noRepeat).toBe(50);
      expect(withRepeat).toBe(40);
      expect(withRepeat).toBeLessThan(noRepeat);
    });

    it('should deduct points for common sequences', () => {
      const noSequence = calculatePinStrength('Xyzw1234');
      const withSequence = calculatePinStrength('123abc!@');

      expect(withSequence).toBeLessThan(noSequence);
    });

    it('should return score between 0 and 100', () => {
      const veryWeak = calculatePinStrength('aaa');
      const veryStrong = calculatePinStrength('MyV3ry$tr0ng!P@ssw0rd');

      expect(veryWeak).toBeGreaterThanOrEqual(0);
      expect(veryWeak).toBeLessThanOrEqual(100);
      expect(veryStrong).toBeGreaterThanOrEqual(0);
      expect(veryStrong).toBeLessThanOrEqual(100);
    });
  });

  describe('secureCompare', () => {
    it('TC-CRYPTO-011: should return true for identical strings', () => {
      expect(secureCompare('test123', 'test123')).toBe(true);
      expect(secureCompare('', '')).toBe(true);
      expect(secureCompare('a'.repeat(100), 'a'.repeat(100))).toBe(true);
    });

    it('TC-CRYPTO-012: should return false for different strings', () => {
      expect(secureCompare('test123', 'test124')).toBe(false);
      expect(secureCompare('test123', 'Test123')).toBe(false);
      expect(secureCompare('test', 'test123')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(secureCompare('short', 'longer string')).toBe(false);
      expect(secureCompare('longer string', 'short')).toBe(false);
    });

    it('should handle unicode characters', () => {
      expect(secureCompare('hello日本語', 'hello日本語')).toBe(true);
      expect(secureCompare('hello日本語', 'hello日本语')).toBe(false);
    });

    it('should handle special characters', () => {
      expect(secureCompare('!@#$%^&*()', '!@#$%^&*()')).toBe(true);
      expect(secureCompare('!@#$%^&*()', '!@#$%^&*()_')).toBe(false);
    });
  });

  describe('encryption edge cases', () => {
    it('should handle very long private keys', () => {
      const longKey = '0x' + 'f'.repeat(1000);
      const encrypted = encryptPrivateKey(longKey, validPin);
      const decrypted = decryptPrivateKey(encrypted, validPin);

      expect(decrypted).toBe(longKey);
    });

    it('should handle special characters in private key', () => {
      const specialKey = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = encryptPrivateKey(specialKey, validPin);
      const decrypted = decryptPrivateKey(encrypted, validPin);

      expect(decrypted).toBe(specialKey);
    });

    it('should handle unicode in private key', () => {
      const unicodeKey = '日本語テスト🎉';
      const encrypted = encryptPrivateKey(unicodeKey, validPin);
      const decrypted = decryptPrivateKey(encrypted, validPin);

      expect(decrypted).toBe(unicodeKey);
    });

    it('should fail with tampered authTag', () => {
      const encrypted = encryptPrivateKey(testPrivateKey, validPin);
      // Tamper with auth tag
      const tamperedTag = encrypted.authTag.slice(0, -2) + '00';
      encrypted.authTag = tamperedTag;

      expect(() => decryptPrivateKey(encrypted, validPin)).toThrow();
    });

    it('should fail with tampered IV', () => {
      const encrypted = encryptPrivateKey(testPrivateKey, validPin);
      // Tamper with IV
      const tamperedIV = encrypted.iv.slice(0, -2) + '00';
      encrypted.iv = tamperedIV;

      expect(() => decryptPrivateKey(encrypted, validPin)).toThrow();
    });

    it('should fail with tampered salt', () => {
      const encrypted = encryptPrivateKey(testPrivateKey, validPin);
      // Tamper with salt
      const tamperedSalt = encrypted.salt.slice(0, -2) + '00';
      encrypted.salt = tamperedSalt;

      expect(() => decryptPrivateKey(encrypted, validPin)).toThrow();
    });
  });
});
