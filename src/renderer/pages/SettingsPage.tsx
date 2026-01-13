import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@renderer/components/ui/card';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import type { AppConfig, NetworkType } from '@shared/types';
import { NetworkSwitchDialog } from '@renderer/components/NetworkSwitchDialog';
import { ChangePinDialog } from '@renderer/components/ChangePinDialog';
import { ReimportKeyDialog } from '@renderer/components/ReimportKeyDialog';

interface SettingsPageProps {
  config: AppConfig;
  onBack: () => void;
  onLanguageChange: (language: 'ja' | 'en') => Promise<void>;
  onConfigChange: (config: AppConfig) => void;
}

export function SettingsPage({ config, onBack, onLanguageChange, onConfigChange }: SettingsPageProps) {
  const { t } = useTranslation();
  const [warningThreshold, setWarningThreshold] = useState(config.alertThresholds.warning.toString());
  const [dangerThreshold, setDangerThreshold] = useState(config.alertThresholds.danger.toString());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkDialogOpen, setNetworkDialogOpen] = useState(false);
  const [changePinDialogOpen, setChangePinDialogOpen] = useState(false);
  const [reimportKeyDialogOpen, setReimportKeyDialogOpen] = useState(false);

  const handleLanguageChange = async (lang: 'ja' | 'en') => {
    await onLanguageChange(lang);
  };

  const handleSaveAlertThresholds = async () => {
    setError(null);
    setSaved(false);
    setSaving(true);

    try {
      const warning = parseFloat(warningThreshold);
      const danger = parseFloat(dangerThreshold);

      if (isNaN(warning) || isNaN(danger) || warning <= 0 || danger <= 0) {
        setError(t('errors.invalidInput'));
        return;
      }

      if (danger >= warning) {
        setError(t('errors.invalidInput'));
        return;
      }

      await window.electronAPI.setAlertThresholds(warning, danger);
      onConfigChange({ ...config, alertThresholds: { warning, danger } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(t('errors.unknown'));
    } finally {
      setSaving(false);
    }
  };

  const handleNetworkSwitch = async (network: NetworkType) => {
    try {
      await window.electronAPI.setNetwork(network);
      onConfigChange({ ...config, network });
      setNetworkDialogOpen(false);
    } catch (err) {
      setError(t('errors.unknown'));
    }
  };

  const handleOpenLogsFolder = async () => {
    await window.electronAPI.openLogsFolder();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={onBack}>
                {t('common.back')}
              </Button>
              <h1 className="text-xl font-bold text-primary">{t('settings.title')}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Language Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.language.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant={config.language === 'ja' ? 'default' : 'outline'}
                onClick={() => handleLanguageChange('ja')}
              >
                {t('settings.language.ja')}
              </Button>
              <Button
                variant={config.language === 'en' ? 'default' : 'outline'}
                onClick={() => handleLanguageChange('en')}
              >
                {t('settings.language.en')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Network Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.network.title')}</CardTitle>
            <CardDescription>
              {config.network === 'mainnet' ? t('settings.network.mainnet') : t('settings.network.testnet')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setNetworkDialogOpen(true)}>
              {t('settings.network.switch')}
            </Button>
          </CardContent>
        </Card>

        {/* Alert Threshold Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.alert.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="warningThreshold">{t('settings.alert.warningThreshold')}</Label>
                <Input
                  id="warningThreshold"
                  type="number"
                  step="0.1"
                  min="0"
                  value={warningThreshold}
                  onChange={(e) => setWarningThreshold(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dangerThreshold">{t('settings.alert.dangerThreshold')}</Label>
                <Input
                  id="dangerThreshold"
                  type="number"
                  step="0.1"
                  min="0"
                  value={dangerThreshold}
                  onChange={(e) => setDangerThreshold(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSaveAlertThresholds} disabled={saving}>
                {saving ? t('common.loading') : t('common.save')}
              </Button>
              {saved && (
                <span className="text-sm text-green-600">{t('settings.alert.saved')}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PIN Change */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.pin.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setChangePinDialogOpen(true)}>
              {t('settings.pin.change')}
            </Button>
          </CardContent>
        </Card>

        {/* Private Key Re-import */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.privateKey.title')}</CardTitle>
            <CardDescription className="text-yellow-600">
              {t('settings.privateKey.warning')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setReimportKeyDialogOpen(true)}>
              {t('settings.privateKey.reimport')}
            </Button>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.logs.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleOpenLogsFolder}>
              {t('settings.logs.openFolder')}
            </Button>
          </CardContent>
        </Card>
      </main>

      {/* Dialogs */}
      <NetworkSwitchDialog
        open={networkDialogOpen}
        onOpenChange={setNetworkDialogOpen}
        currentNetwork={config.network}
        onConfirm={handleNetworkSwitch}
      />

      <ChangePinDialog
        open={changePinDialogOpen}
        onOpenChange={setChangePinDialogOpen}
      />

      <ReimportKeyDialog
        open={reimportKeyDialogOpen}
        onOpenChange={setReimportKeyDialogOpen}
      />
    </div>
  );
}
