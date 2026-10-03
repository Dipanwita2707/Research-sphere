'use client';

import Wordmark from '@/shared/components/brand/Wordmark';
import { useBranding } from '@/shared/providers/BrandingProvider';
import type { Branding } from '@/shared/theme/theme';

/** Initials badge used when a university has not uploaded a logo yet. */
export function BrandMonogram({ branding, className = '' }: { branding: Pick<Branding, 'shortName' | 'displayName'>; className?: string }) {
  const text = (branding.shortName || branding.displayName.split(/\s+/).map((w) => w[0]).join('')).slice(0, 4).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-wine to-wine-darker font-bold tracking-wide text-wine-fg shadow-sm ${text.length > 3 ? 'text-[11px]' : 'text-sm'} ${className}`}
    >
      {text}
    </span>
  );
}

interface TenantLogoProps {
  /** Branding to show; defaults to the signed-in user's (BrandingProvider). */
  branding?: Branding | null;
  /** Height of the logo image / monogram, e.g. "h-10". */
  heightClassName?: string;
  /** Show the university name next to the logo (hidden below sm when compact). */
  showName?: boolean;
  /** Show the small "Powered by ResearchSphere" line under the name. */
  showPoweredBy?: boolean;
  /** Responsive visibility of the name block (default: from sm up). */
  nameClassName?: string;
  className?: string;
}

/**
 * The university's logo and name, or the ResearchSphere wordmark when no university
 * branding applies (platform pages, superadmin, not signed in).
 */
export default function TenantLogo({
  branding: brandingProp,
  heightClassName = 'h-10 sm:h-11',
  showName = true,
  showPoweredBy = true,
  nameClassName = 'hidden sm:flex',
  className = '',
}: TenantLogoProps) {
  const ctx = useBranding();
  const branding = brandingProp === undefined ? ctx.branding : brandingProp;

  if (!branding) {
    return <Wordmark heightClassName="h-[4.25rem] sm:h-[5rem]" className={`drop-shadow-sm ${className}`} />;
  }

  const hasLogo = Boolean(branding.logoUrl);
  return (
    <span className={`flex min-w-0 items-center gap-2.5 ${className}`} data-testid="tenant-logo">
      {hasLogo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- served by the branding API, already re-encoded */}
          <img
            src={branding.logoUrl!}
            alt={`${branding.displayName} logo`}
            className={`${heightClassName} w-auto max-w-[180px] shrink-0 object-contain ${branding.logoDarkUrl ? 'dark:hidden' : ''}`}
          />
          {branding.logoDarkUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- served by the branding API
            <img
              src={branding.logoDarkUrl}
              alt={`${branding.displayName} logo`}
              className={`${heightClassName} hidden w-auto max-w-[180px] shrink-0 object-contain dark:block`}
            />
          )}
        </>
      ) : (
        <BrandMonogram branding={branding} className={`${heightClassName} aspect-square`} />
      )}
      {showName && (
        <span className={`min-w-0 flex-col leading-tight ${nameClassName}`}>
          <span className="max-w-[16rem] truncate text-sm font-bold text-gray-900 dark:text-white xl:max-w-[22rem]" title={branding.displayName}>
            {branding.displayName}
          </span>
          {showPoweredBy && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Powered by ResearchSphere
            </span>
          )}
        </span>
      )}
    </span>
  );
}
