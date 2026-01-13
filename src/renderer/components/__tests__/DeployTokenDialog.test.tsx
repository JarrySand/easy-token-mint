import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeployTokenDialog } from '../DeployTokenDialog';

// Mock window.electronAPI
const mockDeployToken = vi.fn();
const mockEstimateDeployGas = vi.fn();
const mockValidateAddress = vi.fn();
const mockGetPolygonscanUrl = vi.fn();
const mockOpenExternalLink = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  (window as { electronAPI?: object }).electronAPI = {
    deployToken: mockDeployToken,
    estimateDeployGas: mockEstimateDeployGas,
    validateAddress: mockValidateAddress,
    getPolygonscanUrl: mockGetPolygonscanUrl,
    openExternalLink: mockOpenExternalLink,
  };
});

describe('DeployTokenDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
  };

  describe('Rendering', () => {
    it('TC-DEPLOY-001: should render token configuration form', () => {
      render(<DeployTokenDialog {...defaultProps} />);

      // Component uses labels with * for required fields
      expect(screen.getByLabelText(/deploy.name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/deploy.symbol/)).toBeInTheDocument();
      expect(screen.getByLabelText('deploy.decimals')).toBeInTheDocument();
    });

    it('should render confirm and cancel buttons', () => {
      render(<DeployTokenDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'common.confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
    });

    it('should have default values for decimals', () => {
      render(<DeployTokenDialog {...defaultProps} />);

      const decimalsInput = screen.getByLabelText('deploy.decimals');
      expect(decimalsInput).toHaveValue(18);
    });
  });

  describe('Validation', () => {
    it('TC-DEPLOY-002: should show error for empty name', async () => {
      const user = userEvent.setup();
      render(<DeployTokenDialog {...defaultProps} />);

      const symbolInput = screen.getByLabelText(/deploy.symbol/);
      await user.type(symbolInput, 'TEST');

      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('errors.invalidInput')).toBeInTheDocument();
      });
    });

    it('TC-DEPLOY-003: should show error for empty symbol', async () => {
      const user = userEvent.setup();
      render(<DeployTokenDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/deploy.name/);
      await user.type(nameInput, 'Test Token');

      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('errors.invalidInput')).toBeInTheDocument();
      });
    });
  });

  describe('Gas Estimation and Confirmation', () => {
    it('TC-DEPLOY-004: should proceed to confirmation after gas estimation', async () => {
      const user = userEvent.setup();
      mockEstimateDeployGas.mockResolvedValue({ totalCost: '0.01' });
      render(<DeployTokenDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/deploy.name/);
      const symbolInput = screen.getByLabelText(/deploy.symbol/);

      await user.type(nameInput, 'Test Token');
      await user.type(symbolInput, 'TEST');

      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/deploy.confirmTitle/)).toBeInTheDocument();
        expect(screen.getByText(/0.01 POL/)).toBeInTheDocument();
      });
    });
  });

  describe('Token Deployment', () => {
    it('TC-DEPLOY-005: should deploy token successfully', async () => {
      const user = userEvent.setup();
      mockEstimateDeployGas.mockResolvedValue({ totalCost: '0.01' });
      mockDeployToken.mockResolvedValue({
        address: '0x1234567890123456789012345678901234567890',
        txHash: '0xabc123',
      });
      render(<DeployTokenDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/deploy.name/);
      const symbolInput = screen.getByLabelText(/deploy.symbol/);

      await user.type(nameInput, 'Test Token');
      await user.type(symbolInput, 'TEST');

      // Go to confirm
      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/deploy.confirmTitle/)).toBeInTheDocument();
      });

      // Execute deploy
      const executeButton = screen.getByRole('button', { name: 'deploy.execute' });
      await user.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('deploy.success')).toBeInTheDocument();
      });

      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });

    it('TC-DEPLOY-006: should show error when deployment fails', async () => {
      const user = userEvent.setup();
      mockEstimateDeployGas.mockResolvedValue({ totalCost: '0.01' });
      mockDeployToken.mockRejectedValue(new Error('Insufficient funds'));
      render(<DeployTokenDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/deploy.name/);
      const symbolInput = screen.getByLabelText(/deploy.symbol/);

      await user.type(nameInput, 'Test Token');
      await user.type(symbolInput, 'TEST');

      // Go to confirm
      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/deploy.confirmTitle/)).toBeInTheDocument();
      });

      // Execute deploy
      const executeButton = screen.getByRole('button', { name: 'deploy.execute' });
      await user.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Insufficient funds')).toBeInTheDocument();
      });
    });
  });

  describe('Processing State', () => {
    it('should show loading state during deployment', async () => {
      const user = userEvent.setup();
      mockEstimateDeployGas.mockResolvedValue({ totalCost: '0.01' });
      mockDeployToken.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<DeployTokenDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/deploy.name/);
      const symbolInput = screen.getByLabelText(/deploy.symbol/);

      await user.type(nameInput, 'Test Token');
      await user.type(symbolInput, 'TEST');

      // Go to confirm
      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/deploy.confirmTitle/)).toBeInTheDocument();
      });

      // Execute deploy
      const executeButton = screen.getByRole('button', { name: 'deploy.execute' });
      await user.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('deploy.executing')).toBeInTheDocument();
      });
    });
  });

  describe('Dialog Controls', () => {
    it('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<DeployTokenDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'common.cancel' });
      await user.click(cancelButton);

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should allow going back from confirm to input', async () => {
      const user = userEvent.setup();
      mockEstimateDeployGas.mockResolvedValue({ totalCost: '0.01' });
      render(<DeployTokenDialog {...defaultProps} />);

      const nameInput = screen.getByLabelText(/deploy.name/);
      const symbolInput = screen.getByLabelText(/deploy.symbol/);

      await user.type(nameInput, 'Test Token');
      await user.type(symbolInput, 'TEST');

      // Go to confirm
      const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/deploy.confirmTitle/)).toBeInTheDocument();
      });

      // Go back
      const backButton = screen.getByRole('button', { name: 'common.back' });
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/deploy.name/)).toBeInTheDocument();
      });
    });
  });

  describe('State Reset', () => {
    it('should reset form when dialog reopens', async () => {
      const { rerender } = render(<DeployTokenDialog {...defaultProps} open={false} />);

      rerender(<DeployTokenDialog {...defaultProps} open={true} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/deploy.name/)).toHaveValue('');
        expect(screen.getByLabelText(/deploy.symbol/)).toHaveValue('');
        expect(screen.getByLabelText('deploy.decimals')).toHaveValue(18);
      });
    });
  });
});
