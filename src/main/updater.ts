import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain, dialog } from 'electron';
import { logger } from './logger';

let mainWindow: BrowserWindow | null = null;

export function initAutoUpdater(window: BrowserWindow): void {
  mainWindow = window;

  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for update...');
    sendUpdateStatus('checking');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logger.info(`Update available: ${info.version}`);
    sendUpdateStatus('available', info);

    // Show dialog to user
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. Would you like to download it now?`,
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    }
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    logger.info(`No update available. Current version: ${info.version}`);
    sendUpdateStatus('not-available', info);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    logger.info(`Download progress: ${progressObj.percent.toFixed(1)}%`);
    sendUpdateStatus('downloading', { percent: progressObj.percent });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    logger.info(`Update downloaded: ${info.version}`);
    sendUpdateStatus('downloaded', info);

    // Show dialog to restart
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update has been downloaded. Restart now to apply the update?',
        buttons: ['Restart', 'Later'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    }
  });

  autoUpdater.on('error', (err) => {
    logger.error('Auto-updater error', { error: err.message });
    sendUpdateStatus('error', { message: err.message });
  });

  // IPC handlers
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to check for updates', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to download update', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('get-app-version', () => {
    return autoUpdater.currentVersion.version;
  });
}

function sendUpdateStatus(status: string, data?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, data });
  }
}

export function checkForUpdatesOnStartup(): void {
  // Check for updates after a short delay to not block startup
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to check for updates on startup', { error: errorMessage });
    });
  }, 5000);
}
