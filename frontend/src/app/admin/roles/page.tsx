import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import UserRoleManagement from '@/features/admin-management/components/UserRoleManagement';

export default function RolesPage() {
  return (
    <ProtectedRoute>
      <UserRoleManagement />
    </ProtectedRoute>
  );
}
