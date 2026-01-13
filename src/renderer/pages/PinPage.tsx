import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@renderer/components/ui/card';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';

interface PinPageProps {
  onSuccess: () => void;
}

export function PinPage({ onSuccess }: PinPageProps) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);

  // Countdown timer for lock
  useEffect(() => {
    if (!lockUntil) {
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, lockUntil - Date.now());
      setRemainingTime(remaining);

      if (remaining === 0) {
        setLockUntil(null);
        setError(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pin) {
      setError(t('pin.required'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.verifyPin(pin);

      if (result.success) {
        onSuccess();
      } else if (result.lockUntil) {
        setLockUntil(result.lockUntil);
        setPin('');
        setError(t('pin.locked'));
      } else {
        setPin('');
        setError(t('pin.incorrect', { remaining: result.remainingAttempts }));
      }
    } catch {
      setError(t('pin.authFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isLocked = lockUntil !== null && remainingTime > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <CardTitle>{t('app.title')}</CardTitle>
          <CardDescription>{t('pin.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                  {isLocked && (
                    <div className="mt-2 font-mono text-lg">
                      {t('pin.lockCountdown', { time: formatTime(remainingTime) })}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Input
                type="password"
                placeholder={t('pin.placeholder')}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={isLoading || isLocked}
                autoFocus
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || isLocked}>
              {isLoading ? t('pin.loggingIn') : t('pin.login')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
