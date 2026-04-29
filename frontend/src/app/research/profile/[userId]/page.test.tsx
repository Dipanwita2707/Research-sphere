/**
 * Property-Based Tests for Profile Page Display
 * 
 * Task 2.2: Write property tests for profile display
 * - Property 1: Citation Metrics Display Completeness
 * - Property 4: Profile Ownership Edit Control
 * 
 * Validates: Requirements 1.2, 1.9, 1.10
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import ProfilePage from './page';
import { mockResearchProfileAPI } from '@/mocks/research-profile-api';
import type { ProfileData, CitationMetrics } from '@/shared/types/research-profile.types';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}));

jest.mock('@/shared/auth/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/mocks/research-profile-api', () => ({
  mockResearchProfileAPI: {
    getProfile: jest.fn(),
  },
}));

// Mock child components to simplify testing
jest.mock('@/features/research-profile/components/CitationMetricsPanel', () => ({
  __esModule: true,
  default: ({ metrics }: { metrics: CitationMetrics }) => (
    <div data-testid="citation-metrics-panel">
      <div data-testid="h-index">{metrics.hIndex}</div>
      <div data-testid="i10-index">{metrics.i10Index}</div>
      <div data-testid="total-citations">{metrics.totalCitations}</div>
      <div data-testid="avg-citations">{metrics.avgCitationsPerPaper}</div>
    </div>
  ),
}));

jest.mock('@/features/research-profile/components/PublicationList', () => ({
  __esModule: true,
  default: () => <div data-testid="publication-list">Publications</div>,
}));

jest.mock('@/features/research-profile/components/CitationTrendChart', () => ({
  __esModule: true,
  default: () => <div data-testid="citation-trend-chart">Chart</div>,
}));

jest.mock('@/features/research-profile/components/ResearchInterestsTags', () => ({
  __esModule: true,
  default: () => <div data-testid="research-interests">Interests</div>,
}));

jest.mock('lucide-react', () => ({
  Mail: () => <svg data-testid="mail-icon" />,
  Building2: () => <svg data-testid="building-icon" />,
  GraduationCap: () => <svg data-testid="graduation-icon" />,
  Edit2: () => <svg data-testid="edit-icon" />,
  ExternalLink: () => <svg data-testid="external-link-icon" />,
  FileText: () => <svg data-testid="file-text-icon" />,
  TrendingUp: () => <svg data-testid="trending-up-icon" />,
  Users: () => <svg data-testid="users-icon" />,
  Award: () => <svg data-testid="award-icon" />,
}));

// Import mocked modules
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/shared/auth/authStore';

const mockUseParams = useParams as jest.MockedFunction<typeof useParams>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockGetProfile = mockResearchProfileAPI.getProfile as jest.MockedFunction<
  typeof mockResearchProfileAPI.getProfile
>;

// ============================================================================
// Fast-Check Arbitraries (Data Generators)
// ============================================================================

/**
 * Arbitrary for generating valid citation metrics
 */
const citationMetricsArbitrary = fc.record({
  hIndex: fc.integer({ min: 0, max: 200 }),
  i10Index: fc.integer({ min: 0, max: 500 }),
  totalCitations: fc.integer({ min: 0, max: 50000 }),
  citationsPerYear: fc.array(
    fc.record({
      year: fc.integer({ min: 2000, max: 2024 }),
      count: fc.integer({ min: 0, max: 1000 }),
    }),
    { minLength: 0, maxLength: 25 }
  ),
  avgCitationsPerPaper: fc.float({ min: 0, max: 500, noNaN: true }),
});

/**
 * Arbitrary for generating profile data with citation metrics
 */
const profileDataWithMetricsArbitrary = fc.record({
  user: fc.record({
    uid: fc.uuid(),
    name: fc.string({ minLength: 3, maxLength: 50 }),
    email: fc.emailAddress(),
    photo: fc.option(fc.webUrl(), { nil: null }),
    designation: fc.constantFrom('Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer'),
    department: fc.constantFrom('Computer Science', 'Mathematics', 'Physics', 'Chemistry'),
    school: fc.constantFrom('School of Engineering', 'School of Sciences', 'School of Arts'),
  }),
  profile: fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    googleScholarId: fc.option(fc.string(), { nil: null }),
    scopusAuthorId: fc.option(fc.string(), { nil: null }),
    webOfScienceId: fc.option(fc.string(), { nil: null }),
    orcid: fc.option(fc.string(), { nil: null }),
    researchInterests: fc.array(fc.string({ minLength: 3, maxLength: 30 }), { minLength: 0, maxLength: 10 }),
    bio: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: null }),
    personalWebsite: fc.option(fc.webUrl(), { nil: null }),
    metrics: citationMetricsArbitrary,
    visibility: fc.record({
      profile: fc.constantFrom('public', 'institution', 'private'),
      showEmail: fc.boolean(),
      showPhone: fc.boolean(),
      showResearchInterests: fc.boolean(),
      showPublications: fc.boolean(),
      showCoAuthors: fc.boolean(),
      showMetrics: fc.boolean(),
    }),
    lastSyncedAt: fc.option(
      fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2024-12-31') }).map(ts => new Date(ts).toISOString()), 
      { nil: null }
    ),
    syncStatus: fc.constantFrom('never_synced', 'syncing', 'success', 'failed', 'pending'),
    syncError: fc.option(fc.string(), { nil: null }),
    autoSyncEnabled: fc.boolean(),
    syncFrequencyDays: fc.integer({ min: 1, max: 30 }),
    profileCompleteness: fc.integer({ min: 0, max: 100 }),
    isVerified: fc.boolean(),
    verifiedAt: fc.option(
      fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2024-12-31') }).map(ts => new Date(ts).toISOString()), 
      { nil: null }
    ),
    verifiedBy: fc.option(fc.uuid(), { nil: null }),
    createdAt: fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2024-12-31') }).map(ts => new Date(ts).toISOString()),
    updatedAt: fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2024-12-31') }).map(ts => new Date(ts).toISOString()),
  }),
  publications: fc.array(fc.record({
    id: fc.uuid(),
    profileId: fc.uuid(),
    title: fc.string({ minLength: 10, maxLength: 200 }),
    year: fc.integer({ min: 2000, max: 2024 }),
    citationCount: fc.integer({ min: 0, max: 1000 }),
  }), { minLength: 0, maxLength: 50 }),
  coAuthors: fc.array(fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 3, maxLength: 50 }),
    collaborationCount: fc.integer({ min: 1, max: 50 }),
  }), { minLength: 0, maxLength: 20 }),
  impactMetrics: fc.record({
    avgCitationsPerPaper: fc.float({ min: 0, max: 500, noNaN: true }),
    medianCitations: fc.integer({ min: 0, max: 100 }),
    highlyCitedPapers: fc.integer({ min: 0, max: 50 }),
    citationDistribution: fc.array(fc.record({
      range: fc.string(),
      count: fc.integer({ min: 0, max: 100 }),
    })),
  }),
});

// ============================================================================
// Property 1: Citation Metrics Display Completeness
// **Validates: Requirements 1.2, 1.10**
// ============================================================================

describe('Property 1: Citation Metrics Display Completeness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display all citation metric values when metrics are visible', async () => {
    await fc.assert(
      fc.asyncProperty(
        profileDataWithMetricsArbitrary,
        fc.uuid(),
        async (profileData, userId) => {
          // Ensure metrics are visible
          const profileWithVisibleMetrics: ProfileData = {
            ...profileData,
            profile: {
              ...profileData.profile,
              visibility: {
                ...profileData.profile.visibility,
                showMetrics: true,
              },
            },
          } as ProfileData;

          // Setup mocks
          mockUseParams.mockReturnValue({ userId });
          mockUseAuthStore.mockReturnValue({ user: { id: 'different-user' } } as any);
          mockGetProfile.mockResolvedValue({
            profile: profileWithVisibleMetrics,
            permissions: { canEdit: false, canViewPrivate: false },
          });

          // Render component
          const { container, unmount } = render(<ProfilePage />);

          try {
            // Wait for profile to load
            await waitFor(() => {
              expect(mockGetProfile).toHaveBeenCalledWith(userId);
            });

            // Property: All metric values must be present in the rendered output
            const metrics = profileWithVisibleMetrics.profile.metrics;
            
            // Check h-index is displayed (use container to scope query)
            const hIndexElement = container.querySelector('[data-testid="h-index"]');
            expect(hIndexElement).toBeInTheDocument();
            expect(hIndexElement?.textContent).toBe(String(metrics.hIndex));

            // Check i10-index is displayed
            const i10IndexElement = container.querySelector('[data-testid="i10-index"]');
            expect(i10IndexElement).toBeInTheDocument();
            expect(i10IndexElement?.textContent).toBe(String(metrics.i10Index));

            // Check total citations is displayed
            const totalCitationsElement = container.querySelector('[data-testid="total-citations"]');
            expect(totalCitationsElement).toBeInTheDocument();
            expect(totalCitationsElement?.textContent).toBe(String(metrics.totalCitations));

            // Check average citations per paper is displayed
            const avgCitationsElement = container.querySelector('[data-testid="avg-citations"]');
            expect(avgCitationsElement).toBeInTheDocument();
            expect(avgCitationsElement?.textContent).toBe(String(metrics.avgCitationsPerPaper));

            // Check impact metrics are displayed
            const impactMetrics = profileWithVisibleMetrics.impactMetrics;
            expect(container.textContent).toContain(impactMetrics.avgCitationsPerPaper.toFixed(1));
            expect(container.textContent).toContain(String(impactMetrics.medianCitations));
            expect(container.textContent).toContain(String(impactMetrics.highlyCitedPapers));
          } finally {
            // Clean up after each property test run
            unmount();
          }
        }
      ),
      {
        numRuns: 50, // Run 50 test cases with different random data
        endOnFailure: true,
      }
    );
  });

  it('should not display citation metrics when visibility is disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        profileDataWithMetricsArbitrary,
        fc.uuid(),
        async (profileData, userId) => {
          // Ensure metrics are NOT visible
          const profileWithHiddenMetrics: ProfileData = {
            ...profileData,
            profile: {
              ...profileData.profile,
              visibility: {
                ...profileData.profile.visibility,
                showMetrics: false,
              },
            },
          } as ProfileData;

          // Setup mocks
          mockUseParams.mockReturnValue({ userId });
          mockUseAuthStore.mockReturnValue({ user: { id: 'different-user' } } as any);
          mockGetProfile.mockResolvedValue({
            profile: profileWithHiddenMetrics,
            permissions: { canEdit: false, canViewPrivate: false },
          });

          // Render component
          const { container, unmount } = render(<ProfilePage />);

          try {
            // Wait for profile to load
            await waitFor(() => {
              expect(mockGetProfile).toHaveBeenCalledWith(userId);
            });

            // Property: Citation metrics should NOT be displayed
            expect(container.querySelector('[data-testid="citation-metrics-panel"]')).not.toBeInTheDocument();
            expect(container.querySelector('[data-testid="h-index"]')).not.toBeInTheDocument();
            expect(container.querySelector('[data-testid="i10-index"]')).not.toBeInTheDocument();
            expect(container.querySelector('[data-testid="total-citations"]')).not.toBeInTheDocument();
          } finally {
            unmount();
          }
        }
      ),
      {
        numRuns: 30,
        endOnFailure: true,
      }
    );
  });
});

// ============================================================================
// Property 4: Profile Ownership Edit Control
// **Validates: Requirements 1.9**
// ============================================================================

describe('Property 4: Profile Ownership Edit Control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display edit controls if and only if viewer is the profile owner', async () => {
    await fc.assert(
      fc.asyncProperty(
        profileDataWithMetricsArbitrary,
        fc.boolean(), // isOwner flag
        async (profileData, isOwner) => {
          const userId = profileData.user.uid;
          const viewerId = isOwner ? userId : 'different-user-id';

          // Setup mocks
          mockUseParams.mockReturnValue({ userId });
          mockUseAuthStore.mockReturnValue({ user: { id: viewerId } } as any);
          mockGetProfile.mockResolvedValue({
            profile: profileData as ProfileData,
            permissions: { canEdit: isOwner, canViewPrivate: isOwner },
          });

          // Render component
          const { container, unmount } = render(<ProfilePage />);

          try {
            // Wait for profile to load
            await waitFor(() => {
              expect(mockGetProfile).toHaveBeenCalledWith(userId);
            });

            // Property: Edit button should be present if and only if viewer is owner
            // Check for inline edit buttons (Edit links next to sections)
            const editButtons = container.querySelectorAll('button');
            const hasEditControls = Array.from(editButtons).some(btn => 
              btn.textContent?.includes('Edit')
            );

            if (isOwner) {
              // Owner should see inline edit controls
              expect(hasEditControls).toBeTruthy();
            } else {
              // Non-owner should NOT see any edit controls
              const editLinks = Array.from(editButtons).filter(btn => 
                btn.textContent?.includes('Edit') && 
                !btn.textContent?.includes('Edit Profile')
              );
              expect(editLinks.length).toBe(0);
            }
          } finally {
            unmount();
          }
        }
      ),
      {
        numRuns: 100, // Run many cases to test both owner and non-owner scenarios
        endOnFailure: true,
      }
    );
  });

  it('should consistently show/hide edit controls based on ownership across re-renders', async () => {
    await fc.assert(
      fc.asyncProperty(
        profileDataWithMetricsArbitrary,
        fc.boolean(),
        async (profileData, isOwner) => {
          const userId = profileData.user.uid;
          const viewerId = isOwner ? userId : 'different-user-id';

          // Setup mocks
          mockUseParams.mockReturnValue({ userId });
          mockUseAuthStore.mockReturnValue({ user: { id: viewerId } } as any);
          mockGetProfile.mockResolvedValue({
            profile: profileData as ProfileData,
            permissions: { canEdit: isOwner, canViewPrivate: isOwner },
          });

          // Render component
          const { container, rerender, unmount } = render(<ProfilePage />);

          try {
            // Wait for initial load
            await waitFor(() => {
              expect(mockGetProfile).toHaveBeenCalled();
            });

            const findEditButton = () => {
              const buttons = container.querySelectorAll('button');
              return Array.from(buttons).some(btn => btn.textContent?.includes('Edit'));
            };

            const editButtonBefore = findEditButton();

            // Re-render component
            rerender(<ProfilePage />);

            // Wait a bit for any state updates
            await waitFor(() => {
              const icons = container.querySelectorAll('[data-testid="file-text-icon"]');
              expect(icons.length).toBeGreaterThanOrEqual(0);
            }, { timeout: 1000 });

            const editButtonAfter = findEditButton();

            // Property: Edit control visibility should be consistent across re-renders
            if (isOwner) {
              expect(editButtonBefore).toBeTruthy();
              expect(editButtonAfter).toBeTruthy();
            } else {
              expect(editButtonBefore).toBeFalsy();
              expect(editButtonAfter).toBeFalsy();
            }
          } finally {
            unmount();
          }
        }
      ),
      {
        numRuns: 50,
        endOnFailure: true,
      }
    );
  });

  it('should never show edit controls to non-owners regardless of profile data', async () => {
    await fc.assert(
      fc.asyncProperty(
        profileDataWithMetricsArbitrary,
        async (profileData) => {
          const userId = profileData.user.uid;
          const viewerId = 'definitely-not-the-owner';

          // Setup mocks - viewer is NOT the owner
          mockUseParams.mockReturnValue({ userId });
          mockUseAuthStore.mockReturnValue({ user: { id: viewerId } } as any);
          mockGetProfile.mockResolvedValue({
            profile: profileData as ProfileData,
            permissions: { canEdit: false, canViewPrivate: false },
          });

          // Render component
          const { container, unmount } = render(<ProfilePage />);

          try {
            // Wait for profile to load
            await waitFor(() => {
              expect(mockGetProfile).toHaveBeenCalledWith(userId);
            });

            // Property: Non-owners should NEVER see edit controls
            const buttons = container.querySelectorAll('button');
            const hasEditControls = Array.from(buttons).some(btn => 
              btn.textContent?.includes('Edit')
            );
            expect(hasEditControls).toBeFalsy();
          } finally {
            unmount();
          }
        }
      ),
      {
        numRuns: 50,
        endOnFailure: true,
      }
    );
  });
});

// ============================================================================
// Additional Property Tests: Combined Scenarios
// ============================================================================

describe('Combined Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should correctly display metrics AND edit controls based on ownership and visibility', async () => {
    await fc.assert(
      fc.asyncProperty(
        profileDataWithMetricsArbitrary,
        fc.boolean(), // isOwner
        fc.boolean(), // showMetrics
        async (profileData, isOwner, showMetrics) => {
          const userId = profileData.user.uid;
          const viewerId = isOwner ? userId : 'different-user-id';

          const profileWithSettings: ProfileData = {
            ...profileData,
            profile: {
              ...profileData.profile,
              visibility: {
                ...profileData.profile.visibility,
                showMetrics,
              },
            },
          } as ProfileData;

          // Setup mocks
          mockUseParams.mockReturnValue({ userId });
          mockUseAuthStore.mockReturnValue({ user: { id: viewerId } } as any);
          mockGetProfile.mockResolvedValue({
            profile: profileWithSettings,
            permissions: { canEdit: isOwner, canViewPrivate: isOwner },
          });

          // Render component
          const { container, unmount } = render(<ProfilePage />);

          try {
            // Wait for profile to load
            await waitFor(() => {
              expect(mockGetProfile).toHaveBeenCalledWith(userId);
            });

            // Property 1: Metrics visibility
            const metricsPanel = container.querySelector('[data-testid="citation-metrics-panel"]');
            if (showMetrics) {
              expect(metricsPanel).toBeInTheDocument();
            } else {
              expect(metricsPanel).not.toBeInTheDocument();
            }

            // Property 4: Edit control visibility
            const buttons = container.querySelectorAll('button');
            const hasEditControls = Array.from(buttons).some(btn => 
              btn.textContent?.includes('Edit')
            );
            if (isOwner) {
              expect(hasEditControls).toBeTruthy();
            } else {
              expect(hasEditControls).toBeFalsy();
            }
          } finally {
            unmount();
          }
        }
      ),
      {
        numRuns: 100, // Test all combinations
        endOnFailure: true,
      }
    );
  });
});
