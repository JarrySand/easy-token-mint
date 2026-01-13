import path from 'path';
import type { App, BrowserWindow as BrowserWindowType, WebContents } from 'electron';

// Dynamic import to ensure electron is properly initialized
// eslint-disable-next-line @typescript-eslint/no-require-imports
const electron = require('electron');
const app: App = electron.app;
const BrowserWindow: typeof BrowserWindowType = electron.BrowserWindow;

import { initializeDatabase } from './database';
import { initializeConfig } from './config';
import { ensureDataDirectories } from './paths';
import { registerIpcHandlers } from './ipc-handlers';
import { logger } from './logger';
import { initAutoUpdater, checkForUpdatesOnStartup } from './updater';

let mainWindow: BrowserWindowType | null = null;

// Check getIsDev() lazily to avoid accessing app.isPackaged before app is ready
const getIsDev = () => process.env.NODE_ENV === 'development' || !app.isPackaged;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// electron-squirrel-startup should only be checked when app is available
if (app && app.isPackaged) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
}

function createWindow(): void {
  // Create the browser window with security settings
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
    titleBarStyle: 'default',
  });

  // Set Content Security Policy (relaxed in development for Vite HMR)
  if (!getIsDev()) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self';" +
            "script-src 'self';" +
            "style-src 'self' 'unsafe-inline';" +
            "img-src 'self' data:;" +
            "font-src 'self';" +
            "connect-src 'self' https://polygon-rpc.com https://rpc-amoy.polygon.technology https://*.alchemy.com https://*.infura.io;" +
            "object-src 'none';" +
            "base-uri 'self';"
          ],
        },
      });
    });
  }

  // Load the app
  if (getIsDev()) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize the app
app.whenReady().then(async () => {
  try {
    // Ensure data directories exist
    await ensureDataDirectories();

    // Initialize logger
    logger.initialize();
    logger.info('Application starting', {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
    });

    // Initialize config
    await initializeConfig();
    logger.info('Config initialized');

    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Register IPC handlers
    registerIpcHandlers();
    logger.info('IPC handlers registered');

    // Create window
    createWindow();
    logger.info('Main window created');

    // Initialize auto-updater (only in production)
    if (!getIsDev() && mainWindow) {
      initAutoUpdater(mainWindow);
      checkForUpdatesOnStartup();
      logger.info('Auto-updater initialized');
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        logger.info('Window recreated on activate');
      }
    });
  } catch (error) {
    logger.error('Failed to initialize app', { error: String(error) });
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') {
    logger.info('Application quitting');
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Prevent navigation to external URLs
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new globalThis.URL(url);
    if (parsedUrl.protocol !== 'file:' && !url.startsWith('http://localhost')) {
      event.preventDefault();
    }
  });
});
