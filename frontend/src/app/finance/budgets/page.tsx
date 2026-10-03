import { Suspense } from 'react';
import type { Metadata } from 'next';
import BudgetView from '@/features/finance/budget/BudgetView';

export const metadata: Metadata = { title: 'Research budget · Finance' };

export default function ResearchBudgetPage() {
  // The view reads ?fy, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <BudgetView />
    </Suspense>
  );
}
