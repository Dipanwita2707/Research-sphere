'use client';

import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import { useAuthStore } from '@/shared/auth/authStore';
import { AccessManager } from '@/features/research-intelligence';

export default function ResearchIntelligenceAccessPage() {
  const { user } = useAuthStore();
  const role = (user as any)?.role?.name || (user as any)?.userType || '';
  return (
    <ProtectedRoute>
      <AccessManager isAdmin={role === 'admin' || role === 'superadmin'} />
    </ProtectedRoute>
  );
}
