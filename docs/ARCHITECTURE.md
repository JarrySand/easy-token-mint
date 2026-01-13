# Easy Token Mint - Architecture Documentation

This document describes the system architecture, design decisions, and data flows in Easy Token Mint.

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Diagram](#architecture-diagram)
4. [Main Process Architecture](#main-process-architecture)
5. [Renderer Process Architecture](#renderer-process-architecture)
6. [Security Architecture](#security-architecture)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Database Schema](#database-schema)
9. [Configuration Management](#configuration-management)

---

## System Overview

Easy Token Mint is an Electron-based desktop application for managing ERC20 tokens on the Polygon blockchain. It provides:

- **Token Deployment**: Deploy custom MintableToken contracts
- **Token Minting**: Single and batch minting operations
- **Role Management**: Grant/revoke MINTER_ROLE permissions
- **Operation History**: Track all blockchain transactions

### Design Principles

1. **Security First**: Private keys encrypted at rest, PIN-protected access
2. **User Experience**: Simple UI with Japanese/English localization
3. **Reliability**: Multiple RPC endpoints with automatic failover
4. **Auditability**: Complete operation logging and export

---

## Technology Stack

### Frontend (Renderer Process)
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 7.x | Build tool |
| TailwindCSS | 4.x | Styling |
| i18next | 25.x | Internationalization |

### Backend (Main Process)
| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | 39.x | Desktop framework |
| better-sqlite3 | 12.x | Local database |
| ethers.js | 6.x | Blockchain interaction |
| Node.js crypto | - | AES-256-GCM encryption |

### Smart Contracts
| Technology | Version | Purpose |
|------------|---------|---------|
| Solidity | 0.8.20 | Contract language |
| OpenZeppelin | 5.x | ERC20, AccessControl |
| Hardhat | 2.x | Development & testing |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Easy Token Mint                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Renderer Process (React)                    │  │
│  │                                                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │   Pages     │  │  Components │  │     Hooks           │  │  │
│  │  │ - PinPage   │  │ - MintDialog│  │ - useApp            │  │  │
│  │  │ - Setup     │  │ - Deploy    │  │                     │  │  │
│  │  │ - Dashboard │  │ - BatchMint │  │                     │  │  │
│  │  │ - History   │  │ - Roles     │  │                     │  │  │
│  │  │ - Settings  │  │             │  │                     │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │  │
│  │         │                │                     │             │  │
│  │         └────────────────┴─────────────────────┘             │  │
│  │                          │                                    │  │
│  │                    window.electronAPI                         │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
│  ┌──────────────────────────┴───────────────────────────────────┐  │
│  │                     Preload Script                            │  │
│  │                   (Context Bridge)                            │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
│                         IPC Channel                                 │
│                              │                                      │
│  ┌──────────────────────────┴───────────────────────────────────┐  │
│  │                    Main Process (Node.js)                     │  │
│  │                                                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │ IPC Handlers│  │  Blockchain │  │     Database        │  │  │
│  │  │ - auth:*    │  │  - ethers.js│  │   - better-sqlite3  │  │  │
│  │  │ - wallet:*  │  │  - Provider │  │   - Tokens          │  │  │
│  │  │ - tokens:*  │  │  - Wallet   │  │   - Operations      │  │  │
│  │  │ - mint:*    │  │  - Contract │  │                     │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │  │
│  │         │                │                     │             │  │
│  │  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────────┴──────────┐  │  │
│  │  │   Crypto    │  │  PIN Auth   │  │      Config         │  │  │
│  │  │ - AES-256   │  │ - Session   │  │   - Settings        │  │  │
│  │  │ - PBKDF2    │  │ - Lockout   │  │   - Network         │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │    Polygon Blockchain     │
                    │                           │
                    │  ┌─────────────────────┐ │
                    │  │   MintableToken     │ │
                    │  │   (ERC20 + Roles)   │ │
                    │  └─────────────────────┘ │
                    │  ┌─────────────────────┐ │
                    │  │    BatchMinter      │ │
                    │  │   (Batch Operations)│ │
                    │  └─────────────────────┘ │
                    └───────────────────────────┘
```

---

## Main Process Architecture

### Module Structure

```
src/main/
├── index.ts          # Application entry point, window management
├── ipc-handlers.ts   # All IPC handler registrations
├── blockchain.ts     # ethers.js operations, RPC management
├── database.ts       # SQLite operations, schema
├── crypto.ts         # AES-256-GCM encryption
├── pin-auth.ts       # PIN verification, session management
├── config.ts         # Configuration persistence
├── csv-parser.ts     # CSV parsing for batch operations
├── logger.ts         # Application logging
├── paths.ts          # OS-specific paths
└── updater.ts        # Auto-update functionality
```

### Module Responsibilities

#### `index.ts` - Application Lifecycle
- Creates BrowserWindow with security settings
- Configures Content Security Policy (CSP)
- Initializes all modules in correct order
- Handles application quit

#### `ipc-handlers.ts` - IPC Communication
- Registers all IPC handlers
- Routes requests to appropriate modules
- Handles error responses
- Logs all operations

#### `blockchain.ts` - Blockchain Operations
- Provider management with failover
- Wallet creation from private key
- Contract interactions
- Gas estimation
- Transaction submission

#### `database.ts` - Data Persistence
- SQLite database initialization
- Token CRUD operations
- Operation log management
- Automatic backups

#### `crypto.ts` - Cryptography
- AES-256-GCM encryption/decryption
- PBKDF2 key derivation (600,000 iterations)
- PIN strength calculation
- Timing-safe comparisons

#### `pin-auth.ts` - Authentication
- PIN verification with lockout
- Session management
- Private key caching (memory only)
- Activity tracking

---

## Renderer Process Architecture

### Component Structure

```
src/renderer/
├── App.tsx           # Root component, state machine
├── main.tsx          # React entry point
├── pages/
│   ├── PinPage.tsx       # PIN authentication
│   ├── SetupPage.tsx     # Initial setup wizard
│   ├── DashboardPage.tsx # Main dashboard
│   ├── HistoryPage.tsx   # Operation history
│   └── SettingsPage.tsx  # Application settings
├── components/
│   ├── ui/               # Base UI components
│   ├── MintDialog.tsx    # Single mint
│   ├── BatchMintDialog.tsx # Batch mint
│   ├── DeployTokenDialog.tsx
│   ├── AddTokenDialog.tsx
│   └── RoleManagementDialog.tsx
├── hooks/
│   └── useApp.ts     # Main application hook
├── lib/
│   └── utils.ts      # Utility functions
└── i18n/
    ├── index.ts      # i18next setup
    └── locales/
        ├── ja.json   # Japanese translations
        └── en.json   # English translations
```

### State Management

The application uses a simple state machine pattern:

```
                    ┌─────────────┐
                    │   loading   │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │    setup    │          │     pin     │
       └──────┬──────┘          └──────┬──────┘
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  dashboard  │
                    └─────────────┘
```

**States:**
- `loading` - Initial state, checking initialization
- `setup` - First-time setup wizard
- `pin` - PIN authentication required
- `dashboard` - Main application (with sub-navigation)

---

## Security Architecture

### Electron Security Settings

```typescript
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,     // No Node.js in renderer
    contextIsolation: true,     // Isolated contexts
    sandbox: true,              // Sandbox mode
    preload: preloadScript      // Controlled API exposure
  }
});
```

### Content Security Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
connect-src 'self' https://*.polygon.technology https://*.matic.* https://*.blastapi.io;
```

### Private Key Protection

```
┌────────────────────────────────────────────────────────────────┐
│                    Private Key Lifecycle                        │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Import                                                      │
│     User enters private key → Validate format                   │
│           │                                                     │
│           ▼                                                     │
│  2. Encryption                                                  │
│     Generate salt (32 bytes) → PBKDF2 (600k iterations)        │
│           │                        │                            │
│           ▼                        ▼                            │
│     Generate IV (12 bytes) → Derive key (256 bits)             │
│           │                        │                            │
│           └────────────────────────┘                            │
│                        │                                        │
│                        ▼                                        │
│              AES-256-GCM Encrypt                                │
│                        │                                        │
│                        ▼                                        │
│  3. Storage                                                     │
│     Save to wallet.enc: { salt, iv, authTag, encryptedData }   │
│     Set file permissions: 600 (owner read/write only)          │
│                                                                 │
│  4. Usage                                                       │
│     PIN entered → PBKDF2 derive key → Decrypt                  │
│           │                                                     │
│           ▼                                                     │
│     Cache in memory (cachedPrivateKey)                         │
│     Clear on: lock, timeout, app quit                          │
│                                                                 │
│  5. Key Zeroing                                                 │
│     After use: key.fill(0) to clear from memory                │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### PIN Lockout Mechanism

```
Failed Attempts:  1 → 2 → 3 (LOCK)
                              │
                              ▼
                    Lock Duration: 5 min
                              │
                    Another 3 fails
                              │
                              ▼
                    Lock Duration: 10 min
                              │
                    Another 3 fails
                              │
                              ▼
                    Lock Duration: 20 min (max 30 min)
```

---

## Data Flow Diagrams

### Token Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Token Deployment Flow                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User                    Renderer                  Main Process      │
│    │                        │                          │             │
│    │  Click "Deploy"        │                          │             │
│    │───────────────────────>│                          │             │
│    │                        │                          │             │
│    │                        │  tokens:estimateDeployGas│             │
│    │                        │─────────────────────────>│             │
│    │                        │                          │             │
│    │                        │  { gasLimit, totalCost } │             │
│    │                        │<─────────────────────────│             │
│    │                        │                          │             │
│    │  Confirm & Sign        │                          │             │
│    │───────────────────────>│                          │             │
│    │                        │                          │             │
│    │                        │  tokens:deploy           │             │
│    │                        │─────────────────────────>│             │
│    │                        │                          │             │
│    │                        │               ┌──────────┴──────────┐  │
│    │                        │               │ 1. Create op log    │  │
│    │                        │               │ 2. Deploy contract  │  │
│    │                        │               │ 3. Wait for confirm │  │
│    │                        │               │ 4. Save token to DB │  │
│    │                        │               │ 5. Update op log    │  │
│    │                        │               └──────────┬──────────┘  │
│    │                        │                          │             │
│    │                        │  { address, txHash }     │             │
│    │                        │<─────────────────────────│             │
│    │                        │                          │             │
│    │  Show Success          │                          │             │
│    │<───────────────────────│                          │             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Batch Mint Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Batch Mint Flow                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. CSV Upload                                                       │
│     User uploads CSV → csv:parse → Validate rows                    │
│                                                                      │
│  2. Preview                                                          │
│     Show valid/invalid counts, total amount                         │
│                                                                      │
│  3. Batch Processing                                                 │
│     Split into batches of 100                                       │
│           │                                                          │
│           ▼                                                          │
│     ┌─────────────────────────────────────────────────────────┐     │
│     │  For each batch (1..N):                                  │     │
│     │    a. Create operation log (status: pending)            │     │
│     │    b. Call BatchMinter.batchMint()                      │     │
│     │    c. Wait for transaction confirmation                 │     │
│     │    d. Parse MintFailed events for failures              │     │
│     │    e. Update operation log (status: success/failed)     │     │
│     │    f. Collect results                                   │     │
│     └─────────────────────────────────────────────────────────┘     │
│           │                                                          │
│           ▼                                                          │
│  4. Results                                                          │
│     Return { txHashes, results, successCount, failedCount }         │
│                                                                      │
│  5. Failed CSV Export (optional)                                     │
│     csv:generateFailed → Download failed rows                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Tables

```sql
-- Tokens table
CREATE TABLE tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 18,
  network TEXT NOT NULL CHECK (network IN ('mainnet', 'testnet')),
  has_minter_role INTEGER NOT NULL DEFAULT 0,
  max_supply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(address, network)
);

-- Operation logs table
CREATE TABLE operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('deploy', 'mint', 'batch_mint', 'grant_role', 'revoke_role')),
  token_id INTEGER,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  details TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirming', 'success', 'failed', 'timeout')),
  network TEXT NOT NULL CHECK (network IN ('mainnet', 'testnet')),
  operator_address TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (token_id) REFERENCES tokens(id)
);
```

### Indexes

```sql
CREATE INDEX idx_tokens_network ON tokens(network);
CREATE INDEX idx_tokens_address ON tokens(address);
CREATE INDEX idx_operation_logs_network ON operation_logs(network);
CREATE INDEX idx_operation_logs_token_id ON operation_logs(token_id);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);
CREATE INDEX idx_operation_logs_status ON operation_logs(status);
```

### Entity Relationship

```
┌─────────────┐        ┌─────────────────┐
│   tokens    │        │ operation_logs  │
├─────────────┤        ├─────────────────┤
│ id (PK)     │◄───────┤ token_id (FK)   │
│ address     │        │ token_address   │
│ name        │        │ token_symbol    │
│ symbol      │        │ operation_type  │
│ decimals    │        │ details (JSON)  │
│ network     │        │ tx_hash         │
│ has_minter  │        │ status          │
│ max_supply  │        │ network         │
│ created_at  │        │ operator_addr   │
│ updated_at  │        │ created_at      │
└─────────────┘        │ updated_at      │
                       └─────────────────┘
```

---

## Configuration Management

### Config File Structure

Location: `{appData}/easy-token-mint/config.json`

```json
{
  "version": "1.0.0",
  "network": "mainnet",
  "language": "ja",
  "alertThresholds": {
    "warning": 1.0,
    "danger": 0.1
  },
  "walletAddress": "0x...",
  "sessionTimeoutMinutes": 15,
  "batchMinterAddresses": {
    "mainnet": "0x...",
    "testnet": "0x..."
  }
}
```

### File Locations by OS

| OS | Config | Database | Wallet | Logs |
|----|--------|----------|--------|------|
| Windows | `%APPDATA%\easy-token-mint\` | same | same | `logs/` |
| macOS | `~/Library/Application Support/easy-token-mint/` | same | same | `logs/` |
| Linux | `~/.config/easy-token-mint/` | same | same | `logs/` |

### File Permissions

- `config.json`: 600 (owner read/write)
- `wallet.enc`: 600 (owner read/write)
- `data.db`: 600 (owner read/write)
- `logs/`: 700 (owner all)

---

## RPC Provider Strategy

### Failover Logic

```
┌─────────────────────────────────────────────────────────────────────┐
│                     RPC Provider Failover                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Mainnet Endpoints:                                                  │
│    1. https://polygon-rpc.com                                       │
│    2. https://rpc-mainnet.matic.quiknode.pro                        │
│    3. https://polygon-mainnet.public.blastapi.io                    │
│                                                                      │
│  Testnet (Amoy) Endpoints:                                          │
│    1. https://rpc-amoy.polygon.technology                           │
│    2. https://polygon-amoy.public.blastapi.io                       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  getProvider() Flow:                                         │   │
│  │                                                              │   │
│  │  1. If cached provider exists:                               │   │
│  │     - Health check (getBlockNumber with 30s timeout)         │   │
│  │     - If success: return cached                              │   │
│  │     - If fail: increment index, retry                        │   │
│  │                                                              │   │
│  │  2. Try each endpoint in rotation:                           │   │
│  │     - Create provider                                        │   │
│  │     - Health check with timeout                              │   │
│  │     - If success: cache and return                           │   │
│  │     - If fail: try next endpoint                             │   │
│  │                                                              │   │
│  │  3. After MAX_RETRIES * endpoints.length fails:              │   │
│  │     - Throw "All RPC endpoints failed"                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Timeout Configuration

| Operation | Timeout |
|-----------|---------|
| RPC Health Check | 30 seconds |
| Transaction Confirmation | 5 minutes |

---

## Smart Contract Architecture

### MintableToken

```solidity
contract MintableToken is ERC20, ERC20Capped, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Constructor grants deployer both DEFAULT_ADMIN_ROLE and MINTER_ROLE
    // Optional cap (0 = unlimited)
    // Optional initial mint
}
```

### BatchMinter

```solidity
contract BatchMinter {
    // Requires MINTER_ROLE on target token
    // Processes up to 100 recipients per call
    // Try-catch for individual failures
    // Emits MintFailed event for failed mints
}
```

### Role Hierarchy

```
DEFAULT_ADMIN_ROLE (deployer)
         │
         ├── Can grant MINTER_ROLE
         ├── Can revoke MINTER_ROLE
         └── Can grant DEFAULT_ADMIN_ROLE to others

MINTER_ROLE
         │
         └── Can call mint() function
```

---

## Logging Architecture

### Log Levels

| Level | Usage |
|-------|-------|
| DEBUG | Detailed debugging (not in production) |
| INFO | Normal operations |
| WARN | Potential issues |
| ERROR | Errors with stack traces |

### Log Format

```
[2024-01-15T10:30:45.123Z] [INFO] Mint operation successful
  tokenSymbol: TEST
  recipient: 0x1234...
  amount: 100
  txHash: 0xabcd...
```

### Log Rotation

- Max file size: 10MB
- Keep: 3 generations
- Location: `{appData}/easy-token-mint/logs/`
