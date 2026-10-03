import type { Metadata } from 'next';
import MyIncentivesView from '@/features/finance/views/MyIncentivesView';

export const metadata: Metadata = { title: 'My incentives' };

export default function MyIncentivesPage() {
  return <MyIncentivesView />;
}
