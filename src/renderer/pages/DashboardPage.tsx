import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@renderer/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert';
import { shortenAddress, formatBalance, copyToClipboard } from '@renderer/lib/utils';
import type { AppConfig, WalletInfo, Token } from '@shared/types';
import { MintDialog } from '@renderer/components/MintDialog';
import { AddTokenDialog } from '@renderer/components/AddTokenDialog';
import { BatchMintDialog } from '@renderer/components/BatchMintDialog';
import { DeployTokenDialog } from '@renderer/components/DeployTokenDialog';
import { RoleManagementDialog } from '@renderer/components/RoleManagementDialog';

interface DashboardPageProps {
  config: AppConfig | null;
  walletInfo: WalletInfo | null;
  tokens: Token[];
  onRefresh: () => void;
  onTokensChange: () => void;
  onNavigateToHistory: () => void;
  onNavigateToSettings: () => void;
}

export function DashboardPage({
  config,
  walletInfo,
  tokens,
  onRefresh,
  onTokensChange,
  onNavigateToHistory,
  onNavigateToSettings,
}: DashboardPageProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [mintDialogOpen, setMintDialogOpen] = useState(false);
  const [batchMintDialogOpen, setBatchMintDialogOpen] = useState(false);
  const [addTokenDialogOpen, setAddTokenDialogOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);

  const handleCopyAddress = async () => {
    if (walletInfo?.address) {
      await copyToClipboard(walletInfo.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMint = (token: Token) => {
    setSelectedToken(token);
    setMintDialogOpen(true);
  };

  const handleBatchMint = (token: Token) => {
    setSelectedToken(token);
    setBatchMintDialogOpen(true);
  };

  const handleRoleManagement = (token: Token) => {
    setSelectedToken(token);
    setRoleDialogOpen(true);
  };

  // Get BatchMinter address from config
  const batchMinterAddress = config?.network && config?.batchMinterAddresses
    ? config.batchMinterAddresses[config.network]
    : '';

  const balance = parseFloat(walletInfo?.balance || '0');
  const warningThreshold = config?.alertThresholds.warning || 1.0;
  const dangerThreshold = config?.alertThresholds.danger || 0.1;

  const balanceStatus =
    balance < dangerThreshold ? 'danger' : balance < warningThreshold ? 'warning' : 'normal';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-primary">{t('app.title')}</h1>
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  config?.network === 'mainnet'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {config?.network === 'mainnet' ? t('app.network.mainnet') : t('app.network.testnet')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onNavigateToHistory}>
                {t('common.history')}
              </Button>
              <Button variant="ghost" size="sm" onClick={onNavigateToSettings}>
                {t('common.settings')}
              </Button>
              <Button variant="outline" size="sm" onClick={onRefresh}>
                {t('common.refresh')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Wallet Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.wallet.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">{t('dashboard.wallet.address')}</div>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {walletInfo?.address
                      ? shortenAddress(walletInfo.address, 8)
                      : t('dashboard.wallet.notConnected')}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyAddress}
                    disabled={!walletInfo?.address}
                  >
                    {copied ? t('common.copied') : t('common.copy')}
                  </Button>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t('dashboard.wallet.balance')}</div>
                <div
                  className={`text-2xl font-bold ${
                    balanceStatus === 'danger'
                      ? 'text-red-600'
                      : balanceStatus === 'warning'
                      ? 'text-yellow-600'
                      : 'text-gray-900'
                  }`}
                >
                  {formatBalance(walletInfo?.balance || '0')} POL
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Alert */}
        {balanceStatus !== 'normal' && (
          <Alert variant={balanceStatus === 'danger' ? 'destructive' : 'warning'}>
            <AlertTitle>
              {balanceStatus === 'danger' ? t('dashboard.alert.danger.title') : t('dashboard.alert.warning.title')}
            </AlertTitle>
            <AlertDescription>
              {balanceStatus === 'danger'
                ? t('dashboard.alert.danger.description')
                : t('dashboard.alert.warning.description')}
            </AlertDescription>
          </Alert>
        )}

        {/* Tokens Section */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('dashboard.tokens.title')}</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDeployDialogOpen(true)}>
              {t('dashboard.tokens.deploy')}
            </Button>
            <Button onClick={() => setAddTokenDialogOpen(true)}>{t('dashboard.tokens.addToken')}</Button>
          </div>
        </div>

        {tokens.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="text-muted-foreground">
                {t('dashboard.tokens.empty')}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tokens.map((token) => (
              <Card key={token.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{token.symbol}</CardTitle>
                    {token.hasMinterRole ? (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                        {t('dashboard.tokens.hasMinterRole')}
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                        {t('dashboard.tokens.noRole')}
                      </span>
                    )}
                  </div>
                  <CardDescription>{token.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      {shortenAddress(token.address)}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={!token.hasMinterRole}
                        onClick={() => handleMint(token)}
                      >
                        {t('dashboard.tokens.singleMint')}
                      </Button>
                      <Button
                        className="flex-1"
                        variant="outline"
                        disabled={true}
                        title={t('dashboard.tokens.comingSoon')}
                      >
                        {t('dashboard.tokens.batchMint')}
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => handleRoleManagement(token)}
                    >
                      {t('dashboard.tokens.roleManagement')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Dialogs */}
      {selectedToken && (
        <MintDialog
          open={mintDialogOpen}
          onOpenChange={setMintDialogOpen}
          token={selectedToken}
          onSuccess={onRefresh}
        />
      )}

      <AddTokenDialog
        open={addTokenDialogOpen}
        onOpenChange={setAddTokenDialogOpen}
        onSuccess={onTokensChange}
      />

      <DeployTokenDialog
        open={deployDialogOpen}
        onOpenChange={setDeployDialogOpen}
        onSuccess={onTokensChange}
      />

      {selectedToken && batchMinterAddress && (
        <BatchMintDialog
          open={batchMintDialogOpen}
          onOpenChange={setBatchMintDialogOpen}
          token={selectedToken}
          batchMinterAddress={batchMinterAddress}
          onSuccess={onRefresh}
        />
      )}

      {selectedToken && (
        <RoleManagementDialog
          open={roleDialogOpen}
          onOpenChange={setRoleDialogOpen}
          token={selectedToken}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
