'use client';

import { Suspense } from 'react';
import { CollaborationNetworkView } from '@/features/research-intelligence/components/views/CollaborationNetworkView';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CollaborationNetworkView />
    </Suspense>
  );
}
