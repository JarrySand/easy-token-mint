import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog';

interface ChangePinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePinDialog({ open, onOpenChange }: ChangePinDialogProps) {
  const { t } = useTranslation();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setError(null);

    // Validate new PIN
    if (newPin.length < 8) {
      setError(t('setup.pinSetup.minLength'));
      return;
    }

    if (!/[a-zA-Z]/.test(newPin)) {
      setError(t('setup.pinSetup.requireLetter'));
      return;
    }

    if (!/[0-9]/.test(newPin)) {
      setError(t('setup.pinSetup.requireNumber'));
      return;
    }

    if (newPin !== confirmPin) {
      setError(t('setup.pinSetup.mismatch'));
      return;
    }

    setLoading(true);

    try {
      const result = await window.electronAPI.changePin(currentPin, newPin);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setError(t('settings.pin.currentIncorrect'));
      }
    } catch {
      setError(t('settings.pin.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.pin.change')}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success ? (
          <Alert>
            <AlertDescription className="text-green-600">
              {t('settings.pin.success')}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPin">{t('settings.pin.currentPin')}</Label>
              <Input
                id="currentPin"
                type="password"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPin">{t('settings.pin.newPin')}</Label>
              <Input
                id="newPin"
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPin">{t('settings.pin.confirmNewPin')}</Label>
              <Input
                id="confirmNewPin"
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          {!success && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? t('common.loading') : t('common.confirm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
