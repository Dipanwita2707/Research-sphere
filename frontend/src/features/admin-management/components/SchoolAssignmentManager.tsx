'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  User,
  Users,
  MapPin,
  CheckCircle2,
  X,
  Save,
  RefreshCw,
  GraduationCap,
  Search,
  AlertCircle,
} from 'lucide-react';
import api from '@/shared/api/api';
import { useToast } from '@/shared/ui-components/Toast';
import logger from '@/shared/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface School {
  id: string;
  facultyCode: string;
  facultyName: string;
  shortName?: string;
}

export interface AssignmentMemberUser {
  id: string;
  uid: string;
  email: string;
  role?: string;
  employeeDetails?: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    designation?: string;
    primaryDepartment?: {
      departmentName?: string;
    };
  } | null;
}

export interface AssignmentMember {
  id: string;
  userId: string;
  user: AssignmentMemberUser;
  permissions?: Record<string, boolean> | string[];
  assignedSchoolIds: string[];
  assignedSchools?: { id: string; facultyName: string; facultyCode: string }[];
  isDrdHead?: boolean;
  isDrdMember?: boolean;
}

export interface SchoolWithMembers {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  assignedMemberIds: string[];
  members: AssignmentMember[];
}

// ============================================================================
// Configuration Interface - This is what makes it reusable
// ============================================================================

export interface SchoolAssignmentConfig {
  // Page title and description
  title: string;
  description: string;
  icon: React.ReactNode;

  // API endpoints
  endpoints: {
    fetchMembers: string;
    fetchSchoolsWithMembers: string;
    saveAssignment: string;
  };

  // Labels
  labels: {
    memberType: string; // e.g., "DRD Member", "Research Reviewer", etc.
    memberTypePlural: string;
  };

  // Optional: Custom stats to show
  showStats?: boolean;

  // Optional: Custom permission display
  showPermissions?: boolean;
  getPermissionLabel?: (key: string) => string;
}

// ============================================================================
// Default Configurations
// ============================================================================

export const DRD_MEMBER_CONFIG: SchoolAssignmentConfig = {
  title: 'DRD Member School Assignment',
  description: 'Assign DRD Members to specific schools. Members will only see IPR applications from their assigned schools in their review queue.',
  icon: <MapPin className="text-green-600" />,
  endpoints: {
    fetchMembers: '/permission-management/drd-members/with-schools',
    fetchSchoolsWithMembers: '/permission-management/schools/with-members',
    saveAssignment: '/permission-management/drd-member/assign-schools',
  },
  labels: {
    memberType: 'DRD Member',
    memberTypePlural: 'DRD Members',
  },
  showStats: true,
  showPermissions: true,
};

export const DRD_RESEARCH_CONFIG: SchoolAssignmentConfig = {
  title: 'DRD Research School Assignment',
  description: 'Assign DRD Members to schools for research paper review. Members will only see research contributions from their assigned schools.',
  icon: <Building2 className="text-purple-600" />,
  endpoints: {
    fetchMembers: '/permission-management/drd-members/with-schools',
    fetchSchoolsWithMembers: '/permission-management/schools/with-members',
    saveAssignment: '/permission-management/drd-member/assign-schools',
  },
  labels: {
    memberType: 'DRD Member',
    memberTypePlural: 'DRD Members',
  },
  showStats: true,
};

export const DRD_BOOK_CONFIG: SchoolAssignmentConfig = {
  title: 'DRD Book School Assignment',
  description: 'Assign DRD Members to schools for book chapter review. Members will only see book chapters from their assigned schools.',
  icon: <Building2 className="text-indigo-600" />,
  endpoints: {
    fetchMembers: '/permission-management/drd-members/with-schools',
    fetchSchoolsWithMembers: '/permission-management/schools/with-members',
    saveAssignment: '/permission-management/drd-member/assign-schools',
  },
  labels: {
    memberType: 'DRD Member',
    memberTypePlural: 'DRD Members',
  },
  showStats: true,
};

export const DRD_GRANT_CONFIG: SchoolAssignmentConfig = {
  title: 'DRD Grant School Assignment',
  description: 'Assign DRD Members to schools for grant application review. Members will only see grant applications from their assigned schools.',
  icon: <Building2 className="text-orange-600" />,
  endpoints: {
    fetchMembers: '/permission-management/drd-members/with-schools',
    fetchSchoolsWithMembers: '/permission-management/schools/with-members',
    saveAssignment: '/permission-management/drd-member/assign-schools',
  },
  labels: {
    memberType: 'DRD Member',
    memberTypePlural: 'DRD Members',
  },
  showStats: true,
};

export const DRD_CONFERENCE_CONFIG: SchoolAssignmentConfig = {
  title: 'DRD Conference School Assignment',
  description: 'Assign DRD Members to schools for conference paper review. Members will only see conference papers from their assigned schools.',
  icon: <Building2 className="text-teal-600" />,
  endpoints: {
    fetchMembers: '/permission-management/drd-members/with-schools',
    fetchSchoolsWithMembers: '/permission-management/schools/with-members',
    saveAssignment: '/permission-management/drd-member/assign-schools',
  },
  labels: {
    memberType: 'DRD Member',
    memberTypePlural: 'DRD Members',
  },
  showStats: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

const getActivePermissions = (permissions: Record<string, boolean> | string[] | undefined): string[] => {
  if (!permissions) return [];
  if (Array.isArray(permissions)) return permissions;
  return Object.entries(permissions)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
};

const formatPermissionLabel = (key: string): string => {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// ============================================================================
// Main Component
// ============================================================================

interface SchoolAssignmentManagerProps {
  config: SchoolAssignmentConfig;
}

export default function SchoolAssignmentManager({ config }: SchoolAssignmentManagerProps) {
  const toast = useToast();
  
  const [schools, setSchools] = useState<School[]>([]);
  const [members, setMembers] = useState<AssignmentMember[]>([]);
  const [schoolsWithMembers, setSchoolsWithMembers] = useState<SchoolWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected member for editing
  const [selectedMember, setSelectedMember] = useState<AssignmentMember | null>(null);
  const [editedSchoolIds, setEditedSchoolIds] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [membersRes, schoolsWithMembersRes] = await Promise.all([
        api.get(config.endpoints.fetchMembers),
        api.get(config.endpoints.fetchSchoolsWithMembers),
      ]);

      // Handle the nested response structure
      const membersData = membersRes.data?.data?.members || membersRes.data?.data || [];
      setMembers(Array.isArray(membersData) ? membersData : []);
      
      const schoolsData = schoolsWithMembersRes.data?.data || [];
      
      // Transform the backend response to match the expected structure
      const transformedSchoolsData = (Array.isArray(schoolsData) ? schoolsData : []).map((s: any) => ({
        schoolId: s.id,
        schoolCode: s.facultyCode,
        schoolName: s.facultyName,
        assignedMemberIds: s.assignedMembers?.map((m: any) => m.userId) || [],
        members: s.assignedMembers || [],
      }));
      setSchoolsWithMembers(transformedSchoolsData);
      
      // Extract schools list
      const schoolsList = (Array.isArray(schoolsData) ? schoolsData : []).map((s: any) => ({
        id: s.id,
        facultyCode: s.facultyCode,
        facultyName: s.facultyName,
      }));
      setSchools(schoolsList);
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to fetch data';
      logger.error('Failed to fetch data:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [config.endpoints]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openEditModal = (member: AssignmentMember) => {
    setSelectedMember(member);
    setEditedSchoolIds([...member.assignedSchoolIds]);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setSelectedMember(null);
    setEditedSchoolIds([]);
    setShowEditModal(false);
  };

  const handleSchoolToggle = (schoolId: string) => {
    setEditedSchoolIds((prev) => {
      if (prev.includes(schoolId)) {
        return prev.filter((id) => id !== schoolId);
      } else {
        return [...prev, schoolId];
      }
    });
  };

  const handleSaveAssignment = async () => {
    if (!selectedMember) return;

    try {
      setSaving(true);
      setError(null);

      await api.post(config.endpoints.saveAssignment, {
        userId: selectedMember.userId,
        schoolIds: editedSchoolIds,
      });

      const memberName = selectedMember.user?.employeeDetails?.displayName || selectedMember.user?.uid;
      toast.success(`Successfully updated school assignments for ${memberName}`);
      closeEditModal();
      fetchData();
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save assignment';
      logger.error('Failed to save assignment:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const selectAllSchools = () => {
    setEditedSchoolIds(schools.map((s) => s.id));
  };

  const clearAllSchools = () => {
    setEditedSchoolIds([]);
  };

  const getSchoolName = (schoolId: string): string => {
    const school = schools.find((s) => s.id === schoolId);
    return school?.facultyName || 'Unknown School';
  };

  const filteredMembers = Array.isArray(members) ? members.filter((member) => {
    const search = searchTerm.toLowerCase();
    const displayName = member.user?.employeeDetails?.displayName?.toLowerCase() || '';
    const uid = member.user?.uid?.toLowerCase() || '';
    const email = member.user?.email?.toLowerCase() || '';
    return displayName.includes(search) || uid.includes(search) || email.includes(search);
  }) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          {config.icon}
          {config.title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {config.description}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-800 dark:text-red-200">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* Stats Overview */}
      {config.showStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{members.length}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{config.labels.memberTypePlural}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <GraduationCap className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{schools.length}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Schools</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {members.filter((m) => m.assignedSchoolIds.length > 0).length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">With Assignments</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {members.filter((m) => m.assignedSchoolIds.length === 0).length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Unassigned</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              {config.labels.memberTypePlural}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Click on a member to assign schools
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <button
              onClick={fetchData}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Member
                </th>
                {config.showPermissions && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Permissions
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Assigned Schools
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                  onClick={() => openEditModal(member)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {member.user?.employeeDetails?.displayName || member.user?.uid}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {member.user?.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  {config.showPermissions && (
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {getActivePermissions(member.permissions).slice(0, 3).map((perm) => (
                          <span
                            key={perm}
                            className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                          >
                            {config.getPermissionLabel?.(perm) || formatPermissionLabel(perm)}
                          </span>
                        ))}
                        {getActivePermissions(member.permissions).length > 3 && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            +{getActivePermissions(member.permissions).length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    {member.assignedSchoolIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {member.assignedSchoolIds.slice(0, 2).map((schoolId) => (
                          <span
                            key={schoolId}
                            className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                          >
                            {getSchoolName(schoolId)}
                          </span>
                        ))}
                        {member.assignedSchoolIds.length > 2 && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            +{member.assignedSchoolIds.length - 2} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">No schools assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(member);
                      }}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={config.showPermissions ? 4 : 3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No {config.labels.memberTypePlural.toLowerCase()} found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schools Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-green-600 dark:text-green-400" />
            Schools Overview
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Shows the number of {config.labels.memberTypePlural.toLowerCase()} assigned to each school
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schoolsWithMembers.map((school) => (
            <div
              key={school.schoolId}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{school.schoolName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{school.schoolCode}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {school.assignedMemberIds?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Assign Schools to {selectedMember.user?.employeeDetails?.displayName || selectedMember.user?.uid}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Select the schools this member should be assigned to
                  </p>
                </div>
                <button
                  onClick={closeEditModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={selectAllSchools}
                  className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/70"
                >
                  Select All
                </button>
                <button
                  onClick={clearAllSchools}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Clear All
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                  {editedSchoolIds.length} of {schools.length} selected
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {schools.map((school) => (
                  <label
                    key={school.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      editedSchoolIds.includes(school.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editedSchoolIds.includes(school.id)}
                      onChange={() => handleSchoolToggle(school.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {school.facultyName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{school.facultyCode}</p>
                    </div>
                    {editedSchoolIds.includes(school.id) && (
                      <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={closeEditModal}
                disabled={saving}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssignment}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
