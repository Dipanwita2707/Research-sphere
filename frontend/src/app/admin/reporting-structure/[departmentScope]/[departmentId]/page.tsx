import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import ReportingStructureManagement from '@/features/admin-management/components/ReportingStructureManagement';

interface DepartmentReportingStructurePageProps {
  params: {
    departmentScope: string;
    departmentId: string;
  };
}

export default function DepartmentReportingStructurePage({
  params,
}: DepartmentReportingStructurePageProps) {
  const departmentScope = (params.departmentScope || '').toLowerCase();
  const departmentId = params.departmentId;
  const lockedDepartmentKey = `${departmentScope}:${departmentId}`;

  return (
    <ProtectedRoute>
      <ReportingStructureManagement lockedDepartmentKey={lockedDepartmentKey} />
    </ProtectedRoute>
  );
}
