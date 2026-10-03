import { Suspense } from 'react';
import type { Metadata } from 'next';
import PayoutQueueView from '@/features/finance/views/PayoutQueueView';

export const metadata: Metadata = { title: 'Verification queue · Finance' };

export default function PayoutQueuePage() {
  // The view reads ?status / ?search / ?fy / ?line, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <PayoutQueueView />
    </Suspense>
  );
}
