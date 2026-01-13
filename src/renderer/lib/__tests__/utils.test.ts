import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn, shortenAddress, formatBalance, copyToClipboard, clearClipboardTimer } from '../utils';

describe('utils', () => {
  describe('cn (className merge)', () => {
    it('TC-UTIL-004: should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      expect(cn('base', true && 'active')).toBe('base active');
      expect(cn('base', false && 'active')).toBe('base');
    });

    it('should merge Tailwind classes correctly', () => {
      // twMerge should resolve conflicting classes
      expect(cn('p-2', 'p-4')).toBe('p-4');
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('should handle arrays', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar');
    });

    it('should handle objects', () => {
      expect(cn({ foo: true, bar: false })).toBe('foo');
    });

    it('should handle empty input', () => {
      expect(cn()).toBe('');
      expect(cn('')).toBe('');
    });

    it('should filter out falsy values', () => {
      expect(cn('foo', null, undefined, 'bar')).toBe('foo bar');
    });
  });

  describe('shortenAddress', () => {
    const fullAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEfB';

    it('TC-UTIL-001: should shorten address with default chars (4)', () => {
      const result = shortenAddress(fullAddress);
      expect(result).toBe('0x742d...dEfB');
    });

    it('should use custom char count', () => {
      expect(shortenAddress(fullAddress, 6)).toBe('0x742d35...f8dEfB');
      expect(shortenAddress(fullAddress, 2)).toBe('0x74...fB');
    });

    it('should handle empty address', () => {
      expect(shortenAddress('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(shortenAddress(null as unknown as string)).toBe('');
      expect(shortenAddress(undefined as unknown as string)).toBe('');
    });

    it('should work with short addresses', () => {
      expect(shortenAddress('0x1234', 4)).toBe('0x1234...1234');
    });
  });

  describe('formatBalance', () => {
    it('TC-UTIL-002: should format balance with default decimals (4)', () => {
      expect(formatBalance('1.23456789')).toBe('1.2346');
    });

    it('should use custom decimal places', () => {
      expect(formatBalance('1.23456789', 2)).toBe('1.23');
      expect(formatBalance('1.23456789', 6)).toBe('1.234568');
    });

    it('should handle integer values', () => {
      expect(formatBalance('100')).toBe('100.0000');
      expect(formatBalance('100', 2)).toBe('100.00');
    });

    it('should handle zero', () => {
      expect(formatBalance('0')).toBe('0.0000');
    });

    it('should handle very small numbers', () => {
      expect(formatBalance('0.00001234')).toBe('0.0000');
      expect(formatBalance('0.00001234', 6)).toBe('0.000012');
    });

    it('should handle NaN input', () => {
      expect(formatBalance('not a number')).toBe('0');
      expect(formatBalance('')).toBe('0');
    });

    it('should handle very large numbers', () => {
      expect(formatBalance('1000000.123456')).toBe('1000000.1235');
    });

    it('should round correctly', () => {
      expect(formatBalance('1.55555', 2)).toBe('1.56'); // Round up
      expect(formatBalance('1.55444', 2)).toBe('1.55'); // Round down
    });
  });

  describe('copyToClipboard', () => {
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();

      // Mock navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      clearClipboardTimer();
    });

    it('TC-UTIL-003: should copy text to clipboard', async () => {
      await copyToClipboard('test text');

      expect(mockClipboard.writeText).toHaveBeenCalledWith('test text');
    });

    it('should auto-clear clipboard after 30 seconds', async () => {
      const testText = 'sensitive data';
      mockClipboard.readText.mockResolvedValue(testText);

      await copyToClipboard(testText);

      // Fast forward 30 seconds
      await vi.advanceTimersByTimeAsync(30000);

      // Should have tried to clear
      expect(mockClipboard.writeText).toHaveBeenLastCalledWith('');
    });

    it('should not auto-clear if autoClear is false', async () => {
      await copyToClipboard('test text', false);

      vi.advanceTimersByTime(30000);

      // Should only have been called once (for the copy)
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
    });

    it('should clear previous timer on new copy', async () => {
      await copyToClipboard('first text');

      // Advance 15 seconds
      vi.advanceTimersByTime(15000);

      // Copy new text
      await copyToClipboard('second text');

      // Advance another 20 seconds (total 35 from first copy, 20 from second)
      vi.advanceTimersByTime(20000);

      // First timer should have been cancelled
      // Only the clear from second text timer (not yet fired)
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(2);
    });

    it('should not clear if clipboard content changed', async () => {
      mockClipboard.readText.mockResolvedValue('different content');

      await copyToClipboard('original text');

      await vi.advanceTimersByTimeAsync(30000);

      // Should have checked content
      expect(mockClipboard.readText).toHaveBeenCalled();
      // Should not clear because content is different
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1); // Only the initial copy
    });

    it('should handle clipboard read error gracefully', async () => {
      mockClipboard.readText.mockRejectedValue(new Error('Clipboard not accessible'));

      await copyToClipboard('test text');

      // Should not throw when timer fires
      await expect(vi.advanceTimersByTimeAsync(30000)).resolves.not.toThrow();
    });
  });

  describe('clearClipboardTimer', () => {
    beforeEach(() => {
      vi.useFakeTimers();

      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
          readText: vi.fn().mockResolvedValue(''),
        },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clear pending timer', async () => {
      await copyToClipboard('test');

      clearClipboardTimer();

      // Advance time - timer should not fire
      vi.advanceTimersByTime(30000);

      // writeText should only be called once (for the copy, not the clear)
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call when no timer exists', () => {
      expect(() => clearClipboardTimer()).not.toThrow();
    });
  });
});
