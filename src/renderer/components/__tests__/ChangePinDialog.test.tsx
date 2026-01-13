import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePinDialog } from '../ChangePinDialog';

// Mock window.electronAPI
const mockChangePin = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  (window as { electronAPI?: object }).electronAPI = {
    changePin: mockChangePin,
  };
});

describe('ChangePinDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  describe('Rendering', () => {
    it('TC-PIN-CHANGE-001: should render all PIN input fields', () => {
      render(<ChangePinDialog {...defaultProps} />);

      // Actual labels from the component use translation keys
      expect(screen.getByLabelText('settings.pin.currentPin')).toBeInTheDocument();
      expect(screen.getByLabelText('settings.pin.newPin')).toBeInTheDocument();
      expect(screen.getByLabelText('settings.pin.confirmNewPin')).toBeInTheDocument();
    });

    it('should render change and cancel buttons', () => {
      render(<ChangePinDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'common.confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('TC-PIN-CHANGE-002: should show error when new PIN is too short', async () => {
      const user = userEvent.setup();
      render(<ChangePinDialog {...defaultProps} />);

      const currentPinInput = screen.getByLabelText('settings.pin.currentPin');
      const newPinInput = screen.getByLabelText('settings.pin.newPin');
      const confirmPinInput = screen.getByLabelText('settings.pin.confirmNewPin');

      await user.type(currentPinInput, 'CurrentP1');
      await user.type(newPinInput, 'Short1');
      await user.type(confirmPinInput, 'Short1');

      const changeButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(changeButton);

      await waitFor(() => {
        expect(screen.getByText('setup.pinSetup.minLength')).toBeInTheDocument();
      });
    });

    it('TC-PIN-CHANGE-003: should show error when new PINs do not match', async () => {
      const user = userEvent.setup();
      render(<ChangePinDialog {...defaultProps} />);

      const currentPinInput = screen.getByLabelText('settings.pin.currentPin');
      const newPinInput = screen.getByLabelText('settings.pin.newPin');
      const confirmPinInput = screen.getByLabelText('settings.pin.confirmNewPin');

      await user.type(currentPinInput, 'CurrentP1');
      await user.type(newPinInput, 'NewPass123');
      await user.type(confirmPinInput, 'Different1');

      const changeButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(changeButton);

      await waitFor(() => {
        expect(screen.getByText('setup.pinSetup.mismatch')).toBeInTheDocument();
      });
    });

    it('should show error when new PIN has no letters', async () => {
      const user = userEvent.setup();
      render(<ChangePinDialog {...defaultProps} />);

      const currentPinInput = screen.getByLabelText('settings.pin.currentPin');
      const newPinInput = screen.getByLabelText('settings.pin.newPin');
      const confirmPinInput = screen.getByLabelText('settings.pin.confirmNewPin');

      await user.type(currentPinInput, 'CurrentP1');
      await user.type(newPinInput, '12345678');
      await user.type(confirmPinInput, '12345678');

      const changeButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(changeButton);

      await waitFor(() => {
        expect(screen.getByText('setup.pinSetup.requireLetter')).toBeInTheDocument();
      });
    });

    it('should show error when new PIN has no numbers', async () => {
      const user = userEvent.setup();
      render(<ChangePinDialog {...defaultProps} />);

      const currentPinInput = screen.getByLabelText('settings.pin.currentPin');
      const newPinInput = screen.getByLabelText('settings.pin.newPin');
      const confirmPinInput = screen.getByLabelText('settings.pin.confirmNewPin');

      await user.type(currentPinInput, 'CurrentP1');
      await user.type(newPinInput, 'NoNumbers');
      await user.type(confirmPinInput, 'NoNumbers');

      const changeButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(changeButton);

      await waitFor(() => {
        expect(screen.getByText('setup.pinSetup.requireNumber')).toBeInTheDocument();
      });
    });
  });

  describe('PIN Change', () => {
    it('TC-PIN-CHANGE-004: should successfully change PIN', async () => {
      const user = userEvent.setup();
      mockChangePin.mockResolvedValue({ success: true });
      render(<ChangePinDialog {...defaultProps} />);

      const currentPinInput = screen.getByLabelText('settings.pin.currentPin');
      const newPinInput = screen.getByLabelText('settings.pin.newPin');
      const confirmPinInput = screen.getByLabelText('settings.pin.confirmNewPin');

      await user.type(currentPinInput, 'CurrentP1');
      await user.type(newPinInput, 'NewPass123');
      await user.type(confirmPinInput, 'NewPass123');

      const changeButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(changeButton);

      await waitFor(() => {
        expect(mockChangePin).toHaveBeenCalledWith('CurrentP1', 'NewPass123');
      });

      await waitFor(() => {
        expect(screen.getByText('settings.pin.success')).toBeInTheDocument();
      });
    });

    it('TC-PIN-CHANGE-005: should show error when current PIN is incorrect', async () => {
      const user = userEvent.setup();
      mockChangePin.mockResolvedValue({ success: false });
      render(<ChangePinDialog {...defaultProps} />);

      const currentPinInput = screen.getByLabelText('settings.pin.currentPin');
      const newPinInput = screen.getByLabelText('settings.pin.newPin');
      const confirmPinInput = screen.getByLabelText('settings.pin.confirmNewPin');

      await user.type(currentPinInput, 'WrongPin1');
      await user.type(newPinInput, 'NewPass123');
      await user.type(confirmPinInput, 'NewPass123');

      const changeButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(changeButton);

      await waitFor(() => {
        expect(screen.getByText('settings.pin.currentIncorrect')).toBeInTheDocument();
      });
    });
  });

  describe('Dialog Controls', () => {
    it('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ChangePinDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'common.cancel' });
      await user.click(cancelButton);

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should disable button while processing', async () => {
      const user = userEvent.setup();
      mockChangePin.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<ChangePinDialog {...defaultProps} />);

      const currentPinInput = screen.getByLabelText('settings.pin.currentPin');
      const newPinInput = screen.getByLabelText('settings.pin.newPin');
      const confirmPinInput = screen.getByLabelText('settings.pin.confirmNewPin');

      await user.type(currentPinInput, 'CurrentP1');
      await user.type(newPinInput, 'NewPass123');
      await user.type(confirmPinInput, 'NewPass123');

      const changeButton = screen.getByRole('button', { name: 'common.confirm' });
      await user.click(changeButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'common.loading' })).toBeDisabled();
      });
    });
  });

  describe('State Reset', () => {
    it('should reset form when dialog reopens', async () => {
      const { rerender } = render(<ChangePinDialog {...defaultProps} open={false} />);

      rerender(<ChangePinDialog {...defaultProps} open={true} />);

      await waitFor(() => {
        expect(screen.getByLabelText('settings.pin.currentPin')).toHaveValue('');
        expect(screen.getByLabelText('settings.pin.newPin')).toHaveValue('');
        expect(screen.getByLabelText('settings.pin.confirmNewPin')).toHaveValue('');
      });
    });
  });
});
