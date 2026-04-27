import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BugReportSearch } from './BugReportSearch';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Search: () => <svg data-testid="search-icon" />,
  X: () => <svg data-testid="x-icon" />,
}));

// Mock Input component
jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  ),
}));

// Mock Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, type, variant, size, className, ...props }: any) => (
    <button
      onClick={onClick}
      type={type}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

describe('BugReportSearch', () => {
  const defaultProps = {
    searchTerm: '',
    onSearchChange: jest.fn(),
    debounceMs: 300,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render search input field', () => {
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search by user, description, or page url/i);
      expect(input).toBeInTheDocument();
    });

    it('should display search icon', () => {
      render(<BugReportSearch {...defaultProps} />);

      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });

    it('should not display clear button when search is empty', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="" />);

      expect(screen.queryByTestId('x-icon')).not.toBeInTheDocument();
    });

    it('should display clear button when search has value', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });

    it('should have proper placeholder text', () => {
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search by user, description, or page URL...');
      expect(input).toBeInTheDocument();
    });

    it('should apply correct styling classes to input', () => {
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      expect(input).toHaveClass('pl-10');
    });

    it('should apply additional padding when clear button is visible', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const input = screen.getByPlaceholderText(/search by user/i);
      expect(input).toHaveClass('pr-10');
    });
  });

  describe('Search Input', () => {
    it('should update local value when typing', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      await user.type(input, 'test query');

      expect(input).toHaveValue('test query');
    });

    it('should display current searchTerm prop value', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="initial value" />);

      const input = screen.getByPlaceholderText(/search by user/i);
      expect(input).toHaveValue('initial value');
    });

    it('should sync with external searchTerm changes', () => {
      const { rerender } = render(<BugReportSearch {...defaultProps} searchTerm="" />);

      const input = screen.getByPlaceholderText(/search by user/i);
      expect(input).toHaveValue('');

      rerender(<BugReportSearch {...defaultProps} searchTerm="external change" />);

      expect(input).toHaveValue('external change');
    });

    it('should handle empty string input', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const input = screen.getByPlaceholderText(/search by user/i);
      await user.clear(input);

      expect(input).toHaveValue('');
    });

    it('should handle special characters in search', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      await user.type(input, '@#$%^&*()');

      expect(input).toHaveValue('@#$%^&*()');
    });

    it('should handle unicode characters', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      await user.type(input, '你好世界');

      expect(input).toHaveValue('你好世界');
    });
  });

  describe('Debouncing', () => {
    it('should debounce search with default 300ms delay', async () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      fireEvent.change(input, { target: { value: 'test' } });

      expect(onSearchChange).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('test');
      });
    });

    it('should use custom debounce delay when provided', async () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} onSearchChange={onSearchChange} debounceMs={500} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      fireEvent.change(input, { target: { value: 'test' } });

      jest.advanceTimersByTime(300);
      expect(onSearchChange).not.toHaveBeenCalled();

      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('test');
      });
    });

    it('should cancel previous debounce timer on new input', async () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText(/search by user/i);

      fireEvent.change(input, { target: { value: 'test' } });
      jest.advanceTimersByTime(200);

      fireEvent.change(input, { target: { value: 'test2' } });
      jest.advanceTimersByTime(200);

      expect(onSearchChange).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledTimes(1);
        expect(onSearchChange).toHaveBeenCalledWith('test2');
      });
    });

    it('should not call onSearchChange if value matches current searchTerm', async () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} searchTerm="test" onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      fireEvent.change(input, { target: { value: 'test' } });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(onSearchChange).not.toHaveBeenCalled();
      });
    });

    it('should handle rapid typing correctly', async () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText(/search by user/i);

      // Simulate rapid typing
      'test query'.split('').forEach((char, index) => {
        fireEvent.change(input, { target: { value: 'test query'.substring(0, index + 1) } });
        jest.advanceTimersByTime(50);
      });

      // Wait for debounce to complete
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledTimes(1);
        expect(onSearchChange).toHaveBeenCalledWith('test query');
      });
    });

    it('should debounce multiple search attempts', async () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText(/search by user/i);

      // First search
      fireEvent.change(input, { target: { value: 'first' } });
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('first');
      });

      onSearchChange.mockClear();

      // Second search
      fireEvent.change(input, { target: { value: 'second' } });
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('second');
      });
    });
  });

  describe('Clear Button', () => {
    it('should display clear button when input has value', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      expect(clearButton).toBeInTheDocument();
    });

    it('should not display clear button when input is empty', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="" />);

      const clearButton = screen.queryByRole('button', { name: /clear search/i });
      expect(clearButton).not.toBeInTheDocument();
    });

    it('should clear input when clicking clear button', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearButton);

      const input = screen.getByPlaceholderText(/search by user/i);
      expect(input).toHaveValue('');
    });

    it('should call onSearchChange with empty string when clearing', () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} searchTerm="test" onSearchChange={onSearchChange} />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearButton);

      expect(onSearchChange).toHaveBeenCalledWith('');
    });

    it('should call onSearchChange immediately without debounce when clearing', () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} searchTerm="test" onSearchChange={onSearchChange} />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearButton);

      expect(onSearchChange).toHaveBeenCalledWith('');
      expect(onSearchChange).toHaveBeenCalledTimes(1);
    });

    it('should have proper aria-label for accessibility', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      expect(clearButton).toHaveAttribute('aria-label', 'Clear search');
    });

    it('should have ghost variant styling', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      expect(clearButton).toHaveAttribute('data-variant', 'ghost');
    });

    it('should have icon-sm size', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      expect(clearButton).toHaveAttribute('data-size', 'icon-sm');
    });

    it('should show clear button after typing', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BugReportSearch {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

      const input = screen.getByPlaceholderText(/search by user/i);
      await user.type(input, 'test');

      expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
    });

    it('should hide clear button after clearing', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearButton);

      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should perform case-insensitive search (implementation detail)', async () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      fireEvent.change(input, { target: { value: 'TEST' } });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('TEST');
      });
    });

    it('should search across multiple fields (indicated by placeholder)', () => {
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search by user, description, or page url/i);
      expect(input).toBeInTheDocument();
    });

    it('should handle whitespace in search terms', async () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      fireEvent.change(input, { target: { value: '  test  ' } });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('  test  ');
      });
    });

    it('should handle very long search terms', async () => {
      const onSearchChange = jest.fn();
      const longTerm = 'a'.repeat(500);
      render(<BugReportSearch {...defaultProps} onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      fireEvent.change(input, { target: { value: longTerm } });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith(longTerm);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be focusable via Tab key', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search by user/i);

      await user.tab();

      expect(input).toHaveFocus();
    });

    it('should allow typing when focused', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      input.focus();

      await user.keyboard('test');

      expect(input).toHaveValue('test');
    });

    it('should allow clearing with Backspace', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const input = screen.getByPlaceholderText(/search by user/i);
      input.focus();

      await user.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}');

      expect(input).toHaveValue('');
    });

    it('should focus clear button via Tab when visible', async () => {
      const user = userEvent.setup({ delay: null });
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const input = screen.getByPlaceholderText(/search by user/i);
      input.focus();

      await user.tab();

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      expect(clearButton).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('should use semantic input element', () => {
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      expect(input.tagName).toBe('INPUT');
    });

    it('should have text input type', () => {
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should have descriptive placeholder', () => {
      render(<BugReportSearch {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search by user, description, or page URL...');
      expect(input).toBeInTheDocument();
    });

    it('should have clear button with aria-label', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      expect(clearButton).toHaveAttribute('aria-label', 'Clear search');
    });

    it('should be keyboard accessible', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const input = screen.getByPlaceholderText(/search by user/i);
      const clearButton = screen.getByRole('button', { name: /clear search/i });

      expect(input.tagName).toBe('INPUT');
      expect(clearButton.tagName).toBe('BUTTON');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined debounceMs (use default)', async () => {
      const onSearchChange = jest.fn();
      const props = { ...defaultProps, debounceMs: undefined };
      render(<BugReportSearch {...props} onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      fireEvent.change(input, { target: { value: 'test' } });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('test');
      });
    });

    it('should handle zero debounce delay', async () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} onSearchChange={onSearchChange} debounceMs={0} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      fireEvent.change(input, { target: { value: 'test' } });

      jest.advanceTimersByTime(0);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('test');
      });
    });

    it('should handle component unmount during debounce', () => {
      const onSearchChange = jest.fn();
      const { unmount } = render(<BugReportSearch {...defaultProps} onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText(/search by user/i);
      fireEvent.change(input, { target: { value: 'test' } });

      unmount();

      jest.advanceTimersByTime(300);

      expect(onSearchChange).not.toHaveBeenCalled();
    });

    it('should handle rapid clear and type', async () => {
      const onSearchChange = jest.fn();
      render(<BugReportSearch {...defaultProps} searchTerm="test" onSearchChange={onSearchChange} />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearButton);

      expect(onSearchChange).toHaveBeenCalledWith('');

      onSearchChange.mockClear();

      const input = screen.getByPlaceholderText(/search by user/i);
      fireEvent.change(input, { target: { value: 'new' } });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('new');
      });
    });

    it('should maintain state across re-renders', () => {
      const { rerender } = render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const input = screen.getByPlaceholderText(/search by user/i);
      expect(input).toHaveValue('test');

      rerender(<BugReportSearch {...defaultProps} searchTerm="test" debounceMs={500} />);

      expect(input).toHaveValue('test');
    });
  });

  describe('Visual Layout', () => {
    it('should have relative positioning for icon placement', () => {
      const { container } = render(<BugReportSearch {...defaultProps} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('relative');
    });

    it('should display search icon', () => {
      render(<BugReportSearch {...defaultProps} />);

      const searchIcon = screen.getByTestId('search-icon');
      expect(searchIcon).toBeInTheDocument();
    });

    it('should position clear button on the right', () => {
      render(<BugReportSearch {...defaultProps} searchTerm="test" />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      expect(clearButton).toHaveClass('absolute', 'right-2');
    });
  });
});
