import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import type { OperationLog, OperationLogFilter, NetworkType } from '@shared/types';

interface HistoryPageProps {
  network: NetworkType;
  onBack: () => void;
}

const STATUS_CLASSES: Record<OperationLog['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirming: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  timeout: 'bg-gray-100 text-gray-700',
};

export function HistoryPage({ network, onBack }: HistoryPageProps) {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [filterType, setFilterType] = useState<OperationLog['operationType'] | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filter: OperationLogFilter = { network };

      if (filterType) {
        filter.operationType = filterType;
      }
      if (startDate) {
        filter.startDate = startDate;
      }
      if (endDate) {
        filter.endDate = endDate;
      }

      const result = await window.electronAPI.getOperationLogs(filter);
      setLogs(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('history.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [network, filterType, startDate, endDate, t]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleExportCsv = async () => {
    setExporting(true);
    setError(null);

    try {
      const filter: OperationLogFilter = { network };

      if (filterType) {
        filter.operationType = filterType;
      }
      if (startDate) {
        filter.startDate = startDate;
      }
      if (endDate) {
        filter.endDate = endDate;
      }

      const csvPath = await window.electronAPI.exportOperationLogs(filter);
      // Open the folder containing the exported file
      await window.electronAPI.openLogsFolder();
      alert(t('history.exportSuccess', { path: csvPath }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('history.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleOpenTx = async (txHash: string) => {
    const url = await window.electronAPI.getPolygonscanUrl(txHash);
    await window.electronAPI.openExternalLink(url);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const locale = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const shortenTxHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  const getOperationTypeLabel = (type: OperationLog['operationType']) => {
    return t(`history.operationType.${type}`);
  };

  const getStatusLabel = (status: OperationLog['status']) => {
    return t(`history.status.${status}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={onBack}>
                ← {t('common.back')}
              </Button>
              <h1 className="text-xl font-bold text-primary">{t('history.title')}</h1>
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  network === 'mainnet'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {network === 'mainnet' ? t('app.network.mainnet') : t('app.network.testnet')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadLogs} disabled={loading}>
                {t('common.refresh')}
              </Button>
              <Button onClick={handleExportCsv} disabled={exporting || logs.length === 0}>
                {exporting ? t('common.exporting') : t('history.csvExport')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('history.filter.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="filterType">{t('history.filter.operationType')}</Label>
                <select
                  id="filterType"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as OperationLog['operationType'] | '')}
                >
                  <option value="">{t('common.all')}</option>
                  <option value="deploy">{t('history.operationType.deploy')}</option>
                  <option value="mint">{t('history.operationType.mint')}</option>
                  <option value="batch_mint">{t('history.operationType.batch_mint')}</option>
                  <option value="grant_role">{t('history.operationType.grant_role')}</option>
                  <option value="revoke_role">{t('history.operationType.revoke_role')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">{t('history.filter.startDate')}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">{t('history.filter.endDate')}</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('history.result.title')} {!loading && `(${t('history.result.count', { count: logs.length })})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {t('history.result.empty')}
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                            {getOperationTypeLabel(log.operationType)}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${STATUS_CLASSES[log.status]}`}
                          >
                            {getStatusLabel(log.status)}
                          </span>
                          <span className="text-sm font-medium">{log.tokenSymbol}</span>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {log.details}
                        </div>
                        {log.txHash && (
                          <div className="mt-2">
                            <button
                              onClick={() => handleOpenTx(log.txHash!)}
                              className="text-xs text-primary hover:underline"
                            >
                              TX: {shortenTxHash(log.txHash)}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
