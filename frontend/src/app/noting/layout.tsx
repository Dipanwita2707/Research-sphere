'use client';

import { Suspense } from 'react';
import AuthenticatedLayout from '@/shared/layouts/AuthenticatedLayout';
import { PageSkeleton } from '@/shared/components/PageSkeleton';

export default function NotingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout>
      <Suspense fallback={<PageSkeleton message="Loading noting..." />}>
        {children}
      </Suspense>
    </AuthenticatedLayout>
  );
}
