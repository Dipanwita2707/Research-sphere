'use client';

import AuthenticatedLayout from '@/shared/layouts/AuthenticatedLayout';

export default function DSWLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
