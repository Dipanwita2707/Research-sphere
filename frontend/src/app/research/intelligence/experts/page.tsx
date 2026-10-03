'use client';

import { Suspense } from 'react';
import { ExpertFinderView } from '@/features/research-intelligence/components/views/ExpertFinderView';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ExpertFinderView />
    </Suspense>
  );
}
