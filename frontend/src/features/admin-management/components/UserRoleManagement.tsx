'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  permissionManagementService,
  UserWithPermissions,
  PermissionDefinitions,
  Permission,
} from '@/features/admin-management/services/permissionManagement.service';
import { fetchSeminarHallBlocks } from '@/features/resource-management/seminar-hall-booking/services/seminarHall.api';
import {
  roleManagementService,
  Role,
  RoleDepartmentType,
  RolePermissions,
  RoleAnalyticsScope,
  RoleAnalyticsCategoryScope,
} from '@/features/admin-management/services/roleManagement.service';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { schoolService, School } from '@/features/admin-management/services/school.service';
import {
  centralDepartmentService,
  CentralDepartment,
} from '@/features/admin-management/services/centralDepartment.service';
import { departmentService, Department } from '@/features/admin-management/services/department.service';
import {
  Shield,
  Building2,
  Briefcase,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Settings,
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  Copy,
  X,
  Check,
  Layers,
  UserCog,
  Search,
  Filter,
} from 'lucide-react';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';

type ActiveTab = 'roles' | 'users';

interface ScopeOption {
  id: string;
  label: string;
}

interface ScopeOptionGroup {
  id: string;
  label: string;
  options: ScopeOption[];
}

function ScopeCheckboxList({
  options,
  selectedIds,
  onToggle,
}: {
  options: ScopeOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 dark:border-gray-600 px-2 py-3 text-center text-[10px] text-gray-400 dark:text-gray-500">
        No options available
      </div>
    );
  }

  return (
    <div className="max-h-24 space-y-1 overflow-y-auto rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2">
      {options.map((option) => {
        const isChecked = selectedIds.includes(option.id);
        return (
          <label
            key={option.id}
            className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[10px] transition-colors ${
              isChecked
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-600/60'
            }`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => onToggle(option.id)}
              className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="truncate">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function ScopeCheckboxGroupList({
  groups,
  selectedIds,
  onToggle,
}: {
  groups: ScopeOptionGroup[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const nonEmptyGroups = groups.filter(group => group.options.length > 0);

  if (nonEmptyGroups.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 dark:border-gray-600 px-2 py-3 text-center text-[10px] text-gray-400 dark:text-gray-500">
        No departments available
      </div>
    );
  }

  return (
    <div className="max-h-24 space-y-2 overflow-y-auto rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2">
      {nonEmptyGroups.map((group) => (
        <div key={group.id}>
          <p className="mb-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">{group.label}</p>
          <div className="space-y-1">
            {group.options.map((option) => {
              const isChecked = selectedIds.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[10px] transition-colors ${
                    isChecked
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-600/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(option.id)}
                    className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function UserRoleManagement() {
  const { toast } = useToast();
  const { confirmAction } = useConfirm();

  // Main state
  const [activeTab, setActiveTab] = useState<ActiveTab>('users');
  const [loading, setLoading] = useState(true);

  // Data state
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [centralDepts, setCentralDepts] = useState<CentralDepartment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [seminarHallBlocks, setSeminarHallBlocks] = useState<Array<{ id: string; name: string; blockNumber?: string | null }>>([]);
  const [permissionDefs, setPermissionDefs] = useState<PermissionDefinitions | null>(null);

  // User search and selection
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);

  // Role management state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    roleCode: '',
    name: '',
    description: '',
    departmentType: 'BOTH' as RoleDepartmentType,
    requiresDepartmentAssignment: true,
  });
  const [roleSchoolPermissions, setRoleSchoolPermissions] = useState<Record<string, boolean>>({});
  const [roleCentralPermissions, setRoleCentralPermissions] = useState<Record<string, boolean>>({});
  const [roleAnalyticsScope, setRoleAnalyticsScope] = useState<RoleAnalyticsScope>({});
  const [roleSeminarHallBlockIds, setRoleSeminarHallBlockIds] = useState<string[]>([]);
  const [rolePermissionTab, setRolePermissionTab] = useState<'central' | 'school'>('central');
  const [roleCentralDeptFilter, setRoleCentralDeptFilter] = useState<string>('all');
  const [roleSchoolCategoryFilter, setRoleSchoolCategoryFilter] = useState<string>('all');
  const [roleSelectedSchoolId, setRoleSelectedSchoolId] = useState<string>('');
  const [roleSelectedDepartmentId, setRoleSelectedDepartmentId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  // User permission section - central dept type filter
  const [userCentralDeptFilter, setUserCentralDeptFilter] = useState<string>('all');
  const [permissionDeptFilter, setPermissionDeptFilter] = useState<string>('all'); // Filter for permissions display

  // User permission assignment state
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]); // Multiple roles
  const [showCentralDepts, setShowCentralDepts] = useState(true);
  const [showSchoolDepts, setShowSchoolDepts] = useState(false);
  const [selectedDepartmentType, setSelectedDepartmentType] = useState<'central' | 'school'>('central');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [userSelectedSchoolId, setUserSelectedSchoolId] = useState<string>('');
  const [userSelectedDepartmentId, setUserSelectedDepartmentId] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  // Store permissions for all departments: { 'central_deptId': { permKey: true }, 'school_deptId': { ... } }
  const [allDepartmentPermissions, setAllDepartmentPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [isPrimaryDepartment, setIsPrimaryDepartment] = useState(false);
  const [showUserPermissionModal, setShowUserPermissionModal] = useState(false);
  const [showRoleAssignmentModal, setShowRoleAssignmentModal] = useState(false);
  const [departmentsInRole, setDepartmentsInRole] = useState<{ type: 'central' | 'school', deptId: string, deptName: string, permCount: number, permissions: string[] }[]>([]);

  // Analytics scope per central-dept key ("central_<id>")
  interface AnalyticsScopeEntry {
    iprSchools: string[]; iprDepts: string[];
    researchSchools: string[]; researchDepts: string[];
    bookSchools: string[]; bookDepts: string[];
    conferenceSchools: string[]; conferenceDepts: string[];
    grantsSchools: string[]; grantsDepts: string[];
  }
  const emptyScope = (): AnalyticsScopeEntry => ({
    iprSchools: [], iprDepts: [],
    researchSchools: [], researchDepts: [],
    bookSchools: [], bookDepts: [],
    conferenceSchools: [], conferenceDepts: [],
    grantsSchools: [], grantsDepts: [],
  });
  const [analyticsScope, setAnalyticsScope] = useState<Record<string, AnalyticsScopeEntry>>({});
  const toggleScopeItem = (deptKey: string, field: keyof AnalyticsScopeEntry, id: string) => {
    setAnalyticsScope(prev => {
      const scope = prev[deptKey] || emptyScope();
      const current = scope[field] as string[];
      return { ...prev, [deptKey]: { ...scope, [field]: current.includes(id) ? current.filter(x => x !== id) : [...current, id] } };
    });
  };

  const DRD_ANALYTICS_CATEGORIES_MODAL = [
    { id: 'ipr', label: 'IPR', schoolsField: 'iprSchools' as keyof AnalyticsScopeEntry, deptsField: 'iprDepts' as keyof AnalyticsScopeEntry },
    { id: 'research', label: 'Research', schoolsField: 'researchSchools' as keyof AnalyticsScopeEntry, deptsField: 'researchDepts' as keyof AnalyticsScopeEntry },
    { id: 'book', label: 'Book / Chapter', schoolsField: 'bookSchools' as keyof AnalyticsScopeEntry, deptsField: 'bookDepts' as keyof AnalyticsScopeEntry },
    { id: 'conference', label: 'Conference', schoolsField: 'conferenceSchools' as keyof AnalyticsScopeEntry, deptsField: 'conferenceDepts' as keyof AnalyticsScopeEntry },
    { id: 'grants', label: 'Grants', schoolsField: 'grantsSchools' as keyof AnalyticsScopeEntry, deptsField: 'grantsDepts' as keyof AnalyticsScopeEntry },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-load permissions when department is selected
  useEffect(() => {
    if (selectedDepartmentId && selectedUser) {
      console.log('🔄 Department selected, loading permissions...', {
        deptType: selectedDepartmentType,
        deptId: selectedDepartmentId
      });
      loadExistingUserPermissions(selectedDepartmentType, selectedDepartmentId);
    }
  }, [selectedDepartmentId, selectedDepartmentType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes, schoolsRes, centralDeptsRes, departmentsRes, defsRes] = await Promise.all([
        permissionManagementService.getAllUsersWithPermissions(),
        roleManagementService.getAllRoles(),
        schoolService.getAllSchools({ isActive: true }),
        centralDepartmentService.getAllCentralDepartments({ isActive: true }),
        departmentService.getAllDepartments({ isActive: true }),
        roleManagementService.getPermissionDefinitions(),
      ]);
      const seminarHallBlocksRes = await fetchSeminarHallBlocks();

      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      setSchools(schoolsRes.data);
      setCentralDepts(centralDeptsRes.data);
      setDepartments(departmentsRes.data);
      setPermissionDefs(defsRes.data);
      setSeminarHallBlocks(seminarHallBlocksRes.map((block) => ({ id: block.id, name: block.name, blockNumber: block.blockNumber })));
    } catch (error: unknown) {
      logger.error('Failed to fetch data:', error);
      toast({ type: 'error', message: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  // Get unique central department types for filtering
  const centralDeptTypes = useMemo(() => {
    if (!permissionDefs?.centralDepartments) return [];
    return Object.keys(permissionDefs.centralDepartments);
  }, [permissionDefs]);

  // Get departments filtered by selected school
  const filteredDepartmentsBySchool = useMemo(() => {
    if (!roleSelectedSchoolId) return [];
    return departments.filter(dept => dept.facultyId ===
   roleSelectedSchoolId);
  }, [departments, roleSelectedSchoolId]);

  // Get permissions for selected department
  const departmentPermissions = useMemo(() => {
    if (!roleSelectedDepartmentId || !permissionDefs?.schoolDepartments) return [];
    
    // Get the selected department details
    const selectedDept = departments.find(d => d.id ===
   roleSelectedDepartmentId);
    if (!selectedDept) return [];

    // Return all school permissions (we'll rely on the user to select appropriate ones)
    // Or if you have category mapping by department, filter here
    return permissionDefs.schoolDepartments;
  }, [roleSelectedDepartmentId, departments, permissionDefs]);

  // Get departments filtered by selected school for user permission assignment
  const userFilteredDepartmentsBySchool = useMemo(() => {
    if (!userSelectedSchoolId) return [];
    return departments.filter(dept => dept.facultyId ===
   userSelectedSchoolId);
  }, [departments, userSelectedSchoolId]);

  // =====================================
    // ROLE MANAGEMENT FUNCTIONS
  // ==============================
    const openRoleModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleFormData({
        roleCode: (role as any).roleCode || '',
        name: role.name,
        description: role.description || '',
        departmentType: role.departmentType,
        requiresDepartmentAssignment: role.requiresDepartmentAssignment,
      });
      setRoleSchoolPermissions(role.permissions?.schoolDeptPermissions || {});
      setRoleCentralPermissions(role.permissions?.centralDeptPermissions || {});
      setRoleAnalyticsScope(role.permissions?.analyticsScope || {});
      setRoleSeminarHallBlockIds(role.permissions?.seminarHallBlockIds || []);
    } else {
      setEditingRole(null);
      setRoleFormData({
        roleCode: '',
        name: '',
        description: '',
        departmentType: 'BOTH',
        requiresDepartmentAssignment: true,
      });
      setRoleSchoolPermissions({});
      setRoleCentralPermissions({});
      setRoleAnalyticsScope({});
      setRoleSeminarHallBlockIds([]);
    }
    setRoleCentralDeptFilter('all');
    setRoleSchoolCategoryFilter('all');
    setRoleSelectedSchoolId('');
    setRoleSelectedDepartmentId('');
    setShowRoleModal(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roleFormData.name.trim()) {
      toast({ type: 'warning', message: 'Role name is required' });
      return;
    }

    const hasSchoolPerms = Object.values(roleSchoolPermissions).some(v => v);
    const hasCentralPerms = Object.values(roleCentralPermissions).some(v => v);
    const hasBlockPerms = roleSeminarHallBlockIds.length > 0;

    if (!hasSchoolPerms && !hasCentralPerms && !hasBlockPerms) {
      toast({ type: 'warning', message: 'Please select at least one permission or block scope' });
      return;
    }

    const permissions: RolePermissions = {};
    if (hasSchoolPerms) {
      permissions.schoolDeptPermissions = roleSchoolPermissions;
    }
    if (hasCentralPerms) {
      permissions.centralDeptPermissions = roleCentralPermissions;
    }
    // Include analytics scope (per-category schools/departments)
    if (Object.keys(roleAnalyticsScope).length > 0) {
      permissions.analyticsScope = roleAnalyticsScope;
    }
    if (hasBlockPerms) {
      permissions.seminarHallBlockIds = roleSeminarHallBlockIds;
    }

    try {
      if (editingRole) {
        await roleManagementService.updateRole(editingRole.id, {
          ...roleFormData,
          permissions,
        });
        toast({ type: 'success', message: 'Role updated successfully' });
      } else {
        await roleManagementService.createRole({
          ...roleFormData,
          permissions,
        });
        toast({ type: 'success', message: 'Role created successfully' });
      }
      setShowRoleModal(false);
      fetchData();
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error);
      
      // Check if it's a duplicate permission set error
      const isDuplicatePermissionError = errorMessage.includes('exact same') && 
                                         errorMessage.includes('permission set already exists');
      
      toast({ 
        type: isDuplicatePermissionError ? 'warning' : 'error', 
        message: errorMessage,
        duration: isDuplicatePermissionError ? 7000 : 5000 // Show duplicate errors longer
      });
      
      logger.error('Role creation/update failed:', error);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    const confirmed = await confirmAction(
      'Delete Role',
      `Are you sure you want to delete the role "${role.name}"?`
    );
    if (!confirmed) return;

    try {
      await roleManagementService.deleteRole(role.id);
      toast({ type: 'success', message: 'Role deleted successfully' });
      fetchData();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleDuplicateRole = async (role: Role) => {
    const newName = prompt('Enter name for the duplicated role:', `${role.name} (Copy)`);
    if (!newName) return;

    try {
      await roleManagementService.duplicateRole(role.id, newName);
      toast({ type: 'success', message: 'Role duplicated successfully' });
      fetchData();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  // =====================================
    // USER PERMISSION FUNCTIONS
  // ==============================
    // When role is selected FIRST, auto-set department type and apply permissions
  const handleRoleSelection = (roleId: string, checked: boolean) => {
    let updatedRoleIds: string[];
    
    if (checked) {
      updatedRoleIds = [...selectedRoleIds, roleId];
    } else {
      updatedRoleIds = selectedRoleIds.filter(id => id !== roleId);
    }
    
    setSelectedRoleIds(updatedRoleIds);

    if (updatedRoleIds.length ===
   0) {
      setDepartmentsInRole([]);
      setUserPermissions({});
      return;
    }

    // Merge permissions from all selected roles with proper deduplication
    const selectedRoles = roles.filter(r => updatedRoleIds.includes(r.id));
    
    // Use Maps to track unique departments and their permissions
    const centralDeptMap = new Map<string, { deptName: string; permissions: Set<string>; deptType: string }>();
    const schoolDeptMap = new Map<string, { deptName: string; permissions: Set<string> }>();
    
    // Track all permissions (deduplicated)
    const allPermissions = new Set<string>();

    selectedRoles.forEach(role => {
      // Process central permissions - match to specific department types
      if (role.permissions?.centralDeptPermissions) {
        // Get permission keys to determine which department types are involved
        const centralPermKeys = Object.keys(role.permissions.centralDeptPermissions).filter(
          key => role.permissions?.centralDeptPermissions?.[key]
        );
        
        // Determine which central department types have these permissions
        const deptTypesWithPerms = new Set<string>();
        if (permissionDefs?.centralDepartments) {
          Object.entries(permissionDefs.centralDepartments).forEach(([deptType, perms]) => {
            const hasAnyPerm = perms.some(p => centralPermKeys.includes(p.key));
            if (hasAnyPerm) {
              deptTypesWithPerms.add(deptType);
            }
          });
        }
        
        // Add only matching central departments
        Object.entries(role.permissions.centralDeptPermissions).forEach(([key, val]) => {
          if (val) {
            allPermissions.add(key);
            // Only add to departments that match this permission's department type
            centralDepts.forEach(dept => {
              if (dept.departmentType && deptTypesWithPerms.has(dept.departmentType)) {
                if (!centralDeptMap.has(dept.id)) {
                  centralDeptMap.set(dept.id, { 
                    deptName: dept.departmentName, 
                    permissions: new Set(),
                    deptType: dept.departmentType
                  });
                }
                // Only add permission if it belongs to this department type
                const deptTypePerms = permissionDefs?.centralDepartments[dept.departmentType];
                if (deptTypePerms?.some((p: { key: string }) => p.key ===
   key)) {
                  centralDeptMap.get(dept.id)!.permissions.add(key);
                }
              }
            });
          }
        });
      }

      // Process school permissions
      if (role.permissions?.schoolDeptPermissions) {
        Object.entries(role.permissions.schoolDeptPermissions).forEach(([key, val]) => {
          if (val) {
            allPermissions.add(key);
            // Add to all school departments
            schools.forEach(school => {
              school.departments?.forEach(dept => {
                if (!schoolDeptMap.has(dept.id)) {
                  schoolDeptMap.set(dept.id, { 
                    deptName: `${school.facultyName} - ${dept.departmentName}`, 
                    permissions: new Set() 
                  });
                }
                schoolDeptMap.get(dept.id)!.permissions.add(key);
              });
            });
          }
        });
      }
    });

    // Build departments list with deduplicated permission counts
    const deptsInRole: Array<{ 
      type: 'central' | 'school'; 
      deptId: string; 
      deptName: string; 
      permCount: number; 
      permissions: string[] 
    }> = [];
    
    centralDeptMap.forEach((data, deptId) => {
      if (data.permissions.size > 0) { // Only add if has permissions
        deptsInRole.push({
          type: 'central',
          deptId,
          deptName: data.deptName,
          permCount: data.permissions.size,
          permissions: Array.from(data.permissions)
        });
      }
    });
    
    schoolDeptMap.forEach((data, deptId) => {
      if (data.permissions.size > 0) { // Only add if has permissions
        deptsInRole.push({
          type: 'school',
          deptId,
          deptName: data.deptName,
          permCount: data.permissions.size,
          permissions: Array.from(data.permissions)
        });
      }
    });

    setDepartmentsInRole(deptsInRole);

    // Set all permissions as checked (deduplicated)
    const mergedPerms: Record<string, boolean> = {};
    allPermissions.forEach(key => {
      mergedPerms[key] = true;
    });
    setUserPermissions(mergedPerms);
    
    // Auto-select the first department if only one department has permissions
    if (deptsInRole.length ===
   1) {
      const firstDept = deptsInRole[0];
      setSelectedDepartmentType(firstDept.type);
      setSelectedDepartmentId(firstDept.deptId);
      // Permissions already set above, but merge with any existing user permissions
      if (selectedUser) {
        loadExistingUserPermissions(firstDept.type, firstDept.deptId);
      }
    }
  };

  // Open modal and load user's assigned roles
  const openUserPermissionModal = (user: UserWithPermissions) => {
    setSelectedUser(user);
    setSelectedDepartmentId('');
    setSelectedDepartmentType('central');
    setUserPermissions({});

    // ── Preload all existing user permissions into allDepartmentPermissions ──
    // This ensures unticking any existing permission is captured in state
    // and correctly saved (or revoked) on Save click.
    const initialDeptPerms: Record<string, Record<string, boolean>> = {};
    user.centralDeptPermissions.forEach(perm => {
      if (perm.permissions && Object.keys(perm.permissions).length > 0) {
        initialDeptPerms[`central_${perm.centralDeptId}`] = { ...(perm.permissions as Record<string, boolean>) };
      }
    });
    user.schoolDeptPermissions.forEach(perm => {
      if (perm.permissions && Object.keys(perm.permissions).length > 0) {
        initialDeptPerms[`school_${perm.departmentId}`] = { ...(perm.permissions as Record<string, boolean>) };
      }
    });
    setAllDepartmentPermissions(initialDeptPerms);
    
    // Load user's assigned roles
    const assignedRoles = user.assignedRoleIds || [];
    setSelectedRoleIds(assignedRoles);
    
    // Auto-check department type checkboxes based on roles
    let hasCentral = false;
    let hasSchool = false;
    let collectedDepts: Array<{ type: 'central' | 'school'; deptId: string; deptName: string; permCount: number; permissions: string[] }> = [];
    
    if (assignedRoles.length > 0) {
      // Process all roles first to collect departments
      assignedRoles.forEach(roleId => {
        const role = roles.find(r => r.id ===
   roleId);
        if (role) {
          if (role.departmentType ===
   'CENTRAL' || role.departmentType ===
   'BOTH') {
            hasCentral = true;
          }
          if (role.departmentType ===
   'SCHOOL' || role.departmentType ===
   'BOTH') {
            hasSchool = true;
          }
        }
        handleRoleSelection(roleId, true);
      });
      
      const roleNames = assignedRoles.map(id => roles.find(r => r.id ===
   id)?.name).filter(Boolean).join(', ');
      toast({ type: 'info', message: `User has ${assignedRoles.length} role(s): ${roleNames}` });
      
      // Wait a bit for state to update, then auto-select first department with permissions
      setTimeout(() => {
        // Get departments from the role selection (this will be in state after handleRoleSelection completes)
        // We need to manually recalculate here since state updates are async
        const selectedRoles = roles.filter(r => assignedRoles.includes(r.id));
        const centralDeptMap = new Map<string, { deptName: string; permissions: Set<string>; deptType: string }>();
        const schoolDeptMap = new Map<string, { deptName: string; permissions: Set<string> }>();
        
        selectedRoles.forEach(role => {
          // Process central permissions
          if (role.permissions?.centralDeptPermissions) {
            const centralPermKeys = Object.keys(role.permissions.centralDeptPermissions).filter(
              key => role.permissions?.centralDeptPermissions?.[key]
            );
            
            const deptTypesWithPerms = new Set<string>();
            if (permissionDefs?.centralDepartments) {
              Object.entries(permissionDefs.centralDepartments).forEach(([deptType, perms]) => {
                const hasAnyPerm = perms.some((p: { key: string }) => centralPermKeys.includes(p.key));
                if (hasAnyPerm) {
                  deptTypesWithPerms.add(deptType);
                }
              });
            }
            
            centralDepts.forEach(dept => {
              if (dept.departmentType && deptTypesWithPerms.has(dept.departmentType)) {
                if (!centralDeptMap.has(dept.id)) {
                  centralDeptMap.set(dept.id, { 
                    deptName: dept.departmentName, 
                    permissions: new Set(),
                    deptType: dept.departmentType
                  });
                }
                const deptTypePerms = permissionDefs?.centralDepartments[dept.departmentType];
                centralPermKeys.forEach(key => {
                  if (deptTypePerms?.some((p: { key: string }) => p.key ===
   key)) {
                    centralDeptMap.get(dept.id)!.permissions.add(key);
                  }
                });
              }
            });
          }
          
          // Process school permissions
          if (role.permissions?.schoolDeptPermissions) {
            Object.entries(role.permissions.schoolDeptPermissions).forEach(([key, val]) => {
              if (val) {
                schools.forEach(school => {
                  school.departments?.forEach(dept => {
                    if (!schoolDeptMap.has(dept.id)) {
                      schoolDeptMap.set(dept.id, { 
                        deptName: `${school.facultyName} - ${dept.departmentName}`, 
                        permissions: new Set() 
                      });
                    }
                    schoolDeptMap.get(dept.id)!.permissions.add(key);
                  });
                });
              }
            });
          }
        });
        
        // Build departments list
        const deptsWithPerms: typeof collectedDepts = [];
        centralDeptMap.forEach((data, deptId) => {
          if (data.permissions.size > 0) {
            deptsWithPerms.push({
              type: 'central',
              deptId,
              deptName: data.deptName,
              permCount: data.permissions.size,
              permissions: Array.from(data.permissions)
            });
          }
        });
        schoolDeptMap.forEach((data, deptId) => {
          if (data.permissions.size > 0) {
            deptsWithPerms.push({
              type: 'school',
              deptId,
              deptName: data.deptName,
              permCount: data.permissions.size,
              permissions: Array.from(data.permissions)
            });
          }
        });
        
        // Load permissions for ALL departments with role permissions
        if (deptsWithPerms.length > 0) {
          loadAllDepartmentPermissions(deptsWithPerms);
        }
      }, 100);
    }
    
    // Set department type checkboxes
    setShowCentralDepts(hasCentral || assignedRoles.length ===
   0); // Default to central if no roles
    setShowSchoolDepts(hasSchool);
    
    // Reset school/department selection
    setUserSelectedSchoolId('');
    setUserSelectedDepartmentId('');
    
    setShowUserPermissionModal(true);
  };

  // Open role assignment modal
  const openRoleAssignmentModal = (user: UserWithPermissions) => {
    setSelectedUser(user);
    
    // Load user's currently assigned roles
    const assignedRoles = user.assignedRoleIds || [];
    setSelectedRoleIds(assignedRoles);
    
    setShowRoleAssignmentModal(true);
  };

  // Save assigned roles to user
  const handleSaveRoleAssignment = async () => {
    if (!selectedUser) return;

    try {
      await permissionManagementService.assignRolesToUser(selectedUser.id, selectedRoleIds);
      
      toast({ 
        type: 'success', 
        message: `Roles assigned successfully to ${selectedUser.employeeDetails?.displayName || selectedUser.uid}` 
      });
      
      setShowRoleAssignmentModal(false);
      await fetchData(); // Reload users to show updated roles
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error, 'Failed to assign roles') });
    }
  };

  // Load permissions for all departments at once
  const loadAllDepartmentPermissions = (depts: Array<{ type: 'central' | 'school'; deptId: string; deptName: string; permCount: number; permissions: string[] }>) => {
    if (!selectedUser) return;

    const allPerms: Record<string, Record<string, boolean>> = {};
    const scopeUpdates: Record<string, AnalyticsScopeEntry> = {};

    depts.forEach(dept => {
      const deptKey = `${dept.type}_${dept.deptId}`;
      let existingPermissions: Record<string, boolean> = {};

      // Load existing user permissions for this department
      if (dept.type ===
   'central') {
        const existing = selectedUser.centralDeptPermissions.find(p => p.centralDeptId ===
   dept.deptId);
        if (existing) {
          existingPermissions = { ...(existing.permissions || {}) };
          // Populate analytics scope from existing record
          scopeUpdates[deptKey] = {
            iprSchools: (existing.assignedIprAnalyticsSchoolIds as string[] | undefined) || [],
            iprDepts: (existing.assignedIprAnalyticsDepartmentIds as string[] | undefined) || [],
            researchSchools: (existing.assignedResearchAnalyticsSchoolIds as string[] | undefined) || [],
            researchDepts: (existing.assignedResearchAnalyticsDepartmentIds as string[] | undefined) || [],
            bookSchools: (existing.assignedBookAnalyticsSchoolIds as string[] | undefined) || [],
            bookDepts: (existing.assignedBookAnalyticsDepartmentIds as string[] | undefined) || [],
            conferenceSchools: (existing.assignedConferenceAnalyticsSchoolIds as string[] | undefined) || [],
            conferenceDepts: (existing.assignedConferenceAnalyticsDepartmentIds as string[] | undefined) || [],
            grantsSchools: (existing.assignedGrantAnalyticsSchoolIds as string[] | undefined) || [],
            grantsDepts: (existing.assignedGrantAnalyticsDepartmentIds as string[] | undefined) || [],
          };
        }
      } else {
        const existing = selectedUser.schoolDeptPermissions.find(p => p.departmentId ===
   dept.deptId);
        if (existing) {
          existingPermissions = { ...(existing.permissions || {}) };
        }
      }

      // Merge with role permissions for this department
      dept.permissions.forEach(permKey => {
        existingPermissions[permKey] = true;
      });

      allPerms[deptKey] = existingPermissions;
    });

    setAllDepartmentPermissions(allPerms);
    if (Object.keys(scopeUpdates).length > 0) {
      setAnalyticsScope(prev => ({ ...prev, ...scopeUpdates }));
    }
  };

  const loadExistingUserPermissions = (deptType: 'central' | 'school', deptId: string) => {
    if (!selectedUser || !deptId) return;

    let existingPermissions: Record<string, boolean> = {};
    let isPrimary = false;

    if (deptType ===
   'central') {
      const existing = selectedUser.centralDeptPermissions.find(p => p.centralDeptId ===
   deptId);
      if (existing) {
        existingPermissions = existing.permissions || {};
        isPrimary = existing.isPrimary;
      }
    } else {
      const existing = selectedUser.schoolDeptPermissions.find(p => p.departmentId ===
   deptId);
      if (existing) {
        existingPermissions = existing.permissions || {};
        isPrimary = existing.isPrimary;
      }
    }

    // Merge with role permissions for this specific department (deduplicated)
    if (selectedRoleIds.length > 0) {
      const deptInRole = departmentsInRole.find(d => d.deptId ===
   deptId && d.type ===
   deptType);
      if (deptInRole && deptInRole.permissions) {
        // Auto-tick permissions from roles for this department
        deptInRole.permissions.forEach(permKey => {
          existingPermissions[permKey] = true;
        });
      }
    }

    setUserPermissions(existingPermissions);
    setIsPrimaryDepartment(isPrimary);
  };

  const handleSaveUserPermissions = async () => {
    if (!selectedUser) {
      toast({ type: 'warning', message: 'No user selected' });
      return;
    }

    // Save permissions for all departments
    const deptEntries = Object.entries(allDepartmentPermissions);
    if (deptEntries.length ===
   0) {
      toast({ type: 'warning', message: 'No departments with permissions' });
      return;
    }

    try {
      // Save each department's permissions (including when all are unchecked)
      let savedCount = 0;
      // Save each department's permissions
      for (const [deptKey, permissions] of deptEntries) {
        const hasPermissions = Object.values(permissions).some(v => v);
        // Split on first underscore only (dept IDs may contain underscores)
        const underscoreIdx = deptKey.indexOf('_');
        const deptType = deptKey.substring(0, underscoreIdx);
        const deptId = deptKey.substring(underscoreIdx + 1);

        if (!hasPermissions) {
          // User unticked all permissions → revoke access for this department
          try {
            if (deptType ===
   'school') {
              await permissionManagementService.revokeSchoolDeptPermissions(selectedUser.id, deptId);
            } else {
              await permissionManagementService.revokeCentralDeptPermissions(selectedUser.id, deptId);
            }
          } catch {
            // Ignore revoke errors (e.g. dept had no permissions anyway)
          }
          continue;
        }
        
        if (deptType ===
   'school') {
          await permissionManagementService.grantSchoolDeptPermissions({
            userId: selectedUser.id,
            departmentId: deptId,
            permissions: permissions,
            isPrimary: false,
          });
        } else {
          const scope = analyticsScope[deptKey] || emptyScope();
          await permissionManagementService.grantCentralDeptPermissions({
            userId: selectedUser.id,
            centralDeptId: deptId,
            permissions: permissions,
            isPrimary: false,
            assignedIprAnalyticsSchoolIds: scope.iprSchools,
            assignedIprAnalyticsDepartmentIds: scope.iprDepts,
            assignedResearchAnalyticsSchoolIds: scope.researchSchools,
            assignedResearchAnalyticsDepartmentIds: scope.researchDepts,
            assignedBookAnalyticsSchoolIds: scope.bookSchools,
            assignedBookAnalyticsDepartmentIds: scope.bookDepts,
            assignedConferenceAnalyticsSchoolIds: scope.conferenceSchools,
            assignedConferenceAnalyticsDepartmentIds: scope.conferenceDepts,
            assignedGrantAnalyticsSchoolIds: scope.grantsSchools,
            assignedGrantAnalyticsDepartmentIds: scope.grantsDepts,
          });
        }
        savedCount++;
      }

      toast({ type: 'success', message: `Permissions saved successfully` });
      setShowUserPermissionModal(false);
      fetchData();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleRevokeUserPermissions = async (
    userId: string,
    deptId: string,
    type: 'school' | 'central'
  ) => {
    const confirmed = await confirmAction(
      'Revoke Permissions',
      'Are you sure you want to revoke all permissions for this department?'
    );
    if (!confirmed) return;

    try {
      if (type ===
   'school') {
        await permissionManagementService.revokeSchoolDeptPermissions(userId, deptId);
      } else {
        await permissionManagementService.revokeCentralDeptPermissions(userId, deptId);
      }
      toast({ type: 'success', message: 'Permissions revoked' });
      fetchData();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  // =====================================
    // HELPER FUNCTIONS
  // ==============================
    const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const groupPermissionsByCategory = (permissions: Permission[]): Record<string, Permission[]> => {
    return permissions.reduce((acc, perm) => {
      const category = perm.category || 'General';
      if (!acc[category]) acc[category] = [];
      acc[category].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  };

  const getPermissionCount = (role: Role): { school: number; central: number; blocks: number } => {
    const schoolCount = Object.values(role.permissions?.schoolDeptPermissions || {}).filter(v => v).length;
    const centralCount = Object.values(role.permissions?.centralDeptPermissions || {}).filter(v => v).length;
    const blockCount = role.permissions?.seminarHallBlockIds?.length || 0;
    return { school: schoolCount, central: centralCount, blocks: blockCount };
  };

  // Get all available permissions for user assignment based on department
  const getAvailablePermissionsForUser = (): Permission[] => {
    if (!permissionDefs) return [];

    if (selectedDepartmentType ===
   'school') {
      return permissionDefs.schoolDepartments || [];
    } else {
      // For central, get permissions based on selected department type
      if (!selectedDepartmentId) return [];
      
      const dept = centralDepts.find(d => d.id ===
   selectedDepartmentId);
      if (!dept || !dept.departmentType) {
        console.warn('Department not found or missing departmentType:', selectedDepartmentId);
        return [];
      }
      
      const deptType = dept.departmentType.toLowerCase();
      const permissions = permissionDefs.centralDepartments[deptType];
      
      if (!permissions) {
        console.warn('No permissions defined for department type:', deptType, 'Available types:', Object.keys(permissionDefs.centralDepartments));
        return [];
      }
      
      return permissions;
    }
  };

  // Get filtered permissions for role modal based on central dept type filter
  const getFilteredCentralPermissions = (): { deptType: string; permissions: Permission[] }[] => {
    if (!permissionDefs?.centralDepartments) return [];

    if (roleCentralDeptFilter ===
   'all') {
      return Object.entries(permissionDefs.centralDepartments).map(([deptType, permissions]) => ({
        deptType,
        permissions,
      }));
    }

    const permissions = permissionDefs.centralDepartments[roleCentralDeptFilter];
    return permissions ? [{ deptType: roleCentralDeptFilter, permissions }] : [];
  };

  const filteredUsers = users.filter(user => {
    if (!userSearchQuery) return true;
    const query = userSearchQuery.toLowerCase();
    return (
      user.uid?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.employeeDetails?.firstName?.toLowerCase().includes(query) ||
      user.employeeDetails?.lastName?.toLowerCase().includes(query) ||
      user.employeeDetails?.displayName?.toLowerCase().includes(query) ||
      user.employeeDetails?.empId?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary-600" />
          User & Role Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Create role templates and assign permissions to users
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab ===
   'users'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <UserCog className="h-4 w-4 inline mr-2" />
            User Permissions
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab ===
   'roles'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Layers className="h-4 w-4 inline mr-2" />
            Role Templates ({roles.length})
          </button>
        </nav>
      </div>

      {/* ============================================
   */}
      {/* USER PERMISSIONS TAB */}
      {/* ============================================
   */}
      {activeTab ===
   'users' && (
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name, email, employee ID..."
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="text-sm text-gray-500">
                {filteredUsers.length} of {users.length} users
              </div>
            </div>
          </div>

          {/* User List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Role / Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Assigned Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Current Permissions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map(user => {
                  const totalSchoolPerms = user.schoolDeptPermissions?.length || 0;
                  const totalCentralPerms = user.centralDeptPermissions?.length || 0;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {user.employeeDetails?.displayName || user.employeeDetails?.firstName || user.uid}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {user.email || user.uid}
                            </div>
                            {user.employeeDetails?.empId && (
                              <div className="text-xs text-gray-400">
                                ID: {user.employeeDetails.empId}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          (typeof (user.role as any) ===
   'object' ? (user.role as any)?.name : user.role) ===
   'admin' 
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            : (typeof (user.role as any) ===
   'object' ? (user.role as any)?.name : user.role) ===
   'faculty'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {typeof (user.role as any) ===
   'object' ? (user.role as any)?.name : user.role}
                        </span>
                        {user.employeeDetails?.designation && (
                          <div className="text-xs text-gray-500 mt-1">
                            {user.employeeDetails.designation}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {user.assignedRoleIds && user.assignedRoleIds.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.assignedRoleIds.slice(0, 2).map((roleId: string) => {
                                const role = roles.find(r => r.id ===
   roleId);
                                return role ? (
                                  <span key={roleId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded text-xs">
                                    <Shield className="h-3 w-3" />
                                    {role.name}
                                  </span>
                                ) : null;
                              })}
                              {user.assignedRoleIds.length > 2 && (
                                <span className="text-xs text-gray-500">+{user.assignedRoleIds.length - 2} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">No roles assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">                   <div className="flex flex-wrap gap-2">                        {totalCentralPerms > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded text-xs">
                              <Building2 className="h-3 w-3" />
                              {totalCentralPerms} Central
                            </span>
                          )}
                          {totalSchoolPerms > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs">
                              <Briefcase className="h-3 w-3" />
                              {totalSchoolPerms} School
                            </span>
                          )}
                          {totalCentralPerms ===
   0 && totalSchoolPerms ===
   0 && (
                            <span className="text-xs text-gray-400">No permissions</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openRoleAssignmentModal(user)}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm flex items-center gap-1"
                          >
                            <Shield className="h-4 w-4" />
                            Assign Roles
                          </button>
                          <button
                            onClick={() => openUserPermissionModal(user)}
                            className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm flex items-center gap-1"
                          >
                            <Settings className="h-4 w-4" />
                            Manage
                          </button>
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

      {/* ============================================
   */}
      {/* ROLE TEMPLATES TAB */}
      {/* ============================================
   */}
      {activeTab ===
   'roles' && (
        <div className="space-y-6">
          {/* Create Role Button */}
          <div className="flex justify-end">
            <button
              onClick={() => openRoleModal()}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="h-5 w-5" />
              Create Role Template
            </button>
          </div>

          {/* Role Cards */}
          {roles.length ===
   0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <Layers className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Role Templates</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create role templates to quickly assign permissions to users.
              </p>
              <button
                onClick={() => openRoleModal()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="h-5 w-5" />
                Create First Role
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roles.map(role => {
                const permCount = getPermissionCount(role);
                return (
                  <div
                    key={role.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${role.isActive ? 'bg-primary-100 dark:bg-primary-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
                            <Shield className={`h-5 w-5 ${role.isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{role.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              role.isActive 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {role.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDuplicateRole(role)}
                            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openRoleModal(role)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRole(role)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {role.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                          {role.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <Users className="h-4 w-4" />
                        <span>
                          {role.requiresDepartmentAssignment 
                            ? 'Requires department' 
                            : 'University-wide'}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Permissions:</span>
                          <div className="flex items-center gap-3">
                            {permCount.central > 0 && (
                              <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                                <Building2 className="h-4 w-4" />
                                {permCount.central}
                              </span>
                            )}
                            {permCount.school > 0 && (
                              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <Briefcase className="h-4 w-4" />
                                {permCount.school}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================
   */}
      {/* USER PERMISSION MODAL - FULL WIDTH */}
      {/* ============================================
   */}
      {showUserPermissionModal && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-start justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowUserPermissionModal(false)} />

            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl my-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-t-xl">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Manage Permissions
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedUser.employeeDetails?.displayName || selectedUser.uid} • {selectedUser.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUserPermissionModal(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-white/50"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Modal Body - Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Left Column - Configuration */}
                <div className="lg:col-span-1 space-y-4">
                  {/* Step 1: Role Templates - Dropdown with Checkboxes */}
                  <div className="bg-white dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Select Role Templates</h4>
                    </div>
                    
                    <details className="group" open={selectedRoleIds.length > 0}>
                      <summary className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {selectedRoleIds.length > 0 
                            ? `${selectedRoleIds.length} role(s) selected` 
                            : 'Click to select roles'}
                        </span>
                        <ChevronDown className="h-4 w-4 text-gray-500 group-open:rotate-180 transition-transform" />
                      </summary>
                      
                      <div className="mt-2 space-y-1 max-h-64 overflow-y-auto pr-1">
                        {roles.map(role => {
                          const permCount = getPermissionCount(role);
                          const totalPerms = permCount.central + permCount.school + permCount.blocks;
                          const isSelected = selectedRoleIds.includes(role.id);
                          
                          return (
                            <label
                              key={role.id}
                              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => handleRoleSelection(role.id, e.target.checked)}
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-xs text-gray-900 dark:text-white truncate">
                                  {role.name}
                                </div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {role.departmentType} • {totalPerms} perms
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </details>
                    
                    {selectedRoleIds.length > 0 && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-center">
                        <p className="text-[10px] text-green-700 dark:text-green-300 flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Permissions merged below
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Department Selection */}
                  <div className="bg-white dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Select Department Type & Department</h4>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Department Type Selection - Checkbox Style */}
                      <div className="grid grid-cols-2 gap-2">
                        <label
                          className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all border-2 ${
                            showCentralDepts
                              ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-400 dark:border-purple-600'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={showCentralDepts}
                            onChange={e => setShowCentralDepts(e.target.checked)}
                            className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-purple-600" />
                            <span className="text-xs font-medium text-gray-900 dark:text-white">Central</span>
                          </div>
                        </label>
                        <label
                          className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all border-2 ${
                            showSchoolDepts
                              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={showSchoolDepts}
                            onChange={e => setShowSchoolDepts(e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-1.5">
                            <Briefcase className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-medium text-gray-900 dark:text-white">School</span>
                          </div>
                        </label>
                      </div>

                      {/* Central Department Type Filter */}
                      {showCentralDepts && centralDeptTypes.length > 1 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                            Filter by Central Dept Type
                          </label>
                          <select
                            value={userCentralDeptFilter}
                            onChange={e => setUserCentralDeptFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="all">All Central Dept Types</option>
                            {centralDeptTypes.map(type => (
                              <option key={type} value={type}>
                                {type.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* All Central Departments with Auto-ticked Checkboxes */}
                      {showCentralDepts && (
                        <details className="group" open>
                          <summary className="flex items-center justify-between p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-purple-600" />
                              <span className="text-xs font-medium text-purple-900 dark:text-purple-200">
                                Central Departments ({centralDepts.filter(d => userCentralDeptFilter ===
   'all' || d.departmentType ===
   userCentralDeptFilter).length})
                                {departmentsInRole.filter(d => d.type ===
   'central').length > 0 && (
                                  <span className="ml-1 text-[10px] text-purple-600">
                                    ({departmentsInRole.filter(d => d.type ===
   'central' && (userCentralDeptFilter ===
   'all' || centralDepts.find(cd => cd.id ===
   d.deptId)?.departmentType ===
   userCentralDeptFilter)).length} from roles)
                                  </span>
                                )}
                              </span>
                            </div>
                            <ChevronDown className="h-4 w-4 text-purple-600 group-open:rotate-180 transition-transform" />
                          </summary>
                          <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            {centralDepts
                              .filter(dept => userCentralDeptFilter ===
   'all' || dept.departmentType ===
   userCentralDeptFilter)
                              .map(dept => {
                                const deptInRole = departmentsInRole.find(d => d.deptId ===
   dept.id && d.type ===
   'central');
                                const isSelected = selectedDepartmentId ===
   dept.id;
                                
                                return (
                                  <label
                                    key={dept.id}
                                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-purple-100 dark:bg-purple-900/40 border-2 border-purple-400 dark:border-purple-600'
                                        : deptInRole
                                        ? 'bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                                        : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setSelectedDepartmentType('central');
                                          setSelectedDepartmentId(dept.id);
                                          loadExistingUserPermissions('central', dept.id);
                                        } else {
                                          setSelectedDepartmentId('');
                                        }
                                      }}
                                      className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-xs text-gray-900 dark:text-white truncate">
                                        {dept.departmentName}
                                      </div>
                                      {deptInRole ? (
                                        <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400">
                                          <CheckCircle2 className="h-3 w-3" />
                                          {deptInRole.permCount} permission{deptInRole.permCount !== 1 ? 's' : ''} from roles
                                        </div>
                                      ) : (
                                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                          No role permissions
                                        </div>
                                      )}
                                    </div>
                                  </label>
                                );
                              })}
                          </div>
                        </details>
                      )}

                      {/* All School Departments with School/Department Selector */}
                      {showSchoolDepts && (
                        <details className="group" open>
                          <summary className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-blue-600" />
                              <span className="text-xs font-medium text-blue-900 dark:text-blue-200">
                                School Departments ({departments.length})
                                {departmentsInRole.filter(d => d.type ===
   'school').length > 0 && (
                                  <span className="ml-1 text-[10px] text-blue-600">
                                    ({departmentsInRole.filter(d => d.type ===
   'school').length} from roles)
                                  </span>
                                )}
                              </span>
                            </div>
                            <ChevronDown className="h-4 w-4 text-blue-600 group-open:rotate-180 transition-transform" />
                          </summary>
                          
                          {/* School and Department Selector */}
                          <div className="mt-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700 rounded-lg">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Select School (Faculty) <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={userSelectedSchoolId}
                                  onChange={e => {
                                    setUserSelectedSchoolId(e.target.value);
                                    setUserSelectedDepartmentId(''); // Reset department
                                    setSelectedDepartmentId(''); // Clear selection
                                  }}
                                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                >
                                  <option value="">-- Select School --</option>
                                  {schools.map(school => (
                                    <option key={school.id} value={school.id}>
                                      {school.facultyName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Select Department <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={userSelectedDepartmentId}
                                  onChange={e => {
                                    const deptId = e.target.value;
                                    setUserSelectedDepartmentId(deptId);
                                    if (deptId) {
                                      setSelectedDepartmentType('school');
                                      setSelectedDepartmentId(deptId);
                                      loadExistingUserPermissions('school', deptId);
                                    } else {
                                      setSelectedDepartmentId('');
                                    }
                                  }}
                                  disabled={!userSelectedSchoolId}
                                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <option value="">-- Select Department --</option>
                                  {userFilteredDepartmentsBySchool.map(dept => (
                                    <option key={dept.id} value={dept.id}>
                                      {dept.departmentName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            {!userSelectedSchoolId && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                Please select a school to view its departments
                              </p>
                            )}
                            {userSelectedSchoolId && !userSelectedDepartmentId && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                Please select a department to manage permissions
                              </p>
                            )}
                            {userSelectedSchoolId && userSelectedDepartmentId && (
                              <div className="flex items-center gap-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-300 dark:border-blue-600">
                                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <div className="text-xs">
                                  <span className="font-medium text-blue-900 dark:text-blue-200">
                                    {schools.find(s => s.id ===
   userSelectedSchoolId)?.facultyName}
                                  </span>
                                  <span className="text-blue-700 dark:text-blue-300"> / </span>
                                  <span className="font-medium text-blue-900 dark:text-blue-200">
                                    {userFilteredDepartmentsBySchool.find(d => d.id ===
   userSelectedDepartmentId)?.departmentName}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </details>
                      )}

                      {selectedDepartmentId && (
                        <label className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg cursor-pointer border border-green-200 dark:border-green-800">
                          <input
                            type="checkbox"
                            checked={isPrimaryDepartment}
                            onChange={e => setIsPrimaryDepartment(e.target.checked)}
                            className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="text-xs text-green-800 dark:text-green-200 font-medium">Set as Primary Department</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Existing Department Access - Collapsible */}
                  <details className="bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                    <summary className="p-3 font-medium text-gray-900 dark:text-white text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors flex items-center justify-between">
                      <span>Existing Department Access</span>
                      <span className="text-xs text-gray-500">
                        {selectedUser.centralDeptPermissions.length + selectedUser.schoolDeptPermissions.length} dept(s)
                      </span>
                    </summary>
                    <div className="px-3 pb-3 space-y-1 max-h-40 overflow-y-auto">
                      {selectedUser.centralDeptPermissions.map(perm => (
                        <div key={perm.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Building2 className="h-3 w-3 text-purple-600 flex-shrink-0" />
                            <span className="truncate">{perm.centralDept?.departmentName}</span>
                            {perm.isPrimary && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded text-[10px] font-medium">Primary</span>}
                          </div>
                          <button
                            onClick={() => handleRevokeUserPermissions(selectedUser.id, perm.centralDeptId, 'central')}
                            className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Revoke access"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {selectedUser.schoolDeptPermissions.map(perm => (
                        <div key={perm.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Briefcase className="h-3 w-3 text-blue-600 flex-shrink-0" />
                            <span className="truncate">{perm.department?.departmentName}</span>
                            {perm.isPrimary && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded text-[10px] font-medium">Primary</span>}
                          </div>
                          <button
                            onClick={() => handleRevokeUserPermissions(selectedUser.id, perm.departmentId, 'school')}
                            className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Revoke access"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {selectedUser.centralDeptPermissions.length ===
   0 && selectedUser.schoolDeptPermissions.length ===
   0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">No existing access</p>
                      )}
                    </div>
                  </details>
                </div>

                {/* Right Column - Permissions Selection */}
                <div className="lg:col-span-2">
                  <div className="bg-white dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600 h-full">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Permissions by Department</h3>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            ({Object.values(allDepartmentPermissions).reduce((sum, perms) => 
                              sum + Object.values(perms).filter(v => v).length, 0
                            )} total selected)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={permissionDeptFilter}
                            onChange={e => setPermissionDeptFilter(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="all">All Departments</option>
                            {showCentralDepts && centralDepts
                              .filter(d => userCentralDeptFilter ===
   'all' || d.departmentType ===
   userCentralDeptFilter)
                              .map(dept => (
                                <option key={dept.id} value={`central_${dept.id}`}>{dept.departmentName}</option>
                              ))}
                            {showSchoolDepts && schools.flatMap(school =>
                              school.departments?.map(dept => (
                                <option key={dept.id} value={`school_${dept.id}`}>{school.facultyName} - {dept.departmentName}</option>
                              )) || []
                            )}
                          </select>
                        </div>
                      </div>
                    </div>

                    {Object.keys(allDepartmentPermissions).length ===
   0 && !showCentralDepts && !showSchoolDepts ? (
                      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                        <Shield className="h-16 w-16 mb-4 opacity-30" />
                        <p>Select department type (Central/School) to view permissions</p>
                      </div>
                    ) : (
                      <div className="p-4 max-h-[600px] overflow-y-auto space-y-4">
                        {/* Show ALL Central Departments */}
                        {showCentralDepts && centralDepts
                          .filter(dept => {
                            if (userCentralDeptFilter !== 'all' && dept.departmentType !== userCentralDeptFilter) return false;
                            if (permissionDeptFilter !== 'all' && permissionDeptFilter !== `central_${dept.id}`) return false;
                            return true;
                          })
                          .map(dept => {
                          const deptKey = `central_${dept.id}`;
                          const deptPerms = allDepartmentPermissions[deptKey] || {};
                          const hasDeptInState = Object.prototype.hasOwnProperty.call(allDepartmentPermissions, deptKey);
                          
                          // Get existing user permissions for this department
                          const existingPerm = selectedUser?.centralDeptPermissions.find(p => p.centralDeptId ===
   dept.id);
                          const mergedPerms = { ...deptPerms };
                          if (existingPerm && !hasDeptInState) {
                            // Only use DB values as display fallback if user hasn't touched this dept yet
                            Object.keys(existingPerm.permissions || {}).forEach(key => {
                              if (existingPerm.permissions?.[key]) {
                                mergedPerms[key] = true;
                              }
                            });
                          } else if (existingPerm && hasDeptInState) {
                            // User has explicitly changed this dept — only fill in keys NOT yet in state
                            Object.keys(existingPerm.permissions || {}).forEach(key => {
                              if (!(key in deptPerms) && existingPerm.permissions?.[key]) {
                                mergedPerms[key] = true;
                              }
                            });
                          }

                          // Get available permissions for this department type
                          const availablePerms: Permission[] = dept.departmentType && permissionDefs?.centralDepartments 
                            ? permissionDefs.centralDepartments[dept.departmentType] || []
                            : [];

                          if (availablePerms.length ===
   0) return null;

                          const selectedCount = Object.values(mergedPerms).filter(v => v).length;
                          const fromRole = departmentsInRole.find(d => d.deptId ===
   dept.id && d.type ===
   'central');

                          return (
                            <div key={deptKey} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                              {/* Department Header */}
                              <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-purple-600" />
                                    <span className="font-semibold text-sm text-purple-900 dark:text-purple-200">
                                      {dept.departmentName}
                                    </span>
                                    {fromRole && (
                                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-[10px] font-medium">
                                        From roles
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-xs font-medium ${
                                    selectedCount > 0 ? 'text-green-600' : 'text-gray-500'
                                  }`}>
                                    {selectedCount}/{availablePerms.length} selected
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updates: Record<string, boolean> = {};
                                      availablePerms.forEach(p => updates[p.key] = true);
                                      setAllDepartmentPermissions(prev => ({
                                        ...prev,
                                        [deptKey]: { ...prev[deptKey], ...updates },
                                      }));
                                    }}
                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors"
                                  >
                                    Select All
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updates: Record<string, boolean> = {};
                                      availablePerms.forEach(p => updates[p.key] = false);
                                      setAllDepartmentPermissions(prev => ({
                                        ...prev,
                                        [deptKey]: { ...prev[deptKey], ...updates },
                                      }));
                                    }}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                                  >
                                    Remove All
                                  </button>
                                </div>
                              </div>

                              {/* Permissions Grid */}
                              <div className="p-4">
                                {Object.entries(groupPermissionsByCategory(availablePerms)).map(
                                  ([category, perms]) => {
                                    const categoryKey = `dept-${deptKey}-${category}`;
                                    const isExpanded = expandedCategories[categoryKey] !== false;
                                    const catSelectedCount = perms.filter(p => mergedPerms[p.key]).length;

                                    return (
                                      <div key={categoryKey} className="mb-3 last:mb-0 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                                        <button
                                          type="button"
                                          onClick={() => toggleCategory(categoryKey)}
                                          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                          <span className="font-medium text-xs text-gray-900 dark:text-white">
                                            {category}
                                            <span className={`ml-2 text-sm ${catSelectedCount > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                              ({catSelectedCount}/{perms.length})
                                            </span>
                                          </span>
                                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </button>

                                        {isExpanded && (
                                          <>
                                          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {perms.map(perm => {
                                              const isChecked = allDepartmentPermissions[deptKey]?.[perm.key] ?? mergedPerms[perm.key] ?? false;
                                              return (
                                              <label
                                                key={perm.key}
                                                className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                                                  isChecked
                                                    ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700'
                                                    : 'bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => {
                                                    setAllDepartmentPermissions(prev => ({
                                                      ...prev,
                                                      [deptKey]: {
                                                        ...prev[deptKey],
                                                        [perm.key]: !isChecked,
                                                      },
                                                    }));
                                                  }}
                                                  className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500 mt-0.5 flex-shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <div className="font-medium text-gray-900 dark:text-white break-words">
                                                    {perm.label}
                                                  </div>
                                                  {perm.description && (
                                                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 break-words">
                                                      {perm.description}
                                                    </div>
                                                  )}
                                                </div>
                                              </label>
                                              );
                                            })}
                                          </div>

                                          {/* DRD Analytics Scope — Compact Dropdowns */}
                                          {category ===
   'DRD Analytics' && (() => {
                                            const scope = analyticsScope[deptKey] || emptyScope();
                                            const applicantEnabled = !!(allDepartmentPermissions[deptKey]?.applicant_analytics ?? mergedPerms.applicant_analytics);
                                            if (!applicantEnabled) return null;
                                            return (
                                              <div className="px-3 pb-3">
                                                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 p-3">
                                                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-3">
                                                    Applicant Analytics — Scope per Category
                                                  </p>
                                                  <div className="space-y-2">
                                                    {DRD_ANALYTICS_CATEGORIES_MODAL.map(cat => {
                                                      const catSchools = scope[cat.schoolsField] as string[];
                                                      const catDepts = scope[cat.deptsField] as string[];
                                                      return (
                                                        <div key={cat.id} className="rounded-lg border border-blue-100 dark:border-blue-700 bg-white dark:bg-gray-800 p-2.5">
                                                          <p className="text-[11px] font-semibold text-gray-800 dark:text-white mb-1.5">{cat.label}</p>
                                                          <div className="grid grid-cols-2 gap-2">
                                                            {/* School multi-select */}
                                                            <div>
                                                              <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 block">Schools</label>
                                                              <ScopeCheckboxList
                                                                options={schools.map(s => ({
                                                                  id: s.id,
                                                                  label: s.facultyCode || s.facultyName,
                                                                }))}
                                                                selectedIds={catSchools}
                                                                onToggle={(id) => toggleScopeItem(deptKey, cat.schoolsField, id)}
                                                              />
                                                              {catSchools.length > 0 && (
                                                                <span className="text-[9px] text-blue-600 dark:text-blue-400">{catSchools.length} selected</span>
                                                              )}
                                                            </div>
                                                            {/* Department multi-select */}
                                                            <div>
                                                              <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 block">Departments</label>
                                                              <ScopeCheckboxGroupList
                                                                groups={schools.map(s => ({
                                                                  id: s.id,
                                                                  label: s.facultyCode || s.facultyName,
                                                                  options: departments
                                                                    .filter(d => d.facultyId === s.id)
                                                                    .map(d => ({ id: d.id, label: d.departmentName })),
                                                                }))}
                                                                selectedIds={catDepts}
                                                                onToggle={(id) => toggleScopeItem(deptKey, cat.deptsField, id)}
                                                              />
                                                              {catDepts.length > 0 && (
                                                                <span className="text-[9px] text-blue-600 dark:text-blue-400">{catDepts.length} selected</span>
                                                              )}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                  <p className="text-[9px] text-gray-400 mt-2 italic">Use the checkboxes to select multiple. Leave empty = all access.</p>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                          </>
                                        )}
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Show ALL School Departments */}
                        {showSchoolDepts && schools.flatMap(school =>
                          school.departments?.filter(dept => {
                            if (permissionDeptFilter !== 'all' && permissionDeptFilter !== `school_${dept.id}`) return false;
                            return true;
                          }).map(dept => {
                            const deptKey = `school_${dept.id}`;
                            const deptPerms = allDepartmentPermissions[deptKey] || {};
                            const hasDeptInState = Object.prototype.hasOwnProperty.call(allDepartmentPermissions, deptKey);
                            
                            // Get existing user permissions for this department
                            const existingPerm = selectedUser?.schoolDeptPermissions.find(p => p.departmentId ===
   dept.id);
                            const mergedPerms = { ...deptPerms };
                            if (existingPerm && !hasDeptInState) {
                              // Only use DB values as display fallback if user hasn't touched this dept yet
                              Object.keys(existingPerm.permissions || {}).forEach(key => {
                                if (existingPerm.permissions?.[key]) {
                                  mergedPerms[key] = true;
                                }
                              });
                            } else if (existingPerm && hasDeptInState) {
                              // User has explicitly changed this dept — only fill in keys NOT yet in state
                              Object.keys(existingPerm.permissions || {}).forEach(key => {
                                if (!(key in deptPerms) && existingPerm.permissions?.[key]) {
                                  mergedPerms[key] = true;
                                }
                              });
                            }

                            const availablePerms: Permission[] = permissionDefs?.schoolDepartments || [];

                            if (availablePerms.length ===
   0) return null;

                            const selectedCount = Object.values(mergedPerms).filter(v => v).length;
                            const fromRole = departmentsInRole.find(d => d.deptId ===
   dept.id && d.type ===
   'school');

                            return (
                              <div key={deptKey} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                                {/* Department Header */}
                                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Briefcase className="h-5 w-5 text-blue-600" />
                                      <span className="font-semibold text-sm text-blue-900 dark:text-blue-200">
                                        {school.facultyName} - {dept.departmentName}
                                      </span>
                                      {fromRole && (
                                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-[10px] font-medium">
                                          From roles
                                        </span>
                                      )}
                                    </div>
                                    <span className={`text-xs font-medium ${
                                      selectedCount > 0 ? 'text-green-600' : 'text-gray-500'
                                    }`}>
                                      {selectedCount}/{availablePerms.length} selected
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updates: Record<string, boolean> = {};
                                        availablePerms.forEach(p => updates[p.key] = true);
                                        setAllDepartmentPermissions(prev => ({
                                          ...prev,
                                          [deptKey]: { ...prev[deptKey], ...updates },
                                        }));
                                      }}
                                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors"
                                    >
                                      Select All
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updates: Record<string, boolean> = {};
                                        availablePerms.forEach(p => updates[p.key] = false);
                                        setAllDepartmentPermissions(prev => ({
                                          ...prev,
                                          [deptKey]: { ...prev[deptKey], ...updates },
                                        }));
                                      }}
                                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                                    >
                                      Remove All
                                    </button>
                                  </div>
                                </div>

                                {/* Permissions Grid */}
                                <div className="p-4">
                                  {Object.entries(groupPermissionsByCategory(availablePerms)).map(
                                    ([category, perms]) => {
                                      const categoryKey = `dept-${deptKey}-${category}`;
                                      const isExpanded = expandedCategories[categoryKey] !== false;
                                      const catSelectedCount = perms.filter(p => mergedPerms[p.key]).length;

                                      return (
                                        <div key={categoryKey} className="mb-3 last:mb-0 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                                          <button
                                            type="button"
                                            onClick={() => toggleCategory(categoryKey)}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                                          >
                                            <span className="font-medium text-xs text-gray-900 dark:text-white">
                                              {category}
                                              <span className={`ml-2 text-sm ${catSelectedCount > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                                ({catSelectedCount}/{perms.length})
                                              </span>
                                            </span>
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                          </button>

                                          {isExpanded && (
                                            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                              {perms.map(perm => {
                                                const isChecked = allDepartmentPermissions[deptKey]?.[perm.key] ?? mergedPerms[perm.key] ?? false;
                                                return (
                                                <label
                                                  key={perm.key}
                                                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                                                    isChecked
                                                      ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700'
                                                      : 'bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                  }`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                      setAllDepartmentPermissions(prev => ({
                                                        ...prev,
                                                        [deptKey]: {
                                                          ...prev[deptKey],
                                                          [perm.key]: !isChecked,
                                                        },
                                                      }));
                                                    }}
                                                    className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500 mt-0.5 flex-shrink-0"
                                                  />
                                                  <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-gray-900 dark:text-white break-words">
                                                      {perm.label}
                                                    </div>
                                                    {perm.description && (
                                                      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 break-words">
                                                        {perm.description}
                                                      </div>
                                                    )}
                                                  </div>
                                                </label>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            );
                          }) || []
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                <button
                  onClick={() => setShowUserPermissionModal(false)}
                  className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUserPermissions}
                  disabled={Object.keys(allDepartmentPermissions).length ===
   0}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                >
                  <Check className="h-5 w-5" />
                  Save Permissions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
   */}
      {/* ROLE TEMPLATE MODAL - LARGER WITH DEPT FILTER */}
      {/* ============================================
   */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-start justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowRoleModal(false)} />

            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl my-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-600 rounded-lg">
                    <Layers className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {editingRole ? 'Edit Role Template' : 'Create Role Template'}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Define a reusable permission template</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-white/50"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSaveRole}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {/* Left Column - Basic Info */}
                  <div className="lg:col-span-1 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Role Code *
                      </label>
                      <input
                        type="text"
                        value={roleFormData.roleCode}
                        onChange={e => setRoleFormData(prev => ({ ...prev, roleCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-mono"
                        placeholder="e.g., DEAN, HOD, DRD-MEMBER"
                        pattern="[A-Z0-9_-]+"
                        maxLength={32}
                        required
                        disabled={editingRole !== null}
                        title="Role code can only contain uppercase letters, numbers, hyphens, and underscores"
                      />
                      {editingRole && (
                        <p className="text-xs text-gray-500 mt-1">Role code cannot be changed after creation</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Role Name *
                      </label>
                      <input
                        type="text"
                        value={roleFormData.name}
                        onChange={e => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        placeholder="e.g., Dean, HOD, DRD Member"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Applicable For
                      </label>
                      <select
                        value={roleFormData.departmentType}
                        onChange={e => setRoleFormData(prev => ({ ...prev, departmentType: e.target.value as RoleDepartmentType }))}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      >
                        <option value="BOTH">All Departments</option>
                        <option value="SCHOOL">School Departments Only</option>
                        <option value="CENTRAL">Central Departments Only</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <textarea
                        value={roleFormData.description}
                        onChange={e => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        placeholder="Describe the purpose of this role..."
                      />
                    </div>

                    {/* University-wide Checkbox */}
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!roleFormData.requiresDepartmentAssignment}
                          onChange={e => setRoleFormData(prev => ({ ...prev, requiresDepartmentAssignment: !e.target.checked }))}
                          className="mt-0.5 h-5 w-5 text-amber-600 border-gray-300 rounded"
                        />
                        <div>
                          <span className="font-medium text-amber-800 dark:text-amber-200">University-wide role</span>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Users don&apos;t need department assignment (e.g., VC, Pro-VC)
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Permission Summary */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Permission Summary</h4>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-purple-600" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {Object.values(roleCentralPermissions).filter(v => v).length} Central
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-blue-600" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {Object.values(roleSchoolPermissions).filter(v => v).length} School
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {roleSeminarHallBlockIds.length} Block
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Right Column - Permission Selection */}
                  <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600 h-full">
                      {/* Permission Type Tabs with Filter */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setRolePermissionTab('central')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              rolePermissionTab ===
   'central'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <Building2 className="h-4 w-4 inline mr-2" />
                            Central
                          </button>
                          <button
                            type="button"
                            onClick={() => setRolePermissionTab('school')}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              rolePermissionTab ===
   'school'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <Briefcase className="h-4 w-4 inline mr-2" />
                            School
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Select All / Remove All buttons */}
                          <button
                            type="button"
                            onClick={() => {
                              if (rolePermissionTab ===
   'central' && permissionDefs?.centralDepartments) {
                                const allPerms: Record<string, boolean> = {};
                                getFilteredCentralPermissions().forEach(({ permissions }) => {
                                  permissions.forEach(perm => {
                                    allPerms[perm.key] = true;
                                  });
                                });
                                setRoleCentralPermissions(allPerms);
                              } else if (permissionDefs?.schoolDepartments) {
                                const allPerms: Record<string, boolean> = {};
                                permissionDefs.schoolDepartments.forEach(perm => {
                                  allPerms[perm.key] = true;
                                });
                                setRoleSchoolPermissions(allPerms);
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg transition-colors"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (rolePermissionTab ===
   'central') {
                                setRoleCentralPermissions({});
                              } else {
                                setRoleSchoolPermissions({});
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg transition-colors"
                          >
                            Remove All
                          </button>

                          {/* Department Type Filter (for Central) */}
                          {rolePermissionTab ===
   'central' && centralDeptTypes.length > 1 && (
                            <>
                              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
                              <Filter className="h-4 w-4 text-gray-500" />
                              <select
                                value={roleCentralDeptFilter}
                                onChange={e => setRoleCentralDeptFilter(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                              >
                                <option value="all">All Dept Types</option>
                                {centralDeptTypes.map(type => (
                                  <option key={type} value={type}>
                                    {type.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </>
                          )}

                          {/* Category Filter (for School) */}
                          {rolePermissionTab ===
   'school' && permissionDefs?.schoolDepartments && (
                            <>
                              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
                              <Filter className="h-4 w-4 text-gray-500" />
                              <select
                                value={roleSchoolCategoryFilter}
                                onChange={e => setRoleSchoolCategoryFilter(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                              >
                                <option value="all">All Categories</option>
                                {Array.from(new Set(permissionDefs.schoolDepartments.map(p => p.category))).map(category => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>
                      </div>

                      {/* School and Department Selector (for School tab) */}
                      {rolePermissionTab ===
   'school' && (
                        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/10 border-b border-gray-200 dark:border-gray-600">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Select School (Faculty) <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={roleSelectedSchoolId}
                                onChange={e => {
                                  setRoleSelectedSchoolId(e.target.value);
                                  setRoleSelectedDepartmentId(''); // Reset department when school changes
                                }}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                              >
                                <option value="">-- Select School --</option>
                                {schools.map(school => (
                                  <option key={school.id} value={school.id}>
                                    {school.facultyName}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Select Department <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={roleSelectedDepartmentId}
                                onChange={e => setRoleSelectedDepartmentId(e.target.value)}
                                disabled={!roleSelectedSchoolId}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <option value="">-- Select Department --</option>
                                {filteredDepartmentsBySchool.map(dept => (
                                  <option key={dept.id} value={dept.id}>
                                    {dept.departmentName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {!roleSelectedSchoolId && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                              Please select a school to view departments and their permissions
                            </p>
                          )}
                          {roleSelectedSchoolId && !roleSelectedDepartmentId && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                              Please select a department to view its specific permissions
                            </p>
                          )}
                        </div>
                      )}

                      {/* Permission Categories */}
                      <div className="p-4 max-h-[450px] overflow-y-auto space-y-4">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-900/10 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Seminar Hall Block Access</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Assign the blocks this role can manage.</p>
                            </div>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                              {roleSeminarHallBlockIds.length > 0 ? `${roleSeminarHallBlockIds.length} selected` : 'No blocks selected'}
                            </span>
                          </div>

                          {seminarHallBlocks.length > 0 ? (
                            <div className="mt-3 grid grid-cols-1 gap-2 pr-1 sm:grid-cols-2 xl:grid-cols-3">
                              {seminarHallBlocks.map((block) => {
                                const isSelected = roleSeminarHallBlockIds.includes(block.id);
                                return (
                                  <label
                                    key={block.id}
                                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                      isSelected
                                        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
                                        : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800/60'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const nextIds = e.target.checked
                                          ? [...roleSeminarHallBlockIds, block.id]
                                          : roleSeminarHallBlockIds.filter((blockId) => blockId !== block.id);
                                        setRoleSeminarHallBlockIds(nextIds);
                                      }}
                                      className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white">{block.name}</p>
                                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{block.blockNumber || block.id}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="mt-3 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
                              No seminar hall blocks available.
                            </div>
                          )}
                        </div>

                        {rolePermissionTab ===
   'central' && permissionDefs?.centralDepartments && (
                          <div className="space-y-3">
                            {getFilteredCentralPermissions().map(({ deptType, permissions }) => {
                              const grouped = groupPermissionsByCategory(permissions);
                              return (
                                <div key={deptType} className="mb-4">
                                  {roleCentralDeptFilter ===
   'all' && (
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-600">
                                      <Building2 className="h-4 w-4 text-purple-600" />
                                      <h4 className="font-semibold text-purple-700 dark:text-purple-300 uppercase text-sm">
                                        {deptType} Department Permissions
                                      </h4>
                                    </div>
                                  )}
                                  {Object.entries(grouped).map(([category, perms]) => {
                                    const categoryKey = `role-central-${deptType}-${category}`;
                                    const isExpanded = expandedCategories[categoryKey] !== false;
                                    const selectedCount = perms.filter(p => roleCentralPermissions[p.key]).length;

                                    return (
                                      <div key={categoryKey} className="mb-2 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                                        <button
                                          type="button"
                                          onClick={() => toggleCategory(categoryKey)}
                                          className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                          <span className="font-medium text-gray-900 dark:text-white text-sm">
                                            {category}
                                            <span className={`ml-2 ${selectedCount > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                              ({selectedCount}/{perms.length})
                                            </span>
                                          </span>
                                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </button>
                                        {isExpanded && (
                                          <>
                                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-600">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updates: Record<string, boolean> = {};
                                                  perms.forEach(p => updates[p.key] = true);
                                                  setRoleCentralPermissions(prev => ({ ...prev, ...updates }));
                                                }}
                                                className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800 rounded transition-colors"
                                              >
                                                Select All
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updates: Record<string, boolean> = {};
                                                  perms.forEach(p => updates[p.key] = false);
                                                  setRoleCentralPermissions(prev => ({ ...prev, ...updates }));
                                                }}
                                                className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded transition-colors"
                                              >
                                                Remove All
                                              </button>
                                            </div>
                                            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 bg-white dark:bg-gray-800">
                                            {perms.map(perm => (
                                              <label 
                                                key={perm.key} 
                                                className={`flex items-center gap-2 p-2 text-sm cursor-pointer rounded-lg transition-colors ${
                                                  roleCentralPermissions[perm.key]
                                                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={roleCentralPermissions[perm.key] || false}
                                                  onChange={() => setRoleCentralPermissions(prev => ({ ...prev, [perm.key]: !prev[perm.key] }))}
                                                  className="h-4 w-4 text-green-600 border-gray-300 rounded"
                                                />
                                                <span className="text-gray-900 dark:text-white">{perm.label}</span>
                                              </label>
                                            ))}
                                          </div>

                                          {/* Analytics Scope — Compact Dropdowns for DRD Analytics */}
                                          {category ===
   'DRD Analytics' && (() => {
                                            const applicantOn = roleCentralPermissions['applicant_analytics'];
                                            if (!applicantOn) return null;

                                            const ROLE_CAT_LIST: Array<{ id: keyof RoleAnalyticsScope; label: string }> = [
                                              { id: 'ipr', label: 'IPR / Patent' },
                                              { id: 'research', label: 'Research Paper' },
                                              { id: 'book', label: 'Book / Chapter' },
                                              { id: 'conference', label: 'Conference Paper' },
                                              { id: 'grants', label: 'Grant / Funding' },
                                            ];

                                            return (
                                              <div className="px-4 pb-3 border-t border-gray-200 dark:border-gray-600 mt-1 pt-3">
                                                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 p-3">
                                                  <p className="text-xs font-bold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-1.5">
                                                    <Building2 className="h-3.5 w-3.5" />
                                                    Applicant Analytics — Scope per Category
                                                  </p>
                                                  <div className="space-y-2">
                                                    {ROLE_CAT_LIST.map(cat => {
                                                      const scope = (roleAnalyticsScope[cat.id] as RoleAnalyticsCategoryScope | undefined) || { schools: [], departments: [] };
                                                      return (
                                                        <div key={cat.id} className="rounded-lg border border-blue-100 dark:border-blue-700 bg-white dark:bg-gray-800 p-2.5">
                                                          <p className="text-[11px] font-semibold text-gray-800 dark:text-white mb-1.5">{cat.label}</p>
                                                          <div className="grid grid-cols-2 gap-2">
                                                            {/* School multi-select */}
                                                            <div>
                                                              <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 block">Schools</label>
                                                              <ScopeCheckboxList
                                                                options={schools.map(s => ({
                                                                  id: s.id,
                                                                  label: s.facultyCode || s.facultyName,
                                                                }))}
                                                                selectedIds={scope.schools}
                                                                onToggle={(id) => {
                                                                  setRoleAnalyticsScope(prev => {
                                                                    const current = (prev[cat.id] as RoleAnalyticsCategoryScope | undefined) || { schools: [], departments: [] };
                                                                    const schoolsForCategory = current.schools.includes(id)
                                                                      ? current.schools.filter(item => item !== id)
                                                                      : [...current.schools, id];
                                                                    return {
                                                                      ...prev,
                                                                      [cat.id]: { ...current, schools: schoolsForCategory },
                                                                    };
                                                                  });
                                                                }}
                                                              />
                                                              {scope.schools.length > 0 && (
                                                                <span className="text-[9px] text-blue-600 dark:text-blue-400">{scope.schools.length} selected</span>
                                                              )}
                                                            </div>
                                                            {/* Department multi-select */}
                                                            <div>
                                                              <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5 block">Departments</label>
                                                              <ScopeCheckboxGroupList
                                                                groups={schools.map(s => ({
                                                                  id: s.id,
                                                                  label: s.facultyCode || s.facultyName,
                                                                  options: departments
                                                                    .filter(d => d.facultyId === s.id)
                                                                    .map(d => ({ id: d.id, label: d.departmentName })),
                                                                }))}
                                                                selectedIds={scope.departments}
                                                                onToggle={(id) => {
                                                                  setRoleAnalyticsScope(prev => {
                                                                    const current = (prev[cat.id] as RoleAnalyticsCategoryScope | undefined) || { schools: [], departments: [] };
                                                                    const departmentsForCategory = current.departments.includes(id)
                                                                      ? current.departments.filter(item => item !== id)
                                                                      : [...current.departments, id];
                                                                    return {
                                                                      ...prev,
                                                                      [cat.id]: { ...current, departments: departmentsForCategory },
                                                                    };
                                                                  });
                                                                }}
                                                              />
                                                              {scope.departments.length > 0 && (
                                                                <span className="text-[9px] text-blue-600 dark:text-blue-400">{scope.departments.length} selected</span>
                                                              )}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                  <p className="text-[9px] text-gray-400 mt-2 italic">Use the checkboxes to select multiple. Leave empty = all access.</p>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {rolePermissionTab ===
   'school' && permissionDefs?.schoolDepartments && (
                          <>
                            {!roleSelectedSchoolId || !roleSelectedDepartmentId ? (
                              <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Briefcase className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                  Select School and Department
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                                  Please select a school (faculty) and then choose a department to view and assign relevant permissions for this role template.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                                  <div className="flex items-start gap-2">
                                    <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                                    <div>
                                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                                        {schools.find(s => s.id ===
   roleSelectedSchoolId)?.facultyName}
                                      </p>
                                      <p className="text-xs text-blue-700 dark:text-blue-300">
                                        {filteredDepartmentsBySchool.find(d => d.id ===
   roleSelectedDepartmentId)?.departmentName}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                {Object.entries(groupPermissionsByCategory(departmentPermissions))
                                  .filter(([category]) => roleSchoolCategoryFilter ===
   'all' || category ===
   roleSchoolCategoryFilter)
                                  .map(([category, perms]) => {
                              const categoryKey = `role-school-${category}`;
                              const isExpanded = expandedCategories[categoryKey] !== false;
                              const selectedCount = perms.filter(p => roleSchoolPermissions[p.key]).length;

                              return (
                                <div key={categoryKey} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => toggleCategory(categoryKey)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                                      {category}
                                      <span className={`ml-2 ${selectedCount > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                        ({selectedCount}/{perms.length})
                                      </span>
                                    </span>
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </button>
                                  {isExpanded && (
                                    <>
                                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-600">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updates: Record<string, boolean> = {};
                                            perms.forEach(p => updates[p.key] = true);
                                            setRoleSchoolPermissions(prev => ({ ...prev, ...updates }));
                                          }}
                                          className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800 rounded transition-colors"
                                        >
                                          Select All
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updates: Record<string, boolean> = {};
                                            perms.forEach(p => updates[p.key] = false);
                                            setRoleSchoolPermissions(prev => ({ ...prev, ...updates }));
                                          }}
                                          className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded transition-colors"
                                        >
                                          Remove All
                                        </button>
                                      </div>
                                      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 bg-white dark:bg-gray-800">
                                      {perms.map(perm => (
                                        <label 
                                          key={perm.key} 
                                          className={`flex items-center gap-2 p-2 text-sm cursor-pointer rounded-lg transition-colors ${
                                            roleSchoolPermissions[perm.key]
                                              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={roleSchoolPermissions[perm.key] || false}
                                            onChange={() => setRoleSchoolPermissions(prev => ({ ...prev, [perm.key]: !prev[perm.key] }))}
                                            className="h-4 w-4 text-green-600 border-gray-300 rounded"
                                          />
                                          <span className="text-gray-900 dark:text-white">{perm.label}</span>
                                        </label>
                                      ))}
                                    </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                  <button
                    type="button"
                    onClick={() => setShowRoleModal(false)}
                    className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 font-medium"
                  >
                    <Check className="h-5 w-5" />
                    {editingRole ? 'Update Role' : 'Create Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
   */}
      {/* ROLE ASSIGNMENT MODAL */}
      {/* ============================================
   */}
      {showRoleAssignmentModal && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-start justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowRoleAssignmentModal(false)} />

            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl my-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-t-xl">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Assign Roles
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedUser.employeeDetails?.displayName || selectedUser.uid} • {selectedUser.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRoleAssignmentModal(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-white/50"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 max-h-[calc(100vh-250px)] overflow-y-auto">
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select role templates to assign to this user. Selected roles will define the user's base permissions.
                  </p>

                  {/* Role Selection */}
                  <div className="space-y-2">
                    {roles.map(role => {
                      const permCount = getPermissionCount(role);
                      const isSelected = selectedRoleIds.includes(role.id);
                      
                      return (
                        <label
                          key={role.id}
                          className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-colors border-2 ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-600'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedRoleIds([...selectedRoleIds, role.id]);
                              } else {
                                setSelectedRoleIds(selectedRoleIds.filter(id => id !== role.id));
                              }
                            }}
                            className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-indigo-600" />
                              <span className="font-medium text-gray-900 dark:text-white">{role.name}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                role.isActive 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                {role.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            {role.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{role.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <span className="text-gray-500 dark:text-gray-400">
                                {role.departmentType ===
   'BOTH' ? 'All Departments' : role.departmentType}
                              </span>
                              {permCount.central > 0 && (
                                <span className="flex items-center gap-1 text-purple-600">
                                  <Building2 className="h-3 w-3" />
                                  {permCount.central} Central
                                </span>
                              )}
                              {permCount.school > 0 && (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <Briefcase className="h-3 w-3" />
                                  {permCount.school} School
                                </span>
                              )}
                              {permCount.blocks > 0 && (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <MapPinned className="h-3 w-3" />
                                  {permCount.blocks} Blocks
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {selectedRoleIds.length > 0 && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                        ✓ {selectedRoleIds.length} role{selectedRoleIds.length !== 1 ? 's' : ''} selected
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                <button
                  onClick={() => setShowRoleAssignmentModal(false)}
                  className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRoleAssignment}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium"
                >
                  <Check className="h-5 w-5" />
                  Save Roles
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
