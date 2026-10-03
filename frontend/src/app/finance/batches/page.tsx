import { Suspense } from 'react';
import type { Metadata } from 'next';
import BatchListView from '@/features/finance/views/BatchListView';

export const metadata: Metadata = { title: 'Payment batches · Finance' };

export default function BatchesPage() {
  return (
    <Suspense fallback={null}>
      <BatchListView />
    </Suspense>
  );
}
