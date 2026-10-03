'use client';

/**
 * Loads the signed-in user's university branding (GET /branding/me) and applies it:
 * CSS variables on <html>, favicon, and the university short name in the tab title.
 *
 * No flash of the default theme: the last applied theme is cached in localStorage and
 * painted before hydration by BRANDING_BOOT_SCRIPT (root layout). This provider then
 * keeps it in sync with the server and clears it on sign-out.
 *
 * The platform's own pages (landing, login, superadmin) and public profiles always keep
 * the default ResearchSphere theme here — see isDefaultThemeRoute.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/shared/api/api';
import { useAuthStore } from '@/shared/auth/authStore';
import { buildTheme, themeCss, type Branding, type BuiltTheme } from '@/shared/theme/theme';
import { isDefaultThemeRoute, readBrandingCache, writeBrandingCache } from '@/shared/theme/brandingCache';

interface BrandingContextValue {
  /** University branding, or null (not signed in / superadmin / still loading). */
  branding: Branding | null;
  theme: BuiltTheme;
  isLoading: boolean;
  /** False on platform pages that always use the default theme. */
  active: boolean;
}

const DEFAULT_THEME = buildTheme(null);
const BrandingContext = createContext<BrandingContextValue>({ branding: null, theme: DEFAULT_THEME, isLoading: false, active: false });

export const BRANDING_QUERY_KEY = ['branding', 'me'] as const;
const STYLE_ID = 'rs-brand-theme';
const FAVICON_ID = 'rs-brand-favicon';

/** Write (or remove) the theme on <html>. Exported for tests and the live preview. */
export function applyBrandTheme(theme: BuiltTheme | null, opts: { faviconUrl?: string | null } = {}): void {
  const root = document.documentElement;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!theme || theme.isDefault) {
    style?.remove();
    root.removeAttribute('data-brand');
    root.removeAttribute('data-brand-tint');
  } else {
    const css = themeCss(theme);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
    root.setAttribute('data-brand', '');
    root.setAttribute('data-brand-tint', '');
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', theme && !theme.isDefault ? theme.colors.light.primary : DEFAULT_THEME.colors.light.primary);
  let icon = document.getElementById(FAVICON_ID) as HTMLLinkElement | null;
  if (theme && opts.faviconUrl) {
    if (!icon) {
      icon = document.createElement('link');
      icon.id = FAVICON_ID;
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    if (icon.getAttribute('href') !== opts.faviconUrl) icon.href = opts.faviconUrl;
  } else {
    icon?.remove();
  }
}

/** Keep " · <short name>" at the end of the tab title, whatever the page sets. */
function useTitleSuffix(shortName: string | null) {
  useEffect(() => {
    if (!shortName) return;
    const suffix = ` · ${shortName}`;
    const ensure = () => {
      if (!document.title.endsWith(suffix)) document.title = `${document.title || 'ResearchSphere'}${suffix}`;
    };
    ensure();
    const titleEl = document.querySelector('title');
    const observer = new MutationObserver(ensure);
    observer.observe(titleEl ?? document.head, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      if (document.title.endsWith(suffix)) document.title = document.title.slice(0, -suffix.length);
    };
  }, [shortName]);
}

export default function BrandingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = isAuthenticated ? user?.id ?? null : null;
  const active = !isDefaultThemeRoute(pathname);

  const { data: branding = null, isLoading, isPlaceholderData } = useQuery({
    queryKey: [...BRANDING_QUERY_KEY, userId],
    queryFn: async () => {
      const res = await api.get('/branding/me');
      return (res.data?.data ?? null) as Branding | null;
    },
    enabled: Boolean(userId),
    // Last known branding of this user: header and hero render it immediately (no swap)
    placeholderData: () => {
      if (typeof window === 'undefined' || !userId) return undefined;
      const cached = readBrandingCache();
      return cached && cached.userId === userId && cached.branding ? cached.branding : undefined;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const theme = useMemo(() => (branding ? buildTheme(branding) : DEFAULT_THEME), [branding]);

  // Apply / remove the theme as the route or branding changes
  useEffect(() => {
    if (!userId) {
      applyBrandTheme(null);
      return;
    }
    if (isLoading) return; // keep whatever the boot script painted until the server answers
    applyBrandTheme(active && branding ? theme : null, { faviconUrl: branding?.faviconUrl });
  }, [active, branding, theme, isLoading, userId]);

  // Persist for the next page load; forget it on sign-out
  useEffect(() => {
    if (!userId) {
      if (!isAuthenticated) writeBrandingCache(null);
      return;
    }
    if (isLoading || isPlaceholderData) return;
    if (!branding) {
      writeBrandingCache(null);
      return;
    }
    writeBrandingCache({
      v: 1,
      userId,
      css: theme.isDefault ? '' : themeCss(theme),
      tint: !theme.isDefault,
      faviconUrl: branding.faviconUrl,
      shortName: branding.shortName,
      branding,
    });
  }, [branding, theme, isLoading, isPlaceholderData, userId, isAuthenticated]);

  useTitleSuffix(active && branding ? branding.shortName : null);

  const value = useMemo(() => ({ branding: active ? branding : null, theme: active ? theme : DEFAULT_THEME, isLoading, active }), [active, branding, theme, isLoading]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}
