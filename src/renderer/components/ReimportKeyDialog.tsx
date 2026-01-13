import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog';

interface ReimportKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReimportKeyDialog({ open, onOpenChange }: ReimportKeyDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'warning' | 'input'>('warning');
  const [privateKey, setPrivateKey] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setStep('warning');
    setPrivateKey('');
    setPin('');
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setError(null);

    // Clean private key
    let cleanKey = privateKey.trim();
    if (cleanKey.startsWith('0x')) {
      cleanKey = cleanKey.slice(2);
    }

    // Validate format
    if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
      setError(t('setup.privateKey.invalidFormat'));
      return;
    }

    // Validate PIN
    if (pin.length < 8) {
      setError(t('setup.pinSetup.minLength'));
      return;
    }

    if (!/[a-zA-Z]/.test(pin)) {
      setError(t('setup.pinSetup.requireLetter'));
      return;
    }

    if (!/[0-9]/.test(pin)) {
      setError(t('setup.pinSetup.requireNumber'));
      return;
    }

    setLoading(true);

    try {
      const result = await window.electronAPI.importPrivateKey(cleanKey, pin);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          // Reload the page to apply new wallet
          window.location.reload();
        }, 1500);
      } else {
        setError(t('settings.privateKey.failed'));
      }
    } catch {
      setError(t('settings.privateKey.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.privateKey.reimport')}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success ? (
          <Alert>
            <AlertDescription className="text-green-600">
              {t('settings.privateKey.success')}
            </AlertDescription>
          </Alert>
        ) : step === 'warning' ? (
          <Alert variant="warning">
            <AlertTitle>{t('settings.privateKey.title')}</AlertTitle>
            <AlertDescription>
              {t('settings.privateKey.warning')}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="privateKey">{t('setup.privateKey.label')}</Label>
              <Input
                id="privateKey"
                type="password"
                placeholder={t('setup.privateKey.placeholder')}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">{t('setup.pinSetup.label')}</Label>
              <Input
                id="pin"
                type="password"
                placeholder={t('setup.pinSetup.placeholder')}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                {t('setup.pinSetup.req1')}, {t('setup.pinSetup.req2')}, {t('setup.pinSetup.req3')}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          {!success && (
            step === 'warning' ? (
              <Button onClick={() => setStep('input')}>
                {t('common.next')}
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? t('common.loading') : t('common.confirm')}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
