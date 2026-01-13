import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppConfig, WalletInfo, Token } from '@shared/types';

export type AppState = 'loading' | 'setup' | 'pin' | 'dashboard';

// Session check interval in milliseconds
const SESSION_CHECK_INTERVAL = 60000; // 1 minute

export function useApp() {
  const { i18n } = useTranslation();
  const [state, setState] = useState<AppState>('loading');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track latest walletInfo for balance refresh
  const walletInfoRef = useRef<WalletInfo | null>(null);
  walletInfoRef.current = walletInfo;

  // Check if app is initialized
  const checkInitialization = useCallback(async () => {
    try {
      const isInitialized = await window.electronAPI.isInitialized();
      const appConfig = await window.electronAPI.getConfig();
      setConfig(appConfig);

      // Set language from config
      if (appConfig.language && i18n.language !== appConfig.language) {
        i18n.changeLanguage(appConfig.language);
      }

      if (!isInitialized) {
        setState('setup');
      } else {
        setState('pin');
      }
    } catch (err) {
      setError('Failed to initialize application');
      console.error(err);
    }
  }, [i18n]);

  // Load wallet info after authentication
  const loadWalletInfo = useCallback(async () => {
    try {
      const info = await window.electronAPI.getWalletInfo();
      setWalletInfo(info);
    } catch (err) {
      console.error('Failed to load wallet info:', err);
    }
  }, []);

  // Load tokens
  const loadTokens = useCallback(async () => {
    try {
      const tokenList = await window.electronAPI.getTokens();
      setTokens(tokenList);
    } catch (err) {
      console.error('Failed to load tokens:', err);
    }
  }, []);

  // Refresh balance (using ref to avoid stale closure)
  const refreshBalance = useCallback(async () => {
    try {
      const balance = await window.electronAPI.getBalance();
      const currentWalletInfo = walletInfoRef.current;
      if (currentWalletInfo) {
        setWalletInfo({ ...currentWalletInfo, balance });
      }
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  }, []);

  // Handle successful authentication
  const onAuthenticated = useCallback(async () => {
    setState('dashboard');
    await loadWalletInfo();
    await loadTokens();
  }, [loadWalletInfo, loadTokens]);

  // Handle setup complete
  const onSetupComplete = useCallback(async () => {
    // Reload config after setup (network may have changed)
    const updatedConfig = await window.electronAPI.getConfig();
    setConfig(updatedConfig);
    setState('pin');
  }, []);

  // Initial load
  useEffect(() => {
    checkInitialization();
  }, [checkInitialization]);

  // Session timeout check
  useEffect(() => {
    if (state !== 'dashboard') {
      return;
    }

    const checkSession = async () => {
      try {
        const isSessionValid = await window.electronAPI.checkSession();
        if (!isSessionValid) {
          // Session timed out, redirect to PIN screen
          setState('pin');
          setWalletInfo(null);
          setTokens([]);
        }
      } catch (err) {
        console.error('Failed to check session:', err);
      }
    };

    // Check immediately
    checkSession();

    // Set up interval for periodic checks
    const intervalId = setInterval(checkSession, SESSION_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [state]);

  // Update activity on user interactions when in dashboard
  useEffect(() => {
    if (state !== 'dashboard') {
      return;
    }

    const updateActivity = () => {
      window.electronAPI.updateActivity?.();
    };

    // Update activity on various user interactions
    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [state]);

  // Change language
  const changeLanguage = useCallback(async (language: 'ja' | 'en') => {
    try {
      await window.electronAPI.setLanguage(language);
      await i18n.changeLanguage(language);
      if (config) {
        setConfig({ ...config, language });
      }
    } catch (err) {
      console.error('Failed to change language:', err);
    }
  }, [config, i18n]);

  return {
    state,
    config,
    walletInfo,
    tokens,
    error,
    onAuthenticated,
    onSetupComplete,
    loadTokens,
    refreshBalance,
    setConfig,
    changeLanguage,
  };
}
