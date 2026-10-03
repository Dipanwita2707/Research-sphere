/**
 * Runtime application of a university theme:
 *  - CSS variables land on <html> (and come off again for the default theme);
 *  - globals.css defaults are exactly the Classic Wine preset;
 *  - the pre-paint boot script applies the cached theme before React (no flash), only for
 *    the user it belongs to and never on platform pages;
 *  - BrandingProvider renders cached branding immediately and stores fresh branding.
 */
import fs from 'fs';
import path from 'path';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildTheme, themeCss, type Branding } from '../theme';
import { BRANDING_BOOT_SCRIPT, BRANDING_CACHE_KEY, isDefaultThemeRoute, readBrandingCache } from '../brandingCache';

const mockPathname = { value: '/dashboard' };
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname.value }));
const mockGet = jest.fn();
jest.mock('@/shared/api/api', () => ({ __esModule: true, default: { get: (...a: unknown[]) => mockGet(...a) } }));
const mockAuth = { user: { id: 'user-1' } as { id: string } | null, isAuthenticated: true };
jest.mock('@/shared/auth/authStore', () => ({ useAuthStore: (sel: (s: typeof mockAuth) => unknown) => sel(mockAuth) }));

// imported after the mocks
import BrandingProvider, { applyBrandTheme, useBranding } from '@/shared/providers/BrandingProvider';

const RISU: Branding = {
  universityId: 'u-r', code: 'RUNGTA', slug: 'rungta', legalName: 'Rungta University',
  displayName: 'Rungta International Skills University', shortName: 'RISU', tagline: null,
  themePreset: 'royal-blue', primaryColor: null, accentColor: null, heroHeading: null, heroSubheading: null,
  logoUrl: null, logoDarkUrl: null, faviconUrl: null, version: 1,
};

const resetDom = () => {
  document.head.innerHTML = '<title>Dashboard</title>';
  document.documentElement.removeAttribute('data-brand');
  document.documentElement.removeAttribute('data-brand-tint');
  document.documentElement.classList.remove('dark');
  window.localStorage.clear();
};

beforeEach(() => {
  resetDom();
  mockGet.mockReset();
  mockPathname.value = '/dashboard';
  mockAuth.user = { id: 'user-1' };
  mockAuth.isAuthenticated = true;
});

describe('applyBrandTheme', () => {
  test('writes the theme variables on <html> and removes them for the default theme', () => {
    applyBrandTheme(buildTheme({ themePreset: 'royal-blue' }));
    const style = document.getElementById('rs-brand-theme');
    expect(style?.textContent).toContain('--brand-primary:29 78 216');
    expect(document.documentElement.hasAttribute('data-brand')).toBe(true);
    expect(document.documentElement.hasAttribute('data-brand-tint')).toBe(true);

    applyBrandTheme(buildTheme(null));
    expect(document.getElementById('rs-brand-theme')).toBeNull();
    expect(document.documentElement.hasAttribute('data-brand')).toBe(false);
  });

  test('sets and clears the university favicon', () => {
    applyBrandTheme(buildTheme({ themePreset: 'crimson' }), { faviconUrl: '/api/v1/public/branding/x/logo/favicon?v=1' });
    expect((document.getElementById('rs-brand-favicon') as HTMLLinkElement).getAttribute('href')).toContain('/logo/favicon');
    applyBrandTheme(null);
    expect(document.getElementById('rs-brand-favicon')).toBeNull();
  });
});

test('globals.css defaults are the Classic Wine preset', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../../styles/globals.css'), 'utf8');
  const theme = buildTheme(null);
  for (const [name, value] of Object.entries(theme.light)) expect(css).toContain(`${name}: ${value};`);
  for (const [name, value] of Object.entries(theme.dark)) expect(css).toContain(`${name}: ${value};`);
});

describe('pre-paint boot script', () => {
  const runBoot = (pathname: string) => {
    window.history.replaceState(null, '', pathname);
    new Function(BRANDING_BOOT_SCRIPT)();
  };
  const seed = (userId: string, cacheUser = 'user-1') => {
    window.localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { id: userId } } }));
    window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify({ v: 1, userId: cacheUser, css: themeCss(buildTheme({ themePreset: 'royal-blue' })), tint: true, faviconUrl: null, shortName: 'RISU' }));
  };

  test('paints the cached theme before React renders', () => {
    seed('user-1');
    runBoot('/dashboard');
    expect(document.getElementById('rs-brand-theme')?.textContent).toContain('--brand-primary:29 78 216');
    expect(document.documentElement.hasAttribute('data-brand')).toBe(true);
  });

  test('ignores a theme cached for another user on this browser', () => {
    seed('user-2');
    runBoot('/dashboard');
    expect(document.getElementById('rs-brand-theme')).toBeNull();
  });

  test.each(['/login', '/superadmin/universities', '/p/rungta/someone', '/'])('keeps the default theme on %s', (route) => {
    seed('user-1');
    runBoot(route);
    expect(document.getElementById('rs-brand-theme')).toBeNull();
    expect(isDefaultThemeRoute(route)).toBe(true);
  });

  test('applies the saved dark mode and survives corrupt storage', () => {
    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem(BRANDING_CACHE_KEY, '{not json');
    expect(() => runBoot('/dashboard')).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.getElementById('rs-brand-theme')).toBeNull();
  });
});

function Probe() {
  const { branding } = useBranding();
  return <p data-testid="probe">{branding ? `${branding.displayName}|${branding.shortName}` : 'default'}</p>;
}
const renderProvider = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BrandingProvider>
        <Probe />
      </BrandingProvider>
    </QueryClientProvider>,
  );
};

describe('BrandingProvider', () => {
  test('renders the cached branding immediately, then applies and stores the server copy', async () => {
    window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify({ v: 1, userId: 'user-1', css: '', tint: false, faviconUrl: null, shortName: 'RISU', branding: RISU }));
    let resolve!: (v: unknown) => void;
    mockGet.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderProvider();
    // first render already shows the cached university (no default → tenant swap)
    expect(screen.getByTestId('probe')).toHaveTextContent('Rungta International Skills University|RISU');

    resolve({ data: { data: { ...RISU, themePreset: 'emerald' } } });
    await waitFor(() => expect(document.getElementById('rs-brand-theme')?.textContent).toContain('--brand-primary:4 120 87'));
    await waitFor(() => expect(readBrandingCache()?.branding?.themePreset).toBe('emerald'));
    expect(document.title).toBe('Dashboard · RISU');
  });

  test('platform pages keep the default theme even when signed in', async () => {
    mockPathname.value = '/superadmin/dashboard';
    mockGet.mockResolvedValue({ data: { data: RISU } });
    renderProvider();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(screen.getByTestId('probe')).toHaveTextContent('default');
    expect(document.getElementById('rs-brand-theme')).toBeNull();
  });

  test('signing out clears the cached theme', async () => {
    window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify({ v: 1, userId: 'user-1', css: 'x', tint: true, faviconUrl: null, shortName: 'RISU' }));
    mockAuth.user = null;
    mockAuth.isAuthenticated = false;
    renderProvider();
    await waitFor(() => expect(readBrandingCache()).toBeNull());
    expect(mockGet).not.toHaveBeenCalled();
  });
});
