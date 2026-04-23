'use client';

import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import FeeStructureManagement from '@/features/finance/fee-structure/components/FeeStructureManagement';

export default function FeesPage() {
  return (
    <ProtectedRoute>
      <FeeStructureManagement />
    </ProtectedRoute>
  );
}
