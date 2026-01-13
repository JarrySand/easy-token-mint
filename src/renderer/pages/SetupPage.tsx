import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@renderer/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert';
import type { NetworkType } from '@shared/types';

interface SetupPageProps {
  onComplete: () => void;
}

type Step = 'private-key' | 'pin' | 'network' | 'confirm';

export function SetupPage({ onComplete }: SetupPageProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('private-key');
  const [privateKey, setPrivateKey] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [network, setNetwork] = useState<NetworkType>('mainnet');
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate PIN strength
  const getPinStrength = (p: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (p.length >= 8) score += 25;
    if (p.length >= 12) score += 15;
    if (/[a-z]/.test(p)) score += 15;
    if (/[A-Z]/.test(p)) score += 15;
    if (/[0-9]/.test(p)) score += 15;
    if (/[^a-zA-Z0-9]/.test(p)) score += 15;

    if (score < 40) return { score, label: t('setup.pinSetup.weak'), color: 'bg-red-500' };
    if (score < 70) return { score, label: t('setup.pinSetup.medium'), color: 'bg-yellow-500' };
    return { score, label: t('setup.pinSetup.strong'), color: 'bg-green-500' };
  };

  const strength = getPinStrength(pin);

  const handlePrivateKeyNext = async () => {
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

    // Get address preview
    try {
      // We'll validate by importing and checking the address
      // For now, just move to next step
      setPrivateKey(cleanKey);
      setStep('pin');
    } catch {
      setError(t('setup.privateKey.processingFailed'));
    }
  };

  const handlePinNext = () => {
    setError(null);

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

    if (pin !== pinConfirm) {
      setError(t('setup.pinSetup.mismatch'));
      return;
    }

    setStep('network');
  };

  const handleNetworkNext = () => {
    setStep('confirm');
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Import private key with PIN encryption
      const result = await window.electronAPI.importPrivateKey(privateKey, pin);

      if (!result.success) {
        setError(t('setup.privateKey.importFailed'));
        return;
      }

      setAddress(result.address);

      // Set network
      await window.electronAPI.setNetwork(network);

      onComplete();
    } catch (err) {
      setError(t('setup.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const getStepDescription = () => {
    const stepNum = step === 'private-key' ? 1 : step === 'pin' ? 2 : step === 'network' ? 3 : 4;
    const stepTitle = step === 'private-key' ? t('setup.privateKey.title')
      : step === 'pin' ? t('setup.pinSetup.title')
      : step === 'network' ? t('setup.network.title')
      : t('setup.confirm.title');
    return `${t('setup.step', { current: stepNum, total: 4 })}: ${stepTitle}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t('setup.title')}</CardTitle>
          <CardDescription>{getStepDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Private Key */}
          {step === 'private-key' && (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>{t('setup.privateKey.description')}</AlertTitle>
                <AlertDescription>
                  {t('setup.privateKey.info')}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="privateKey">{t('setup.privateKey.label')}</Label>
                <Input
                  id="privateKey"
                  type="password"
                  placeholder={t('setup.privateKey.placeholder')}
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                />
              </div>

              <Button onClick={handlePrivateKeyNext} className="w-full">
                {t('common.next')}
              </Button>
            </div>
          )}

          {/* Step 2: PIN */}
          {step === 'pin' && (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>{t('setup.pinSetup.requirements')}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm">
                    <li>{t('setup.pinSetup.req1')}</li>
                    <li>{t('setup.pinSetup.req2')}</li>
                    <li>{t('setup.pinSetup.req3')}</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="pin">{t('setup.pinSetup.label')}</Label>
                <Input
                  id="pin"
                  type="password"
                  placeholder={t('setup.pinSetup.placeholder')}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
                {pin && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{t('setup.pinSetup.strength')}: {strength.label}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full">
                      <div
                        className={`h-2 rounded-full transition-all ${strength.color}`}
                        style={{ width: `${strength.score}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pinConfirm">{t('setup.pinSetup.confirmLabel')}</Label>
                <Input
                  id="pinConfirm"
                  type="password"
                  placeholder={t('setup.pinSetup.confirmPlaceholder')}
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('private-key')} className="flex-1">
                  {t('common.back')}
                </Button>
                <Button onClick={handlePinNext} className="flex-1">
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Network */}
          {step === 'network' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('setup.network.title')}</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      network === 'mainnet'
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setNetwork('mainnet')}
                  >
                    <div className="font-medium">{t('app.network.mainnet')}</div>
                    <div className="text-sm text-muted-foreground">{t('setup.network.mainnetDesc')}</div>
                  </button>
                  <button
                    type="button"
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      network === 'testnet'
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setNetwork('testnet')}
                  >
                    <div className="font-medium">{t('app.network.testnet')}</div>
                    <div className="text-sm text-muted-foreground">{t('setup.network.testnetDesc')}</div>
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('pin')} className="flex-1">
                  {t('common.back')}
                </Button>
                <Button onClick={handleNetworkNext} className="flex-1">
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>{t('setup.confirm.reviewTitle')}</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-2">
                    <div>
                      <span className="font-medium">{t('setup.confirm.networkLabel')}:</span>{' '}
                      {network === 'mainnet' ? t('setup.confirm.mainnet') : t('setup.confirm.testnet')}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <Alert variant="warning">
                <AlertDescription>
                  {t('setup.confirm.warning')}
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('network')} className="flex-1">
                  {t('common.back')}
                </Button>
                <Button onClick={handleComplete} className="flex-1" disabled={isLoading}>
                  {isLoading ? t('setup.confirm.completing') : t('setup.confirm.complete')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
