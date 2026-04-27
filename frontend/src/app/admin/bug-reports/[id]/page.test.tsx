import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import BugReportDetailPage from './page';
import api from '@/shared/api/api';
import { useAuthStore } from '@/shared/auth/authStore';
import type { BugReportDetail } from '@/features/bug-reports/types/bugReport.types';

// Mock next/navigation
const mockPush = jest.fn();
const mockParams = { id: 'bug-123' };

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => mockParams,
}));

// Mock API
jest.mock('@/shared/api/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
  },
  getHostUrl: jest.fn(() => 'http://localhost:3001'),
}));

// Mock auth store
jest.mock('@/shared/auth/authStore');

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ArrowLeft: () => <div data-testid="arrow-left-icon">ArrowLeft</div>,
  Loader2: () => <div data-testid="loader-icon">Loader2</div>,
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

// Mock Button component
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}));

// Mock BugReportDetail component
jest.mock('../components/BugReportDetail', () => ({
  BugReportDetail: ({ report, onStatusUpdate }: any) => (
    <div data-testid="bug-report-detail">
      <div>Bug ID: {report.id}</div>
      <div>Description: {report.description}</div>
      <div>Status: {report.resolutionStatus}</div>
      <button onClick={() => onStatusUpdate('resolved')}>Mark as Resolved</button>
      <button onClick={() => onStatusUpdate('unresolved')}>Mark as Unresolved</button>
    </div>
  ),
}));

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

describe('BugReportDetailPage', () => {
  const mockAdminUser = {
    uid: 'ADMIN001',
    id: 'admin-123',
    email: 'admin@example.com',
    userType: 'admin',
    role: {
      name: 'admin',
    },
  };

  const mockSuperadminUser = {
    uid: 'SUPER001',
    id: 'super-123',
    email: 'superadmin@example.com',
    userType: 'employee',
    role: {
      name: 'superadmin',
    },
  };

  const mockNonAdminUser = {
    uid: 'STU001',
    id: 'student-123',
    email: 'student@example.com',
    userType: 'student',
    role: {
      name: 'student',
    },
  };

  const mockBugReport: BugReportDetail = {
    id: 'bug-123',
    userId: 'user-456',
    userRole: 'student',
    userIdentifier: 'REG2024001',
    userEmail: 'student@example.com',
    description: 'The login button is not working properly.',
    pageUrl: 'http://localhost:3000/login',
    routePath: '/login',
    resolutionStatus: 'unresolved',
    resolvedAt: null,
    resolvedBy: null,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    screenshots: [],
    reporter: {
      uid: 'REG2024001',
      email: 'student@example.com',
      role: 'student',
      name: 'John Doe',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Authentication and Authorization', () => {
    it('should redirect non-admin users to dashboard', async () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: mockNonAdminUser });

      render(<BugReportDetailPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should not render content for non-admin users', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: mockNonAdminUser });

      const { container } = render(<BugReportDetailPage />);

      expect(container.firstChild).toBeNull();
    });

    it('should allow admin users to access the page', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: mockAdminUser });
      (api.get as jest.Mock).mockResolvedValue({ data: mockBugReport });

      render(<BugReportDetailPage />);

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should allow superadmin users to access the page', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: mockSuperadminUser });
      (api.get as jest.Mock).mockResolvedValue({ data: mockBugReport });

      render(<BugReportDetailPage />);

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch bug report details on mount', async () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: mockAdminUser });
      (api.get as jest.Mock).mockResolvedValue({ data: mockBugReport });

      render(<BugReportDetailPage />);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/admin/bug-reports/bug-123');
      });
    });

    it('should display loading indicator while fetching', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: mockAdminUser });
      (api.get as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<BugReportDetailPage />);

      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should display back button', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: mockAdminUser });
      (api.get as jest.Mock).mockResolvedValue({ data: mockBugReport });

      render(<BugReportDetailPage />);

      expect(screen.getByText('Back to Bug Reports')).toBeInTheDocument();
    });

    it('should navigate back to bug reports list when back button is clicked', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: mockAdminUser });
      (api.get as jest.Mock).mockResolvedValue({ data: mockBugReport });

      render(<BugReportDetailPage />);

      const backButton = screen.getByText('Back to Bug Reports');
      fireEvent.click(backButton);

      expect(mockPush).toHaveBeenCalledWith('/admin/bug-reports');
    });
  });

  describe('Rendering', () => {
    it('should render page layout with proper structure', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: mockAdminUser });
      (api.get as jest.Mock).mockResolvedValue({ data: mockBugReport });

      render(<BugReportDetailPage />);

      // Check for main container
      expect(screen.getByText('Back to Bug Reports')).toBeInTheDocument();
    });

    it('should not display error or detail during initial load', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: mockAdminUser });
      (api.get as jest.Mock).mockImplementation(() => new Promise(() => {}));

      render(<BugReportDetailPage />);

      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('bug-report-detail')).not.toBeInTheDocument();
    });
  });
});
