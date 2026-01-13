import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert';
import type { Token } from '@shared/types';

interface MintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: Token;
  onSuccess: () => void;
}

type DialogState = 'input' | 'confirm' | 'processing' | 'success' | 'error';

export function MintDialog({ open, onOpenChange, token, onSuccess }: MintDialogProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<DialogState>('input');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setState('input');
      setRecipient('');
      setAmount('');
      setGasEstimate(null);
      setTxHash(null);
      setError(null);
    }
  }, [open]);

  const validateAddress = async (address: string): Promise<boolean> => {
    try {
      return await window.electronAPI.validateAddress(address);
    } catch {
      return false;
    }
  };

  const handleEstimateGas = async () => {
    setError(null);

    if (!recipient) {
      setError(t('mint.invalidAddress'));
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError(t('mint.invalidAmount'));
      return;
    }

    const isValid = await validateAddress(recipient);
    if (!isValid) {
      setError(t('mint.invalidAddress'));
      return;
    }

    try {
      const estimate = await window.electronAPI.estimateMintGas(
        token.address,
        recipient,
        amount
      );
      setGasEstimate(estimate.totalCost);
      setState('confirm');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('mint.failed'));
    }
  };

  const handleMint = async () => {
    setState('processing');
    setError(null);

    try {
      const result = await window.electronAPI.mint({
        tokenAddress: token.address,
        recipient,
        amount,
      });

      setTxHash(result.txHash);
      setState('success');
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('mint.failed'));
      setState('error');
    }
  };

  const handleOpenExplorer = async () => {
    if (txHash) {
      const url = await window.electronAPI.getPolygonscanUrl(txHash);
      await window.electronAPI.openExternalLink(url);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('mint.title')} - {token.symbol}</DialogTitle>
          <DialogDescription>
            {token.name}
          </DialogDescription>
        </DialogHeader>

        {/* Input State */}
        {state === 'input' && (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="recipient">{t('mint.recipient')}</Label>
              <Input
                id="recipient"
                placeholder={t('mint.recipientPlaceholder')}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{t('mint.amount')}</Label>
              <Input
                id="amount"
                type="number"
                placeholder={t('mint.amountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleEstimateGas}>{t('common.confirm')}</Button>
            </DialogFooter>
          </div>
        )}

        {/* Confirm State */}
        {state === 'confirm' && (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>{t('mint.confirmTitle')}</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="font-medium">{t('addToken.symbol')}:</span> {token.symbol}
                  </div>
                  <div>
                    <span className="font-medium">{t('mint.recipient')}:</span>{' '}
                    <code className="text-xs">{recipient}</code>
                  </div>
                  <div>
                    <span className="font-medium">{t('mint.amount')}:</span> {amount} {token.symbol}
                  </div>
                  <div>
                    <span className="font-medium">{t('mint.gasEstimate')}:</span> {gasEstimate} POL
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={() => setState('input')}>
                {t('common.back')}
              </Button>
              <Button onClick={handleMint}>{t('mint.execute')}</Button>
            </DialogFooter>
          </div>
        )}

        {/* Processing State */}
        {state === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <div className="animate-spin mx-auto w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
            <div className="text-muted-foreground">{t('transaction.pending')}</div>
          </div>
        )}

        {/* Success State */}
        {state === 'success' && (
          <div className="space-y-4">
            <Alert variant="success">
              <AlertTitle>{t('mint.success')}</AlertTitle>
              <AlertDescription>
                <div className="mt-2">
                  <span className="font-medium">{t('mint.txHash')}:</span>
                  <code className="block text-xs mt-1 break-all">{txHash}</code>
                </div>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={handleOpenExplorer}>
                {t('transaction.viewOnPolygonscan')}
              </Button>
              <Button onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
            </DialogFooter>
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>{t('mint.failed')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={() => setState('input')}>
                {t('common.back')}
              </Button>
              <Button onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
