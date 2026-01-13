import React, { useState, useEffect, useCallback } from 'react';
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

interface RoleManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: Token;
  onSuccess: () => void;
}

type ActionState = 'idle' | 'processing' | 'success' | 'error';

export function RoleManagementDialog({
  open,
  onOpenChange,
  token,
  onSuccess,
}: RoleManagementDialogProps) {
  const { t } = useTranslation();
  const [minters, setMinters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMinterAddress, setNewMinterAddress] = useState('');
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionTxHash, setActionTxHash] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: 'grant' | 'revoke'; address: string } | null>(null);

  const loadMinters = useCallback(async () => {
    setLoading(true);
    try {
      const minterList = await window.electronAPI.getMinters(token.address);
      setMinters(minterList);
    } catch (err) {
      console.error('Failed to load minters:', err);
    } finally {
      setLoading(false);
    }
  }, [token.address]);

  useEffect(() => {
    if (open) {
      loadMinters();
      setNewMinterAddress('');
      setActionState('idle');
      setActionError(null);
      setActionTxHash(null);
      setPendingAction(null);
    }
  }, [open, loadMinters]);

  const handleGrantRole = async () => {
    if (!newMinterAddress) {
      setActionError(t('roleManagement.invalidAddress'));
      return;
    }

    try {
      const isValid = await window.electronAPI.validateAddress(newMinterAddress);
      if (!isValid) {
        setActionError(t('roleManagement.invalidAddress'));
        return;
      }
    } catch {
      setActionError(t('errors.unknown'));
      return;
    }

    if (minters.some((m) => m.toLowerCase() === newMinterAddress.toLowerCase())) {
      setActionError(t('errors.unknown'));
      return;
    }

    setPendingAction({ type: 'grant', address: newMinterAddress });
  };

  const handleRevokeRole = (address: string) => {
    setPendingAction({ type: 'revoke', address });
  };

  const executeAction = async () => {
    if (!pendingAction) return;

    setActionState('processing');
    setActionError(null);

    try {
      let result: { txHash: string };
      if (pendingAction.type === 'grant') {
        result = await window.electronAPI.grantMinterRole(token.address, pendingAction.address);
      } else {
        result = await window.electronAPI.revokeMinterRole(token.address, pendingAction.address);
      }

      setActionTxHash(result.txHash);
      setActionState('success');
      setNewMinterAddress('');
      await loadMinters();
      onSuccess();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t('errors.unknown'));
      setActionState('error');
    }
  };

  const cancelAction = () => {
    setPendingAction(null);
    setActionState('idle');
    setActionError(null);
  };

  const handleOpenExplorer = async () => {
    if (actionTxHash) {
      const url = await window.electronAPI.getPolygonscanUrl(actionTxHash);
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
          <DialogTitle>{t('roleManagement.title')} - {token.symbol}</DialogTitle>
          <DialogDescription>
            {token.name}
          </DialogDescription>
        </DialogHeader>

        {/* Pending Action Confirmation */}
        {pendingAction && actionState === 'idle' && (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>
                {pendingAction.type === 'grant' ? t('roleManagement.addMinter') : t('roleManagement.revoke')}
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2">
                  <span className="font-medium">{t('roleManagement.addMinterAddress')}:</span>
                  <code className="block text-xs mt-1 break-all bg-gray-100 p-2 rounded">
                    {pendingAction.address}
                  </code>
                </div>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={cancelAction}>
                {t('common.cancel')}
              </Button>
              <Button
                variant={pendingAction.type === 'revoke' ? 'destructive' : 'default'}
                onClick={executeAction}
              >
                {pendingAction.type === 'grant' ? t('roleManagement.add') : t('roleManagement.revoke')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Processing State */}
        {actionState === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <div className="animate-spin mx-auto w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
            <div className="text-muted-foreground">{t('transaction.pending')}</div>
          </div>
        )}

        {/* Success State */}
        {actionState === 'success' && (
          <div className="space-y-4">
            <Alert variant="success">
              <AlertTitle>
                {pendingAction?.type === 'grant' ? t('roleManagement.addSuccess') : t('roleManagement.revokeSuccess')}
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2">
                  <span className="font-medium">{t('mint.txHash')}:</span>
                  <code className="block text-xs mt-1 break-all">{actionTxHash}</code>
                </div>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={handleOpenExplorer}>
                {t('transaction.viewOnPolygonscan')}
              </Button>
              <Button onClick={cancelAction}>{t('common.close')}</Button>
            </DialogFooter>
          </div>
        )}

        {/* Error State */}
        {actionState === 'error' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>
                {pendingAction?.type === 'grant' ? t('roleManagement.addFailed') : t('roleManagement.revokeFailed')}
              </AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={cancelAction}>
                {t('common.back')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Main Content (when no pending action) */}
        {!pendingAction && actionState === 'idle' && (
          <div className="space-y-4">
            {actionError && (
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            {/* Add new minter */}
            <div className="space-y-3 border rounded-lg p-4">
              <Label>{t('roleManagement.addMinter')}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="0x..."
                  value={newMinterAddress}
                  onChange={(e) => {
                    setNewMinterAddress(e.target.value);
                    setActionError(null);
                  }}
                  className="flex-1"
                />
                <Button onClick={handleGrantRole} disabled={!newMinterAddress}>
                  {t('roleManagement.add')}
                </Button>
              </div>
            </div>

            {/* Current minters list */}
            <div className="space-y-3">
              <Label>{t('roleManagement.currentMinters')}</Label>
              {loading ? (
                <div className="py-4 text-center text-muted-foreground">{t('roleManagement.loading')}</div>
              ) : minters.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground border rounded-lg">
                  {t('roleManagement.noMinters')}
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {minters.map((minter) => (
                    <div
                      key={minter}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <code className="text-sm" title={minter}>
                        {shortenAddress(minter)}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeRole(minter)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {t('roleManagement.revoke')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
