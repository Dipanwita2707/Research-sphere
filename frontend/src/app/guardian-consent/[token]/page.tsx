import type { Metadata } from 'next';
import GuardianConsentPage from '@/features/dpdp/components/public/GuardianConsentPage';

export const metadata: Metadata = {
  title: 'Guardian consent · ResearchSphere',
  description: 'Verify consent for a student under 18.',
  // Token-bearing URL: keep it out of search engines and referrers.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function GuardianConsentRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GuardianConsentPage token={decodeURIComponent(token)} />;
}
