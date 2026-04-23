'use client';

import AuthenticatedLayout from '@/shared/layouts/AuthenticatedLayout';

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout>
      <div className="finance-theme min-h-full">
        {children}
      </div>
    </AuthenticatedLayout>
  );
}
