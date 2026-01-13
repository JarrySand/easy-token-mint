import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@renderer/hooks/useApp';
import { PinPage } from '@renderer/pages/PinPage';
import { SetupPage } from '@renderer/pages/SetupPage';
import { DashboardPage } from '@renderer/pages/DashboardPage';
import { HistoryPage } from '@renderer/pages/HistoryPage';
import { SettingsPage } from '@renderer/pages/SettingsPage';

type Page = 'dashboard' | 'history' | 'settings';

export function App() {
  const { t } = useTranslation();
  const {
    state,
    config,
    walletInfo,
    tokens,
    error,
    onAuthenticated,
    onSetupComplete,
    loadTokens,
    refreshBalance,
    changeLanguage,
    setConfig,
  } = useApp();

  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  // Loading state
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin mx-auto w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
          <div className="text-muted-foreground">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center text-red-600">
          <div className="text-xl font-bold mb-2">{t('common.error')}</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  // Setup flow
  if (state === 'setup') {
    return <SetupPage onComplete={onSetupComplete} />;
  }

  // PIN authentication
  if (state === 'pin') {
    return <PinPage onSuccess={onAuthenticated} />;
  }

  // History page
  if (currentPage === 'history' && config) {
    return (
      <HistoryPage
        network={config.network}
        onBack={() => setCurrentPage('dashboard')}
      />
    );
  }

  // Settings page
  if (currentPage === 'settings' && config) {
    return (
      <SettingsPage
        config={config}
        onBack={() => setCurrentPage('dashboard')}
        onLanguageChange={changeLanguage}
        onConfigChange={setConfig}
        onNetworkChange={() => {
          refreshBalance();
          loadTokens();
        }}
      />
    );
  }

  // Dashboard
  return (
    <DashboardPage
      config={config}
      walletInfo={walletInfo}
      tokens={tokens}
      onRefresh={() => {
        refreshBalance();
        loadTokens();
      }}
      onTokensChange={loadTokens}
      onNavigateToHistory={() => setCurrentPage('history')}
      onNavigateToSettings={() => setCurrentPage('settings')}
    />
  );
}
