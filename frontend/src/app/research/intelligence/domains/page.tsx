'use client';

import { Suspense } from 'react';
import { DomainMapView } from '@/features/research-intelligence/components/views/DomainMapView';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DomainMapView />
    </Suspense>
  );
}
