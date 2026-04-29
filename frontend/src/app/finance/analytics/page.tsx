'use client';

import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import FinanceAnalytics from '@/features/finance/analytics/components/FinanceAnalytics';

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <FinanceAnalytics />
    </ProtectedRoute>
  );
}
