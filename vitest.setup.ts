import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock Electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      const paths: Record<string, string> = {
        userData: '/mock/userData',
        appData: '/mock/appData',
        home: '/mock/home',
      };
      return paths[name] || '/mock/default';
    }),
    getName: vi.fn(() => 'easy-token-mint'),
    getVersion: vi.fn(() => '1.0.0'),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(),
  },
  clipboard: {
    writeText: vi.fn(),
    readText: vi.fn(),
  },
}));

// Mock better-sqlite3 with in-memory database support
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      pragma: vi.fn(),
      exec: vi.fn(),
      prepare: vi.fn().mockReturnValue({
        run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
        get: vi.fn(),
        all: vi.fn().mockReturnValue([]),
      }),
      close: vi.fn(),
    })),
  };
});

// Mock fs/promises for file operations
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    access: vi.fn().mockRejectedValue(new Error('ENOENT')),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    copyFile: vi.fn(),
    readdir: vi.fn().mockResolvedValue([]),
    unlink: vi.fn(),
    chmod: vi.fn(),
  };
});

// Mock window.electron for renderer tests
const mockElectronAPI = {
  isInitialized: vi.fn().mockResolvedValue(false),
  getConfig: vi.fn().mockResolvedValue({
    version: '1.0.0',
    network: 'mainnet',
    language: 'ja',
    alertThresholds: { warning: 1.0, danger: 0.1 },
    walletAddress: null,
  }),
  verifyPin: vi.fn().mockResolvedValue({ success: true }),
  setPin: vi.fn().mockResolvedValue({ success: true }),
  changePin: vi.fn().mockResolvedValue({ success: true }),
  importPrivateKey: vi.fn().mockResolvedValue({ success: true, address: '0x123' }),
  getWalletInfo: vi.fn().mockResolvedValue(null),
  getBalance: vi.fn().mockResolvedValue('0'),
  getTokens: vi.fn().mockResolvedValue([]),
  addToken: vi.fn().mockResolvedValue({}),
  deployToken: vi.fn().mockResolvedValue({ address: '0x123', txHash: '0xabc' }),
  mint: vi.fn().mockResolvedValue({ txHash: '0xabc' }),
  batchMint: vi.fn().mockResolvedValue({ txHash: '0xabc', results: [] }),
  getOperationLogs: vi.fn().mockResolvedValue([]),
  exportOperationLogs: vi.fn().mockResolvedValue(''),
  setNetwork: vi.fn().mockResolvedValue(undefined),
  setLanguage: vi.fn().mockResolvedValue(undefined),
  setAlertThresholds: vi.fn().mockResolvedValue(undefined),
  openLogsFolder: vi.fn().mockResolvedValue(undefined),
  openExternalLink: vi.fn().mockResolvedValue(undefined),
};

// Set up window.electron for renderer tests
if (typeof window !== 'undefined') {
  (window as { electron?: typeof mockElectronAPI }).electron = mockElectronAPI;
}

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'ja',
      changeLanguage: vi.fn(),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

// Global test utilities
global.console = {
  ...console,
  // Suppress console during tests unless debugging
  // log: vi.fn(),
  // debug: vi.fn(),
  // info: vi.fn(),
  // warn: vi.fn(),
  // error: vi.fn(),
};
