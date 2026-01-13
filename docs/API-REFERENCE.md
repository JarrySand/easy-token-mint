# Easy Token Mint - API Reference

This document provides a complete reference for all IPC handlers, database operations, and blockchain functions available in Easy Token Mint.

## Table of Contents

1. [IPC Handler API](#ipc-handler-api)
2. [Database API](#database-api)
3. [Blockchain API](#blockchain-api)
4. [Type Definitions](#type-definitions)

---

## IPC Handler API

All IPC communication between the renderer and main process goes through `window.electronAPI`. Each handler is invoked via `ipcRenderer.invoke()`.

### Authentication Handlers

#### `auth:verifyPin`

Verifies the PIN and unlocks the private key.

```typescript
verifyPin(pin: string): Promise<{
  success: boolean;
  remainingAttempts?: number;
  lockUntil?: number;
}>
```

**Parameters:**
- `pin` - The PIN to verify (8+ characters, must contain letters and numbers)

**Returns:**
- `success` - Whether authentication succeeded
- `remainingAttempts` - Number of attempts remaining before lockout (on failure)
- `lockUntil` - Unix timestamp when lockout expires (if locked)

**Example:**
```typescript
const result = await window.electronAPI.verifyPin('MySecurePin123');
if (result.success) {
  // Authenticated successfully
} else if (result.lockUntil) {
  // Account is locked until result.lockUntil
} else {
  // Wrong PIN, result.remainingAttempts left
}
```

---

#### `auth:setPin`

Validates a new PIN format (used during setup).

```typescript
setPin(pin: string): Promise<{ success: boolean; message?: string }>
```

**Parameters:**
- `pin` - The PIN to validate

**Returns:**
- `success` - Whether the PIN format is valid
- `message` - Error message if invalid

---

#### `auth:changePin`

Changes the current PIN to a new PIN.

```typescript
changePin(currentPin: string, newPin: string): Promise<{
  success: boolean;
  message?: string;
}>
```

**Parameters:**
- `currentPin` - The current PIN for verification
- `newPin` - The new PIN to set

**Returns:**
- `success` - Whether the change succeeded
- `message` - Error message if failed

---

#### `auth:checkSession`

Checks if the current session is still valid (not timed out).

```typescript
checkSession(): Promise<boolean>
```

**Returns:**
- `true` if session is active, `false` if timed out or not authenticated

---

#### `auth:updateActivity`

Updates the last activity timestamp to prevent session timeout.

```typescript
updateActivity(): Promise<void>
```

**Note:** Called automatically on user interactions (click, keydown, scroll).

---

#### `auth:lock`

Manually locks the application.

```typescript
lock(): Promise<void>
```

---

### Wallet Handlers

#### `wallet:import`

Imports a private key and encrypts it with a PIN.

```typescript
importPrivateKey(privateKey: string, pin: string): Promise<{
  success: boolean;
  address?: string;
  message?: string;
}>
```

**Parameters:**
- `privateKey` - Ethereum private key (with or without 0x prefix)
- `pin` - PIN to encrypt the key with

**Returns:**
- `success` - Whether import succeeded
- `address` - The wallet address derived from the key
- `message` - Error message if failed

**Validation:**
- Private key must be 64 hex characters (with or without 0x prefix)
- PIN must be 8+ characters with at least one letter and one number

---

#### `wallet:getInfo`

Gets the current wallet information.

```typescript
getWalletInfo(): Promise<WalletInfo | null>
```

**Returns:**
```typescript
interface WalletInfo {
  address: string;  // Ethereum address
  balance: string;  // MATIC balance in ETH units
}
```

Returns `null` if no wallet is configured.

---

#### `wallet:getBalance`

Refreshes and returns the current MATIC balance.

```typescript
getBalance(): Promise<string>
```

**Returns:**
- Balance in MATIC (ETH units), e.g., "10.5"

---

### Token Handlers

#### `tokens:getAll`

Gets all tokens for the current network.

```typescript
getTokens(): Promise<Token[]>
```

**Returns:**
Array of Token objects sorted by creation date (newest first).

---

#### `tokens:add`

Adds an existing token to track.

```typescript
addToken(address: string): Promise<Token>
```

**Parameters:**
- `address` - Token contract address

**Returns:**
- The Token object with info fetched from the blockchain

**Errors:**
- Throws if address is invalid
- Returns existing token if already tracked

---

#### `tokens:deploy`

Deploys a new MintableToken contract.

```typescript
deployToken(params: DeployTokenParams): Promise<{
  address: string;
  txHash: string;
}>
```

**Parameters:**
```typescript
interface DeployTokenParams {
  name: string;           // Token name (e.g., "Reward Token")
  symbol: string;         // Token symbol (e.g., "RWD")
  decimals: number;       // Decimal places (typically 18)
  maxSupply: string | null;  // Max supply or null for unlimited
  initialMint: {
    amount: string;       // Amount to mint initially
    recipient: string;    // Address to receive initial tokens
  } | null;
}
```

**Returns:**
- `address` - Deployed contract address
- `txHash` - Deployment transaction hash

---

#### `tokens:estimateDeployGas`

Estimates gas for token deployment.

```typescript
estimateDeployGas(params: DeployTokenParams): Promise<{
  gasLimit: bigint;
  gasPrice: bigint;
  totalCost: string;  // In MATIC
}>
```

---

#### `tokens:refreshMinterRole`

Refreshes the minter role status for a token.

```typescript
refreshMinterRole(tokenId: number, tokenAddress: string): Promise<void>
```

---

### Minting Handlers

#### `mint:single`

Mints tokens to a single recipient.

```typescript
mint(params: MintParams): Promise<{ txHash: string }>
```

**Parameters:**
```typescript
interface MintParams {
  tokenAddress: string;  // Token contract address
  recipient: string;     // Recipient address
  amount: string;        // Amount in human-readable units
}
```

**Returns:**
- `txHash` - Transaction hash

**Errors:**
- Throws if recipient address is invalid
- Throws if token not found
- Throws if wallet doesn't have MINTER_ROLE

---

#### `mint:estimateGas`

Estimates gas for a mint operation.

```typescript
estimateMintGas(
  tokenAddress: string,
  recipient: string,
  amount: string
): Promise<{
  gasLimit: bigint;
  gasPrice: bigint;
  totalCost: string;
}>
```

---

#### `mint:batch`

Executes batch minting to multiple recipients.

```typescript
batchMint(params: BatchMintParams & { batchMinterAddress: string }): Promise<{
  txHashes: string[];
  results: BatchMintResult[];
  successCount: number;
  failedCount: number;
}>
```

**Parameters:**
```typescript
interface BatchMintParams {
  tokenAddress: string;
  recipients: Array<{ address: string; amount: string }>;
  skipInvalid: boolean;  // Skip invalid addresses instead of failing
}
```

**Returns:**
```typescript
interface BatchMintResult {
  address: string;
  amount: string;
  success: boolean;
  error?: string;
}
```

**Note:** Batch operations are split into chunks of 100 recipients per transaction.

---

#### `mint:estimateBatchGas`

Estimates gas for batch minting.

```typescript
estimateBatchGas(
  batchMinterAddress: string,
  tokenAddress: string,
  recipients: Array<{ address: string; amount: string }>
): Promise<{
  gasLimit: bigint;
  gasPrice: bigint;
  totalCost: string;
}>
```

---

### Role Management Handlers

#### `roles:getMinters`

Gets all addresses with MINTER_ROLE for a token.

```typescript
getMinters(tokenAddress: string): Promise<string[]>
```

---

#### `roles:grant`

Grants MINTER_ROLE to an address.

```typescript
grantMinterRole(tokenAddress: string, targetAddress: string): Promise<{
  txHash: string;
}>
```

---

#### `roles:revoke`

Revokes MINTER_ROLE from an address.

```typescript
revokeMinterRole(tokenAddress: string, targetAddress: string): Promise<{
  txHash: string;
}>
```

---

### CSV Handlers

#### `csv:parse`

Parses CSV content for batch minting.

```typescript
parseMintCsv(csvContent: string): Promise<{
  validRows: Array<{ address: string; amount: string }>;
  invalidRows: Array<{ line: number; content: string; error: string }>;
  validCount: number;
  invalidCount: number;
  totalAmount: string;
}>
```

**CSV Format:**
```csv
address,amount
0x1234...,100
0x5678...,200
```

---

#### `csv:generateFailed`

Generates CSV content for failed mint operations.

```typescript
generateFailedCsv(failedRows: Array<{
  address: string;
  amount: string;
  error: string;
}>): Promise<string>
```

---

### Operations Handlers

#### `operations:getLogs`

Gets operation logs with optional filtering.

```typescript
getOperationLogs(filter?: OperationLogFilter): Promise<OperationLog[]>
```

**Filter Parameters:**
```typescript
interface OperationLogFilter {
  operationType?: 'deploy' | 'mint' | 'batch_mint' | 'grant_role' | 'revoke_role';
  tokenId?: number;
  startDate?: string;  // ISO date string
  endDate?: string;    // ISO date string
  network?: 'mainnet' | 'testnet';
}
```

---

#### `operations:exportCsv`

Exports operation logs as CSV.

```typescript
exportOperationLogs(filter?: OperationLogFilter): Promise<string>
```

**CSV Columns:**
- timestamp
- operation
- token_symbol
- token_address
- details (JSON)
- tx_hash
- operator_address

---

### Settings Handlers

#### `settings:setNetwork`

Switches between mainnet and testnet.

```typescript
setNetwork(network: 'mainnet' | 'testnet'): Promise<void>
```

**Note:** Clears the provider cache and requires re-fetching token data.

---

#### `settings:setLanguage`

Changes the application language.

```typescript
setLanguage(language: 'ja' | 'en'): Promise<void>
```

---

#### `settings:setAlertThresholds`

Sets MATIC balance alert thresholds.

```typescript
setAlertThresholds(warning: number, danger: number): Promise<void>
```

**Parameters:**
- `warning` - Warning threshold in MATIC (default: 1.0)
- `danger` - Danger threshold in MATIC (default: 0.1)

---

#### `settings:setSessionTimeout`

Sets the session timeout duration.

```typescript
setSessionTimeout(minutes: number): Promise<void>
```

**Parameters:**
- `minutes` - Timeout in minutes (0 to disable)

---

#### `settings:setBatchMinterAddress`

Sets the BatchMinter contract address for a network.

```typescript
setBatchMinterAddress(network: 'mainnet' | 'testnet', address: string): Promise<void>
```

---

### Utility Handlers

#### `utils:validateAddress`

Validates an Ethereum address.

```typescript
validateAddress(address: string): Promise<boolean>
```

---

#### `utils:getPolygonscanUrl`

Gets the Polygonscan URL for a transaction.

```typescript
getPolygonscanUrl(txHash: string): Promise<string>
```

---

#### `utils:openExternalLink`

Opens an external URL in the default browser.

```typescript
openExternalLink(url: string): Promise<void>
```

**Security:** Only allows URLs from whitelisted domains:
- `polygonscan.com`
- `amoy.polygonscan.com`

---

#### `utils:openLogsFolder`

Opens the application logs folder in the file explorer.

```typescript
openLogsFolder(): Promise<void>
```

---

## Database API

Internal database operations (used by IPC handlers).

### Token Operations

```typescript
// Get all tokens for a network
getTokens(network: NetworkType): Token[]

// Get token by address and network
getTokenByAddress(address: string, network: NetworkType): Token | undefined

// Insert a new token
insertToken(token: Omit<Token, 'id' | 'createdAt' | 'updatedAt'>): Token

// Update token fields
updateToken(id: number, updates: Partial<Token>): void
```

### Operation Log Operations

```typescript
// Get operation logs with optional filter
getOperationLogs(filter?: OperationLogFilter): OperationLog[]

// Insert new operation log
insertOperationLog(log: Omit<OperationLog, 'id' | 'createdAt' | 'updatedAt'>): number

// Update operation log
updateOperationLog(id: number, updates: {
  status?: OperationLog['status'];
  txHash?: string;
  tokenAddress?: string;
  tokenId?: number;
}): void

// Get pending/confirming operations
getPendingOperations(): OperationLog[]
```

---

## Blockchain API

Low-level blockchain operations.

### Provider Management

```typescript
// Get or create provider with fallback
getProvider(): Promise<JsonRpcProvider>

// Clear provider (on network switch)
clearProvider(): void
```

### Wallet Operations

```typescript
// Get wallet from cached private key
getWallet(): Promise<Wallet>

// Get address from private key
getAddressFromPrivateKey(privateKey: string): string

// Get MATIC balance
getBalance(address: string): Promise<string>
```

### Token Operations

```typescript
// Get token info from contract
getTokenInfo(tokenAddress: string): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  maxSupply: string | null;
}>

// Check if address has MINTER_ROLE
hasMinterRole(tokenAddress: string, address: string): Promise<boolean>

// Get all minter addresses
getMinters(tokenAddress: string): Promise<string[]>
```

### Transaction Operations

```typescript
// Deploy token
deployToken(params: DeployTokenParams): Promise<{
  address: string;
  txHash: string;
}>

// Mint tokens
mint(tokenAddress: string, recipient: string, amount: string, decimals: number): Promise<string>

// Batch mint
batchMint(batchMinterAddress: string, tokenAddress: string, requests: BatchMintRequest[], decimals: number): Promise<{
  txHash: string;
  results: BatchMintResultItem[];
}>

// Grant/Revoke roles
grantMinterRole(tokenAddress: string, address: string): Promise<string>
revokeMinterRole(tokenAddress: string, address: string): Promise<string>
```

---

## Type Definitions

### Core Types

```typescript
type NetworkType = 'mainnet' | 'testnet';

interface AppConfig {
  version: string;
  network: NetworkType;
  language: 'ja' | 'en';
  alertThresholds: {
    warning: number;
    danger: number;
  };
  walletAddress: string | null;
  sessionTimeoutMinutes: number;
  batchMinterAddresses: {
    mainnet: string;
    testnet: string;
  };
}

interface Token {
  id: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  network: NetworkType;
  hasMinterRole: boolean;
  maxSupply: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OperationLog {
  id: number;
  operationType: 'deploy' | 'mint' | 'batch_mint' | 'grant_role' | 'revoke_role';
  tokenId: number | null;
  tokenAddress: string;
  tokenSymbol: string;
  details: string;  // JSON string
  txHash: string | null;
  status: 'pending' | 'confirming' | 'success' | 'failed' | 'timeout';
  network: NetworkType;
  operatorAddress: string;
  createdAt: string;
  updatedAt: string;
}

interface WalletInfo {
  address: string;
  balance: string;
}
```

---

## Error Handling

All IPC handlers follow these patterns:

1. **Validation Errors**: Throw with descriptive message
   ```typescript
   throw new Error('Invalid token address');
   ```

2. **Not Found Errors**: Throw when resource doesn't exist
   ```typescript
   throw new Error('Token not found');
   ```

3. **Authentication Errors**: Return failure object
   ```typescript
   return { success: false, message: 'Not authenticated' };
   ```

4. **Blockchain Errors**: Propagate with original error message
   ```typescript
   // Transaction failed errors include the reason
   ```

---

## Security Considerations

1. **PIN Authentication**: Required for all wallet operations
2. **Session Timeout**: Auto-lock after inactivity
3. **Private Key**: Never exposed via IPC, only kept in memory
4. **External Links**: Whitelist-based URL validation
5. **Input Validation**: All addresses validated before use
