/**
 * The header logo and the dashboard hero render the university's branding, with sensible
 * defaults when nothing is set; the editor previews a preset and warns about weak colours.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Branding } from '@/shared/theme/theme';

const mockBranding: { value: Branding | null } = { value: null };
jest.mock('@/shared/providers/BrandingProvider', () => {
  const { buildTheme } = jest.requireActual('@/shared/theme/theme');
  return {
    useBranding: () => ({ branding: mockBranding.value, theme: buildTheme(mockBranding.value), isLoading: false, active: true }),
  };
});
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/dashboard' }));
jest.mock('@/shared/auth/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1', firstName: 'Asha', userType: 'faculty', role: { name: 'faculty' } } }) }));
jest.mock('@/shared/hooks/useUserContextQueries', () => ({ useStaffDashboardSummary: jest.fn() }));
jest.mock('@/shared/hooks/useAffiliation', () => ({ useAffiliation: () => ({ canonicalName: 'Affiliation Name' }) }));
jest.mock('@/shared/api/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('@/features/research-management/services/research.service', () => ({
  researchService: { getMyContributions: jest.fn(async () => ({ data: { contributions: [{ status: 'approved', publicationType: 'research_paper', title: 'Paper', indexingDetails: { citationCount: 4 }, incentiveAmount: 1000, createdAt: '2026-01-01' }] } })) },
}));
jest.mock('@/features/ipr-management/services/ipr.service', () => ({ iprService: { getMyApplications: jest.fn(async () => []) } }));

import TenantLogo from '@/shared/components/brand/TenantLogo';
import ModernStaffDashboard from '@/features/dashboard/components/ModernStaffDashboard';
import BrandingEditor from '@/features/branding/components/BrandingEditor';

const RISU: Branding = {
  slug: 'rungta', displayName: 'Rungta International Skills University', shortName: 'RISU', tagline: null,
  themePreset: 'royal-blue', primaryColor: null, accentColor: null, heroHeading: null, heroSubheading: null,
  logoUrl: null, logoDarkUrl: null, faviconUrl: null, version: 1,
};

const withQuery = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe('TenantLogo (header)', () => {
  test('shows the ResearchSphere wordmark when no university branding applies', () => {
    mockBranding.value = null;
    render(<TenantLogo />);
    expect(screen.getByAltText('ResearchSphere')).toBeInTheDocument();
  });

  test('shows a monogram, the university name and "Powered by ResearchSphere" without a logo', () => {
    mockBranding.value = RISU;
    render(<TenantLogo />);
    expect(screen.getByText('RISU')).toBeInTheDocument();
    expect(screen.getByText('Rungta International Skills University')).toBeInTheDocument();
    expect(screen.getByText('Powered by ResearchSphere')).toBeInTheDocument();
  });

  test('uses the uploaded logo, with the dark variant for dark mode', () => {
    mockBranding.value = { ...RISU, logoUrl: '/l.png', logoDarkUrl: '/d.png' };
    render(<TenantLogo />);
    const logos = screen.getAllByAltText('Rungta International Skills University logo');
    expect(logos.map((i) => i.getAttribute('src'))).toEqual(['/l.png', '/d.png']);
    expect(logos[0].className).toContain('dark:hidden');
  });
});

describe('dashboard hero', () => {
  test('defaults: university name, default heading, real KPI numbers', async () => {
    mockBranding.value = RISU;
    withQuery(<ModernStaffDashboard />);
    expect(screen.getByTestId('hero-badge')).toHaveTextContent('RISU · Research & Development Portal');
    expect(screen.getByTestId('hero-heading')).toHaveTextContent('Where IdeasBecome Impact');
    expect(screen.getByTestId('hero-university')).toHaveTextContent('Rungta International Skills University');
    // KPI tiles come from the user's own submissions (1 approved paper), not placeholders
    expect((await screen.findAllByText('Publications')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Rs 1,000')).toBeInTheDocument();
  });

  test('custom heading and subheading', () => {
    mockBranding.value = { ...RISU, heroHeading: 'Skills That Shape Tomorrow', heroSubheading: 'Research at RISU.' };
    withQuery(<ModernStaffDashboard />);
    expect(screen.getByTestId('hero-heading')).toHaveTextContent('Skills That Shape Tomorrow');
    expect(screen.getByTestId('hero-heading').querySelector('span')).toHaveTextContent('Tomorrow');
    expect(screen.getByText('Research at RISU.')).toBeInTheDocument();
  });
});

describe('BrandingEditor (create mode)', () => {
  test('previews the chosen preset and warns when a custom colour is too light', () => {
    mockBranding.value = null;
    const onDraft = jest.fn();
    render(<BrandingEditor mode="create" legalName="Example University" onDraftChange={onDraft} />);
    fireEvent.click(screen.getByRole('radio', { name: /Royal Blue & White/ }));
    expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ values: expect.objectContaining({ themePreset: 'royal-blue' }) }));
    const light = screen.getByTestId('brand-preview-light');
    expect(light.style.getPropertyValue('--brand-primary')).toBe('29 78 216');
    expect(screen.getByTestId('brand-preview-dark').style.getPropertyValue('--brand-primary-text')).toBe('147 197 253');

    fireEvent.change(screen.getByLabelText('Custom primary colour'), { target: { value: '#FDE047' } });
    expect(screen.getByRole('status')).toHaveTextContent(/too light/);
  });
});
