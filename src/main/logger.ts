import fs from 'fs';
import path from 'path';
import { getLogsPath } from './paths';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const LOG_FILE = 'app.log';
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 3;

let logFilePath: string | null = null;
let isInitialized = false;

function getTimestamp(): string {
  return new Date().toISOString();
}

function formatLogEntry(entry: LogEntry): string {
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}\n`;
}

function ensureLogFile(): void {
  if (!logFilePath) {
    const logsPath = getLogsPath();
    logFilePath = path.join(logsPath, LOG_FILE);
  }

  // Ensure directory exists
  const dir = path.dirname(logFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function rotateLogsIfNeeded(): void {
  if (!logFilePath || !fs.existsSync(logFilePath)) {
    return;
  }

  try {
    const stats = fs.statSync(logFilePath);
    if (stats.size >= MAX_LOG_SIZE) {
      // Rotate logs
      const logsPath = getLogsPath();

      // Delete oldest log file if exists
      const oldestLog = path.join(logsPath, `app.${MAX_LOG_FILES}.log`);
      if (fs.existsSync(oldestLog)) {
        fs.unlinkSync(oldestLog);
      }

      // Rotate existing log files
      for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
        const currentFile = path.join(logsPath, `app.${i}.log`);
        const nextFile = path.join(logsPath, `app.${i + 1}.log`);
        if (fs.existsSync(currentFile)) {
          fs.renameSync(currentFile, nextFile);
        }
      }

      // Move current log to .1
      fs.renameSync(logFilePath, path.join(logsPath, 'app.1.log'));
    }
  } catch (error) {
    console.error('Failed to rotate logs:', error);
  }
}

function writeLog(entry: LogEntry): void {
  ensureLogFile();
  rotateLogsIfNeeded();

  const line = formatLogEntry(entry);

  try {
    fs.appendFileSync(logFilePath!, line, 'utf8');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }

  // Also output to console in development
  if (process.env.NODE_ENV === 'development') {
    const consoleMethod = entry.level === 'error' ? console.error :
                          entry.level === 'warn' ? console.warn :
                          console.log;
    consoleMethod(`[${entry.level.toUpperCase()}] ${entry.message}`, entry.context || '');
  }
}

export function initializeLogger(): void {
  if (isInitialized) {
    return;
  }

  ensureLogFile();
  isInitialized = true;

  info('Logger initialized', { logFile: logFilePath });
}

export function debug(message: string, context?: Record<string, unknown>): void {
  writeLog({
    timestamp: getTimestamp(),
    level: 'debug',
    message,
    context,
  });
}

export function info(message: string, context?: Record<string, unknown>): void {
  writeLog({
    timestamp: getTimestamp(),
    level: 'info',
    message,
    context,
  });
}

export function warn(message: string, context?: Record<string, unknown>): void {
  writeLog({
    timestamp: getTimestamp(),
    level: 'warn',
    message,
    context,
  });
}

export function error(message: string, context?: Record<string, unknown>): void {
  writeLog({
    timestamp: getTimestamp(),
    level: 'error',
    message,
    context,
  });
}

export const logger = {
  debug,
  info,
  warn,
  error,
  initialize: initializeLogger,
};

export default logger;
