'use client';

import { Suspense } from 'react';
import DataProtectionAdmin from '@/features/dpdp/components/admin/DataProtectionAdmin';
import { LoadingState } from '@/features/dpdp/components/ui';

export default function DataProtectionPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DataProtectionAdmin />
    </Suspense>
  );
}
