import { describe, it, expect, vi } from 'vitest';

// Mock blockchain module for isValidAddress
vi.mock('../blockchain', () => ({
  isValidAddress: vi.fn((address: string) => {
    // Simple validation: must be 42 chars starting with 0x
    return /^0x[0-9a-fA-F]{40}$/.test(address);
  }),
}));

import { parseMintCsv, splitIntoBatches, generateFailedCsv } from '../csv-parser';

describe('csv-parser module', () => {
  const validAddress1 = '0x1234567890123456789012345678901234567890';
  const validAddress2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
  const invalidAddress = '0xinvalid';

  describe('parseMintCsv', () => {
    it('TC-CSV-001: should parse CSV with header', () => {
      const csv = `address,amount
${validAddress1},100
${validAddress2},200`;

      const result = parseMintCsv(csv);

      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].address).toBe(validAddress1);
      expect(result.rows[0].amount).toBe('100');
      expect(result.rows[1].address).toBe(validAddress2);
      expect(result.rows[1].amount).toBe('200');
    });

    it('TC-CSV-002: should parse CSV without header', () => {
      const csv = `${validAddress1},100
${validAddress2},200`;

      const result = parseMintCsv(csv);

      expect(result.validCount).toBe(2);
      expect(result.rows[0].lineNumber).toBe(1);
    });

    it('TC-CSV-003: should handle empty CSV', () => {
      const result = parseMintCsv('');

      expect(result.validCount).toBe(0);
      expect(result.invalidCount).toBe(0);
      expect(result.rows).toHaveLength(0);
    });

    it('TC-CSV-004: should handle BOM in UTF-8', () => {
      const csv = `\ufeffaddress,amount
${validAddress1},100`;

      const result = parseMintCsv(csv);

      // BOM should be handled (header detection should still work)
      expect(result.validCount).toBe(1);
    });

    it('TC-CSV-005: should detect invalid addresses', () => {
      const csv = `address,amount
${invalidAddress},100
${validAddress1},200`;

      const result = parseMintCsv(csv);

      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(1);
      expect(result.rows[0].isValid).toBe(false);
      expect(result.rows[0].error).toContain('Invalid Ethereum address');
    });

    it('TC-CSV-006: should detect invalid amounts', () => {
      const csv = `address,amount
${validAddress1},-100
${validAddress2},abc
${validAddress1},0
${validAddress2},100`;

      const result = parseMintCsv(csv);

      expect(result.invalidCount).toBe(3); // negative, non-numeric, zero
      expect(result.validCount).toBe(1);
    });

    it('TC-CSV-007: should skip empty lines', () => {
      const csv = `address,amount
${validAddress1},100

${validAddress2},200

`;

      const result = parseMintCsv(csv);

      expect(result.validCount).toBe(2);
      expect(result.rows).toHaveLength(2);
    });

    it('should handle Windows line endings', () => {
      const csv = `address,amount\r\n${validAddress1},100\r\n${validAddress2},200`;

      const result = parseMintCsv(csv);

      expect(result.validCount).toBe(2);
    });

    it('should handle decimal amounts', () => {
      const csv = `address,amount
${validAddress1},100.5
${validAddress2},0.001`;

      const result = parseMintCsv(csv);

      expect(result.validCount).toBe(2);
      expect(result.rows[0].amount).toBe('100.5');
      expect(result.rows[1].amount).toBe('0.001');
    });

    it('should reject zero amount', () => {
      const csv = `address,amount
${validAddress1},0`;

      const result = parseMintCsv(csv);

      expect(result.invalidCount).toBe(1);
      expect(result.rows[0].error).toContain('Invalid amount');
    });

    it('should reject negative amount', () => {
      const csv = `address,amount
${validAddress1},-50`;

      const result = parseMintCsv(csv);

      expect(result.invalidCount).toBe(1);
      expect(result.rows[0].error).toContain('Invalid amount');
    });

    it('should handle missing amount column', () => {
      const csv = `address,amount
${validAddress1}`;

      const result = parseMintCsv(csv);

      expect(result.invalidCount).toBe(1);
      expect(result.rows[0].error).toContain('Invalid format');
    });

    it('should calculate total amount correctly', () => {
      const csv = `address,amount
${validAddress1},100
${validAddress2},200
${validAddress1},50.5`;

      const result = parseMintCsv(csv);

      expect(parseFloat(result.totalAmount)).toBeCloseTo(350.5, 10);
    });

    it('should track line numbers correctly', () => {
      const csv = `address,amount
${validAddress1},100
${validAddress2},200`;

      const result = parseMintCsv(csv);

      expect(result.rows[0].lineNumber).toBe(2); // Header is line 1
      expect(result.rows[1].lineNumber).toBe(3);
    });

    it('should handle whitespace around values', () => {
      const csv = `address,amount
  ${validAddress1}  ,  100
${validAddress2},200`;

      const result = parseMintCsv(csv);

      expect(result.validCount).toBe(2);
      expect(result.rows[0].address).toBe(validAddress1);
      expect(result.rows[0].amount).toBe('100');
    });

    it('should detect header with "Address" (capitalized)', () => {
      const csv = `Address,Amount
${validAddress1},100`;

      const result = parseMintCsv(csv);

      expect(result.validCount).toBe(1);
      expect(result.rows[0].lineNumber).toBe(2);
    });

    it('should handle very large amounts', () => {
      const csv = `address,amount
${validAddress1},999999999999999999`;

      const result = parseMintCsv(csv);

      expect(result.validCount).toBe(1);
      expect(result.rows[0].amount).toBe('999999999999999999');
    });
  });

  describe('splitIntoBatches', () => {
    it('TC-CSV-009: should not split array smaller than batch size', () => {
      const items = [1, 2, 3, 4, 5];
      const batches = splitIntoBatches(items, 100);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toEqual([1, 2, 3, 4, 5]);
    });

    it('TC-CSV-010: should split array larger than batch size', () => {
      const items = Array.from({ length: 250 }, (_, i) => i);
      const batches = splitIntoBatches(items, 100);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(100);
      expect(batches[1]).toHaveLength(100);
      expect(batches[2]).toHaveLength(50);
    });

    it('TC-CSV-011: should handle exact batch size boundary', () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const batches = splitIntoBatches(items, 100);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(100);
    });

    it('should handle empty array', () => {
      const batches = splitIntoBatches([], 100);

      expect(batches).toHaveLength(0);
    });

    it('should handle batch size of 1', () => {
      const items = [1, 2, 3];
      const batches = splitIntoBatches(items, 1);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toEqual([1]);
      expect(batches[1]).toEqual([2]);
      expect(batches[2]).toEqual([3]);
    });

    it('should preserve item order', () => {
      const items = ['a', 'b', 'c', 'd', 'e'];
      const batches = splitIntoBatches(items, 2);

      expect(batches[0]).toEqual(['a', 'b']);
      expect(batches[1]).toEqual(['c', 'd']);
      expect(batches[2]).toEqual(['e']);
    });

    it('should work with objects', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const batches = splitIntoBatches(items, 2);

      expect(batches[0]).toEqual([{ id: 1 }, { id: 2 }]);
      expect(batches[1]).toEqual([{ id: 3 }]);
    });
  });

  describe('generateFailedCsv', () => {
    it('TC-CSV-012: should generate CSV for failed rows', () => {
      const failedRows = [
        { address: validAddress1, amount: '100', error: 'Insufficient balance' },
        { address: validAddress2, amount: '200', error: 'Contract error' },
      ];

      const csv = generateFailedCsv(failedRows);

      expect(csv).toContain('address,amount,error');
      expect(csv).toContain(validAddress1);
      expect(csv).toContain('Insufficient balance');
      expect(csv).toContain(validAddress2);
      expect(csv).toContain('Contract error');
    });

    it('should escape quotes in error messages', () => {
      const failedRows = [
        { address: validAddress1, amount: '100', error: 'Error with "quotes"' },
      ];

      const csv = generateFailedCsv(failedRows);

      // Quotes should be doubled for CSV escaping
      expect(csv).toContain('""quotes""');
    });

    it('should handle empty failed rows', () => {
      const csv = generateFailedCsv([]);

      expect(csv).toBe('address,amount,error\n');
    });

    it('should handle special characters in error', () => {
      const failedRows = [
        { address: validAddress1, amount: '100', error: 'Error: unexpected, value' },
      ];

      const csv = generateFailedCsv(failedRows);

      expect(csv).toContain('Error: unexpected, value');
    });

    it('should generate parseable CSV', () => {
      const failedRows = [
        { address: validAddress1, amount: '100', error: 'Error 1' },
        { address: validAddress2, amount: '200', error: 'Error 2' },
      ];

      const csv = generateFailedCsv(failedRows);
      const lines = csv.split('\n');

      expect(lines).toHaveLength(3); // header + 2 rows
      expect(lines[0]).toBe('address,amount,error');
    });
  });

  describe('integration scenarios', () => {
    it('should handle realistic CSV data', () => {
      const csv = `address,amount
0x742d35Cc6634C0532925a3b844Bc9e7595f8dEfB,1000.50
0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199,2500
0x1234567890123456789012345678901234567890,100
invalid_address,500
0xabcdefabcdefabcdefabcdefabcdefabcdefabcd,-100`;

      const result = parseMintCsv(csv);

      expect(result.validCount).toBe(3);
      expect(result.invalidCount).toBe(2);
    });

    it('should handle CSV exported from Excel', () => {
      // Excel often adds extra commas and quotes
      const csv = `"address","amount"
"${validAddress1}","100"
"${validAddress2}","200"`;

      // Note: Current implementation doesn't handle quoted values
      // This test documents expected behavior
      const result = parseMintCsv(csv);

      // With quotes, addresses won't match regex
      expect(result.invalidCount).toBe(2);
    });

    it('should batch and track large CSV correctly', () => {
      // Generate 250 rows
      const rows = Array.from({ length: 250 }, (_, i) => `${validAddress1},${i + 1}`);
      const csv = `address,amount\n${rows.join('\n')}`;

      const result = parseMintCsv(csv);
      const batches = splitIntoBatches(
        result.rows.filter((r) => r.isValid),
        100
      );

      expect(result.validCount).toBe(250);
      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(100);
      expect(batches[1]).toHaveLength(100);
      expect(batches[2]).toHaveLength(50);
    });
  });
});
