import React from 'react';
import Link from 'next/link';
import Wordmark from '@/shared/components/brand/Wordmark';
import { BrandMonogram } from '@/shared/components/brand/TenantLogo';
import { buildTheme, themeCss, type Branding } from '@/shared/theme/theme';

const BRAND_SCOPE = '[data-public-brand]';

/**
 * Minimal chrome for unauthenticated pages (privacy notice, guardian consent, public
 * profiles). With `branding`, the page is drawn in that university's theme (server-side,
 * so there is no flash) and the header shows its logo and name.
 */
export default function PublicShell({ children, branding }: { children: React.ReactNode; branding?: Branding | null }) {
  const theme = branding ? buildTheme(branding) : null;
  return (
    <div className="min-h-screen bg-ivory dark:bg-gray-950 flex flex-col" {...(theme && !theme.isDefault ? { 'data-public-brand': '' } : {})}>
      {theme && !theme.isDefault && (
        // Values come from buildTheme (validated hex colours only), never from free text
        <style dangerouslySetInnerHTML={{ __html: themeCss(theme, BRAND_SCOPE) }} />
      )}
      <header className="border-b border-gray-200/70 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {branding ? (
            <span className="flex min-w-0 items-center gap-2.5" data-testid="public-brand">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- served by the branding API
                <img src={branding.logoUrl} alt={`${branding.displayName} logo`} className="h-10 w-auto max-w-[160px] object-contain" />
              ) : (
                <BrandMonogram branding={branding} className="h-10 w-10" />
              )}
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-bold text-gray-900 dark:text-white">{branding.displayName}</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Powered by ResearchSphere</span>
              </span>
            </span>
          ) : (
            <Link href="/" aria-label="Home">
              <Wordmark sizeClassName="text-lg" />
            </Link>
          )}
          <Link href="/login" className="shrink-0 text-sm font-medium text-wine dark:text-hi hover:underline">
            Sign in
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</main>
      <footer className="border-t border-gray-200/70 dark:border-gray-800 py-6 text-center text-xs text-gray-500 dark:text-gray-400 px-4">
        Personal data is processed in accordance with the Digital Personal Data Protection Act, 2023 (India).
      </footer>
    </div>
  );
}
