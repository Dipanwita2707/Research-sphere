import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import ReportingStructureManagement from '@/features/admin-management/components/ReportingStructureManagement';

export default function ReportingStructurePage() {
  return (
    <ProtectedRoute>
      <ReportingStructureManagement />
    </ProtectedRoute>
  );
}
