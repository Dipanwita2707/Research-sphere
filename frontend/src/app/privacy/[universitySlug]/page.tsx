import type { Metadata } from 'next';
import PublicPrivacyPage from '@/features/dpdp/components/public/PublicPrivacyPage';

export const metadata: Metadata = {
  title: 'Privacy notice · ResearchSphere',
  description: 'How your university processes personal data under the Digital Personal Data Protection Act, 2023.',
};

export default async function PrivacyNoticePage({ params }: { params: Promise<{ universitySlug: string }> }) {
  const { universitySlug } = await params;
  return <PublicPrivacyPage universitySlug={decodeURIComponent(universitySlug)} />;
}
