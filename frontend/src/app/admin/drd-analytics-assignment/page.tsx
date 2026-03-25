'use client';

import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import DrdAnalyticsAssignmentManager from '@/features/admin-management/components/DrdAnalyticsAssignmentManager';

export default function DrdAnalyticsAssignmentPage() {
  return (
    <ProtectedRoute>
      <DrdAnalyticsAssignmentManager />
    </ProtectedRoute>
  );
}
