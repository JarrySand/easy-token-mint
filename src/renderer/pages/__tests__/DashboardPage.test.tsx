import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardPage } from '../DashboardPage';
import type { AppConfig, WalletInfo, Token } from '@shared/types';

// Mock child components
vi.mock('@renderer/components/MintDialog', () => ({
  MintDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="mint-dialog">MintDialog<button onClick={() => onOpenChange(false)}>Close</button></div> : null,
}));

vi.mock('@renderer/components/AddTokenDialog', () => ({
  AddTokenDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="add-token-dialog">AddTokenDialog<button onClick={() => onOpenChange(false)}>Close</button></div> : null,
}));

vi.mock('@renderer/components/BatchMintDialog', () => ({
  BatchMintDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="batch-mint-dialog">BatchMintDialog<button onClick={() => onOpenChange(false)}>Close</button></div> : null,
}));

vi.mock('@renderer/components/DeployTokenDialog', () => ({
  DeployTokenDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="deploy-dialog">DeployTokenDialog<button onClick={() => onOpenChange(false)}>Close</button></div> : null,
}));

vi.mock('@renderer/components/RoleManagementDialog', () => ({
  RoleManagementDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="role-dialog">RoleManagementDialog<button onClick={() => onOpenChange(false)}>Close</button></div> : null,
}));

// Mock copyToClipboard utility
const mockCopyToClipboard = vi.fn().mockResolvedValue(undefined);
vi.mock('@renderer/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/utils')>('@renderer/lib/utils');
  return {
    ...actual,
    copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
  };
});

describe('DashboardPage', () => {
  const mockOnRefresh = vi.fn();
  const mockOnTokensChange = vi.fn();
  const mockOnNavigateToHistory = vi.fn();
  const mockOnNavigateToSettings = vi.fn();

  const defaultConfig: AppConfig = {
    version: '1.0.0',
    network: 'testnet',
    language: 'ja',
    walletAddress: '0x1234567890123456789012345678901234567890',
    alertThresholds: {
      warning: 1.0,
      danger: 0.1,
    },
    sessionTimeoutMinutes: 30,
    batchMinterAddresses: {
      mainnet: '0xBatchMainnet',
      testnet: '0xBatchTestnet',
    },
  };

  const defaultWalletInfo: WalletInfo = {
    address: '0x1234567890123456789012345678901234567890',
    balance: '5.0',
  };

  const sampleToken: Token = {
    id: 1,
    address: '0xTokenAddress1234567890123456789012345678',
    name: 'Test Token',
    symbol: 'TEST',
    decimals: 18,
    network: 'testnet',
    hasMinterRole: true,
    maxSupply: '1000000',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const renderDashboard = (props: Partial<Parameters<typeof DashboardPage>[0]> = {}) => {
    return render(
      <DashboardPage
        config={defaultConfig}
        walletInfo={defaultWalletInfo}
        tokens={[sampleToken]}
        onRefresh={mockOnRefresh}
        onTokensChange={mockOnTokensChange}
        onNavigateToHistory={mockOnNavigateToHistory}
        onNavigateToSettings={mockOnNavigateToSettings}
        {...props}
      />
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header', () => {
    it('TC-DASH-001: should render app title', () => {
      renderDashboard();
      expect(screen.getByText('app.title')).toBeInTheDocument();
    });

    it('TC-DASH-002: should display current network', () => {
      renderDashboard();
      expect(screen.getByText('app.network.testnet')).toBeInTheDocument();
    });

    it('should display mainnet badge when on mainnet', () => {
      renderDashboard({
        config: { ...defaultConfig, network: 'mainnet' },
      });
      expect(screen.getByText('app.network.mainnet')).toBeInTheDocument();
    });

    it('TC-DASH-003: should call onNavigateToHistory when clicking history button', async () => {
      const user = userEvent.setup();
      renderDashboard();

      const historyButton = screen.getByRole('button', { name: 'common.history' });
      await user.click(historyButton);

      expect(mockOnNavigateToHistory).toHaveBeenCalled();
    });

    it('TC-DASH-004: should call onNavigateToSettings when clicking settings button', async () => {
      const user = userEvent.setup();
      renderDashboard();

      const settingsButton = screen.getByRole('button', { name: 'common.settings' });
      await user.click(settingsButton);

      expect(mockOnNavigateToSettings).toHaveBeenCalled();
    });

    it('TC-DASH-005: should call onRefresh when clicking refresh button', async () => {
      const user = userEvent.setup();
      renderDashboard();

      const refreshButton = screen.getByRole('button', { name: 'common.refresh' });
      await user.click(refreshButton);

      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  describe('Wallet Info', () => {
    it('TC-DASH-006: should display wallet address (shortened)', () => {
      renderDashboard();
      // shortenAddress with 8 should show first 8 and last 8 chars
      expect(screen.getByText(/0x123456/)).toBeInTheDocument();
    });

    it('TC-DASH-007: should display wallet balance', () => {
      renderDashboard();
      expect(screen.getByText(/5\.0.*POL/)).toBeInTheDocument();
    });

    it('should show "not connected" when wallet info is null', () => {
      renderDashboard({ walletInfo: null });
      expect(screen.getByText('dashboard.wallet.notConnected')).toBeInTheDocument();
    });

    it('TC-DASH-008: should copy address to clipboard when clicking copy button', async () => {
      const user = userEvent.setup();
      renderDashboard();

      const copyButton = screen.getByRole('button', { name: 'common.copy' });
      await user.click(copyButton);

      expect(mockCopyToClipboard).toHaveBeenCalledWith(defaultWalletInfo.address);
    });

    it('should show "copied" message after copying', async () => {
      const user = userEvent.setup();
      renderDashboard();

      const copyButton = screen.getByRole('button', { name: 'common.copy' });
      await user.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText('common.copied')).toBeInTheDocument();
      });
    });

    it('should disable copy button when no wallet address', () => {
      renderDashboard({ walletInfo: null });
      const copyButton = screen.getByRole('button', { name: 'common.copy' });
      expect(copyButton).toBeDisabled();
    });
  });

  describe('Balance Alerts', () => {
    it('TC-DASH-009: should show warning alert when balance is low', () => {
      renderDashboard({
        walletInfo: { ...defaultWalletInfo, balance: '0.5' },
      });
      expect(screen.getByText('dashboard.alert.warning.title')).toBeInTheDocument();
    });

    it('TC-DASH-010: should show danger alert when balance is critical', () => {
      renderDashboard({
        walletInfo: { ...defaultWalletInfo, balance: '0.05' },
      });
      expect(screen.getByText('dashboard.alert.danger.title')).toBeInTheDocument();
    });

    it('should not show alert when balance is normal', () => {
      renderDashboard();
      expect(screen.queryByText('dashboard.alert.warning.title')).not.toBeInTheDocument();
      expect(screen.queryByText('dashboard.alert.danger.title')).not.toBeInTheDocument();
    });
  });

  describe('Token List', () => {
    it('TC-DASH-011: should display token cards', () => {
      renderDashboard();
      expect(screen.getByText('TEST')).toBeInTheDocument();
      expect(screen.getByText('Test Token')).toBeInTheDocument();
    });

    it('should show empty message when no tokens', () => {
      renderDashboard({ tokens: [] });
      expect(screen.getByText('dashboard.tokens.empty')).toBeInTheDocument();
    });

    it('TC-DASH-012: should show minter role badge for tokens with role', () => {
      renderDashboard();
      expect(screen.getByText('dashboard.tokens.hasMinterRole')).toBeInTheDocument();
    });

    it('should show no role badge for tokens without role', () => {
      const tokenWithoutRole = { ...sampleToken, hasMinterRole: false };
      renderDashboard({ tokens: [tokenWithoutRole] });
      expect(screen.getByText('dashboard.tokens.noRole')).toBeInTheDocument();
    });

    it('TC-DASH-013: should enable mint button for tokens with minter role', () => {
      renderDashboard();
      const mintButton = screen.getByRole('button', { name: 'dashboard.tokens.singleMint' });
      expect(mintButton).not.toBeDisabled();
    });

    it('TC-DASH-014: should disable mint button for tokens without minter role', () => {
      const tokenWithoutRole = { ...sampleToken, hasMinterRole: false };
      renderDashboard({ tokens: [tokenWithoutRole] });
      const mintButton = screen.getByRole('button', { name: 'dashboard.tokens.singleMint' });
      expect(mintButton).toBeDisabled();
    });

    it('should display multiple tokens', () => {
      const tokens = [
        sampleToken,
        { ...sampleToken, id: 2, symbol: 'TEST2', name: 'Test Token 2' },
      ];
      renderDashboard({ tokens });
      expect(screen.getByText('TEST')).toBeInTheDocument();
      expect(screen.getByText('TEST2')).toBeInTheDocument();
    });
  });

  describe('Dialogs', () => {
    it('TC-DASH-015: should open deploy dialog when clicking deploy button', async () => {
      const user = userEvent.setup();
      renderDashboard();

      const deployButton = screen.getByRole('button', { name: 'dashboard.tokens.deploy' });
      await user.click(deployButton);

      expect(screen.getByTestId('deploy-dialog')).toBeInTheDocument();
    });

    it('TC-DASH-016: should open add token dialog when clicking add token button', async () => {
      const user = userEvent.setup();
      renderDashboard();

      const addButton = screen.getByRole('button', { name: 'dashboard.tokens.addToken' });
      await user.click(addButton);

      expect(screen.getByTestId('add-token-dialog')).toBeInTheDocument();
    });

    it('TC-DASH-017: should open mint dialog when clicking single mint button', async () => {
      const user = userEvent.setup();
      renderDashboard();

      const mintButton = screen.getByRole('button', { name: 'dashboard.tokens.singleMint' });
      await user.click(mintButton);

      expect(screen.getByTestId('mint-dialog')).toBeInTheDocument();
    });

    it('TC-DASH-018: should open batch mint dialog when clicking batch mint button', async () => {
      const user = userEvent.setup();
      renderDashboard();

      const batchMintButton = screen.getByRole('button', { name: 'dashboard.tokens.batchMint' });
      await user.click(batchMintButton);

      expect(screen.getByTestId('batch-mint-dialog')).toBeInTheDocument();
    });

    it('TC-DASH-019: should open role management dialog when clicking role management button', async () => {
      const user = userEvent.setup();
      renderDashboard();

      const roleButton = screen.getByRole('button', { name: 'dashboard.tokens.roleManagement' });
      await user.click(roleButton);

      expect(screen.getByTestId('role-dialog')).toBeInTheDocument();
    });

    it('should disable batch mint button when batchMinterAddress is not set', () => {
      renderDashboard({
        config: {
          ...defaultConfig,
          batchMinterAddresses: { mainnet: '', testnet: '' },
        },
      });
      const batchMintButton = screen.getByRole('button', { name: 'dashboard.tokens.batchMint' });
      expect(batchMintButton).toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null config gracefully', () => {
      renderDashboard({ config: null });
      // Should still render without crashing
      expect(screen.getByText('app.title')).toBeInTheDocument();
    });

    it('should handle zero balance', () => {
      renderDashboard({
        walletInfo: { ...defaultWalletInfo, balance: '0' },
      });
      expect(screen.getByText(/0.*POL/)).toBeInTheDocument();
      expect(screen.getByText('dashboard.alert.danger.title')).toBeInTheDocument();
    });

    it('should handle very large balance', () => {
      renderDashboard({
        walletInfo: { ...defaultWalletInfo, balance: '1000000.123456789' },
      });
      // formatBalance returns fixed decimal format without comma separators
      expect(screen.getByText(/1000000\.1235.*POL/)).toBeInTheDocument();
    });
  });
});
