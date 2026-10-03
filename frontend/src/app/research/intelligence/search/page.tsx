'use client';

import { Suspense } from 'react';
import { ResearchSearchView } from '@/features/research-intelligence/components/views/ResearchSearchView';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResearchSearchView />
    </Suspense>
  );
}
