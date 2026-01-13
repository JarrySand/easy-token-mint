# Easy Token Mint - Testing Guide

This document provides guidelines for writing and running tests in Easy Token Mint.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Mocking Strategies](#mocking-strategies)
6. [Test Patterns](#test-patterns)
7. [Coverage Requirements](#coverage-requirements)

---

## Testing Philosophy

### Principles

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Isolation**: Each test should be independent and not affect others
3. **Readability**: Tests serve as documentation - make them clear
4. **Fast Feedback**: Tests should run quickly for rapid iteration
5. **Comprehensive**: Cover happy paths, edge cases, and error conditions

### Test Pyramid

```
           ┌─────────────┐
           │    E2E      │  ← Manual (documented in manual-test-procedures.md)
           ├─────────────┤
           │ Integration │  ← IPC handlers, blockchain interactions
       ────┼─────────────┼────
           │    Unit     │  ← Core logic, utilities, pure functions
           └─────────────┘
```

---

## Test Structure

### Directory Layout

```
src/
├── main/
│   └── __tests__/
│       ├── blockchain.test.ts
│       ├── config.test.ts
│       ├── crypto.test.ts
│       ├── csv-parser.test.ts
│       ├── database.test.ts
│       ├── ipc-handlers.test.ts
│       └── pin-auth.test.ts
├── renderer/
│   ├── components/
│   │   └── __tests__/
│   │       ├── MintDialog.test.tsx
│   │       └── ...
│   ├── pages/
│   │   └── __tests__/
│   │       ├── PinPage.test.tsx
│   │       └── ...
│   ├── hooks/
│   │   └── __tests__/
│   │       └── useApp.test.ts
│   └── lib/
│       └── __tests__/
│           └── utils.test.ts
└── test/                    # Smart contract tests
    ├── MintableToken.test.ts
    └── BatchMinter.test.ts
```

### File Naming Convention

- Test files: `*.test.ts` or `*.test.tsx`
- Test IDs: `TC-{MODULE}-{NUMBER}` (e.g., `TC-CRYPTO-001`)

---

## Running Tests

### Commands

```bash
# Run all tests in watch mode
npm test

# Run all tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/main/__tests__/crypto.test.ts

# Run tests matching pattern
npm test -- --testPathPattern="crypto"

# Run smart contract tests
npm run test:contracts
```

### Configuration

Tests are configured in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',  // 'jsdom' for renderer tests
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    testTimeout: 10000,
  },
});
```

---

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('module name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('function name', () => {
    it('TC-XXX-001: should do something when condition', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      // ...
    });
  });
});
```

### React Component Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentUnderTest } from '../ComponentUnderTest';

describe('ComponentUnderTest', () => {
  it('should render correctly', () => {
    render(<ComponentUnderTest prop="value" />);

    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ComponentUnderTest onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox'), 'input value');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledWith('input value');
  });

  it('should show loading state', async () => {
    render(<ComponentUnderTest loading />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
```

### Async Tests

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();

  expect(result).toBe('expected');
});

it('should handle async with waitFor', async () => {
  render(<AsyncComponent />);

  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

---

## Mocking Strategies

### Module Mocking

```typescript
// Mock entire module
vi.mock('../paths', () => ({
  getConfigPath: vi.fn(() => '/mock/config.json'),
  getWalletPath: vi.fn(() => '/mock/wallet.enc'),
  setSecureFilePermissions: vi.fn().mockResolvedValue(undefined),
}));
```

### Partial Module Mocking

```typescript
import * as blockchain from '../blockchain';

vi.spyOn(blockchain, 'getBalance').mockResolvedValue('10.5');
```

### Electron Mocking

```typescript
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  shell: {
    openPath: vi.fn().mockResolvedValue(''),
    openExternal: vi.fn().mockResolvedValue(undefined),
  },
}));
```

### Database Mocking (In-Memory)

```typescript
vi.mock('../paths', () => ({
  getDatabasePath: vi.fn(() => ':memory:'),  // Use in-memory SQLite
  getBackupPath: vi.fn(() => '/mock/backup'),
  setSecureFilePermissions: vi.fn().mockResolvedValue(undefined),
}));
```

### Window.electronAPI Mocking

```typescript
const mockElectronAPI = {
  verifyPin: vi.fn(),
  getConfig: vi.fn(),
  getTokens: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal('window', {
    electronAPI: mockElectronAPI,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

### Timer Mocking

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('should timeout after 5 minutes', () => {
  const callback = vi.fn();
  setTimeoutFunction(callback);

  vi.advanceTimersByTime(5 * 60 * 1000);

  expect(callback).toHaveBeenCalled();
});
```

---

## Test Patterns

### IPC Handler Testing Pattern

```typescript
// Store registered handlers
const handlers: Record<string, Function> = {};

vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => {
  handlers[channel] = handler;
  return undefined as unknown as Electron.IpcMain;
});

describe('IPC Handlers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach(key => delete handlers[key]);

    vi.resetModules();
    const { registerIpcHandlers } = await import('../ipc-handlers');
    registerIpcHandlers();
  });

  it('should handle auth:verifyPin', async () => {
    const result = await handlers['auth:verifyPin']({}, 'ValidPin123');
    expect(result).toEqual({ success: true });
  });
});
```

### Database Testing Pattern

```typescript
let initializeDatabase: () => Promise<void>;
let insertToken: (token: TokenInput) => Token;
let closeDatabase: () => void;

beforeEach(async () => {
  vi.resetModules();

  const dbModule = await import('../database');
  initializeDatabase = dbModule.initializeDatabase;
  insertToken = dbModule.insertToken;
  closeDatabase = dbModule.closeDatabase;

  await initializeDatabase();  // Creates fresh in-memory DB
});

afterEach(() => {
  closeDatabase();  // Important: close DB connection
});
```

### Crypto Testing Pattern

```typescript
describe('encryption', () => {
  const testPrivateKey = '0x' + 'a'.repeat(64);  // Never use real keys
  const validPin = 'Test1234';

  it('should encrypt and decrypt correctly', () => {
    const encrypted = encryptPrivateKey(testPrivateKey, validPin);
    const decrypted = decryptPrivateKey(encrypted, validPin);

    expect(decrypted).toBe(testPrivateKey);
  });

  it('should fail with wrong PIN', () => {
    const encrypted = encryptPrivateKey(testPrivateKey, validPin);

    expect(() => decryptPrivateKey(encrypted, 'WrongPin1')).toThrow();
  });
});
```

### React Hook Testing Pattern

```typescript
import { renderHook, act } from '@testing-library/react';
import { useApp } from '../useApp';

describe('useApp', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: {
        isInitialized: vi.fn().mockResolvedValue(true),
        getConfig: vi.fn().mockResolvedValue({ network: 'testnet' }),
      },
    });
  });

  it('should initialize state', async () => {
    const { result } = renderHook(() => useApp());

    expect(result.current.state).toBe('loading');

    await act(async () => {
      // Wait for initialization
    });

    expect(result.current.state).toBe('pin');
  });
});
```

---

## Coverage Requirements

### Target Coverage

| Module | Target | Priority |
|--------|--------|----------|
| crypto.ts | 95%+ | P0 (Critical) |
| pin-auth.ts | 90%+ | P0 (Critical) |
| blockchain.ts | 70%+ | P1 (High) |
| database.ts | 85%+ | P1 (High) |
| ipc-handlers.ts | 80%+ | P1 (High) |
| csv-parser.ts | 90%+ | P1 (High) |
| config.ts | 85%+ | P2 (Medium) |
| React components | 70%+ | P2 (Medium) |

### Coverage Report

Run `npm run test:coverage` to generate coverage report.

```
File                 | % Stmts | % Branch | % Funcs | % Lines |
---------------------|---------|----------|---------|---------|
crypto.ts            |   98.5  |   96.0   |  100.0  |   98.5  |
pin-auth.ts          |   94.2  |   91.5   |   95.0  |   94.2  |
...
```

---

## Test ID Reference

### Crypto Module (TC-CRYPTO-*)

| ID | Description |
|----|-------------|
| TC-CRYPTO-001 | Encrypt and decrypt private key correctly |
| TC-CRYPTO-002 | Fail to decrypt with wrong PIN |
| TC-CRYPTO-003 | Fail to decrypt corrupted data |
| TC-CRYPTO-004 | Handle empty private key |
| TC-CRYPTO-005 | Accept valid PIN format |
| TC-CRYPTO-006 | Reject PIN shorter than 8 characters |
| TC-CRYPTO-007 | Reject PIN without letters |
| TC-CRYPTO-008 | Reject PIN without numbers |
| TC-CRYPTO-009 | Return high score for strong PIN |
| TC-CRYPTO-010 | Return lower score for weak PIN |
| TC-CRYPTO-011 | Return true for identical strings (secure compare) |
| TC-CRYPTO-012 | Return false for different strings (secure compare) |

### Database Module (TC-DB-*)

| ID | Description |
|----|-------------|
| TC-DB-001 | Create tables and indexes |
| TC-DB-002 | Enable WAL mode |
| TC-DB-003 | Insert a token |
| TC-DB-004 | Get all tokens |
| TC-DB-005 | Filter tokens by network |
| TC-DB-006 | Get token by address |
| TC-DB-007 | Update token |
| TC-DB-008 | Prevent duplicate address on same network |
| TC-DB-009 | Insert operation log |
| TC-DB-010 | Get all operation logs |
| TC-DB-011 | Filter logs by operation type |
| TC-DB-012 | Filter logs by token ID |
| TC-DB-013 | Filter logs by date range |
| TC-DB-014 | Filter logs by network |
| TC-DB-015 | Update operation log status |
| TC-DB-016 | Create backup |
| TC-DB-017 | Keep only 3 recent backups |

### IPC Handlers (TC-IPC-*)

| ID | Description |
|----|-------------|
| TC-IPC-001 | app:isInitialized returns true when wallet exists |
| TC-IPC-002 | app:isInitialized returns false when wallet doesn't exist |
| TC-IPC-003 | app:getConfig returns current config |
| TC-IPC-004 | auth:verifyPin returns success on valid PIN |
| TC-IPC-005 | auth:verifyPin returns failure with remaining attempts |
| ... | (see ipc-handlers.test.ts for complete list) |

---

## Troubleshooting

### Common Issues

#### "Module not found" in tests

```typescript
// Use resetModules before dynamic imports
vi.resetModules();
const { functionToTest } = await import('../module');
```

#### Database tests fail with "Database not initialized"

```typescript
// Ensure initialization in beforeEach
beforeEach(async () => {
  await initializeDatabase();
});

// Ensure cleanup in afterEach
afterEach(() => {
  closeDatabase();
});
```

#### React component tests fail with "window is undefined"

```typescript
// Mock window before tests
beforeEach(() => {
  vi.stubGlobal('window', { electronAPI: mockAPI });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

#### Async tests timeout

```typescript
// Increase timeout for specific test
it('slow test', async () => {
  // ...
}, 30000);  // 30 second timeout

// Or configure globally in vitest.config.ts
test: {
  testTimeout: 30000,
}
```

---

## Best Practices

1. **One assertion per concept**: Multiple `expect` calls are fine if testing one concept
2. **Descriptive test names**: Should read like documentation
3. **Avoid testing implementation**: Test public API, not internal details
4. **Clean up resources**: Always close database connections, clear timers
5. **Use test IDs**: Makes it easy to reference tests in bug reports
6. **Test error cases**: Not just happy paths
7. **Keep tests fast**: Mock expensive operations
8. **Don't test the framework**: Trust React, Vitest, etc. work correctly
