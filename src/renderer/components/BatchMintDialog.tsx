import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert';
import { Label } from '@renderer/components/ui/label';
import type { Token } from '@shared/types';

interface BatchMintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: Token;
  batchMinterAddress: string;
  onSuccess: () => void;
}

interface CsvRow {
  lineNumber: number;
  address: string;
  amount: string;
  isValid: boolean;
  error?: string;
}

interface BatchResult {
  address: string;
  amount: string;
  success: boolean;
  error?: string;
}

type DialogState = 'upload' | 'preview' | 'confirm' | 'processing' | 'result';

export function BatchMintDialog({
  open,
  onOpenChange,
  token,
  batchMinterAddress,
  onSuccess,
}: BatchMintDialogProps) {
  const [state, setState] = useState<DialogState>('upload');
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState('0');
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing state
  const [processingBatch, setProcessingBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);

  // Result state
  const [results, setResults] = useState<BatchResult[]>([]);
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      resetState();
    }
  }, [open]);

  const resetState = () => {
    setState('upload');
    setCsvRows([]);
    setValidCount(0);
    setInvalidCount(0);
    setTotalAmount('0');
    setSkipInvalid(false);
    setGasEstimate(null);
    setError(null);
    setFileName(null);
    setProcessingBatch(0);
    setTotalBatches(0);
    setResults([]);
    setTxHashes([]);
    setSuccessCount(0);
    setFailedCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    try {
      const content = await file.text();
      const result = await window.electronAPI.parseCsv(content);

      setCsvRows(result.rows);
      setValidCount(result.validCount);
      setInvalidCount(result.invalidCount);
      setTotalAmount(result.totalAmount);
      setState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSVファイルの読み込みに失敗しました');
    }
  };

  const handleProceedToConfirm = async () => {
    setError(null);

    const recipientsToMint = skipInvalid
      ? csvRows.filter(r => r.isValid)
      : csvRows;

    if (recipientsToMint.length === 0) {
      setError('発行対象が0件です');
      return;
    }

    // Calculate batches
    const batchCount = Math.ceil(recipientsToMint.length / 100);
    setTotalBatches(batchCount);

    // Estimate gas for first batch
    try {
      const sampleRecipients = recipientsToMint.slice(0, Math.min(100, recipientsToMint.length));
      const estimate = await window.electronAPI.estimateBatchMintGas(
        batchMinterAddress,
        token.address,
        sampleRecipients.map(r => ({ address: r.address, amount: r.amount }))
      );
      setGasEstimate(estimate.totalCost);
      setState('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ガス見積に失敗しました');
    }
  };

  const handleExecuteBatchMint = async () => {
    setState('processing');
    setError(null);

    const recipientsToMint = (skipInvalid
      ? csvRows.filter(r => r.isValid)
      : csvRows
    ).map(r => ({ address: r.address, amount: r.amount }));

    try {
      const result = await window.electronAPI.batchMintFull({
        tokenAddress: token.address,
        recipients: recipientsToMint,
        skipInvalid,
        batchMinterAddress,
      });

      setResults(result.results);
      setTxHashes(result.txHashes);
      setSuccessCount(result.successCount);
      setFailedCount(result.failedCount);
      setState('result');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '一括発行に失敗しました');
      setState('result');
    }
  };

  const handleExportFailedCsv = async () => {
    const failedRows = results
      .filter(r => !r.success)
      .map(r => ({
        address: r.address,
        amount: r.amount,
        error: r.error || 'Unknown error',
      }));

    if (failedRows.length === 0) return;

    const csvContent = await window.electronAPI.generateFailedCsv(failedRows);

    // Download the CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed_mint_${token.symbol}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenExplorer = async (txHash: string) => {
    const url = await window.electronAPI.getPolygonscanUrl(txHash);
    await window.electronAPI.openExternalLink(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CSV一括発行 - {token.symbol}</DialogTitle>
          <DialogDescription>
            CSVファイルから複数アドレスへ一括でトークンを発行します
          </DialogDescription>
        </DialogHeader>

        {/* Upload State */}
        {state === 'upload' && (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>CSVファイルを選択</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-file-input"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  ファイルを選択
                </Button>
                {fileName && (
                  <span className="text-sm text-muted-foreground">{fileName}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                CSVフォーマット: address,amount (ヘッダー行は任意)
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Preview State */}
        {state === 'preview' && (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">有効な行:</span>{' '}
                <span className="text-green-600">{validCount}件</span>
              </div>
              <div>
                <span className="font-medium">無効な行:</span>{' '}
                <span className={invalidCount > 0 ? 'text-red-600' : ''}>{invalidCount}件</span>
              </div>
              <div>
                <span className="font-medium">合計発行量:</span> {totalAmount} {token.symbol}
              </div>
            </div>

            <div className="border rounded-md max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left p-2">行</th>
                    <th className="text-left p-2">アドレス</th>
                    <th className="text-left p-2">発行量</th>
                    <th className="text-left p-2">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={row.isValid ? '' : 'bg-red-50 dark:bg-red-950/20'}
                    >
                      <td className="p-2">{row.lineNumber}</td>
                      <td className="p-2 font-mono text-xs truncate max-w-[200px]">
                        {row.address}
                      </td>
                      <td className="p-2">{row.amount}</td>
                      <td className="p-2">
                        {row.isValid ? (
                          <span className="text-green-600">OK</span>
                        ) : (
                          <span className="text-red-600" title={row.error}>
                            {row.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidCount > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="skip-invalid"
                  checked={skipInvalid}
                  onChange={(e) => setSkipInvalid(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="skip-invalid" className="text-sm">
                  無効なアドレスをスキップして続行
                </Label>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={resetState}>
                戻る
              </Button>
              <Button onClick={handleProceedToConfirm}>
                確認画面へ
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Confirm State */}
        {state === 'confirm' && (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>一括発行の確認</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="font-medium">トークン:</span> {token.symbol}
                  </div>
                  <div>
                    <span className="font-medium">発行件数:</span>{' '}
                    {skipInvalid ? validCount : csvRows.length}件
                  </div>
                  <div>
                    <span className="font-medium">バッチ数:</span> {totalBatches}回
                    <span className="text-muted-foreground ml-1">
                      (1バッチ最大100件)
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">合計発行量:</span> {totalAmount} {token.symbol}
                  </div>
                  <div>
                    <span className="font-medium">推定ガス代 (1バッチ):</span>{' '}
                    {gasEstimate} MATIC
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={() => setState('preview')}>
                戻る
              </Button>
              <Button onClick={handleExecuteBatchMint}>一括発行を実行</Button>
            </DialogFooter>
          </div>
        )}

        {/* Processing State */}
        {state === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <div className="animate-spin mx-auto w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
            <div className="text-muted-foreground">
              バッチ処理中... ({processingBatch}/{totalBatches})
            </div>
          </div>
        )}

        {/* Result State */}
        {state === 'result' && (
          <div className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>一括発行に失敗しました</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <Alert variant={failedCount > 0 ? 'warning' : 'success'}>
                <AlertTitle>一括発行が完了しました</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1">
                    <div>
                      <span className="text-green-600 font-medium">{successCount}件成功</span>
                      {failedCount > 0 && (
                        <span className="text-red-600 font-medium ml-2">
                          / {failedCount}件失敗
                        </span>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {txHashes.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto p-2">
                <Label className="text-sm font-medium">トランザクション</Label>
                {txHashes.map((hash, idx) => (
                  <div key={idx} className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      バッチ {idx + 1}:
                    </span>
                    <code className="text-xs truncate flex-1">{hash}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenExplorer(hash)}
                    >
                      確認
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {failedCount > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-red-600">
                  失敗した発行 ({failedCount}件)
                </Label>
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="text-left p-2">アドレス</th>
                        <th className="text-left p-2">発行量</th>
                        <th className="text-left p-2">エラー</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results
                        .filter(r => !r.success)
                        .map((r, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-mono truncate max-w-[150px]">
                              {r.address}
                            </td>
                            <td className="p-2">{r.amount}</td>
                            <td className="p-2 text-red-600">{r.error}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportFailedCsv}
                >
                  失敗分をCSV出力
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>閉じる</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
