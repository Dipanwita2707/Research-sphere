import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BugReportTable } from './BugReportTable';
import type { BugReport, PaginationMetadata } from '@/features/bug-reports/types/bugReport.types';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ArrowUpDown: () => <svg data-testid="arrow-updown-icon" />,
  ArrowUp: () => <svg data-testid="arrow-up-icon" />,
  ArrowDown: () => <svg data-testid="arrow-down-icon" />,
  CheckCircle: () => <svg data-testid="check-circle-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  ChevronLeft: () => <svg data-testid="chevron-left-icon" />,
  ChevronRight: () => <svg data-testid="chevron-right-icon" />,
}));

// Mock Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, size, variant, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-size={size}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

describe('BugReportTable', () => {
  const mockReports: BugReport[] = [
    {
      id: '1',
      userId: 'user-1',
      userRole: 'student',
      userIdentifier: 'STU001',
      userEmail: 'student@example.com',
      description: 'Login button not working on mobile devices',
      pageUrl: 'https://example.com/login',
      routePath: '/login',
      resolutionStatus: 'unresolved',
      resolvedAt: null,
      resolvedBy: null,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      screenshots: [
        {
          id: 'ss-1',
          bugReportId: '1',
          originalFilename: 'screenshot1.png',
          storedFilename: 'uuid-1.png',
          fileSize: 1024000,
          mimeType: 'image/png',
          storagePath: '/uploads/uuid-1.png',
          uploadedAt: '2024-01-15T10:30:00Z',
        },
      ],
    },
    {
      id: '2',
      userId: 'user-2',
      userRole: 'faculty',
      userIdentifier: 'FAC001',
      userEmail: 'faculty@example.com',
      description: 'Dashboard charts not loading properly',
      pageUrl: 'https://example.com/dashboard',
      routePath: '/dashboard',
      resolutionStatus: 'resolved',
      resolvedAt: '2024-01-16T14:00:00Z',
      resolvedBy: 'admin-1',
      createdAt: '2024-01-14T09:00:00Z',
      updatedAt: '2024-01-16T14:00:00Z',
      screenshots: [],
    },
  ];

  const mockPagination: PaginationMetadata = {
    total: 50,
    page: 1,
    limit: 50,
    totalPages: 1,
  };

  const defaultProps = {
    reports: mockReports,
    onReportClick: jest.fn(),
    onStatusChange: jest.fn(),
    sortBy: 'createdAt' as const,
    sortOrder: 'desc' as const,
    onSort: jest.fn(),
    pagination: mockPagination,
    onPageChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the table with all reports', () => {
      render(<BugReportTable {...defaultProps} />);

      expect(screen.getByText('STU001')).toBeInTheDocument();
      expect(screen.getByText('FAC001')).toBeInTheDocument();
    });

    it('should display all table headers', () => {
      render(<BugReportTable {...defaultProps} />);

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Role')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Page')).toBeInTheDocument();
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should display user identifier and email', () => {
      render(<BugReportTable {...defaultProps} />);

      expect(screen.getByText('STU001')).toBeInTheDocument();
      expect(screen.getByText('student@example.com')).toBeInTheDocument();
    });

    it('should display user role as badge', () => {
      render(<BugReportTable {...defaultProps} />);

      expect(screen.getByText('student')).toBeInTheDocument();
      expect(screen.getByText('faculty')).toBeInTheDocument();
    });

    it('should display bug description', () => {
      render(<BugReportTable {...defaultProps} />);

      expect(screen.getByText('Login button not working on mobile devices')).toBeInTheDocument();
      expect(screen.getByText('Dashboard charts not loading properly')).toBeInTheDocument();
    });

    it('should display route path or page URL', () => {
      render(<BugReportTable {...defaultProps} />);

      expect(screen.getByText('/login')).toBeInTheDocument();
      expect(screen.getByText('/dashboard')).toBeInTheDocument();
    });

    it('should display screenshot count when screenshots exist', () => {
      render(<BugReportTable {...defaultProps} />);

      expect(screen.getByText('1 screenshot(s)')).toBeInTheDocument();
    });

    it('should not display screenshot count when no screenshots', () => {
      render(<BugReportTable {...defaultProps} />);

      const rows = screen.getAllByRole('row');
      const resolvedRow = rows.find(row => row.textContent?.includes('FAC001'));
      
      expect(resolvedRow).toBeDefined();
      expect(resolvedRow?.textContent).not.toContain('screenshot(s)');
    });
  });

  describe('Resolution Status Display', () => {
    it('should display unresolved status with clock icon', () => {
      render(<BugReportTable {...defaultProps} />);

      const unresolvedText = screen.getByText('Unresolved');
      expect(unresolvedText).toBeInTheDocument();
      expect(unresolvedText).toHaveClass('text-orange-700');
    });

    it('should display resolved status with check icon', () => {
      render(<BugReportTable {...defaultProps} />);

      const resolvedText = screen.getByText('Resolved');
      expect(resolvedText).toBeInTheDocument();
      expect(resolvedText).toHaveClass('text-green-700');
    });

    it('should apply green background to resolved reports', () => {
      render(<BugReportTable {...defaultProps} />);

      const rows = screen.getAllByRole('row');
      const resolvedRow = rows.find(row => row.textContent?.includes('FAC001'));
      
      expect(resolvedRow).toHaveClass('bg-green-50/30');
    });

    it('should not apply green background to unresolved reports', () => {
      render(<BugReportTable {...defaultProps} />);

      const rows = screen.getAllByRole('row');
      const unresolvedRow = rows.find(row => row.textContent?.includes('STU001'));
      
      expect(unresolvedRow).not.toHaveClass('bg-green-50/30');
    });
  });

  describe('Sorting', () => {
    it('should display sort icons on sortable columns', () => {
      render(<BugReportTable {...defaultProps} />);

      const sortButtons = screen.getAllByRole('button').filter(
        button => button.textContent?.includes('Status') || 
                  button.textContent?.includes('Role') || 
                  button.textContent?.includes('Submitted')
      );

      expect(sortButtons.length).toBeGreaterThan(0);
    });

    it('should show active sort indicator on current sort column', () => {
      render(<BugReportTable {...defaultProps} sortBy="createdAt" sortOrder="desc" />);

      const submittedButton = screen.getByRole('button', { name: /submitted/i });
      const arrowDown = within(submittedButton).getByTestId('arrow-down-icon');
      
      expect(arrowDown).toBeInTheDocument();
    });

    it('should show ascending arrow when sort order is asc', () => {
      render(<BugReportTable {...defaultProps} sortBy="createdAt" sortOrder="asc" />);

      const submittedButton = screen.getByRole('button', { name: /submitted/i });
      const arrowUp = within(submittedButton).getByTestId('arrow-up-icon');
      
      expect(arrowUp).toBeInTheDocument();
    });

    it('should show neutral arrow on non-active sort columns', () => {
      render(<BugReportTable {...defaultProps} sortBy="createdAt" sortOrder="desc" />);

      const statusButton = screen.getByRole('button', { name: /status/i });
      const arrowUpDown = within(statusButton).getByTestId('arrow-updown-icon');
      
      expect(arrowUpDown).toBeInTheDocument();
    });

    it('should call onSort with toggled order when clicking active column', () => {
      const onSort = jest.fn();
      render(<BugReportTable {...defaultProps} sortBy="createdAt" sortOrder="desc" onSort={onSort} />);

      const submittedButton = screen.getByRole('button', { name: /submitted/i });
      fireEvent.click(submittedButton);

      expect(onSort).toHaveBeenCalledWith('createdAt', 'asc');
    });

    it('should call onSort with desc order when clicking new column', () => {
      const onSort = jest.fn();
      render(<BugReportTable {...defaultProps} sortBy="createdAt" sortOrder="desc" onSort={onSort} />);

      const statusButton = screen.getByRole('button', { name: /status/i });
      fireEvent.click(statusButton);

      expect(onSort).toHaveBeenCalledWith('resolutionStatus', 'desc');
    });

    it('should handle sorting by userRole', () => {
      const onSort = jest.fn();
      render(<BugReportTable {...defaultProps} onSort={onSort} />);

      const roleButton = screen.getByRole('button', { name: /role/i });
      fireEvent.click(roleButton);

      expect(onSort).toHaveBeenCalledWith('userRole', 'desc');
    });

    it('should handle sorting by resolutionStatus', () => {
      const onSort = jest.fn();
      render(<BugReportTable {...defaultProps} onSort={onSort} />);

      const statusButton = screen.getByRole('button', { name: /status/i });
      fireEvent.click(statusButton);

      expect(onSort).toHaveBeenCalledWith('resolutionStatus', 'desc');
    });
  });

  describe('Row Click Handling', () => {
    it('should call onReportClick when clicking a row', () => {
      const onReportClick = jest.fn();
      render(<BugReportTable {...defaultProps} onReportClick={onReportClick} />);

      const rows = screen.getAllByRole('row');
      const dataRow = rows.find(row => row.textContent?.includes('STU001'));
      
      if (dataRow) {
        fireEvent.click(dataRow);
        expect(onReportClick).toHaveBeenCalledWith('1');
      }
    });

    it('should apply hover styles to rows', () => {
      render(<BugReportTable {...defaultProps} />);

      const rows = screen.getAllByRole('row');
      const dataRow = rows.find(row => row.textContent?.includes('STU001'));
      
      expect(dataRow).toHaveClass('hover:bg-gray-50', 'cursor-pointer');
    });
  });

  describe('Status Change Actions', () => {
    it('should display "Resolve" button for unresolved reports', () => {
      render(<BugReportTable {...defaultProps} />);

      const rows = screen.getAllByRole('row');
      const unresolvedRow = rows.find(row => row.textContent?.includes('STU001'));
      
      if (unresolvedRow) {
        const resolveButton = within(unresolvedRow).getByText('Resolve');
        expect(resolveButton).toBeInTheDocument();
      }
    });

    it('should display "Reopen" button for resolved reports', () => {
      render(<BugReportTable {...defaultProps} />);

      const rows = screen.getAllByRole('row');
      const resolvedRow = rows.find(row => row.textContent?.includes('FAC001'));
      
      if (resolvedRow) {
        const reopenButton = within(resolvedRow).getByText('Reopen');
        expect(reopenButton).toBeInTheDocument();
      }
    });

    it('should call onStatusChange with "resolved" when clicking Resolve button', () => {
      const onStatusChange = jest.fn();
      render(<BugReportTable {...defaultProps} onStatusChange={onStatusChange} />);

      const rows = screen.getAllByRole('row');
      const unresolvedRow = rows.find(row => row.textContent?.includes('STU001'));
      
      if (unresolvedRow) {
        const resolveButton = within(unresolvedRow).getByText('Resolve');
        fireEvent.click(resolveButton);
        
        expect(onStatusChange).toHaveBeenCalledWith('1', 'resolved');
      }
    });

    it('should call onStatusChange with "unresolved" when clicking Reopen button', () => {
      const onStatusChange = jest.fn();
      render(<BugReportTable {...defaultProps} onStatusChange={onStatusChange} />);

      const rows = screen.getAllByRole('row');
      const resolvedRow = rows.find(row => row.textContent?.includes('FAC001'));
      
      if (resolvedRow) {
        const reopenButton = within(resolvedRow).getByText('Reopen');
        fireEvent.click(reopenButton);
        
        expect(onStatusChange).toHaveBeenCalledWith('2', 'unresolved');
      }
    });

    it('should stop propagation when clicking status change button', () => {
      const onReportClick = jest.fn();
      const onStatusChange = jest.fn();
      render(<BugReportTable {...defaultProps} onReportClick={onReportClick} onStatusChange={onStatusChange} />);

      const rows = screen.getAllByRole('row');
      const unresolvedRow = rows.find(row => row.textContent?.includes('STU001'));
      
      if (unresolvedRow) {
        const resolveButton = within(unresolvedRow).getByText('Resolve');
        fireEvent.click(resolveButton);
        
        expect(onStatusChange).toHaveBeenCalled();
        expect(onReportClick).not.toHaveBeenCalled();
      }
    });
  });

  describe('Pagination', () => {
    const paginatedProps = {
      ...defaultProps,
      pagination: {
        total: 150,
        page: 2,
        limit: 50,
        totalPages: 3,
      },
    };

    it('should display pagination controls when totalPages > 1', () => {
      render(<BugReportTable {...paginatedProps} />);

      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('should not display pagination when totalPages = 1', () => {
      render(<BugReportTable {...defaultProps} />);

      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('should display current page information', () => {
      render(<BugReportTable {...paginatedProps} />);

      expect(screen.getByText(/Showing 51 to 100 of 150 reports/)).toBeInTheDocument();
    });

    it('should display page number buttons', () => {
      render(<BugReportTable {...paginatedProps} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should highlight current page button', () => {
      render(<BugReportTable {...paginatedProps} />);

      const page2Button = screen.getByRole('button', { name: '2' });
      expect(page2Button).toHaveAttribute('data-variant', 'default');
    });

    it('should call onPageChange when clicking page number', () => {
      const onPageChange = jest.fn();
      render(<BugReportTable {...paginatedProps} onPageChange={onPageChange} />);

      const page3Button = screen.getByRole('button', { name: '3' });
      fireEvent.click(page3Button);

      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('should call onPageChange when clicking Previous button', () => {
      const onPageChange = jest.fn();
      render(<BugReportTable {...paginatedProps} onPageChange={onPageChange} />);

      const previousButton = screen.getByText('Previous');
      fireEvent.click(previousButton);

      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('should call onPageChange when clicking Next button', () => {
      const onPageChange = jest.fn();
      render(<BugReportTable {...paginatedProps} onPageChange={onPageChange} />);

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('should disable Previous button on first page', () => {
      const firstPageProps = {
        ...paginatedProps,
        pagination: { ...paginatedProps.pagination, page: 1 },
      };
      render(<BugReportTable {...firstPageProps} />);

      const previousButton = screen.getByText('Previous');
      expect(previousButton).toBeDisabled();
    });

    it('should disable Next button on last page', () => {
      const lastPageProps = {
        ...paginatedProps,
        pagination: { ...paginatedProps.pagination, page: 3 },
      };
      render(<BugReportTable {...lastPageProps} />);

      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();
    });

    it('should display correct page range for last page', () => {
      const lastPageProps = {
        ...paginatedProps,
        pagination: { ...paginatedProps.pagination, page: 3 },
      };
      render(<BugReportTable {...lastPageProps} />);

      expect(screen.getByText(/Showing 101 to 150 of 150 reports/)).toBeInTheDocument();
    });

    it('should handle pagination with many pages (show 5 page buttons)', () => {
      const manyPagesProps = {
        ...defaultProps,
        pagination: {
          total: 500,
          page: 5,
          limit: 50,
          totalPages: 10,
        },
      };
      render(<BugReportTable {...manyPagesProps} />);

      // Should show 5 page buttons centered around current page
      const pageButtons = screen.getAllByRole('button').filter(
        button => /^\d+$/.test(button.textContent || '')
      );
      
      expect(pageButtons).toHaveLength(5);
    });
  });

  describe('Date Formatting', () => {
    it('should format dates in human-readable format', () => {
      render(<BugReportTable {...defaultProps} />);

      // Check that dates are formatted (not raw ISO strings)
      expect(screen.queryByText('2024-01-15T10:30:00Z')).not.toBeInTheDocument();
      expect(screen.queryByText('2024-01-14T09:00:00Z')).not.toBeInTheDocument();
    });
  });

  describe('Text Truncation', () => {
    it('should truncate long descriptions', () => {
      const longDescriptionReport: BugReport = {
        ...mockReports[0],
        description: 'A'.repeat(150),
      };

      render(<BugReportTable {...defaultProps} reports={[longDescriptionReport]} />);

      const displayedText = screen.getByText(/A+\.\.\./);
      expect(displayedText.textContent?.length).toBeLessThan(150);
    });

    it('should not truncate short descriptions', () => {
      const shortDescription = 'Short bug description';
      const shortDescriptionReport: BugReport = {
        ...mockReports[0],
        description: shortDescription,
      };

      render(<BugReportTable {...defaultProps} reports={[shortDescriptionReport]} />);

      expect(screen.getByText(shortDescription)).toBeInTheDocument();
      expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should render table structure even with no reports', () => {
      render(<BugReportTable {...defaultProps} reports={[]} />);

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('should not display any data rows when reports array is empty', () => {
      render(<BugReportTable {...defaultProps} reports={[]} />);

      const rows = screen.getAllByRole('row');
      // Only header row should be present
      expect(rows.length).toBe(1);
    });
  });

  describe('Accessibility', () => {
    it('should use semantic table elements', () => {
      render(<BugReportTable {...defaultProps} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should have proper table structure with thead and tbody', () => {
      const { container } = render(<BugReportTable {...defaultProps} />);

      expect(container.querySelector('thead')).toBeInTheDocument();
      expect(container.querySelector('tbody')).toBeInTheDocument();
    });

    it('should have clickable rows with cursor pointer', () => {
      render(<BugReportTable {...defaultProps} />);

      const rows = screen.getAllByRole('row');
      const dataRow = rows.find(row => row.textContent?.includes('STU001'));
      
      expect(dataRow).toHaveClass('cursor-pointer');
    });
  });
});
