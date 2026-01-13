import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@renderer/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@renderer/components/ui/dialog';
import type { NetworkType } from '@shared/types';

interface NetworkSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentNetwork: NetworkType;
  onConfirm: (network: NetworkType) => void;
}

export function NetworkSwitchDialog({
  open,
  onOpenChange,
  currentNetwork,
  onConfirm,
}: NetworkSwitchDialogProps) {
  const { t } = useTranslation();
  const targetNetwork = currentNetwork === 'mainnet' ? 'testnet' : 'mainnet';
  const targetLabel = targetNetwork === 'mainnet'
    ? t('settings.network.mainnet')
    : t('settings.network.testnet');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.network.confirmTitle')}</DialogTitle>
          <DialogDescription>
            {t('settings.network.confirmMessage', { network: targetLabel })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onConfirm(targetNetwork)}>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
