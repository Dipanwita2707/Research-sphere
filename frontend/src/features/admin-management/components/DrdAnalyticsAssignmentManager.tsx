'use client';

import { useEffect, useMemo, useState } from 'react';
import { permissionManagementService, UserWithPermissions } from '@/features/admin-management/services/permissionManagement.service';
import { schoolService, School } from '@/features/admin-management/services/school.service';
import { departmentService, Department } from '@/features/admin-management/services/department.service';
import { centralDepartmentService, CentralDepartment } from '@/features/admin-management/services/centralDepartment.service';
import { useToast } from '@/shared/ui-components/Toast';
import { logger } from '@/shared/utils/logger';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  GraduationCap,
  Layers3,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  User2,
  UserCheck,
  Users,
} from 'lucide-react';

type ApplicantAnalyticsPermissionKey =
  | 'ipr_applicant_analytics'
  | 'research_applicant_analytics'
  | 'book_applicant_analytics'
  | 'conference_applicant_analytics'
  | 'grant_applicant_analytics';

type ApplicantCategoryId = 'ipr' | 'research' | 'book' | 'conference' | 'grants';
type DrdAnalyticsPermissionKey = ApplicantAnalyticsPermissionKey | 'drd_member_analytics';
type DepartmentSelection = Record<string, Record<DrdAnalyticsPermissionKey, boolean>>;
type ApplicantCategoryState = Record<ApplicantCategoryId, string[]>;

// Per-category department scope: { research: ['deptId1', 'deptId2'], ipr: [...], ... }
type CategoryDepartmentState = Record<ApplicantCategoryId, string[]>;

function createEmptyCategoryDepartments(): CategoryDepartmentState {
  return { ipr: [], research: [], book: [], conference: [], grants: [] };
}

const DRD_MEMBER_ANALYTICS = 'drd_member_analytics';
const LEGACY_APPLICANT_ANALYTICS = 'applicant_analytics';

const APPLICANT_CATEGORIES: Array<{
  id: ApplicantCategoryId;
  permissionKey: ApplicantAnalyticsPermissionKey;
  title: string;
  description: string;
  schoolField:
    | 'assignedIprAnalyticsSchoolIds'
    | 'assignedResearchAnalyticsSchoolIds'
    | 'assignedBookAnalyticsSchoolIds'
    | 'assignedConferenceAnalyticsSchoolIds'
    | 'assignedGrantAnalyticsSchoolIds';
  accent: string;
}> = [
  {
    id: 'ipr',
    permissionKey: 'ipr_applicant_analytics',
    title: 'IPR Applicant Analytics',
    description: 'Patents, IPR filings, approvals, and incentive visibility for assigned academic scope.',
    schoolField: 'assignedIprAnalyticsSchoolIds',
    accent: 'from-[#005b96] to-[#03396c]',
  },
  {
    id: 'research',
    permissionKey: 'research_applicant_analytics',
    title: 'Research Applicant Analytics',
    description: 'Research paper submissions, approvals, and incentives by school, department, and applicant.',
    schoolField: 'assignedResearchAnalyticsSchoolIds',
    accent: 'from-[#0b6e4f] to-[#0f9d58]',
  },
  {
    id: 'book',
    permissionKey: 'book_applicant_analytics',
    title: 'Book / Chapter Applicant Analytics',
    description: 'Book and book chapter activity within the academic units you choose for this category.',
    schoolField: 'assignedBookAnalyticsSchoolIds',
    accent: 'from-[#7c3aed] to-[#5b21b6]',
  },
  {
    id: 'conference',
    permissionKey: 'conference_applicant_analytics',
    title: 'Conference Applicant Analytics',
    description: 'Conference paper activity and incentive analytics for the selected school and department scope.',
    schoolField: 'assignedConferenceAnalyticsSchoolIds',
    accent: 'from-[#d97706] to-[#b45309]',
  },
  {
    id: 'grants',
    permissionKey: 'grant_applicant_analytics',
    title: 'Grant Applicant Analytics',
    description: 'Grant submission and incentive analytics with separate scope from the other DRD categories.',
    schoolField: 'assignedGrantAnalyticsSchoolIds',
    accent: 'from-[#be185d] to-[#9d174d]',
  },
];

function getUserName(user: UserWithPermissions) {
  return user.employeeDetails?.displayName || user.uid || user.email || 'Unknown';
}

function createEmptyDepartmentSelection(): Record<DrdAnalyticsPermissionKey, boolean> {
  return {
    drd_member_analytics: false,
    ipr_applicant_analytics: false,
    research_applicant_analytics: false,
    book_applicant_analytics: false,
    conference_applicant_analytics: false,
    grant_applicant_analytics: false,
  };
}

function createEmptyCategorySchools(): ApplicantCategoryState {
  return {
    ipr: [],
    research: [],
    book: [],
    conference: [],
    grants: [],
  };
}

function AssignmentMetric({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[#d8e6ef] bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.22em] text-[#6497b1]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#011f4b]">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{helper}</p>
    </div>
  );
}

export default function DrdAnalyticsAssignmentManager() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [centralDepts, setCentralDepts] = useState<CentralDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reviewerSchoolIds, setReviewerSchoolIds] = useState<string[]>([]);
  const [drdMemberAnalyticsEnabled, setDrdMemberAnalyticsEnabled] = useState(false);
  const [selectedCategoryPermissions, setSelectedCategoryPermissions] = useState<Record<ApplicantAnalyticsPermissionKey, boolean>>({
    ipr_applicant_analytics: false,
    research_applicant_analytics: false,
    book_applicant_analytics: false,
    conference_applicant_analytics: false,
    grant_applicant_analytics: false,
  });
  const [categorySchoolSelections, setCategorySchoolSelections] = useState<ApplicantCategoryState>(createEmptyCategorySchools());
  const [categoryDepartmentSelections, setCategoryDepartmentSelections] = useState<CategoryDepartmentState>(createEmptyCategoryDepartments());
  const [departmentSelection, setDepartmentSelection] = useState<DepartmentSelection>({});

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, schoolsRes, departmentsRes, centralDeptsRes] = await Promise.all([
        permissionManagementService.getAllUsersWithPermissions(),
        schoolService.getAllSchools({ isActive: true }),
        departmentService.getAllDepartments({ isActive: true }),
        centralDepartmentService.getAllCentralDepartments({ isActive: true }),
      ]);

      setUsers(usersRes.data || []);
      setSchools(schoolsRes.data || []);
      setDepartments(departmentsRes.data || []);
      setCentralDepts(centralDeptsRes.data || []);
    } catch (error) {
      logger.error('Failed to load DRD analytics assignment data', error);
      toast({ type: 'error', message: 'Failed to load analytics assignment data' });
    } finally {
      setLoading(false);
    }
  };

  const drdDepartment = useMemo(
    () =>
      centralDepts.find((dept) =>
        ['DRD', 'Development', 'Research'].some((needle) =>
          `${dept.departmentCode || ''} ${dept.departmentName || ''}`.toLowerCase().includes(needle.toLowerCase())
        )
      ) || null,
    [centralDepts]
  );

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) => {
      const haystack = [
        user.uid,
        user.email,
        user.employeeDetails?.displayName,
        user.employeeDetails?.firstName,
        user.employeeDetails?.lastName,
        user.employeeDetails?.empId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [users, query]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id ===
   selectedUserId) || null,
    [users, selectedUserId]
  );

  const groupedDepartments = useMemo(() => {
    const bySchool = new Map<string, Department[]>();
    departments.forEach((department) => {
      const schoolId = department.facultyId;
      if (!bySchool.has(schoolId)) bySchool.set(schoolId, []);
      bySchool.get(schoolId)?.push(department);
    });
    return schools.map((school) => ({
      school,
      departments: (bySchool.get(school.id) || []).sort((left, right) =>
        left.departmentName.localeCompare(right.departmentName)
      ),
    }));
  }, [departments, schools]);

  useEffect(() => {
    if (!selectedUser || !drdDepartment) return;

    const drdPerm = selectedUser.centralDeptPermissions.find((perm) => perm.centralDeptId ===
   drdDepartment.id);
    const hasSpecificApplicantPermission = APPLICANT_CATEGORIES.some(
      ({ permissionKey }) => drdPerm?.permissions?.[permissionKey] ===
   true
    );
    const hasLegacyApplicantPermission = drdPerm?.permissions?.[LEGACY_APPLICANT_ANALYTICS] ===
   true;
    const legacyApplicantSchools = drdPerm?.assignedSchoolIds || [];

    setReviewerSchoolIds(drdPerm?.assignedSchoolIds || []);
    setDrdMemberAnalyticsEnabled(drdPerm?.permissions?.[DRD_MEMBER_ANALYTICS] ===
   true);
    setSelectedCategoryPermissions({
      ipr_applicant_analytics:
        drdPerm?.permissions?.ipr_applicant_analytics ===
   true ||
        (!hasSpecificApplicantPermission && hasLegacyApplicantPermission),
      research_applicant_analytics:
        drdPerm?.permissions?.research_applicant_analytics ===
   true ||
        (!hasSpecificApplicantPermission && hasLegacyApplicantPermission),
      book_applicant_analytics:
        drdPerm?.permissions?.book_applicant_analytics ===
   true ||
        (!hasSpecificApplicantPermission && hasLegacyApplicantPermission),
      conference_applicant_analytics:
        drdPerm?.permissions?.conference_applicant_analytics ===
   true ||
        (!hasSpecificApplicantPermission && hasLegacyApplicantPermission),
      grant_applicant_analytics:
        drdPerm?.permissions?.grant_applicant_analytics ===
   true ||
        (!hasSpecificApplicantPermission && hasLegacyApplicantPermission),
    });

    setCategorySchoolSelections({
      ipr: (drdPerm?.assignedIprAnalyticsSchoolIds as string[] | undefined) || legacyApplicantSchools,
      research: (drdPerm?.assignedResearchAnalyticsSchoolIds as string[] | undefined) || legacyApplicantSchools,
      book: (drdPerm?.assignedBookAnalyticsSchoolIds as string[] | undefined) || legacyApplicantSchools,
      conference:
        (drdPerm?.assignedConferenceAnalyticsSchoolIds as string[] | undefined) || legacyApplicantSchools,
      grants: (drdPerm?.assignedGrantAnalyticsSchoolIds as string[] | undefined) || legacyApplicantSchools,
    });

    setCategoryDepartmentSelections({
      ipr: (drdPerm?.assignedIprAnalyticsDepartmentIds as string[] | undefined) || [],
      research: (drdPerm?.assignedResearchAnalyticsDepartmentIds as string[] | undefined) || [],
      book: (drdPerm?.assignedBookAnalyticsDepartmentIds as string[] | undefined) || [],
      conference: (drdPerm?.assignedConferenceAnalyticsDepartmentIds as string[] | undefined) || [],
      grants: (drdPerm?.assignedGrantAnalyticsDepartmentIds as string[] | undefined) || [],
    });

    const nextSelection: DepartmentSelection = {};
    selectedUser.schoolDeptPermissions.forEach((permission) => {
      const hasSpecificDepartmentApplicantPermission = APPLICANT_CATEGORIES.some(
        ({ permissionKey }) => permission.permissions?.[permissionKey] ===
   true
      );
      const hasLegacyDepartmentApplicantPermission = permission.permissions?.[LEGACY_APPLICANT_ANALYTICS] ===
   true;

      nextSelection[permission.departmentId] = {
        drd_member_analytics: permission.permissions?.drd_member_analytics ===
   true,
        ipr_applicant_analytics:
          permission.permissions?.ipr_applicant_analytics ===
   true ||
          (!hasSpecificDepartmentApplicantPermission && hasLegacyDepartmentApplicantPermission),
        research_applicant_analytics:
          permission.permissions?.research_applicant_analytics ===
   true ||
          (!hasSpecificDepartmentApplicantPermission && hasLegacyDepartmentApplicantPermission),
        book_applicant_analytics:
          permission.permissions?.book_applicant_analytics ===
   true ||
          (!hasSpecificDepartmentApplicantPermission && hasLegacyDepartmentApplicantPermission),
        conference_applicant_analytics:
          permission.permissions?.conference_applicant_analytics ===
   true ||
          (!hasSpecificDepartmentApplicantPermission && hasLegacyDepartmentApplicantPermission),
        grant_applicant_analytics:
          permission.permissions?.grant_applicant_analytics ===
   true ||
          (!hasSpecificDepartmentApplicantPermission && hasLegacyDepartmentApplicantPermission),
      };
    });
    setDepartmentSelection(nextSelection);
  }, [selectedUser, drdDepartment]);

  const enabledApplicantCategoryCount = useMemo(
    () => APPLICANT_CATEGORIES.filter(({ permissionKey }) => selectedCategoryPermissions[permissionKey]).length,
    [selectedCategoryPermissions]
  );

  const departmentAssignmentsCount = useMemo(
    () =>
      Object.values(departmentSelection).filter((entry) =>
        entry.drd_member_analytics || APPLICANT_CATEGORIES.some(({ permissionKey }) => entry[permissionKey])
      ).length,
    [departmentSelection]
  );

  const totalCategorySchoolAssignments = useMemo(
    () => Object.values(categorySchoolSelections).reduce((sum, ids) => sum + ids.length, 0),
    [categorySchoolSelections]
  );

  const toggleReviewerSchool = (schoolId: string) => {
    setReviewerSchoolIds((current) =>
      current.includes(schoolId) ? current.filter((id) => id !== schoolId) : [...current, schoolId]
    );
  };

  const toggleApplicantCategory = (permissionKey: ApplicantAnalyticsPermissionKey) => {
    setSelectedCategoryPermissions((current) => ({
      ...current,
      [permissionKey]: !current[permissionKey],
    }));
  };

  const toggleCategorySchool = (categoryId: ApplicantCategoryId, schoolId: string) => {
    setCategorySchoolSelections((current) => ({
      ...current,
      [categoryId]: current[categoryId].includes(schoolId)
        ? current[categoryId].filter((id) => id !== schoolId)
        : [...current[categoryId], schoolId],
    }));
  };

  const toggleCategoryDepartment = (categoryId: ApplicantCategoryId, departmentId: string) => {
    setCategoryDepartmentSelections((current) => ({
      ...current,
      [categoryId]: current[categoryId].includes(departmentId)
        ? current[categoryId].filter((id) => id !== departmentId)
        : [...current[categoryId], departmentId],
    }));
  };

  const toggleDepartmentPermission = (departmentId: string, permissionKey: DrdAnalyticsPermissionKey) => {
    setDepartmentSelection((current) => ({
      ...current,
      [departmentId]: {
        ...createEmptyDepartmentSelection(),
        ...(current[departmentId] || {}),
        [permissionKey]: !current[departmentId]?.[permissionKey],
      },
    }));
  };

  const getDepartmentState = (departmentId: string) =>
    departmentSelection[departmentId] || createEmptyDepartmentSelection();

  const handleSave = async () => {
    if (!selectedUser || !drdDepartment) {
      toast({ type: 'warning', message: 'Select a user first' });
      return;
    }

    try {
      setSaving(true);

      const existingCentralPerm =
        selectedUser.centralDeptPermissions.find((perm) => perm.centralDeptId ===
   drdDepartment.id) || null;
      const hasAnyApplicantAnalytics = APPLICANT_CATEGORIES.some(
        ({ permissionKey }) => selectedCategoryPermissions[permissionKey]
      );

      const mergedCentralPermissions = {
        ...(existingCentralPerm?.permissions || {}),
        applicant_analytics: hasAnyApplicantAnalytics,
        drd_member_analytics: drdMemberAnalyticsEnabled,
        ipr_applicant_analytics: selectedCategoryPermissions.ipr_applicant_analytics,
        research_applicant_analytics: selectedCategoryPermissions.research_applicant_analytics,
        book_applicant_analytics: selectedCategoryPermissions.book_applicant_analytics,
        conference_applicant_analytics: selectedCategoryPermissions.conference_applicant_analytics,
        grant_applicant_analytics: selectedCategoryPermissions.grant_applicant_analytics,
      };

      if (
        hasAnyApplicantAnalytics ||
        drdMemberAnalyticsEnabled ||
        existingCentralPerm ||
        reviewerSchoolIds.length > 0 ||
        totalCategorySchoolAssignments > 0
      ) {
        // Collect per-category department IDs from departmentSelection
          const collectDeptIdsForCategory = (permKey: DrdAnalyticsPermissionKey) =>
            Object.entries(departmentSelection)
              .filter(([, perms]) => perms[permKey])
              .map(([deptId]) => deptId);

          await permissionManagementService.grantCentralDeptPermissions({
          userId: selectedUser.id,
          centralDeptId: drdDepartment.id,
          permissions: mergedCentralPermissions,
          isPrimary: existingCentralPerm?.isPrimary || false,
          assignedIprAnalyticsSchoolIds: selectedCategoryPermissions.ipr_applicant_analytics
            ? categorySchoolSelections.ipr
            : [],
          assignedResearchAnalyticsSchoolIds: selectedCategoryPermissions.research_applicant_analytics
            ? categorySchoolSelections.research
            : [],
          assignedBookAnalyticsSchoolIds: selectedCategoryPermissions.book_applicant_analytics
            ? categorySchoolSelections.book
            : [],
          assignedConferenceAnalyticsSchoolIds: selectedCategoryPermissions.conference_applicant_analytics
            ? categorySchoolSelections.conference
            : [],
          assignedGrantAnalyticsSchoolIds: selectedCategoryPermissions.grant_applicant_analytics
            ? categorySchoolSelections.grants
            : [],
          // Per-category department scope arrays — now from categoryDepartmentSelections
          assignedIprAnalyticsDepartmentIds: selectedCategoryPermissions.ipr_applicant_analytics
            ? categoryDepartmentSelections.ipr
            : [],
          assignedResearchAnalyticsDepartmentIds: selectedCategoryPermissions.research_applicant_analytics
            ? categoryDepartmentSelections.research
            : [],
          assignedBookAnalyticsDepartmentIds: selectedCategoryPermissions.book_applicant_analytics
            ? categoryDepartmentSelections.book
            : [],
          assignedConferenceAnalyticsDepartmentIds: selectedCategoryPermissions.conference_applicant_analytics
            ? categoryDepartmentSelections.conference
            : [],
          assignedGrantAnalyticsDepartmentIds: selectedCategoryPermissions.grant_applicant_analytics
            ? categoryDepartmentSelections.grants
            : [],
          // DRD member analytics scope
          assignedDrdMemberAnalyticsSchoolIds: drdMemberAnalyticsEnabled ? reviewerSchoolIds : [],
          assignedDrdMemberAnalyticsDepartmentIds: drdMemberAnalyticsEnabled
            ? collectDeptIdsForCategory('drd_member_analytics')
            : [],
        });

        await permissionManagementService.assignDrdMemberSchools(
          selectedUser.id,
          drdMemberAnalyticsEnabled ? reviewerSchoolIds : []
        );
      }

      await Promise.all(
        departments.map(async (department) => {
          const permissions = getDepartmentState(department.id);
          const existingDeptPerm = selectedUser.schoolDeptPermissions.find((perm) => perm.departmentId ===
   department.id);
          const hasApplicantDepartmentScope = APPLICANT_CATEGORIES.some(
            ({ permissionKey }) => permissions[permissionKey]
          );

          const mergedDepartmentPermissions = {
            ...(existingDeptPerm?.permissions || {}),
            applicant_analytics: hasApplicantDepartmentScope,
            drd_member_analytics: permissions.drd_member_analytics,
            ipr_applicant_analytics: permissions.ipr_applicant_analytics,
            research_applicant_analytics: permissions.research_applicant_analytics,
            book_applicant_analytics: permissions.book_applicant_analytics,
            conference_applicant_analytics: permissions.conference_applicant_analytics,
            grant_applicant_analytics: permissions.grant_applicant_analytics,
          };

          if (hasApplicantDepartmentScope || permissions.drd_member_analytics || existingDeptPerm) {
            await permissionManagementService.grantSchoolDeptPermissions({
              userId: selectedUser.id,
              departmentId: department.id,
              permissions: mergedDepartmentPermissions,
              isPrimary: existingDeptPerm?.isPrimary || false,
            });
          }
        })
      );

      toast({ type: 'success', message: `Updated DRD analytics assignment for ${getUserName(selectedUser)}` });
      await fetchData();
    } catch (error) {
      logger.error('Failed to save DRD analytics assignment', error);
      toast({ type: 'error', message: 'Failed to save DRD analytics assignment' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#005b96]" />
          <p className="mt-3 text-sm text-gray-500">Loading DRD analytics assignment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#005b96] via-[#004a80] to-[#003d6b] text-white shadow-[0_16px_48px_rgba(0,91,150,0.24)]">
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-[#6497b1]/25 blur-3xl" />
        <div className="relative px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#d8e6ef]">
                <BarChart3 className="h-3.5 w-3.5" />
                DRD Analytics Assignment
              </div>
              <h1 className="mt-4 text-3xl font-bold">Assign analytics category by category</h1>
              <p className="mt-3 text-sm leading-6 text-[#d8e6ef] sm:text-base">
                Give a user analytics access at a granular level. Each applicant analytics category has its
                own school and department scope, while DRD member analytics keeps its own reviewer scope.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedUser || saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Assignment'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-[#d8e6ef] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#011f4b]">Select User</h2>
              <p className="mt-1 text-sm text-gray-500">Search faculty or staff who need granular DRD analytics access.</p>
            </div>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="rounded-xl border border-[#b3cde0] p-2 text-[#005b96] transition-colors hover:border-[#005b96]"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#d8e6ef] bg-[#f7fbfe] px-3 py-2.5">
            <Search className="h-4 w-4 text-[#6497b1]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, UID"
              className="w-full bg-transparent text-sm text-[#011f4b] outline-none placeholder:text-[#6497b1]"
            />
          </div>

          <div className="mt-4 max-h-[660px] space-y-2 overflow-y-auto pr-1">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUserId(user.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-all ${
                  selectedUserId ===
   user.id
                    ? 'border-[#005b96] bg-[#005b96] text-white shadow-lg shadow-[#005b96]/20'
                    : 'border-[#d8e6ef] bg-white hover:border-[#b3cde0] hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                      selectedUserId ===
   user.id ? 'bg-white/15 text-white' : 'bg-[#f7fbfe] text-[#005b96]'
                    }`}
                  >
                    <User2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{getUserName(user)}</p>
                    <p className={`mt-1 text-xs ${selectedUserId ===
   user.id ? 'text-[#d8e6ef]' : 'text-gray-500'}`}>
                      {user.employeeDetails?.designation || user.role}
                    </p>
                    <p className={`mt-1 text-xs ${selectedUserId ===
   user.id ? 'text-[#d8e6ef]' : 'text-gray-400'}`}>
                      {user.email || user.uid}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-6">
          {!selectedUser ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#f0f7fb] text-[#005b96]">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-[#011f4b]">Pick a user to continue</h3>
                <p className="mt-2 max-w-md text-sm text-gray-500">
                  The category assignment panel will open here once you select a faculty or staff member from the left list.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-[28px] border border-[#d8e6ef] bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#f0f7fb] text-[#005b96]">
                      <User2 className="h-7 w-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-[#011f4b]">{getUserName(selectedUser)}</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {selectedUser.employeeDetails?.designation || selectedUser.role}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">{selectedUser.email || selectedUser.uid}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#d8e6ef] bg-[#f7fbfe] px-3 py-1.5 text-xs font-semibold text-[#005b96]">
                      DRD Central Dept: {drdDepartment?.departmentCode || drdDepartment?.departmentName || 'Not found'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <AssignmentMetric
                  title="Applicant Categories"
                  value={String(enabledApplicantCategoryCount)}
                  helper="Category-wise applicant analytics permissions enabled."
                />
                <AssignmentMetric
                  title="Reviewer Scope"
                  value={String(reviewerSchoolIds.length)}
                  helper="Schools used for DRD member analytics visibility."
                />
                <AssignmentMetric
                  title="Category School Scope"
                  value={String(totalCategorySchoolAssignments)}
                  helper="Total school selections spread across all applicant analytics categories."
                />
                <AssignmentMetric
                  title="Department Scope"
                  value={String(departmentAssignmentsCount)}
                  helper="Departments with at least one category-specific analytics assignment."
                />
              </div>

              <div className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                <div className="border-b border-[#e3edf4] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <UserCheck className="h-5 w-5 text-[#005b96]" />
                    <div>
                      <h3 className="text-lg font-semibold text-[#011f4b]">DRD Member Analytics</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Reviewer performance analytics remains separate from applicant analytics and uses its own school scope.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 p-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <button
                    type="button"
                    onClick={() => setDrdMemberAnalyticsEnabled((current) => !current)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      drdMemberAnalyticsEnabled
                        ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                        : 'border-[#d8e6ef] bg-white hover:border-[#b3cde0]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[#011f4b]">Enable DRD Member Analytics</p>
                        <p className="mt-1 text-sm text-gray-500">
                          Lets this user view reviewer workload, response speed, and completion performance.
                        </p>
                      </div>
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          drdMemberAnalyticsEnabled ? 'bg-emerald-500 text-white' : 'bg-[#f0f7fb] text-[#6497b1]'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    </div>
                  </button>

                  <div className="rounded-2xl border border-[#d8e6ef] bg-[#f7fbfe] p-4">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-[#005b96]" />
                      <div>
                        <p className="font-semibold text-[#011f4b]">Reviewer School Scope</p>
                        <p className="mt-1 text-sm text-gray-500">These schools control which reviewer workload records are visible.</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {schools.map((school) => {
                        const selected = reviewerSchoolIds.includes(school.id);
                        return (
                          <button
                            key={school.id}
                            type="button"
                            onClick={() => toggleReviewerSchool(school.id)}
                            className={`rounded-2xl border p-4 text-left transition-all ${
                              selected
                                ? 'border-[#005b96] bg-[#edf5fa] shadow-sm'
                                : 'border-[#d8e6ef] bg-white hover:border-[#b3cde0]'
                            }`}
                          >
                            <p className="font-semibold text-[#011f4b]">{school.facultyName}</p>
                            <p className="mt-1 text-xs text-gray-500">{school.facultyCode}</p>
                            <p className={`mt-3 text-xs font-semibold ${selected ? 'text-[#005b96]' : 'text-gray-400'}`}>
                              {selected ? 'Selected for reviewer analytics' : 'Click to add reviewer scope'}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-6 rounded-2xl border border-[#d8e6ef] bg-white p-4">
                      <div className="flex items-center gap-3">
                        <Layers3 className="h-5 w-5 text-[#005b96]" />
                        <div>
                          <p className="font-semibold text-[#011f4b]">Reviewer Department Scope</p>
                          <p className="mt-1 text-sm text-gray-500">
                            Add department-only DRD member analytics where the user should not see the whole school.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-4">
                        {groupedDepartments.map(({ school, departments: schoolDepartments }) => (
                          <div key={`drd-member-${school.id}`} className="rounded-2xl border border-[#e3edf4] bg-[#f7fbfe] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-[#011f4b]">{school.facultyName}</p>
                                <p className="mt-1 text-xs text-gray-500">{school.facultyCode}</p>
                              </div>
                              <span className="rounded-full border border-[#d8e6ef] bg-white px-3 py-1 text-xs font-semibold text-[#005b96]">
                                {schoolDepartments.length} departments
                              </span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {schoolDepartments.map((department) => {
                                const selected = getDepartmentState(department.id).drd_member_analytics;
                                return (
                                  <button
                                    key={`drd-member-${department.id}`}
                                    type="button"
                                    onClick={() => toggleDepartmentPermission(department.id, 'drd_member_analytics')}
                                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                                      selected
                                        ? 'border-[#005b96] bg-[#005b96] text-white'
                                        : 'border-[#d8e6ef] bg-white text-[#011f4b] hover:border-[#b3cde0]'
                                    }`}
                                  >
                                    {department.departmentName}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {APPLICANT_CATEGORIES.map((category) => {
                  const enabled = selectedCategoryPermissions[category.permissionKey];
                  const selectedSchools = categorySchoolSelections[category.id];
                  const selectedDepts = categoryDepartmentSelections[category.id];
                  const categoryDepartmentCount = selectedDepts.length;

                  return (
                    <div key={category.id} className="overflow-hidden rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                      <div className={`bg-gradient-to-r ${category.accent} px-5 py-4 text-white`}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/85">
                              <GraduationCap className="h-3.5 w-3.5" />
                              Applicant Analytics Category
                            </div>
                            <h3 className="mt-3 text-xl font-semibold">{category.title}</h3>
                            <p className="mt-2 text-sm text-white/80">{category.description}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleApplicantCategory(category.permissionKey)}
                            className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                              enabled
                                ? 'border-white/30 bg-white text-[#011f4b]'
                                : 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                            }`}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {enabled ? 'Enabled' : 'Enable Category'}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm">
                            <p className="text-xs uppercase tracking-[0.22em] text-white/70">Schools</p>
                            <p className="mt-2 text-xl font-semibold">{selectedSchools.length}</p>
                          </div>
                          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm">
                            <p className="text-xs uppercase tracking-[0.22em] text-white/70">Departments</p>
                            <p className="mt-2 text-xl font-semibold">{categoryDepartmentCount}</p>
                          </div>
                          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm">
                            <p className="text-xs uppercase tracking-[0.22em] text-white/70">Scope Model</p>
                            <p className="mt-2 text-xl font-semibold">UNION</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-6 p-5 xl:grid-cols-[0.95fr_1.05fr]">
                        <div className="rounded-2xl border border-[#d8e6ef] bg-[#f7fbfe] p-4">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-[#005b96]" />
                            <div>
                              <p className="font-semibold text-[#011f4b]">School Scope for {category.title}</p>
                              <p className="mt-1 text-sm text-gray-500">
                                Select the schools this user can view for this category. Each selected school expands to all its departments.
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {schools.map((school) => {
                              const selected = selectedSchools.includes(school.id);
                              return (
                                <button
                                  key={`${category.id}-${school.id}`}
                                  type="button"
                                  onClick={() => toggleCategorySchool(category.id, school.id)}
                                  className={`rounded-2xl border p-4 text-left transition-all ${
                                    selected
                                      ? 'border-[#005b96] bg-white shadow-sm'
                                      : 'border-[#d8e6ef] bg-white hover:border-[#b3cde0]'
                                  }`}
                                >
                                  <p className="font-semibold text-[#011f4b]">{school.facultyName}</p>
                                  <p className="mt-1 text-xs text-gray-500">{school.facultyCode}</p>
                                  <p className={`mt-3 text-xs font-semibold ${selected ? 'text-[#005b96]' : 'text-gray-400'}`}>
                                    {selected ? 'Included for this category' : 'Click to include'}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[#d8e6ef] bg-white p-4">
                          <div className="flex items-center gap-3">
                            <Layers3 className="h-5 w-5 text-[#005b96]" />
                            <div>
                              <p className="font-semibold text-[#011f4b]">Department Scope for {category.title}</p>
                              <p className="mt-1 text-sm text-gray-500">
                                Select specific departments. These are added on top of any schools selected. Each school above already grants access to all its departments.
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {groupedDepartments.map(({ school, departments: schoolDepartments }) => (
                              <div key={`${category.id}-depts-${school.id}`} className="rounded-2xl border border-[#e3edf4] bg-[#f7fbfe] p-3">
                                <div className="flex items-center justify-between gap-2 mb-3">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-[#005b96]" />
                                    <p className="font-semibold text-sm text-[#011f4b]">{school.facultyName}</p>
                                    <span className="text-xs text-gray-400">{school.facultyCode}</span>
                                  </div>
                                  {categorySchoolSelections[category.id].includes(school.id) && (
                                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">All depts included via school</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {schoolDepartments.map((department) => {
                                    const selected = categoryDepartmentSelections[category.id].includes(department.id);
                                    const viaSchool = categorySchoolSelections[category.id].includes(school.id);
                                    return (
                                      <button
                                        key={`${category.id}-dept-${department.id}`}
                                        type="button"
                                        onClick={() => toggleCategoryDepartment(category.id, department.id)}
                                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                          selected
                                            ? 'border-[#005b96] bg-[#005b96] text-white'
                                            : viaSchool
                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                            : 'border-[#d8e6ef] bg-white text-[#011f4b] hover:border-[#b3cde0]'
                                        }`}
                                      >
                                        {selected ? '✓ ' : viaSchool ? '~ ' : ''}{department.departmentName}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Applicant analytics scope is now stored category by category. A school selected for one category does not automatically grant analytics in the other categories unless you select it there too.
              </div>
            </>
          )}
        </section>
      </section>
    </div>
  );
}
