import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PublicShell from '@/features/dpdp/components/public/PublicShell';
import PublicProfileView from '@/features/research-profile/components/PublicProfileView';
import type { AuthorProfileView } from '@/features/research-profile/services/researchProfile.service';
import type { Branding } from '@/shared/theme/theme';

// Public author profile: /p/<university-slug>/<handle>. No login. The API only
// returns profiles the author made public, with their hidden sections removed.

const API_ORIGIN = process.env.API_PROXY_TARGET || 'http://localhost:5001';
const SLUG = /^[a-z0-9-]{1,80}$/i;

type Params = Promise<{ universitySlug: string; handle: string }>;

async function loadProfile(universitySlug: string, handle: string): Promise<AuthorProfileView | null> {
  if (!SLUG.test(universitySlug) || !SLUG.test(handle)) return null;
  try {
    const res = await fetch(
      `${API_ORIGIN}/api/v1/public/profiles/${encodeURIComponent(universitySlug)}/${encodeURIComponent(handle)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data ?? null;
  } catch {
    return null;
  }
}

/** The profile owner's university branding (theme, logo, name); null keeps the default look. */
async function loadBranding(universitySlug: string): Promise<Branding | null> {
  if (!SLUG.test(universitySlug)) return null;
  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/public/branding/${encodeURIComponent(universitySlug)}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { universitySlug, handle } = await params;
  const [profile, branding] = await Promise.all([loadProfile(universitySlug, handle), loadBranding(universitySlug)]);
  if (!profile) return { title: 'Profile not found · ResearchSphere', robots: { index: false, follow: false } };

  const role = [profile.user.designation, profile.user.department, profile.user.university].filter(Boolean).join(', ');
  const description = (profile.profile.bio || `${profile.user.name}${role ? `, ${role}` : ''}. Research profile on ResearchSphere.`).slice(0, 200);
  return {
    title: `${profile.user.name} · Research profile${branding?.shortName ? ` · ${branding.shortName}` : ''}`,
    ...(branding?.faviconUrl ? { icons: { icon: branding.faviconUrl } } : {}),
    description,
    robots: profile.allowSearchIndexing ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title: profile.user.name, description, type: 'profile' },
  };
}

export default async function PublicAuthorProfilePage({ params }: { params: Params }) {
  const { universitySlug, handle } = await params;
  const [profile, branding] = await Promise.all([loadProfile(universitySlug, handle), loadBranding(universitySlug)]);
  if (!profile) notFound();

  return (
    <PublicShell branding={branding}>
      <PublicProfileView profile={profile} />
    </PublicShell>
  );
}
