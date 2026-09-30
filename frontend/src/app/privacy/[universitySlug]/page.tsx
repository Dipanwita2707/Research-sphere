import type { Metadata } from 'next';
import PublicPrivacyPage from '@/features/dpdp/components/public/PublicPrivacyPage';

export const metadata: Metadata = {
  title: 'Privacy notice · ResearchSphere',
  description: 'How your university processes personal data under the Digital Personal Data Protection Act, 2023.',
};

export default function PrivacyNoticePage({ params }: { params: { universitySlug: string } }) {
  return <PublicPrivacyPage universitySlug={decodeURIComponent(params.universitySlug)} />;
}
