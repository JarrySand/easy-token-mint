import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) {
    return '';
  }
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatBalance(balance: string, decimals = 4): string {
  const num = parseFloat(balance);
  if (isNaN(num)) {
    return '0';
  }
  return num.toFixed(decimals);
}

// Clipboard auto-clear timer reference
let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;

// Clear interval in milliseconds (30 seconds as per spec.md#7.3.1-④)
const CLIPBOARD_CLEAR_INTERVAL_MS = 30 * 1000;

export async function copyToClipboard(text: string, autoClear = true): Promise<void> {
  // Clear any existing timer
  if (clipboardClearTimer) {
    clearTimeout(clipboardClearTimer);
    clipboardClearTimer = null;
  }

  await navigator.clipboard.writeText(text);

  // Set auto-clear timer for sensitive data
  if (autoClear) {
    clipboardClearTimer = setTimeout(async () => {
      try {
        // Only clear if clipboard still contains the copied text
        const currentContent = await navigator.clipboard.readText();
        if (currentContent === text) {
          await navigator.clipboard.writeText('');
        }
      } catch {
        // Clipboard access may fail if window is not focused
        // Silently ignore
      }
      clipboardClearTimer = null;
    }, CLIPBOARD_CLEAR_INTERVAL_MS);
  }
}

export function clearClipboardTimer(): void {
  if (clipboardClearTimer) {
    clearTimeout(clipboardClearTimer);
    clipboardClearTimer = null;
  }
}
