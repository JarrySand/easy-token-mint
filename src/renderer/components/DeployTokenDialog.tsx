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
import { Checkbox } from '@renderer/components/ui/checkbox';

interface DeployTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type DialogState = 'input' | 'confirm' | 'processing' | 'success' | 'error';

export function DeployTokenDialog({ open, onOpenChange, onSuccess }: DeployTokenDialogProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<DialogState>('input');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimals, setDecimals] = useState('18');
  const [hasCap, setHasCap] = useState(false);
  const [maxSupply, setMaxSupply] = useState('');
  const [hasInitialMint, setHasInitialMint] = useState(false);
  const [initialMintAmount, setInitialMintAmount] = useState('');
  const [initialMintRecipient, setInitialMintRecipient] = useState('');
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setState('input');
      setName('');
      setSymbol('');
      setDecimals('18');
      setHasCap(false);
      setMaxSupply('');
      setHasInitialMint(false);
      setInitialMintAmount('');
      setInitialMintRecipient('');
      setGasEstimate(null);
      setDeployedAddress(null);
      setTxHash(null);
      setError(null);
    }
  }, [open]);

  const validateInput = (): string | null => {
    if (!name.trim()) {
      return t('errors.invalidInput');
    }
    if (!symbol.trim()) {
      return t('errors.invalidInput');
    }
    if (symbol.length > 11) {
      return t('errors.invalidInput');
    }
    const dec = parseInt(decimals, 10);
    if (isNaN(dec) || dec < 0 || dec > 18) {
      return t('errors.invalidInput');
    }
    if (hasCap && (!maxSupply || parseFloat(maxSupply) <= 0)) {
      return t('errors.invalidInput');
    }
    if (hasInitialMint) {
      if (!initialMintAmount || parseFloat(initialMintAmount) <= 0) {
        return t('errors.invalidInput');
      }
      if (hasCap && parseFloat(initialMintAmount) > parseFloat(maxSupply)) {
        return t('errors.invalidInput');
      }
    }
    return null;
  };

  const handleEstimateGas = async () => {
    const validationError = validateInput();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    // Validate recipient address if initial mint is enabled
    if (hasInitialMint && initialMintRecipient) {
      try {
        const isValid = await window.electronAPI.validateAddress(initialMintRecipient);
        if (!isValid) {
          setError(t('mint.invalidAddress'));
          return;
        }
      } catch {
        setError(t('errors.unknown'));
        return;
      }
    }

    try {
      const params = {
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        decimals: parseInt(decimals, 10),
        maxSupply: hasCap ? maxSupply : null,
        initialMint: hasInitialMint
          ? {
              amount: initialMintAmount,
              recipient: initialMintRecipient || '', // Empty means use deployer's address
            }
          : null,
      };

      const estimate = await window.electronAPI.estimateDeployGas(params);
      setGasEstimate(estimate.totalCost);
      setState('confirm');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('deploy.failed'));
    }
  };

  const handleDeploy = async () => {
    setState('processing');
    setError(null);

    try {
      const params = {
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        decimals: parseInt(decimals, 10),
        maxSupply: hasCap ? maxSupply : null,
        initialMint: hasInitialMint
          ? {
              amount: initialMintAmount,
              recipient: initialMintRecipient || '',
            }
          : null,
      };

      const result = await window.electronAPI.deployToken(params);
      setDeployedAddress(result.address);
      setTxHash(result.txHash);
      setState('success');
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('deploy.failed'));
      setState('error');
    }
  };

  const handleOpenExplorer = async () => {
    if (txHash) {
      const url = await window.electronAPI.getPolygonscanUrl(txHash);
      await window.electronAPI.openExternalLink(url);
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('deploy.title')}</DialogTitle>
          <DialogDescription>
            Polygon Network
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{t('deploy.name')} *</Label>
                <Input
                  id="name"
                  placeholder={t('deploy.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="symbol">{t('deploy.symbol')} *</Label>
                <Input
                  id="symbol"
                  placeholder={t('deploy.symbolPlaceholder')}
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  maxLength={11}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="decimals">{t('deploy.decimals')}</Label>
              <Input
                id="decimals"
                type="number"
                min="0"
                max="18"
                value={decimals}
                onChange={(e) => setDecimals(e.target.value)}
              />
            </div>

            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasCap"
                  checked={hasCap}
                  onCheckedChange={(checked) => setHasCap(checked === true)}
                />
                <Label htmlFor="hasCap" className="cursor-pointer">
                  {t('deploy.limited')}
                </Label>
              </div>

              {hasCap && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="maxSupply">{t('deploy.maxSupplyAmount')}</Label>
                  <Input
                    id="maxSupply"
                    type="number"
                    placeholder="1000000"
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasInitialMint"
                  checked={hasInitialMint}
                  onCheckedChange={(checked) => setHasInitialMint(checked === true)}
                />
                <Label htmlFor="hasInitialMint" className="cursor-pointer">
                  {t('deploy.withInitialMint')}
                </Label>
              </div>

              {hasInitialMint && (
                <div className="space-y-3 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="initialMintAmount">{t('deploy.initialAmount')}</Label>
                    <Input
                      id="initialMintAmount"
                      type="number"
                      placeholder="100000"
                      value={initialMintAmount}
                      onChange={(e) => setInitialMintAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="initialMintRecipient">{t('deploy.initialRecipient')}</Label>
                    <Input
                      id="initialMintRecipient"
                      placeholder="0x..."
                      value={initialMintRecipient}
                      onChange={(e) => setInitialMintRecipient(e.target.value)}
                    />
                  </div>
                </div>
              )}
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
              <AlertTitle>{t('deploy.confirmTitle')}</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-2 text-sm">
                  <div>
                    <span className="font-medium">{t('deploy.name')}:</span> {name}
                  </div>
                  <div>
                    <span className="font-medium">{t('deploy.symbol')}:</span> {symbol.toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium">{t('deploy.decimals')}:</span> {decimals}
                  </div>
                  <div>
                    <span className="font-medium">{t('deploy.maxSupply')}:</span>{' '}
                    {hasCap ? `${maxSupply} ${symbol.toUpperCase()}` : t('deploy.unlimited')}
                  </div>
                  {hasInitialMint && (
                    <div>
                      <span className="font-medium">{t('deploy.initialMint')}:</span>{' '}
                      {initialMintAmount} {symbol.toUpperCase()}
                      {initialMintRecipient && (
                        <span className="block text-xs text-muted-foreground">
                          → {shortenAddress(initialMintRecipient)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <span className="font-medium">{t('deploy.gasEstimate')}:</span> {gasEstimate} POL
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={() => setState('input')}>
                {t('common.back')}
              </Button>
              <Button onClick={handleDeploy}>{t('deploy.execute')}</Button>
            </DialogFooter>
          </div>
        )}

        {/* Processing State */}
        {state === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <div className="animate-spin mx-auto w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
            <div className="text-muted-foreground">
              {t('deploy.executing')}
            </div>
          </div>
        )}

        {/* Success State */}
        {state === 'success' && (
          <div className="space-y-4">
            <Alert variant="success">
              <AlertTitle>{t('deploy.success')}</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="font-medium">{t('deploy.contractAddress')}:</span>
                    <code className="block text-xs mt-1 break-all bg-gray-100 p-2 rounded">
                      {deployedAddress}
                    </code>
                  </div>
                  <div>
                    <span className="font-medium">{t('mint.txHash')}:</span>
                    <code className="block text-xs mt-1 break-all">{txHash}</code>
                  </div>
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
              <AlertTitle>{t('deploy.failed')}</AlertTitle>
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
