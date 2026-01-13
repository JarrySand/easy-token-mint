import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MintDialog } from '../MintDialog';
import type { Token } from '@shared/types';

// Mock window.electronAPI
const mockValidateAddress = vi.fn();
const mockEstimateMintGas = vi.fn();
const mockMint = vi.fn();
const mockGetPolygonscanUrl = vi.fn();
const mockOpenExternalLink = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  (window as { electronAPI?: object }).electronAPI = {
    validateAddress: mockValidateAddress,
    estimateMintGas: mockEstimateMintGas,
    mint: mockMint,
    getPolygonscanUrl: mockGetPolygonscanUrl,
    openExternalLink: mockOpenExternalLink,
  };
});

describe('MintDialog', () => {
  const mockToken: Token = {
    id: 1,
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Token',
    symbol: 'TEST',
    decimals: 18,
    network: 'testnet',
    hasMinterRole: true,
    maxSupply: '10000000',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    token: mockToken,
    onSuccess: vi.fn(),
  };

  describe('Rendering', () => {
    it('TC-MINT-001: should render dialog with token info', () => {
      render(<MintDialog {...defaultProps} />);

      // Title includes token symbol: "mint.title - TEST"
      expect(screen.getByText(/mint.title.*TEST/)).toBeInTheDocument();
      expect(screen.getByText('Test Token')).toBeInTheDocument();
    });

    it('should render recipient and amount inputs', () => {
      render(<MintDialog {...defaultProps} />);

      expect(screen.getByLabelText('mint.recipient')).toBeInTheDocument();
      expect(screen.getByLabelText('mint.amount')).toBeInTheDocument();
    });

    it('should render confirm and cancel buttons', () => {
      render(<MintDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'common.confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
    });
  });

  describe('Input Validation', () => {
    it('TC-MINT-002: should show error for empty recipient', async () => {
      const user = userEvent.setup();
      render(<MintDialog {...defaultProps} />);

      const amountInput = screen.getByLabelText('mint.amount');
      await user.type(amountInput, '100');

      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('mint.invalidAddress')).toBeInTheDocument();
      });
    });

    it('TC-MINT-003: should show error for empty amount', async () => {
      const user = userEvent.setup();
      mockValidateAddress.mockResolvedValue(true);
      render(<MintDialog {...defaultProps} />);

      const recipientInput = screen.getByLabelText('mint.recipient');
      await user.type(recipientInput, '0x1234567890123456789012345678901234567890');

      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('mint.invalidAmount')).toBeInTheDocument();
      });
    });

    it('TC-MINT-004: should show error for invalid address', async () => {
      const user = userEvent.setup();
      mockValidateAddress.mockResolvedValue(false);
      render(<MintDialog {...defaultProps} />);

      const recipientInput = screen.getByLabelText('mint.recipient');
      const amountInput = screen.getByLabelText('mint.amount');

      await user.type(recipientInput, '0xinvalid');
      await user.type(amountInput, '100');

      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('mint.invalidAddress')).toBeInTheDocument();
      });
    });

    it('should show error for negative amount', async () => {
      const user = userEvent.setup();
      render(<MintDialog {...defaultProps} />);

      const recipientInput = screen.getByLabelText('mint.recipient');
      const amountInput = screen.getByLabelText('mint.amount');

      await user.type(recipientInput, '0x1234567890123456789012345678901234567890');
      await user.type(amountInput, '-100');

      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('mint.invalidAmount')).toBeInTheDocument();
      });
    });
  });

  describe('Gas Estimation', () => {
    it('TC-MINT-005: should show confirmation with gas estimate', async () => {
      const user = userEvent.setup();
      mockValidateAddress.mockResolvedValue(true);
      mockEstimateMintGas.mockResolvedValue({ totalCost: '0.005' });
      render(<MintDialog {...defaultProps} />);

      const recipientInput = screen.getByLabelText('mint.recipient');
      const amountInput = screen.getByLabelText('mint.amount');

      await user.type(recipientInput, '0x1234567890123456789012345678901234567890');
      await user.type(amountInput, '100');

      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/mint.confirmTitle/)).toBeInTheDocument();
        expect(screen.getByText(/0.005 POL/)).toBeInTheDocument();
      });
    });

    it('should show error when gas estimation fails', async () => {
      const user = userEvent.setup();
      mockValidateAddress.mockResolvedValue(true);
      mockEstimateMintGas.mockRejectedValue(new Error('Network error'));
      render(<MintDialog {...defaultProps} />);

      const recipientInput = screen.getByLabelText('mint.recipient');
      const amountInput = screen.getByLabelText('mint.amount');

      await user.type(recipientInput, '0x1234567890123456789012345678901234567890');
      await user.type(amountInput, '100');

      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Mint Execution', () => {
    it('TC-MINT-006: should execute mint and show success', async () => {
      const user = userEvent.setup();
      mockValidateAddress.mockResolvedValue(true);
      mockEstimateMintGas.mockResolvedValue({ totalCost: '0.005' });
      mockMint.mockResolvedValue({ txHash: '0xabc123' });
      render(<MintDialog {...defaultProps} />);

      // Input phase
      const recipientInput = screen.getByLabelText('mint.recipient');
      const amountInput = screen.getByLabelText('mint.amount');

      await user.type(recipientInput, '0x1234567890123456789012345678901234567890');
      await user.type(amountInput, '100');

      // Go to confirm phase
      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      // Execute mint
      await waitFor(() => {
        expect(screen.getByText(/mint.confirmTitle/)).toBeInTheDocument();
      });

      const executeButton = screen.getByRole('button', { name: 'mint.execute' });
      await user.click(executeButton);

      // Verify success
      await waitFor(() => {
        expect(screen.getByText(/mint.success/)).toBeInTheDocument();
        expect(screen.getByText('0xabc123')).toBeInTheDocument();
      });

      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });

    it('TC-MINT-007: should show error when mint fails', async () => {
      const user = userEvent.setup();
      mockValidateAddress.mockResolvedValue(true);
      mockEstimateMintGas.mockResolvedValue({ totalCost: '0.005' });
      mockMint.mockRejectedValue(new Error('Insufficient funds'));
      render(<MintDialog {...defaultProps} />);

      // Input phase
      const recipientInput = screen.getByLabelText('mint.recipient');
      const amountInput = screen.getByLabelText('mint.amount');

      await user.type(recipientInput, '0x1234567890123456789012345678901234567890');
      await user.type(amountInput, '100');

      // Go to confirm phase
      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      // Execute mint
      await waitFor(() => {
        expect(screen.getByText(/mint.confirmTitle/)).toBeInTheDocument();
      });

      const executeButton = screen.getByRole('button', { name: 'mint.execute' });
      await user.click(executeButton);

      // Verify error
      await waitFor(() => {
        expect(screen.getByText(/mint.failed/)).toBeInTheDocument();
        expect(screen.getByText('Insufficient funds')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should allow going back from confirm to input', async () => {
      const user = userEvent.setup();
      mockValidateAddress.mockResolvedValue(true);
      mockEstimateMintGas.mockResolvedValue({ totalCost: '0.005' });
      render(<MintDialog {...defaultProps} />);

      const recipientInput = screen.getByLabelText('mint.recipient');
      const amountInput = screen.getByLabelText('mint.amount');

      await user.type(recipientInput, '0x1234567890123456789012345678901234567890');
      await user.type(amountInput, '100');

      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'common.back' })).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: 'common.back' });
      await user.click(backButton);

      // Should be back at input state
      await waitFor(() => {
        expect(screen.getByLabelText('mint.recipient')).toBeInTheDocument();
      });
    });

    it('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<MintDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'common.cancel' });
      await user.click(cancelButton);

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('External Link', () => {
    it('should open Polygonscan when view transaction is clicked', async () => {
      const user = userEvent.setup();
      mockValidateAddress.mockResolvedValue(true);
      mockEstimateMintGas.mockResolvedValue({ totalCost: '0.005' });
      mockMint.mockResolvedValue({ txHash: '0xabc123' });
      mockGetPolygonscanUrl.mockResolvedValue('https://polygonscan.com/tx/0xabc123');
      render(<MintDialog {...defaultProps} />);

      // Complete mint flow
      const recipientInput = screen.getByLabelText('mint.recipient');
      const amountInput = screen.getByLabelText('mint.amount');

      await user.type(recipientInput, '0x1234567890123456789012345678901234567890');
      await user.type(amountInput, '100');

      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'mint.execute' })).toBeInTheDocument();
      });

      const executeButton = screen.getByRole('button', { name: 'mint.execute' });
      await user.click(executeButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'transaction.viewOnPolygonscan' })).toBeInTheDocument();
      });

      const viewButton = screen.getByRole('button', { name: 'transaction.viewOnPolygonscan' });
      await user.click(viewButton);

      expect(mockGetPolygonscanUrl).toHaveBeenCalledWith('0xabc123');
      expect(mockOpenExternalLink).toHaveBeenCalledWith('https://polygonscan.com/tx/0xabc123');
    });
  });

  describe('State Reset', () => {
    it('should reset state when dialog opens', async () => {
      const { rerender } = render(<MintDialog {...defaultProps} open={false} />);

      // Open the dialog
      rerender(<MintDialog {...defaultProps} open={true} />);

      await waitFor(() => {
        expect(screen.getByLabelText('mint.recipient')).toHaveValue('');
        expect(screen.getByLabelText('mint.amount')).toHaveValue(null);
      });
    });
  });
});
