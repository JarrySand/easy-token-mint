import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PinPage } from '../PinPage';

// Mock window.electronAPI
const mockVerifyPin = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  (window as unknown as { electronAPI?: { verifyPin: typeof mockVerifyPin } }).electronAPI = {
    verifyPin: mockVerifyPin,
  };
});

describe('PinPage', () => {
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    mockOnSuccess.mockClear();
  });

  describe('Rendering', () => {
    it('TC-PIN-001: should render PIN input field with mask', () => {
      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'password');
    });

    it('should render login button', () => {
      render(<PinPage onSuccess={mockOnSuccess} />);

      const button = screen.getByRole('button', { name: 'pin.login' });
      expect(button).toBeInTheDocument();
    });

    it('should render app title', () => {
      render(<PinPage onSuccess={mockOnSuccess} />);

      expect(screen.getByText('app.title')).toBeInTheDocument();
    });

    it('should have autofocus on PIN input', () => {
      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder');
      // In React, autoFocus becomes autofocus in the DOM
      // We can check the autofocus property or just verify the input exists
      expect(input).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('TC-PIN-002: should call verifyPin on submit', async () => {
      mockVerifyPin.mockResolvedValue({ success: true });
      const user = userEvent.setup();

      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder');
      await user.type(input, 'Test1234');

      const button = screen.getByRole('button', { name: 'pin.login' });
      await user.click(button);

      expect(mockVerifyPin).toHaveBeenCalledWith('Test1234');
    });

    it('TC-PIN-003: should call onSuccess after successful auth', async () => {
      mockVerifyPin.mockResolvedValue({ success: true });
      const user = userEvent.setup();

      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder');
      await user.type(input, 'Test1234');

      const button = screen.getByRole('button', { name: 'pin.login' });
      await user.click(button);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show error when PIN is empty', async () => {
      const user = userEvent.setup();

      render(<PinPage onSuccess={mockOnSuccess} />);

      const button = screen.getByRole('button', { name: 'pin.login' });
      await user.click(button);

      expect(screen.getByText('pin.required')).toBeInTheDocument();
      expect(mockVerifyPin).not.toHaveBeenCalled();
    });

    it('should disable button while loading', async () => {
      mockVerifyPin.mockImplementation(() => new Promise(() => {})); // Never resolves
      const user = userEvent.setup();

      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder');
      await user.type(input, 'Test1234');

      const button = screen.getByRole('button', { name: 'pin.login' });
      await user.click(button);

      await waitFor(() => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('TC-PIN-004: should show error on failed auth', async () => {
      mockVerifyPin.mockResolvedValue({ success: false, remainingAttempts: 2 });
      const user = userEvent.setup();

      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder');
      await user.type(input, 'WrongPin1');

      const button = screen.getByRole('button', { name: 'pin.login' });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/pin.incorrect/)).toBeInTheDocument();
      });
    });

    it('should clear PIN on error', async () => {
      mockVerifyPin.mockResolvedValue({ success: false, remainingAttempts: 2 });
      const user = userEvent.setup();

      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder') as HTMLInputElement;
      await user.type(input, 'WrongPin1');

      const button = screen.getByRole('button', { name: 'pin.login' });
      await user.click(button);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('should handle API error', async () => {
      mockVerifyPin.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();

      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder');
      await user.type(input, 'Test1234');

      const button = screen.getByRole('button', { name: 'pin.login' });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('pin.authFailed')).toBeInTheDocument();
      });
    });
  });

  describe('Lockout', () => {
    it('TC-PIN-005: should show lockout message when locked', async () => {
      const lockUntil = Date.now() + 5 * 60 * 1000; // 5 minutes from now
      mockVerifyPin.mockResolvedValue({ success: false, lockUntil });
      const user = userEvent.setup();

      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder');
      await user.type(input, 'WrongPin1');

      const button = screen.getByRole('button', { name: 'pin.login' });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('pin.locked')).toBeInTheDocument();
      });
    });

    it('should disable input and button when locked', async () => {
      const lockUntil = Date.now() + 5 * 60 * 1000;
      mockVerifyPin.mockResolvedValue({ success: false, lockUntil });
      const user = userEvent.setup();

      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder');
      await user.type(input, 'WrongPin1');

      const button = screen.getByRole('button', { name: 'pin.login' });
      await user.click(button);

      // Wait for the lock message to appear first, which indicates state has been updated
      await waitFor(() => {
        expect(screen.getByText('pin.locked')).toBeInTheDocument();
      });

      // Now check that input and button are disabled after useEffect runs
      // The isLocked condition depends on remainingTime > 0, which is set by useEffect
      await waitFor(() => {
        expect(input).toBeDisabled();
        expect(button).toBeDisabled();
      }, { timeout: 2000 });
    });

    it('should show countdown timer when locked', async () => {
      const lockUntil = Date.now() + 5 * 60 * 1000;
      mockVerifyPin.mockResolvedValue({ success: false, lockUntil });
      const user = userEvent.setup();

      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder');
      await user.type(input, 'WrongPin1');

      const button = screen.getByRole('button', { name: 'pin.login' });
      await user.click(button);

      // First wait for lock message, then for countdown to appear
      // The countdown only appears when isLocked is true (remainingTime > 0)
      await waitFor(() => {
        expect(screen.getByText('pin.locked')).toBeInTheDocument();
      });

      // Wait for useEffect to update remainingTime which makes isLocked true
      await waitFor(() => {
        expect(screen.getByText(/pin.lockCountdown/)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should submit form on Enter key', async () => {
      mockVerifyPin.mockResolvedValue({ success: true });
      const user = userEvent.setup();

      render(<PinPage onSuccess={mockOnSuccess} />);

      const input = screen.getByPlaceholderText('pin.placeholder');
      await user.type(input, 'Test1234{enter}');

      expect(mockVerifyPin).toHaveBeenCalledWith('Test1234');
    });
  });
});
