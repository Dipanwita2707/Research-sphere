'use client';

import { Suspense } from 'react';
import { KeywordGraphView } from '@/features/research-intelligence/components/views/KeywordGraphView';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KeywordGraphView />
    </Suspense>
  );
}
