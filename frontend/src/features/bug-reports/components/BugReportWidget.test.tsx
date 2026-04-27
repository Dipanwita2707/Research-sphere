import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BugReportWidget } from './BugReportWidget';

// Mock the BugReportForm component
jest.mock('./BugReportForm', () => ({
  BugReportForm: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    isOpen ? (
      <div data-testid="bug-report-form">
        <button onClick={onClose}>Close Form</button>
      </div>
    ) : null
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Bug: () => <svg data-testid="bug-icon" />,
}));

describe('BugReportWidget', () => {
  // Store original environment variable
  const originalEnv = process.env.NEXT_PUBLIC_BUG_REPORT_ENABLED;

  beforeEach(() => {
    // Reset environment variable before each test
    process.env.NEXT_PUBLIC_BUG_REPORT_ENABLED = 'true';
  });

  afterEach(() => {
    // Restore original environment variable
    process.env.NEXT_PUBLIC_BUG_REPORT_ENABLED = originalEnv;
  });

  describe('Rendering and Visibility', () => {
    it('should render the bug icon button when feature is enabled', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toBeInTheDocument();
    });

    it('should display the bug icon', () => {
      render(<BugReportWidget />);
      
      const bugIcon = screen.getByTestId('bug-icon');
      expect(bugIcon).toBeInTheDocument();
    });

    it('should have correct positioning classes (fixed, bottom-right)', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toHaveClass('fixed', 'bottom-5', 'right-5');
    });

    it('should have correct z-index (z-40)', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toHaveClass('z-40');
    });

    it('should have proper ARIA attributes for accessibility', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toHaveAttribute('aria-label', 'Report a bug');
      expect(button).toHaveAttribute('title', 'Report a bug');
    });

    it('should apply custom className when provided', () => {
      render(<BugReportWidget className="custom-class" />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toHaveClass('custom-class');
    });

    it('should have hover state classes', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toHaveClass('hover:bg-red-700', 'hover:shadow-xl');
    });

    it('should have focus state classes for accessibility', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-red-500', 'focus:ring-offset-2');
    });
  });

  describe('Feature Flag Behavior', () => {
    it('should not render when feature flag is explicitly disabled', () => {
      process.env.NEXT_PUBLIC_BUG_REPORT_ENABLED = 'false';
      
      const { container } = render(<BugReportWidget />);
      
      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button', { name: /report a bug/i })).not.toBeInTheDocument();
    });

    it('should render when feature flag is not set (default enabled)', () => {
      delete process.env.NEXT_PUBLIC_BUG_REPORT_ENABLED;
      
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toBeInTheDocument();
    });

    it('should render when feature flag is set to any value other than "false"', () => {
      process.env.NEXT_PUBLIC_BUG_REPORT_ENABLED = 'true';
      
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toBeInTheDocument();
    });

    it('should render when feature flag is set to empty string', () => {
      process.env.NEXT_PUBLIC_BUG_REPORT_ENABLED = '';
      
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('should open bug report form when clicked', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      fireEvent.click(button);
      
      const form = screen.getByTestId('bug-report-form');
      expect(form).toBeInTheDocument();
    });

    it('should not display form initially', () => {
      render(<BugReportWidget />);
      
      const form = screen.queryByTestId('bug-report-form');
      expect(form).not.toBeInTheDocument();
    });

    it('should close form when onClose is called', async () => {
      render(<BugReportWidget />);
      
      // Open the form
      const button = screen.getByRole('button', { name: /report a bug/i });
      fireEvent.click(button);
      
      expect(screen.getByTestId('bug-report-form')).toBeInTheDocument();
      
      // Close the form
      const closeButton = screen.getByText('Close Form');
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('bug-report-form')).not.toBeInTheDocument();
      });
    });

    it('should handle multiple open/close cycles', async () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      
      // First cycle
      fireEvent.click(button);
      expect(screen.getByTestId('bug-report-form')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Close Form'));
      await waitFor(() => {
        expect(screen.queryByTestId('bug-report-form')).not.toBeInTheDocument();
      });
      
      // Second cycle
      fireEvent.click(button);
      expect(screen.getByTestId('bug-report-form')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Close Form'));
      await waitFor(() => {
        expect(screen.queryByTestId('bug-report-form')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be focusable via Tab key', async () => {
      const user = userEvent.setup();
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      
      // Tab to the button
      await user.tab();
      
      expect(button).toHaveFocus();
    });

    it('should open form when activated with Enter key', async () => {
      const user = userEvent.setup();
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      
      // Focus the button
      button.focus();
      expect(button).toHaveFocus();
      
      // Press Enter
      await user.keyboard('{Enter}');
      
      const form = screen.getByTestId('bug-report-form');
      expect(form).toBeInTheDocument();
    });

    it('should open form when activated with Space key', async () => {
      const user = userEvent.setup();
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      
      // Focus the button
      button.focus();
      expect(button).toHaveFocus();
      
      // Press Space
      await user.keyboard(' ');
      
      const form = screen.getByTestId('bug-report-form');
      expect(form).toBeInTheDocument();
    });

    it('should be keyboard accessible with proper focus styles', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      
      // Focus the button
      button.focus();
      
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus:ring-2', 'focus:ring-red-500');
    });
  });

  describe('Visual States', () => {
    it('should have base styling classes', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      
      expect(button).toHaveClass(
        'w-14',
        'h-14',
        'rounded-full',
        'bg-red-600',
        'text-white',
        'shadow-lg'
      );
    });

    it('should have transition classes for smooth animations', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      
      expect(button).toHaveClass('transition-all', 'duration-200');
    });

    it('should have flex layout for centering icon', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      
      expect(button).toHaveClass('flex', 'items-center', 'justify-center');
    });

    it('should have group class for hover effects', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      
      expect(button).toHaveClass('group');
    });
  });

  describe('Integration with BugReportForm', () => {
    it('should pass isOpen prop correctly to BugReportForm', () => {
      render(<BugReportWidget />);
      
      // Initially closed
      expect(screen.queryByTestId('bug-report-form')).not.toBeInTheDocument();
      
      // Open form
      const button = screen.getByRole('button', { name: /report a bug/i });
      fireEvent.click(button);
      
      // Now open
      expect(screen.getByTestId('bug-report-form')).toBeInTheDocument();
    });

    it('should pass onClose callback to BugReportForm', async () => {
      render(<BugReportWidget />);
      
      // Open form
      const button = screen.getByRole('button', { name: /report a bug/i });
      fireEvent.click(button);
      
      expect(screen.getByTestId('bug-report-form')).toBeInTheDocument();
      
      // Trigger onClose
      const closeButton = screen.getByText('Close Form');
      fireEvent.click(closeButton);
      
      // Form should close
      await waitFor(() => {
        expect(screen.queryByTestId('bug-report-form')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have semantic button element', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button.tagName).toBe('BUTTON');
    });

    it('should have descriptive aria-label', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toHaveAttribute('aria-label', 'Report a bug');
    });

    it('should have title attribute for tooltip', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toHaveAttribute('title', 'Report a bug');
    });

    it('should be discoverable by screen readers', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toBeVisible();
      expect(button).toHaveAccessibleName('Report a bug');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid clicks without breaking', () => {
      render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      
      // Rapid clicks
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
      
      // Should still have form open
      expect(screen.getByTestId('bug-report-form')).toBeInTheDocument();
    });

    it('should maintain state after re-render', () => {
      const { rerender } = render(<BugReportWidget />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      fireEvent.click(button);
      
      expect(screen.getByTestId('bug-report-form')).toBeInTheDocument();
      
      // Re-render
      rerender(<BugReportWidget />);
      
      // Form should still be open
      expect(screen.getByTestId('bug-report-form')).toBeInTheDocument();
    });

    it('should handle className prop being undefined', () => {
      render(<BugReportWidget className={undefined} />);
      
      const button = screen.getByRole('button', { name: /report a bug/i });
      expect(button).toBeInTheDocument();
    });
  });
});
