'use client';

import { useEffect, useState } from 'react';
import {
  permissionManagementService,
  UserWithPermissions,
  PermissionDefinitions,
  Permission,
} from '@/features/admin-management/services/permissionManagement.service';
import {
  roleManagementService,
  Role,
} from '@/features/admin-management/services/roleManagement.service';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { schoolService, School } from '@/features/admin-management/services/school.service';
import {
  centralDepartmentService,
  CentralDepartment,
} from '@/features/admin-management/services/centralDepartment.service';
import { Shield, Building2, Briefcase, ChevronDown, ChevronUp, User, Users, Settings, CheckCircle2, Layers } from 'lucide-react';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';

export default function PermissionManagement() {
  const { toast } = useToast();
  const { confirmAction } = useConfirm();
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [centralDepts, setCentralDepts] = useState<CentralDepartment[]>([]);
  const [permissionDefs, setPermissionDefs] = useState<PermissionDefinitions | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New department-focused approach
  const [selectedDepartmentType, setSelectedDepartmentType] = useState<'central' | 'school'>('central');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Form state
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});
  const [isPrimary, setIsPrimary] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  
  // Monthly report scope state
  const [selectedMonthlyReportSchools, setSelectedMonthlyReportSchools] = useState<string[]>([]);
  const [selectedMonthlyReportDepartments, setSelectedMonthlyReportDepartments] = useState<string[]>([]);

  // Note: Permission definitions are now fetched from backend via permissionDefs state

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, schoolsRes, centralDeptsRes, defsRes, rolesRes] = await Promise.all([
        permissionManagementService.getAllUsersWithPermissions(),
        schoolService.getAllSchools({ isActive: true }),
        centralDepartmentService.getAllCentralDepartments({ isActive: true }),
        permissionManagementService.getPermissionDefinitions(),
        roleManagementService.getAllRoles({ isActive: true }),
      ]);

      setUsers(usersRes.data);
      setSchools(schoolsRes.data);
      setCentralDepts(centralDeptsRes.data);
      setPermissionDefs(defsRes.data);
      setRoles(rolesRes.data);
    } catch (error: unknown) {
      logger.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPermissionModal = (user: UserWithPermissions) => {
    if (!selectedDepartmentId) {
      toast({ type: 'warning', message: 'Please select a department first' });
      return;
    }
    
    setSelectedUser(user);
    setSelectedRoleId(''); // Reset role selection
    
    // Load existing permissions for this user and department
    let existingPermissions: Record<string, boolean> = {};
    let isCurrentlyPrimary = false;
    let existingMonthlyReportSchools: string[] = [];
    let existingMonthlyReportDepartments: string[] = [];
    
    if (selectedDepartmentType === 'central') {
      const existingPerm = user.centralDeptPermissions.find(perm => perm.centralDeptId === selectedDepartmentId);
      if (existingPerm) {
        existingPermissions = existingPerm.permissions;
        isCurrentlyPrimary = existingPerm.isPrimary;
        // Load monthly report scope if available
        existingMonthlyReportSchools = (existingPerm as any).assignedMonthlyReportSchoolIds || [];
        existingMonthlyReportDepartments = (existingPerm as any).assignedMonthlyReportDepartmentIds || [];
      }
    } else {
      const existingPerm = user.schoolDeptPermissions.find(perm => perm.departmentId === selectedDepartmentId);
      if (existingPerm) {
        existingPermissions = existingPerm.permissions;
        isCurrentlyPrimary = existingPerm.isPrimary;
      }
    }
    
    setSelectedPermissions(existingPermissions);
    setIsPrimary(isCurrentlyPrimary);
    setSelectedMonthlyReportSchools(existingMonthlyReportSchools);
    setSelectedMonthlyReportDepartments(existingMonthlyReportDepartments);
    setShowPermissionModal(true);
  };

  // Apply role template permissions
  const applyRoleTemplate = (roleId: string) => {
    if (!roleId) {
      setSelectedRoleId('');
      return;
    }

    const role = roles.find(r => r.id === roleId);
    if (!role) {
      toast({ type: 'error', message: 'Role not found' });
      return;
    }

    setSelectedRoleId(roleId);

    // Apply permissions based on department type
    const rolePerms = role.permissions || {};
    let permissionsToApply: Record<string, boolean> = {};

    if (selectedDepartmentType === 'central' && rolePerms.centralDeptPermissions) {
      permissionsToApply = { ...rolePerms.centralDeptPermissions };
    } else if (selectedDepartmentType === 'school' && rolePerms.schoolDeptPermissions) {
      permissionsToApply = { ...rolePerms.schoolDeptPermissions };
    }

    // Merge with existing permissions (role as base, can be modified)
    setSelectedPermissions(prev => ({
      ...prev,
      ...permissionsToApply,
    }));

    toast({ 
      type: 'success', 
      message: `Applied "${role.name}" role template. You can now adjust individual permissions.` 
    });
  };

  const handlePermissionToggle = (permKey: string) => {
    setSelectedPermissions((prev) => ({
      ...prev,
      [permKey]: !prev[permKey],
    }));
  };

  const handleGrantPermissions = async () => {
    if (!selectedUser || !selectedDepartmentId) {
      toast({ type: 'warning', message: 'Please select a department and user' });
      return;
    }

    if (Object.keys(selectedPermissions).filter(k => selectedPermissions[k]).length === 0) {
      toast({ type: 'warning', message: 'Please select at least one permission' });
      return;
    }

    try {
      if (selectedDepartmentType === 'school') {
        await permissionManagementService.grantSchoolDeptPermissions({
          userId: selectedUser.id,
          departmentId: selectedDepartmentId,
          permissions: selectedPermissions,
          isPrimary,
        });
      } else {
        await permissionManagementService.grantCentralDeptPermissions({
          userId: selectedUser.id,
          centralDeptId: selectedDepartmentId,
          permissions: selectedPermissions,
          isPrimary,
          // Include monthly report scope if the permission is enabled
          assignedMonthlyReportSchoolIds: selectedPermissions['monthly_report_view'] ? selectedMonthlyReportSchools : [],
          assignedMonthlyReportDepartmentIds: selectedPermissions['monthly_report_view'] ? selectedMonthlyReportDepartments : [],
        });
      }
      setShowPermissionModal(false);
      // Reset monthly report scope state
      setSelectedMonthlyReportSchools([]);
      setSelectedMonthlyReportDepartments([]);
      fetchData();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleRevoke = async (
    userId: string,
    departmentId: string,
    type: 'school' | 'central'
  ) => {
    const confirmed = await confirmAction('Revoke Permissions', 'Are you sure you want to revoke these permissions?');
    if (!confirmed) return;

    try {
      if (type === 'school') {
        await permissionManagementService.revokeSchoolDeptPermissions(userId, departmentId);
      } else {
        await permissionManagementService.revokeCentralDeptPermissions(userId, departmentId);
      }
      fetchData();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const getSelectedDepartment = () => {
    if (selectedDepartmentType === 'school') {
      return schools.flatMap(school => 
        school.departments?.map(dept => ({
          id: dept.id,
          name: dept.departmentName,
          code: dept.departmentCode,
          type: 'school'
        })) || []
      ).find(dept => dept.id === selectedDepartmentId);
    } else {
      return centralDepts.find(dept => dept.id === selectedDepartmentId);
    }
  };

  const getSelectedDepartmentName = () => {
    const dept = getSelectedDepartment();
    if (!dept) return '';
    
    if (selectedDepartmentType === 'central') {
      // For central departments, use departmentName property
      return (dept as CentralDepartment).departmentName;
    } else {
      // For school departments, use name property
      return (dept as { id: string; name: string; code: string; type: string; }).name;
    }
  };

  const getDepartmentPermissions = (): Permission[] => {
    if (!selectedDepartmentId || !permissionDefs) return [];
    
    const selectedDept = getSelectedDepartment();
    if (!selectedDept) return [];

    if (selectedDepartmentType === 'central') {
      const centralDept = selectedDept as CentralDepartment;
      // Try to match department code with permission definitions from backend
      const deptCode = centralDept.departmentCode?.toLowerCase();
      
      // centralDepartments is Record<string, Permission[]> keyed by lowercase dept type (drd, hr, finance, etc.)
      if (permissionDefs.centralDepartments) {
        // Check various possible matches for DRD department
        if (deptCode === 'drd' || deptCode === 'drd123' || centralDept.departmentName?.toUpperCase().includes('DRD')) {
          return permissionDefs.centralDepartments['drd'] || [];
        }
        
        // For other departments, try direct match
        return permissionDefs.centralDepartments[deptCode] || [];
      }
      
      return [];
    }
    
    // For school departments, return schoolDepartments permissions
    return permissionDefs.schoolDepartments || [];
  };

  const groupPermissionsByCategory = (perms: Permission[]) => {
    return perms.reduce((acc, perm) => {
      if (!acc[perm.category]) acc[perm.category] = [];
      acc[perm.category].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  };

  const getFilteredUsers = () => {
    if (!selectedDepartmentId) return users;
    
    return users.filter(user => {
      if (selectedDepartmentType === 'central') {
        return user.centralDeptPermissions.some(perm => perm.centralDeptId === selectedDepartmentId);
      } else {
        return user.schoolDeptPermissions.some(perm => perm.departmentId === selectedDepartmentId);
      }
    });
  };

  // Quick permission preset functionality
  const applyPermissionPreset = (presetType: 'basic' | 'advanced' | 'full') => {
    const deptPermissions = getDepartmentPermissions();
    let permissions: Record<string, boolean> = {};
    
    switch (presetType) {
      case 'basic':
        // Grant basic read permissions
        deptPermissions.forEach(perm => {
          if (perm.label.toLowerCase().includes('view') || perm.label.toLowerCase().includes('dashboard')) {
            permissions[perm.key] = true;
          }
        });
        break;
      case 'advanced':
        // Grant read + some edit permissions
        deptPermissions.forEach(perm => {
          if (perm.label.toLowerCase().includes('view') || 
              perm.label.toLowerCase().includes('dashboard') ||
              perm.label.toLowerCase().includes('edit') ||
              perm.label.toLowerCase().includes('add') ||
              perm.label.toLowerCase().includes('manage')) {
            permissions[perm.key] = true;
          }
        });
        break;
      case 'full':
        // Grant all permissions
        deptPermissions.forEach(perm => {
          permissions[perm.key] = true;
        });
        break;
    }
    
    setSelectedPermissions(permissions);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="text-blue-600" />
          Department Permission Management
        </h1>
        <p className="text-gray-600 mt-2">
          Select from predefined departments to manage user permissions and access controls. 
          Each department has its own set of specific permissions that can be assigned to users.
        </p>
      </div>

      {/* Department Selection */}
      <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          Step 1: Select Department
        </h2>
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Departments are predefined in the system. You can only assign permissions for existing departments.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Department Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department Type *
            </label>
            <select
              value={selectedDepartmentType}
              onChange={(e) => {
                setSelectedDepartmentType(e.target.value as 'central' | 'school');
                setSelectedDepartmentId('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="central">Central Departments</option>
              <option value="school">School Departments</option>
            </select>
          </div>

          {/* Department Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Department *
            </label>
            <select
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Select Department --</option>
              {selectedDepartmentType === 'central' 
                ? centralDepts.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.departmentName}
                    </option>
                  ))
                : schools.flatMap((school) =>
                    school.departments?.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {school.facultyName} - {dept.departmentName}
                      </option>
                    )) || []
                  )
              }
            </select>
          </div>

          {/* Department Info */}
          <div className="flex items-end">
            {selectedDepartmentId && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 w-full">
                <div className="text-sm font-medium text-blue-900">
                  {getSelectedDepartmentName()}
                </div>
                <div className="text-xs text-blue-700">
                  {getDepartmentPermissions().length} permissions available
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Permission Overview */}
      {selectedDepartmentId && getDepartmentPermissions().length > 0 && (
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-green-600" />
            Step 2: Available Permissions for {getSelectedDepartmentName()}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(groupPermissionsByCategory(getDepartmentPermissions())).map(([category, perms]) => (
              <div key={category} className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  {category}
                </h3>
                <ul className="space-y-1">
                  {perms.map((perm) => (
                    <li key={perm.key} className="text-sm text-gray-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      {perm.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Management */}
      {selectedDepartmentId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Step 3: Manage User Permissions
            </h2>
            <p className="text-gray-600 mt-1">
              Assign permissions to users for {getSelectedDepartmentName()}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Current Permissions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => {
                  // Check if user has permissions for selected department
                  const hasPermissions = selectedDepartmentType === 'central' 
                    ? user.centralDeptPermissions.some(perm => perm.centralDeptId === selectedDepartmentId)
                    : user.schoolDeptPermissions.some(perm => perm.departmentId === selectedDepartmentId);
                  
                  const userPermissionCount = selectedDepartmentType === 'central'
                    ? user.centralDeptPermissions.find(perm => perm.centralDeptId === selectedDepartmentId)?.permissions || {}
                    : user.schoolDeptPermissions.find(perm => perm.departmentId === selectedDepartmentId)?.permissions || {};
                  
                  const activePermissions = Object.keys(userPermissionCount).filter(k => userPermissionCount[k]);

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3 ${hasPermissions ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                          <User className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.employeeDetails?.displayName || user.uid}
                            </div>
                            <div className="text-sm text-gray-500">{user.uid}</div>
                            <div className="text-xs text-gray-400">
                              {user.role} • {user.employeeDetails?.designation || 'No designation'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {hasPermissions ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                ✓ {activePermissions.length} permissions
                              </span>
                              {selectedDepartmentType === 'central' && 
                               user.centralDeptPermissions.find(perm => perm.centralDeptId === selectedDepartmentId)?.isPrimary && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                  Primary
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {activePermissions.slice(0, 3).join(', ')}
                              {activePermissions.length > 3 && ` +${activePermissions.length - 3} more`}
                            </div>
                          </div>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                            No permissions assigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {hasPermissions ? (
                            <>
                              <button
                                onClick={() => openPermissionModal(user)}
                                className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm"
                              >
                                Edit Permissions
                              </button>
                              <button
                                onClick={() => handleRevoke(user.id, selectedDepartmentId, selectedDepartmentType)}
                                className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-sm"
                              >
                                Revoke All
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => openPermissionModal(user)}
                              className="px-3 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 text-sm"
                            >
                              Grant Permissions
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Department Selected */}
      {!selectedDepartmentId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Department</h3>
          <p className="text-gray-500 mb-4">
            Choose from the predefined departments above to view and manage user permissions for that specific department.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left inline-block">
            <h4 className="font-medium text-gray-700 mb-2">Available Departments:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div>• DRD (Research & Development)</div>
              <div>• HR (Human Resources)</div>
              <div>• Finance Department</div>
              <div>• Library Department</div>
              <div>• IT (Information Technology)</div>
              <div>• Admissions Office</div>
              <div>• Registrar Office</div>
              <div>• School Departments</div>
            </div>
          </div>
        </div>
      )}



      {/* Permission Assignment Modal */}
      {showPermissionModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                Manage Permissions: {getSelectedDepartmentName()}
              </h2>
              <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>User:</strong> {selectedUser.employeeDetails?.displayName} ({selectedUser.uid})
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Department: {getSelectedDepartmentName()} • 
                  Type: {selectedDepartmentType === 'central' ? 'Central Department' : 'School Department'}
                </p>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {/* Role Template Selection */}
                {roles.length > 0 && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      <h4 className="font-semibold text-indigo-900 dark:text-indigo-100">Apply Role Template</h4>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400">(Optional - Quick permission setup)</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <select
                        value={selectedRoleId}
                        onChange={(e) => applyRoleTemplate(e.target.value)}
                        className="flex-1 px-3 py-2 border border-indigo-300 dark:border-indigo-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">-- Select a Role Template --</option>
                        {roles
                          .filter(role => {
                            // Filter roles based on department type
                            if (selectedDepartmentType === 'central') {
                              return role.departmentType === 'CENTRAL' || role.departmentType === 'BOTH';
                            }
                            return role.departmentType === 'SCHOOL' || role.departmentType === 'BOTH';
                          })
                          .map(role => (
                            <option key={role.id} value={role.id}>
                              {role.name} {role.description ? `- ${role.description}` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                    {selectedRoleId && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                        ✓ Role template applied. You can modify individual permissions below.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isPrimary" className="text-sm text-gray-700 flex items-center gap-2">
                    <span>Set as Primary Department (for reporting)</span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">Primary</span>
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Select Permissions *
                    </h3>
                    
                    {/* Quick Presets */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => applyPermissionPreset('basic')}
                        className="text-xs px-3 py-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
                      >
                        Basic Access
                      </button>
                      <button
                        onClick={() => applyPermissionPreset('advanced')}
                        className="text-xs px-3 py-1 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-colors"
                      >
                        Advanced User
                      </button>
                      <button
                        onClick={() => applyPermissionPreset('full')}
                        className="text-xs px-3 py-1 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                      >
                        Full Administrator
                      </button>
                    </div>
                  </div>
                  
                  <div className="border rounded-xl p-4 max-h-96 overflow-y-auto bg-gray-50">
                    {Object.entries(groupPermissionsByCategory(getDepartmentPermissions())).map(
                      ([category, perms]) => (
                        <div key={category} className="mb-6 bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                              <Shield className="w-4 h-4 text-blue-500" />
                              {category}
                            </h4>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const categoryPerms: Record<string, boolean> = {};
                                  perms.forEach(perm => categoryPerms[perm.key] = true);
                                  setSelectedPermissions(prev => ({ ...prev, ...categoryPerms }));
                                }}
                                className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                              >
                                Select All
                              </button>
                              <button
                                onClick={() => {
                                  const categoryPerms: Record<string, boolean> = {};
                                  perms.forEach(perm => categoryPerms[perm.key] = false);
                                  setSelectedPermissions(prev => ({ ...prev, ...categoryPerms }));
                                }}
                                className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {perms.map((perm) => (
                              <label
                                key={perm.key}
                                className="flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 p-3 rounded-lg cursor-pointer border border-gray-100 hover:border-gray-200 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions[perm.key] || false}
                                  onChange={() => handlePermissionToggle(perm.key)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="flex-1">{perm.label}</span>
                                {selectedPermissions[perm.key] && (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                )}
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Monthly Report Scope Selection - Only show when monthly_report_view is selected */}
                {selectedPermissions['monthly_report_view'] && (
                  <div className="border border-purple-200 rounded-xl p-4 bg-purple-50">
                    <h4 className="font-semibold text-purple-800 mb-4 flex items-center gap-2">
                      📊 Monthly Report Scope
                      <span className="text-xs font-normal text-purple-600">(Select which schools/departments this user can view reports for)</span>
                    </h4>
                    
                    {/* School Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Schools (can view all trackers from these schools)
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto bg-white p-3 rounded-lg border border-purple-100">
                        {schools.map((school) => (
                          <label
                            key={school.id}
                            className="flex items-center gap-2 text-sm text-gray-700 hover:bg-purple-50 p-2 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedMonthlyReportSchools.includes(school.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMonthlyReportSchools([...selectedMonthlyReportSchools, school.id]);
                                } else {
                                  setSelectedMonthlyReportSchools(selectedMonthlyReportSchools.filter(id => id !== school.id));
                                }
                              }}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="truncate">{school.facultyName}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedMonthlyReportSchools.length} school(s) selected
                      </p>
                    </div>
                    
                    {/* Department Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Departments (can view trackers from specific departments only)
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto bg-white p-3 rounded-lg border border-purple-100">
                        {schools.flatMap((school) =>
                          (school.departments || []).map((dept) => (
                            <label
                              key={dept.id}
                              className="flex items-center gap-2 text-sm text-gray-700 hover:bg-purple-50 p-2 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedMonthlyReportDepartments.includes(dept.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMonthlyReportDepartments([...selectedMonthlyReportDepartments, dept.id]);
                                  } else {
                                    setSelectedMonthlyReportDepartments(selectedMonthlyReportDepartments.filter(id => id !== dept.id));
                                  }
                                }}
                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              />
                              <span className="truncate" title={`${school.facultyName} - ${dept.departmentName}`}>
                                {dept.departmentName}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedMonthlyReportDepartments.length} department(s) selected
                      </p>
                    </div>
                    
                    {selectedMonthlyReportSchools.length === 0 && selectedMonthlyReportDepartments.length === 0 && (
                      <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs text-yellow-700">
                          ⚠️ Please select at least one school or department to define the scope for monthly report viewing.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Permission Summary</h4>
                  <p className="text-sm text-gray-600">
                    {Object.values(selectedPermissions).filter(Boolean).length} permissions selected out of {getDepartmentPermissions().length} available
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowPermissionModal(false);
                      setSelectedPermissions({});
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGrantPermissions}
                    disabled={Object.values(selectedPermissions).filter(Boolean).length === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Save Permissions
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
