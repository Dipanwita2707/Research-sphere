import type { Metadata } from 'next';
import FinanceDashboardView from '@/features/finance/views/FinanceDashboardView';

export const metadata: Metadata = { title: 'Finance dashboard' };

export default function FinanceDashboardPage() {
  return <FinanceDashboardView />;
}
