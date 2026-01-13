import { isValidAddress } from './blockchain';

// Precision for internal calculations (18 decimals like wei)
const PRECISION = 18;
const _PRECISION_MULTIPLIER = BigInt(10 ** PRECISION);

/**
 * Parse decimal string to BigInt with fixed precision
 * Handles strings like "100", "100.5", "0.123456789012345678"
 */
function parseDecimalToBigInt(amount: string): bigint {
  const parts = amount.split('.');
  const integerPart = parts[0] || '0';
  let fractionalPart = parts[1] || '';

  // Pad or truncate fractional part to PRECISION digits
  if (fractionalPart.length > PRECISION) {
    fractionalPart = fractionalPart.slice(0, PRECISION);
  } else {
    fractionalPart = fractionalPart.padEnd(PRECISION, '0');
  }

  // Combine integer and fractional parts
  const combined = integerPart + fractionalPart;
  return BigInt(combined);
}

/**
 * Convert BigInt with fixed precision back to decimal string
 */
function bigIntToDecimalString(value: bigint): string {
  const str = value.toString().padStart(PRECISION + 1, '0');
  const integerPart = str.slice(0, -PRECISION) || '0';
  const fractionalPart = str.slice(-PRECISION);

  // Remove trailing zeros from fractional part
  const trimmedFractional = fractionalPart.replace(/0+$/, '');

  if (trimmedFractional.length === 0) {
    return integerPart;
  }
  return `${integerPart}.${trimmedFractional}`;
}

export interface CsvRow {
  lineNumber: number;
  address: string;
  amount: string;
  isValid: boolean;
  error?: string;
}

export interface CsvParseResult {
  rows: CsvRow[];
  validCount: number;
  invalidCount: number;
  totalAmount: string;
}

/**
 * Parse CSV content for batch minting
 * Expected format: address,amount (with optional header)
 */
export function parseMintCsv(content: string): CsvParseResult {
  const lines = content.trim().split(/\r?\n/);
  const rows: CsvRow[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let totalAmount = BigInt(0);

  // Skip header if present
  let startIndex = 0;
  if (lines.length > 0) {
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('address') || firstLine.includes('amount')) {
      startIndex = 1;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    const lineNumber = i + 1;
    const parts = line.split(',').map(p => p.trim());

    if (parts.length < 2) {
      rows.push({
        lineNumber,
        address: parts[0] || '',
        amount: '',
        isValid: false,
        error: 'Invalid format: expected address,amount',
      });
      invalidCount++;
      continue;
    }

    const address = parts[0];
    const amount = parts[1];

    // Validate address
    if (!isValidAddress(address)) {
      rows.push({
        lineNumber,
        address,
        amount,
        isValid: false,
        error: 'Invalid Ethereum address',
      });
      invalidCount++;
      continue;
    }

    // Validate amount
    if (!isValidAmount(amount)) {
      rows.push({
        lineNumber,
        address,
        amount,
        isValid: false,
        error: 'Invalid amount: must be a positive number',
      });
      invalidCount++;
      continue;
    }

    // Valid row
    rows.push({
      lineNumber,
      address,
      amount,
      isValid: true,
    });
    validCount++;

    // Add to total using precise string-based calculation
    try {
      totalAmount += parseDecimalToBigInt(amount);
    } catch {
      // Ignore parsing errors for total calculation
    }
  }

  // Convert back to decimal string with proper precision
  const totalAmountStr = bigIntToDecimalString(totalAmount);

  return {
    rows,
    validCount,
    invalidCount,
    totalAmount: totalAmountStr,
  };
}

/**
 * Validate amount string
 */
function isValidAmount(amount: string): boolean {
  if (!amount) {
    return false;
  }

  // Allow integer or decimal number
  const numRegex = /^\d+(\.\d+)?$/;
  if (!numRegex.test(amount)) {
    return false;
  }

  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && isFinite(num);
}

/**
 * Split rows into batches of specified size
 */
export function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Generate CSV content for failed mint results
 */
export function generateFailedCsv(
  failedRows: Array<{ address: string; amount: string; error: string }>
): string {
  const header = 'address,amount,error\n';
  const rows = failedRows.map(row =>
    `${row.address},${row.amount},"${row.error.replace(/"/g, '""')}"`
  );
  return header + rows.join('\n');
}
