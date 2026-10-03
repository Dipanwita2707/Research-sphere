'use client';

import AuthenticatedLayout from '@/shared/layouts/AuthenticatedLayout';

/**
 * Finance module frame. The incentive payout screens use the shared ResearchSphere analytics
 * surfaces. The retired legacy IPR finance review (/finance/processing) redirects to /finance/payouts.
 */
export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
