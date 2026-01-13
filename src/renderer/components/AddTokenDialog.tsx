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
import { Alert, AlertDescription } from '@renderer/components/ui/alert';

interface AddTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddTokenDialog({ open, onOpenChange, onSuccess }: AddTokenDialogProps) {
  const { t } = useTranslation();
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAddress('');
      setError(null);
    }
  }, [open]);

  const handleAdd = async () => {
    setError(null);

    if (!address) {
      setError(t('addToken.invalidAddress'));
      return;
    }

    setIsLoading(true);

    try {
      await window.electronAPI.addToken(address);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('addToken.addFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addToken.title')}</DialogTitle>
          <DialogDescription>
            {t('addToken.address')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="tokenAddress">{t('addToken.address')}</Label>
            <Input
              id="tokenAddress"
              placeholder={t('addToken.addressPlaceholder')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAdd} disabled={isLoading}>
              {isLoading ? t('addToken.adding') : t('addToken.add')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
