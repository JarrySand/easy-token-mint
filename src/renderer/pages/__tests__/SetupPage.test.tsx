import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupPage } from '../SetupPage';

// Mock window.electronAPI
const mockImportPrivateKey = vi.fn();
const mockSetNetwork = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  (window as unknown as {
    electronAPI?: {
      importPrivateKey: typeof mockImportPrivateKey;
      setNetwork: typeof mockSetNetwork;
    };
  }).electronAPI = {
    importPrivateKey: mockImportPrivateKey,
    setNetwork: mockSetNetwork,
  };

  mockImportPrivateKey.mockResolvedValue({ success: true, address: '0x1234' });
  mockSetNetwork.mockResolvedValue(undefined);
});

describe('SetupPage', () => {
  const mockOnComplete = vi.fn();
  const validPrivateKey = 'a'.repeat(64);
  const validPin = 'Test1234';

  beforeEach(() => {
    mockOnComplete.mockClear();
  });

  describe('Step 1: Private Key', () => {
    it('TC-SETUP-001: should render private key input form', () => {
      render(<SetupPage onComplete={mockOnComplete} />);

      expect(screen.getByLabelText('setup.privateKey.label')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'common.next' })).toBeInTheDocument();
    });

    it('TC-SETUP-002: should accept valid private key', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);

      const input = screen.getByLabelText('setup.privateKey.label');
      await user.type(input, validPrivateKey);

      const nextButton = screen.getByRole('button', { name: 'common.next' });
      await user.click(nextButton);

      // Should move to step 2
      await waitFor(() => {
        expect(screen.getByLabelText('setup.pinSetup.label')).toBeInTheDocument();
      });
    });

    it('TC-SETUP-003: should reject invalid private key format', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);

      const input = screen.getByLabelText('setup.privateKey.label');
      await user.type(input, 'invalid-key');

      const nextButton = screen.getByRole('button', { name: 'common.next' });
      await user.click(nextButton);

      expect(screen.getByText('setup.privateKey.invalidFormat')).toBeInTheDocument();
    });

    it('should accept private key with 0x prefix', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);

      const input = screen.getByLabelText('setup.privateKey.label');
      await user.type(input, '0x' + validPrivateKey);

      const nextButton = screen.getByRole('button', { name: 'common.next' });
      await user.click(nextButton);

      // Should move to step 2
      await waitFor(() => {
        expect(screen.getByLabelText('setup.pinSetup.label')).toBeInTheDocument();
      });
    });
  });

  describe('Step 2: PIN Setup', () => {
    const goToStep2 = async (user: ReturnType<typeof userEvent.setup>) => {
      const input = screen.getByLabelText('setup.privateKey.label');
      await user.type(input, validPrivateKey);
      const nextButton = screen.getByRole('button', { name: 'common.next' });
      await user.click(nextButton);
      await waitFor(() => {
        expect(screen.getByLabelText('setup.pinSetup.label')).toBeInTheDocument();
      });
    };

    it('TC-SETUP-004: should render PIN setup form', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep2(user);

      expect(screen.getByLabelText('setup.pinSetup.label')).toBeInTheDocument();
      expect(screen.getByLabelText('setup.pinSetup.confirmLabel')).toBeInTheDocument();
    });

    it('TC-SETUP-005: should show PIN strength indicator', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep2(user);

      const pinInput = screen.getByLabelText('setup.pinSetup.label');
      await user.type(pinInput, validPin);

      expect(screen.getByText(/setup.pinSetup.strength/)).toBeInTheDocument();
    });

    it('TC-SETUP-006: should show error when PINs do not match', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep2(user);

      const pinInput = screen.getByLabelText('setup.pinSetup.label');
      const confirmInput = screen.getByLabelText('setup.pinSetup.confirmLabel');

      await user.type(pinInput, validPin);
      await user.type(confirmInput, 'DifferentPin1');

      const nextButton = screen.getByRole('button', { name: 'common.next' });
      await user.click(nextButton);

      expect(screen.getByText('setup.pinSetup.mismatch')).toBeInTheDocument();
    });

    it('should reject PIN shorter than 8 characters', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep2(user);

      const pinInput = screen.getByLabelText('setup.pinSetup.label');
      const confirmInput = screen.getByLabelText('setup.pinSetup.confirmLabel');

      await user.type(pinInput, 'Test123');
      await user.type(confirmInput, 'Test123');

      const nextButton = screen.getByRole('button', { name: 'common.next' });
      await user.click(nextButton);

      expect(screen.getByText('setup.pinSetup.minLength')).toBeInTheDocument();
    });

    it('should reject PIN without letters', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep2(user);

      const pinInput = screen.getByLabelText('setup.pinSetup.label');
      const confirmInput = screen.getByLabelText('setup.pinSetup.confirmLabel');

      await user.type(pinInput, '12345678');
      await user.type(confirmInput, '12345678');

      const nextButton = screen.getByRole('button', { name: 'common.next' });
      await user.click(nextButton);

      expect(screen.getByText('setup.pinSetup.requireLetter')).toBeInTheDocument();
    });

    it('should reject PIN without numbers', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep2(user);

      const pinInput = screen.getByLabelText('setup.pinSetup.label');
      const confirmInput = screen.getByLabelText('setup.pinSetup.confirmLabel');

      await user.type(pinInput, 'TestTest');
      await user.type(confirmInput, 'TestTest');

      const nextButton = screen.getByRole('button', { name: 'common.next' });
      await user.click(nextButton);

      expect(screen.getByText('setup.pinSetup.requireNumber')).toBeInTheDocument();
    });

    it('should allow going back to step 1', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep2(user);

      const backButton = screen.getByRole('button', { name: 'common.back' });
      await user.click(backButton);

      expect(screen.getByLabelText('setup.privateKey.label')).toBeInTheDocument();
    });
  });

  describe('Step 3: Network Selection', () => {
    const goToStep3 = async (user: ReturnType<typeof userEvent.setup>) => {
      // Step 1
      const keyInput = screen.getByLabelText('setup.privateKey.label');
      await user.type(keyInput, validPrivateKey);
      await user.click(screen.getByRole('button', { name: 'common.next' }));

      // Step 2
      await waitFor(() => {
        expect(screen.getByLabelText('setup.pinSetup.label')).toBeInTheDocument();
      });
      const pinInput = screen.getByLabelText('setup.pinSetup.label');
      const confirmInput = screen.getByLabelText('setup.pinSetup.confirmLabel');
      await user.type(pinInput, validPin);
      await user.type(confirmInput, validPin);
      await user.click(screen.getByRole('button', { name: 'common.next' }));

      // Step 3
      await waitFor(() => {
        expect(screen.getByText('app.network.mainnet')).toBeInTheDocument();
      });
    };

    it('TC-SETUP-007: should render network selection', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep3(user);

      expect(screen.getByText('app.network.mainnet')).toBeInTheDocument();
      expect(screen.getByText('app.network.testnet')).toBeInTheDocument();
    });

    it('should allow selecting testnet', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep3(user);

      const testnetButton = screen.getByText('app.network.testnet').closest('button');
      await user.click(testnetButton!);

      // Button should be selected (has primary border)
      expect(testnetButton).toHaveClass('border-primary');
    });
  });

  describe('Step 4: Confirmation', () => {
    const goToStep4 = async (user: ReturnType<typeof userEvent.setup>) => {
      // Step 1
      const keyInput = screen.getByLabelText('setup.privateKey.label');
      await user.type(keyInput, validPrivateKey);
      await user.click(screen.getByRole('button', { name: 'common.next' }));

      // Step 2
      await waitFor(() => {
        expect(screen.getByLabelText('setup.pinSetup.label')).toBeInTheDocument();
      });
      const pinInput = screen.getByLabelText('setup.pinSetup.label');
      const confirmInput = screen.getByLabelText('setup.pinSetup.confirmLabel');
      await user.type(pinInput, validPin);
      await user.type(confirmInput, validPin);
      await user.click(screen.getByRole('button', { name: 'common.next' }));

      // Step 3
      await waitFor(() => {
        expect(screen.getByText('app.network.mainnet')).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: 'common.next' }));

      // Step 4
      await waitFor(() => {
        expect(screen.getByText('setup.confirm.reviewTitle')).toBeInTheDocument();
      });
    };

    it('TC-SETUP-008: should show confirmation screen', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep4(user);

      expect(screen.getByText('setup.confirm.reviewTitle')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'setup.confirm.complete' })).toBeInTheDocument();
    });

    it('TC-SETUP-009: should complete setup and call onComplete', async () => {
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep4(user);

      const completeButton = screen.getByRole('button', { name: 'setup.confirm.complete' });
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockImportPrivateKey).toHaveBeenCalledWith(validPrivateKey, validPin);
        expect(mockSetNetwork).toHaveBeenCalledWith('mainnet');
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });

    it('should handle import failure', async () => {
      mockImportPrivateKey.mockResolvedValue({ success: false });
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep4(user);

      const completeButton = screen.getByRole('button', { name: 'setup.confirm.complete' });
      await user.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText('setup.privateKey.importFailed')).toBeInTheDocument();
      });
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('should disable button while completing', async () => {
      mockImportPrivateKey.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<SetupPage onComplete={mockOnComplete} />);
      await goToStep4(user);

      const completeButton = screen.getByRole('button', { name: 'setup.confirm.complete' });
      await user.click(completeButton);

      await waitFor(() => {
        expect(completeButton).toBeDisabled();
      });
    });
  });
});
