import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import ReportingStructureManagement from '@/features/admin-management/components/ReportingStructureManagement';

interface DepartmentReportingStructurePageProps {
  // Next 15+: route params are a Promise
  params: Promise<{
    departmentScope: string;
    departmentId: string;
  }>;
}

export default async function DepartmentReportingStructurePage({
  params,
}: DepartmentReportingStructurePageProps) {
  const resolved = await params;
  const departmentScope = (resolved.departmentScope || '').toLowerCase();
  const departmentId = resolved.departmentId;
  const lockedDepartmentKey = `${departmentScope}:${departmentId}`;

  return (
    <ProtectedRoute>
      <ReportingStructureManagement lockedDepartmentKey={lockedDepartmentKey} />
    </ProtectedRoute>
  );
}
