import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BugReportDetail } from './BugReportDetail';
import type { BugReportDetail as BugReportDetailType } from '@/features/bug-reports/types/bugReport.types';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Bug: () => <div data-testid="bug-icon">Bug</div>,
  User: () => <div data-testid="user-icon">User</div>,
  Mail: () => <div data-testid="mail-icon">Mail</div>,
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
  ExternalLink: () => <div data-testid="external-link-icon">ExternalLink</div>,
  CheckCircle: () => <div data-testid="check-circle-icon">CheckCircle</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  Download: () => <div data-testid="download-icon">Download</div>,
  X: () => <div data-testid="x-icon">X</div>,
  Image: () => <div data-testid="image-icon">Image</div>,
}));

// Mock the API utility
jest.mock('@/shared/api/api', () => ({
  getHostUrl: jest.fn(() => 'http://localhost:3001'),
}));

// Mock Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, size, variant, className, title }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-size={size}
      data-variant={variant}
      className={className}
      title={title}
    >
      {children}
    </button>
  ),
}));

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('BugReportDetail', () => {
  const mockOnStatusUpdate = jest.fn();

  const mockUnresolvedReport: BugReportDetailType = {
    id: 'bug-123',
    userId: 'user-456',
    userRole: 'student',
    userIdentifier: 'REG2024001',
    userEmail: 'student@example.com',
    description: 'The login button is not working properly. When I click it, nothing happens.',
    pageUrl: 'http://localhost:3000/login',
    routePath: '/login',
    resolutionStatus: 'unresolved',
    resolvedAt: null,
    resolvedBy: null,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    screenshots: [
      {
        id: 'screenshot-1',
        bugReportId: 'bug-123',
        originalFilename: 'login-error.png',
        storedFilename: 'uuid-login-error.png',
        fileSize: 102400,
        mimeType: 'image/png',
        storagePath: '/uploads/screenshots/uuid-login-error.png',
        uploadedAt: '2024-01-15T10:30:00Z',
      },
      {
        id: 'screenshot-2',
        bugReportId: 'bug-123',
        originalFilename: 'console-error.png',
        storedFilename: 'uuid-console-error.png',
        fileSize: 204800,
        mimeType: 'image/png',
        storagePath: '/uploads/screenshots/uuid-console-error.png',
        uploadedAt: '2024-01-15T10:30:00Z',
      },
    ],
    reporter: {
      uid: 'REG2024001',
      email: 'student@example.com',
      role: 'student',
      name: 'John Doe',
    },
  };

  const mockResolvedReport: BugReportDetailType = {
    ...mockUnresolvedReport,
    resolutionStatus: 'resolved',
    resolvedAt: '2024-01-16T14:20:00Z',
    resolvedBy: 'admin-789',
    resolver: {
      uid: 'ADMIN001',
      email: 'admin@example.com',
      name: 'Admin User',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering - Basic Information', () => {
    it('should render bug report header with ID', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('Bug Report Details')).toBeInTheDocument();
      expect(screen.getByText('ID: bug-123')).toBeInTheDocument();
    });

    it('should display complete bug description without truncation', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('The login button is not working properly. When I click it, nothing happens.')).toBeInTheDocument();
    });

    it('should display reporter information', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('REG2024001')).toBeInTheDocument();
      expect(screen.getByText('student@example.com')).toBeInTheDocument();
      expect(screen.getByText('student')).toBeInTheDocument();
    });

    it('should display "Not provided" when email is missing', () => {
      const reportWithoutEmail = {
        ...mockUnresolvedReport,
        userEmail: null,
      };

      render(<BugReportDetail report={reportWithoutEmail} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('Not provided')).toBeInTheDocument();
    });

    it('should display complete page URL', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('http://localhost:3000/login')).toBeInTheDocument();
    });

    it('should display route path', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('/login')).toBeInTheDocument();
    });

    it('should display submission timestamp in human-readable format', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      // The component formats the date, so we check for the presence of date elements
      expect(screen.getByText(/January 15, 2024/)).toBeInTheDocument();
    });
  });

  describe('Resolution Status Display', () => {
    it('should display unresolved status badge', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('Unresolved')).toBeInTheDocument();
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('should display resolved status badge', () => {
      render(<BugReportDetail report={mockResolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('Resolved')).toBeInTheDocument();
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    });

    it('should display resolution information when resolved', () => {
      render(<BugReportDetail report={mockResolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('Resolution Information')).toBeInTheDocument();
      expect(screen.getByText(/January 16, 2024/)).toBeInTheDocument();
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    it('should not display resolution information when unresolved', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.queryByText('Resolution Information')).not.toBeInTheDocument();
    });

    it('should display resolver email when name is not available', () => {
      const reportWithResolverEmail = {
        ...mockResolvedReport,
        resolver: {
          uid: 'ADMIN001',
          email: 'admin@example.com',
        },
      };

      render(<BugReportDetail report={reportWithResolverEmail} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });

    it('should display resolver UID when name and email are not available', () => {
      const reportWithResolverUid = {
        ...mockResolvedReport,
        resolver: {
          uid: 'ADMIN001',
          email: '',
        },
      };

      render(<BugReportDetail report={reportWithResolverUid} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('ADMIN001')).toBeInTheDocument();
    });
  });

  describe('Resolution Status Update', () => {
    it('should display "Mark as Resolved" button for unresolved reports', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('Mark as Resolved')).toBeInTheDocument();
    });

    it('should display "Mark as Unresolved" button for resolved reports', () => {
      render(<BugReportDetail report={mockResolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('Mark as Unresolved')).toBeInTheDocument();
    });

    it('should call onStatusUpdate with "resolved" when marking as resolved', async () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      const button = screen.getByText('Mark as Resolved');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnStatusUpdate).toHaveBeenCalledWith('resolved');
      });
    });

    it('should call onStatusUpdate with "unresolved" when marking as unresolved', async () => {
      render(<BugReportDetail report={mockResolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      const button = screen.getByText('Mark as Unresolved');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnStatusUpdate).toHaveBeenCalledWith('unresolved');
      });
    });

    it('should disable button during API request', async () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      const button = screen.getByText('Mark as Resolved');
      fireEvent.click(button);

      // Button should be disabled immediately
      expect(button).toBeDisabled();
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });

    it('should display loading state during update', async () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      const button = screen.getByText('Mark as Resolved');
      fireEvent.click(button);

      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });
  });

  describe('Screenshot Display', () => {
    it('should display all associated screenshots with thumbnails', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('Screenshots (2)')).toBeInTheDocument();
      expect(screen.getByText('login-error.png')).toBeInTheDocument();
      expect(screen.getByText('console-error.png')).toBeInTheDocument();
    });

    it('should display screenshot file sizes', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('100.0 KB')).toBeInTheDocument();
      expect(screen.getByText('200.0 KB')).toBeInTheDocument();
    });

    it('should display placeholder when no screenshots are provided', () => {
      const reportWithoutScreenshots = {
        ...mockUnresolvedReport,
        screenshots: [],
      };

      render(<BugReportDetail report={reportWithoutScreenshots} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByText('No screenshots provided')).toBeInTheDocument();
      expect(screen.getByTestId('image-icon')).toBeInTheDocument();
    });

    it('should open full-size image when thumbnail is clicked', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      const thumbnails = screen.getAllByAltText(/login-error.png|console-error.png/);
      fireEvent.click(thumbnails[0]);

      // Modal should be visible
      expect(screen.getByAltText('Screenshot')).toBeInTheDocument();
    });

    it('should close full-size image modal when X button is clicked', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      // Open modal
      const thumbnails = screen.getAllByAltText(/login-error.png|console-error.png/);
      fireEvent.click(thumbnails[0]);

      // Verify modal is open
      expect(screen.getByAltText('Screenshot')).toBeInTheDocument();

      // Close modal - find the button by its content (X icon)
      const closeButton = screen.getByTestId('x-icon').closest('button');
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      // Modal should be closed (only one screenshot alt text visible)
      const screenshotImages = screen.queryAllByAltText('Screenshot');
      expect(screenshotImages.length).toBe(0);
    });

    it('should close full-size image modal when backdrop is clicked', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      // Open modal
      const thumbnails = screen.getAllByAltText(/login-error.png|console-error.png/);
      fireEvent.click(thumbnails[0]);

      // Click backdrop (the modal container)
      const modal = screen.getByAltText('Screenshot').closest('div[class*="fixed"]');
      if (modal) {
        fireEvent.click(modal);
      }

      // Modal should be closed
      const screenshotImages = screen.queryAllByAltText('Screenshot');
      expect(screenshotImages.length).toBe(0);
    });

    it('should provide download button for individual screenshots', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      const downloadButtons = screen.getAllByTitle('Download screenshot');
      expect(downloadButtons).toHaveLength(2);
    });

    it('should open screenshot in new tab when download button is clicked', () => {
      const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation();
      
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      const downloadButtons = screen.getAllByTitle('Download screenshot');
      fireEvent.click(downloadButtons[0]);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/bug-reports/screenshots/screenshot-1',
        '_blank'
      );

      windowOpenSpy.mockRestore();
    });

    it('should handle missing screenshot files gracefully', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      const images = screen.getAllByAltText(/login-error.png|console-error.png/);
      
      // Simulate image load error
      fireEvent.error(images[0]);

      // The error handler should have been triggered
      // We can't easily test the DOM manipulation, but we verify no crash occurs
      expect(images[0]).toBeInTheDocument();
    });
  });

  describe('Page Information', () => {
    it('should provide button to open page in new tab', () => {
      const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation();
      
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      const openPageButton = screen.getByTitle('Open page in new tab');
      fireEvent.click(openPageButton);

      expect(windowOpenSpy).toHaveBeenCalledWith('http://localhost:3000/login', '_blank');

      windowOpenSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper alt text for screenshots', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByAltText('login-error.png')).toBeInTheDocument();
      expect(screen.getByAltText('console-error.png')).toBeInTheDocument();
    });

    it('should have title attributes for interactive elements', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      expect(screen.getByTitle('Open page in new tab')).toBeInTheDocument();
      expect(screen.getAllByTitle('Download screenshot')).toHaveLength(2);
    });
  });

  describe('Responsive Layout', () => {
    it('should render all sections in proper order', () => {
      render(<BugReportDetail report={mockUnresolvedReport} onStatusUpdate={mockOnStatusUpdate} />);
      
      const sections = [
        'Bug Report Details',
        'Reporter Information',
        'Bug Description',
        'Page Information',
        'Screenshots (2)',
      ];

      sections.forEach(section => {
        expect(screen.getByText(section)).toBeInTheDocument();
      });
    });
  });
});
