/**
 * Research profile page: visibility and ownership.
 *
 * The server strips hidden sections and rejects profiles the viewer may not open;
 * these tests pin how the page renders each of those responses.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ProfilePage from './page';
import type { AuthorProfileView } from '@/features/research-profile/services/researchProfile.service';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ userId: 'author-1' }),
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

let mockViewer: { id: string } | null = { id: 'author-1' };
jest.mock('@/shared/auth/authStore', () => ({
  useAuthStore: () => ({ user: mockViewer }),
}));

const mockGetProfileView = jest.fn();
jest.mock('@/features/research-profile/services/researchProfile.service', () => {
  const actual = jest.requireActual('@/features/research-profile/services/researchProfile.service');
  return {
    ...actual,
    researchProfileService: { getProfileView: (...args: unknown[]) => mockGetProfileView(...args) },
  };
});

jest.mock('@/features/ipr-management/services/drdAnalytics.service', () => ({
  drdAnalyticsService: {
    getApplicantPersonAnalytics: jest.fn().mockRejectedValue(new Error('403')),
    getApplicantPersonSubmissions: jest.fn().mockRejectedValue(new Error('403')),
  },
}));

jest.mock('next/dynamic', () => () => () => null);
jest.mock('@/features/research-profile/components/PublicationList', () => ({
  __esModule: true,
  default: () => <div data-testid="publication-list" />,
}));
jest.mock('@/assets/hero-art.jpg', () => 'hero-art.jpg', { virtual: true });

function makeView(overrides: Partial<AuthorProfileView> = {}): AuthorProfileView {
  const sections = { photo: false, email: true, phone: false, researchInterests: true, publications: true, coAuthors: true, metrics: true };
  return {
    user: {
      id: 'author-1', uid: 'FAC-1', name: 'Dr. Asha Rao', email: 'asha@uni.example', phone: null, photo: null,
      designation: 'Professor', department: 'Physics', school: 'School of Sciences', university: 'Demo University',
    },
    profile: {
      id: 'p1', userId: 'author-1', bio: 'Works on photonics.', researchInterests: ['Photonics'], researchInterestsSource: 'author',
      orcid: null, scopusAuthorId: null, webOfScienceId: null, lastSyncedAt: null,
      metrics: { totalCitations: 120, hIndex: 6, i10Index: 3, avgCitationsPerPaper: 12, citationsPerYear: [] },
    },
    publications: [],
    publicationCount: 0,
    incentiveSummary: null,
    coAuthorCount: 0,
    coAuthors: [],
    impactMetrics: null,
    sections,
    access: { isOwner: true, canEdit: true, canViewPrivate: true },
    visibility: 'institution',
    allowSearchIndexing: false,
    ...overrides,
  };
}

const accessError = (code: string) => Object.assign(new Error(code), { response: { status: 403, data: { code } } });

beforeEach(() => {
  mockViewer = { id: 'author-1' };
  mockGetProfileView.mockReset();
  mockPush.mockReset();
});

describe('Research profile page', () => {
  it('shows the owner their visibility and a Manage Profile button', async () => {
    mockGetProfileView.mockResolvedValue(makeView());
    render(<ProfilePage />);

    expect(await screen.findByText('Dr. Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Manage Profile')).toBeInTheDocument();
    expect(screen.getByText('University only')).toBeInTheDocument();
    expect(screen.getByText('Works on photonics.')).toBeInTheDocument();
  });

  it('offers the public link to the owner once the profile is public', async () => {
    mockGetProfileView.mockResolvedValue(
      makeView({
        visibility: 'public',
        settings: {
          bio: null, researchInterests: [], profileVisibility: 'public', showEmail: true, showPhone: false,
          showResearchInterests: true, showPublications: true, showCoAuthors: true, showMetrics: true, showPhoto: true,
          allowSearchIndexing: false, publicHandle: 'asha-rao', publicPath: '/p/demo/asha-rao', cvDetails: {},
        },
      }),
    );
    render(<ProfilePage />);
    expect(await screen.findByText('Share public link')).toBeInTheDocument();
    expect(screen.getByText('Public profile')).toBeInTheDocument();
  });

  it('never shows edit controls or the visibility badge to other viewers', async () => {
    mockViewer = { id: 'someone-else' };
    mockGetProfileView.mockResolvedValue(makeView({ access: { isOwner: false, canEdit: false, canViewPrivate: false } }));
    render(<ProfilePage />);

    expect(await screen.findByText('Dr. Asha Rao')).toBeInTheDocument();
    expect(screen.queryByText('Manage Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('University only')).not.toBeInTheDocument();
  });

  it('hides the sections the author turned off', async () => {
    mockViewer = { id: 'someone-else' };
    mockGetProfileView.mockResolvedValue(
      makeView({
        user: { ...makeView().user, email: null },
        access: { isOwner: false, canEdit: false, canViewPrivate: false },
        sections: { photo: false, email: false, phone: false, researchInterests: false, publications: false, coAuthors: false, metrics: false },
      }),
    );
    render(<ProfilePage />);

    expect(await screen.findByText('Dr. Asha Rao')).toBeInTheDocument();
    expect(screen.queryByText('asha@uni.example')).not.toBeInTheDocument();
    expect(screen.queryByText('CITATIONS')).not.toBeInTheDocument();
    expect(screen.queryByText('Research Focus')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Publications/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Network/ })).not.toBeInTheDocument();
  });

  it('does not invent a bio or interests when the author has none', async () => {
    mockViewer = { id: 'someone-else' };
    mockGetProfileView.mockResolvedValue(
      makeView({
        access: { isOwner: false, canEdit: false, canViewPrivate: false },
        profile: { ...makeView().profile, bio: null, researchInterests: [] },
      }),
    );
    render(<ProfilePage />);

    expect(await screen.findByText('Dr. Asha Rao')).toBeInTheDocument();
    expect(screen.queryByText('Biography')).not.toBeInTheDocument();
    expect(screen.queryByText('Research Focus')).not.toBeInTheDocument();
  });

  it.each([
    ['PROFILE_PRIVATE', 'This profile is private'],
    ['PROFILE_INSTITUTION_ONLY', 'Visible to university members only'],
    ['PROFILE_NOT_FOUND', 'Profile not found'],
  ])('explains %s instead of rendering placeholder data', async (code, message) => {
    mockViewer = { id: 'someone-else' };
    mockGetProfileView.mockRejectedValue(accessError(code));
    render(<ProfilePage />);

    expect(await screen.findByText(message)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Research Faculty')).not.toBeInTheDocument());
  });
});
