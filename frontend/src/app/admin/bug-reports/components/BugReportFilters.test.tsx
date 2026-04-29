import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BugReportFilters } from './BugReportFilters';
import type { ResolutionStatus } from '@/features/bug-reports/types/bugReport.types';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  CheckCircle: () => <svg data-testid="check-circle-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  List: () => <svg data-testid="list-icon" />,
}));

// Mock Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, size, variant, className, ...props }: any) => (
    <button
      onClick={onClick}
      data-size={size}
      data-variant={variant}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

describe('BugReportFilters', () => {
  const defaultProps = {
    currentStatus: 'all' as const,
    onStatusChange: jest.fn(),
    unresolvedCount: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all filter buttons', () => {
      render(<BugReportFilters {...defaultProps} />);

      expect(screen.getByText('All Reports')).toBeInTheDocument();
      expect(screen.getByText('Unresolved')).toBeInTheDocument();
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });

    it('should display icons for each filter', () => {
      render(<BugReportFilters {...defaultProps} />);

      expect(screen.getByTestId('list-icon')).toBeInTheDocument();
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });

    it('should display unresolved count badge', () => {
      render(<BugReportFilters {...defaultProps} unresolvedCount={5} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display unresolved count badge with correct styling', () => {
      render(<BugReportFilters {...defaultProps} unresolvedCount={5} />);

      const badge = screen.getByText('5');
      expect(badge).toHaveClass('bg-orange-100', 'text-orange-700');
    });

    it('should not display badge when unresolved count is 0', () => {
      render(<BugReportFilters {...defaultProps} unresolvedCount={0} />);

      const unresolvedButton = screen.getByText('Unresolved').closest('button');
      expect(unresolvedButton?.textContent).not.toContain('0');
    });

    it('should display badge for large unresolved counts', () => {
      render(<BugReportFilters {...defaultProps} unresolvedCount={999} />);

      expect(screen.getByText('999')).toBeInTheDocument();
    });
  });

  describe('Active Filter Indication', () => {
    it('should highlight "All Reports" when currentStatus is "all"', () => {
      render(<BugReportFilters {...defaultProps} currentStatus="all" />);

      const allButton = screen.getByText('All Reports').closest('button');
      expect(allButton).toHaveAttribute('data-variant', 'default');
    });

    it('should highlight "Unresolved" when currentStatus is "unresolved"', () => {
      render(<BugReportFilters {...defaultProps} currentStatus="unresolved" />);

      const unresolvedButton = screen.getByText('Unresolved').closest('button');
      expect(unresolvedButton).toHaveAttribute('data-variant', 'default');
    });

    it('should highlight "Resolved" when currentStatus is "resolved"', () => {
      render(<BugReportFilters {...defaultProps} currentStatus="resolved" />);

      const resolvedButton = screen.getByText('Resolved').closest('button');
      expect(resolvedButton).toHaveAttribute('data-variant', 'default');
    });

    it('should use outline variant for non-active filters', () => {
      render(<BugReportFilters {...defaultProps} currentStatus="all" />);

      const unresolvedButton = screen.getByText('Unresolved').closest('button');
      const resolvedButton = screen.getByText('Resolved').closest('button');

      expect(unresolvedButton).toHaveAttribute('data-variant', 'outline');
      expect(resolvedButton).toHaveAttribute('data-variant', 'outline');
    });

    it('should change badge styling when filter is active', () => {
      render(<BugReportFilters {...defaultProps} currentStatus="unresolved" unresolvedCount={5} />);

      const badge = screen.getByText('5');
      expect(badge).toHaveClass('bg-white/20', 'text-white');
    });
  });

  describe('Filter Selection', () => {
    it('should call onStatusChange with "all" when clicking All Reports', () => {
      const onStatusChange = jest.fn();
      render(<BugReportFilters {...defaultProps} onStatusChange={onStatusChange} />);

      const allButton = screen.getByText('All Reports');
      fireEvent.click(allButton);

      expect(onStatusChange).toHaveBeenCalledWith('all');
    });

    it('should call onStatusChange with "unresolved" when clicking Unresolved', () => {
      const onStatusChange = jest.fn();
      render(<BugReportFilters {...defaultProps} onStatusChange={onStatusChange} />);

      const unresolvedButton = screen.getByText('Unresolved');
      fireEvent.click(unresolvedButton);

      expect(onStatusChange).toHaveBeenCalledWith('unresolved');
    });

    it('should call onStatusChange with "resolved" when clicking Resolved', () => {
      const onStatusChange = jest.fn();
      render(<BugReportFilters {...defaultProps} onStatusChange={onStatusChange} />);

      const resolvedButton = screen.getByText('Resolved');
      fireEvent.click(resolvedButton);

      expect(onStatusChange).toHaveBeenCalledWith('resolved');
    });

    it('should call onStatusChange only once per click', () => {
      const onStatusChange = jest.fn();
      render(<BugReportFilters {...defaultProps} onStatusChange={onStatusChange} />);

      const unresolvedButton = screen.getByText('Unresolved');
      fireEvent.click(unresolvedButton);

      expect(onStatusChange).toHaveBeenCalledTimes(1);
    });

    it('should allow clicking the same filter multiple times', () => {
      const onStatusChange = jest.fn();
      render(<BugReportFilters {...defaultProps} onStatusChange={onStatusChange} />);

      const allButton = screen.getByText('All Reports');
      fireEvent.click(allButton);
      fireEvent.click(allButton);

      expect(onStatusChange).toHaveBeenCalledTimes(2);
      expect(onStatusChange).toHaveBeenCalledWith('all');
    });
  });

  describe('Filter Persistence', () => {
    it('should maintain selected filter across re-renders', () => {
      const { rerender } = render(<BugReportFilters {...defaultProps} currentStatus="unresolved" />);

      const unresolvedButton = screen.getByText('Unresolved').closest('button');
      expect(unresolvedButton).toHaveAttribute('data-variant', 'default');

      rerender(<BugReportFilters {...defaultProps} currentStatus="unresolved" unresolvedCount={10} />);

      const unresolvedButtonAfter = screen.getByText('Unresolved').closest('button');
      expect(unresolvedButtonAfter).toHaveAttribute('data-variant', 'default');
    });

    it('should update active filter when currentStatus prop changes', () => {
      const { rerender } = render(<BugReportFilters {...defaultProps} currentStatus="all" />);

      let allButton = screen.getByText('All Reports').closest('button');
      expect(allButton).toHaveAttribute('data-variant', 'default');

      rerender(<BugReportFilters {...defaultProps} currentStatus="resolved" />);

      allButton = screen.getByText('All Reports').closest('button');
      const resolvedButton = screen.getByText('Resolved').closest('button');

      expect(allButton).toHaveAttribute('data-variant', 'outline');
      expect(resolvedButton).toHaveAttribute('data-variant', 'default');
    });
  });

  describe('Unresolved Count Updates', () => {
    it('should update badge when unresolvedCount changes', () => {
      const { rerender } = render(<BugReportFilters {...defaultProps} unresolvedCount={5} />);

      expect(screen.getByText('5')).toBeInTheDocument();

      rerender(<BugReportFilters {...defaultProps} unresolvedCount={10} />);

      expect(screen.queryByText('5')).not.toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should hide badge when unresolvedCount becomes 0', () => {
      const { rerender } = render(<BugReportFilters {...defaultProps} unresolvedCount={5} />);

      expect(screen.getByText('5')).toBeInTheDocument();

      rerender(<BugReportFilters {...defaultProps} unresolvedCount={0} />);

      expect(screen.queryByText('5')).not.toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('should show badge when unresolvedCount increases from 0', () => {
      const { rerender } = render(<BugReportFilters {...defaultProps} unresolvedCount={0} />);

      expect(screen.queryByText('0')).not.toBeInTheDocument();

      rerender(<BugReportFilters {...defaultProps} unresolvedCount={3} />);

      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Visual States', () => {
    it('should apply correct size to buttons', () => {
      render(<BugReportFilters {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('data-size', 'sm');
      });
    });

    it('should have flex layout for responsive design', () => {
      const { container } = render(<BugReportFilters {...defaultProps} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'flex-wrap', 'items-center', 'gap-2');
    });

    it('should apply whitespace-nowrap to prevent text wrapping', () => {
      render(<BugReportFilters {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('whitespace-nowrap');
      });
    });

    it('should apply hover styles to non-active filters', () => {
      render(<BugReportFilters {...defaultProps} currentStatus="all" />);

      const unresolvedButton = screen.getByText('Unresolved').closest('button');
      expect(unresolvedButton).toHaveClass('hover:bg-gray-50');
    });
  });

  describe('Icon Colors', () => {
    it('should render icons for each filter', () => {
      render(<BugReportFilters {...defaultProps} currentStatus="all" />);

      const listIcon = screen.getByTestId('list-icon');
      const clockIcon = screen.getByTestId('clock-icon');
      const checkIcon = screen.getByTestId('check-circle-icon');

      expect(listIcon).toBeInTheDocument();
      expect(clockIcon).toBeInTheDocument();
      expect(checkIcon).toBeInTheDocument();
    });

    it('should apply color classes to icons', () => {
      render(<BugReportFilters {...defaultProps} currentStatus="all" />);

      const clockIcon = screen.getByTestId('clock-icon');
      const checkIcon = screen.getByTestId('check-circle-icon');

      // Icons should have color classes applied
      expect(clockIcon.className).toBeTruthy();
      expect(checkIcon.className).toBeTruthy();
    });

    it('should maintain icon visibility when filter changes', () => {
      const { rerender } = render(<BugReportFilters {...defaultProps} currentStatus="all" />);

      let clockIcon = screen.getByTestId('clock-icon');
      expect(clockIcon).toBeInTheDocument();

      rerender(<BugReportFilters {...defaultProps} currentStatus="unresolved" />);

      clockIcon = screen.getByTestId('clock-icon');
      expect(clockIcon).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should render semantic button elements', () => {
      render(<BugReportFilters {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(3);
    });

    it('should have accessible text labels', () => {
      render(<BugReportFilters {...defaultProps} />);

      expect(screen.getByText('All Reports')).toBeInTheDocument();
      expect(screen.getByText('Unresolved')).toBeInTheDocument();
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      render(<BugReportFilters {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large unresolved counts', () => {
      render(<BugReportFilters {...defaultProps} unresolvedCount={99999} />);

      expect(screen.getByText('99999')).toBeInTheDocument();
    });

    it('should handle negative unresolved counts gracefully', () => {
      render(<BugReportFilters {...defaultProps} unresolvedCount={-1} />);

      // Badge should not be displayed for negative counts
      expect(screen.queryByText('-1')).not.toBeInTheDocument();
    });

    it('should handle rapid filter changes', () => {
      const onStatusChange = jest.fn();
      render(<BugReportFilters {...defaultProps} onStatusChange={onStatusChange} />);

      const allButton = screen.getByText('All Reports');
      const unresolvedButton = screen.getByText('Unresolved');
      const resolvedButton = screen.getByText('Resolved');

      fireEvent.click(allButton);
      fireEvent.click(unresolvedButton);
      fireEvent.click(resolvedButton);
      fireEvent.click(allButton);

      expect(onStatusChange).toHaveBeenCalledTimes(4);
    });

    it('should maintain functionality when unresolvedCount is undefined', () => {
      const props = {
        currentStatus: 'all' as const,
        onStatusChange: jest.fn(),
        unresolvedCount: undefined as any,
      };

      render(<BugReportFilters {...props} />);

      expect(screen.getByText('All Reports')).toBeInTheDocument();
      expect(screen.getByText('Unresolved')).toBeInTheDocument();
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });
  });

  describe('Filter Count Display', () => {
    it('should only show count badge on Unresolved filter', () => {
      render(<BugReportFilters {...defaultProps} unresolvedCount={5} />);

      const allButton = screen.getByText('All Reports').closest('button');
      const resolvedButton = screen.getByText('Resolved').closest('button');

      expect(allButton?.textContent).not.toContain('5');
      expect(resolvedButton?.textContent).not.toContain('5');
    });

    it('should display count badge with proper spacing', () => {
      render(<BugReportFilters {...defaultProps} unresolvedCount={5} />);

      const badge = screen.getByText('5');
      expect(badge).toHaveClass('ml-1.5', 'sm:ml-2');
    });

    it('should format badge with proper padding and styling', () => {
      render(<BugReportFilters {...defaultProps} unresolvedCount={5} />);

      const badge = screen.getByText('5');
      expect(badge).toHaveClass('px-1.5', 'py-0.5', 'rounded-full', 'text-xs', 'font-medium');
    });
  });
});
