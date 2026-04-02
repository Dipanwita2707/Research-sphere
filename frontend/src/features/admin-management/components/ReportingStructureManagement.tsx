'use client';

import Link from 'next/link';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  reportingStructureService,
  HierarchyNode,
  AssignManagerRequest,
  UserHierarchyInfo,
  BulkHierarchyInfoMap,
  ReportingDepartmentOption,
  ReportingDepartmentContext,
} from '@/shared/services/reportingStructure.service';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import {
  Users,
  UserPlus,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  Building2,
  GitBranch,
  RefreshCw,
  Upload,
  AlertTriangle,
  ArrowRightLeft,
  Shield,
  ChevronLeft,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface UserOption {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  empId?: string;
  department?: string;
  departmentId?: string | null;
  departmentScope?: 'school' | 'central' | null;
  departmentCode?: string | null;
  departmentType?: string | null;
  school?: string;
  designation?: string;
  roleCode?: string;
}

interface ReportingStructureManagementProps {
  lockedDepartmentKey?: string;
}

export default function ReportingStructureManagement({
  lockedDepartmentKey,
}: ReportingStructureManagementProps) {
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [hierarchyTree, setHierarchyTree] = useState<HierarchyNode[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<ReportingDepartmentOption[]>([]);
  const [selectedDepartmentKey, setSelectedDepartmentKey] = useState(lockedDepartmentKey || 'all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Assign dialog state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [hierarchyLevels, setHierarchyLevels] = useState(1);
  const [managerChain, setManagerChain] = useState<string[]>(['']); // Array of manager IDs for each level
  const [assigning, setAssigning] = useState(false);

  // Search states for dropdowns
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [managerSearches, setManagerSearches] = useState<string[]>(['']);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showManagerDropdowns, setShowManagerDropdowns] = useState<boolean[]>([false]);

  // Hierarchy-aware search: maps userId → hierarchy info (or null)
  const [hierarchyInfoMap, setHierarchyInfoMap] = useState<BulkHierarchyInfoMap>({});

  // Move user dialog state
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveUserId, setMoveUserId] = useState('');
  const [moveUserName, setMoveUserName] = useState('');
  const [moveNewManagerId, setMoveNewManagerId] = useState('');
  const [moveManagerSearch, setMoveManagerSearch] = useState('');
  const [showMoveManagerDropdown, setShowMoveManagerDropdown] = useState(false);
  const [moving, setMoving] = useState(false);
  const isDepartmentLocked = Boolean(lockedDepartmentKey);

  useEffect(() => {
    if (lockedDepartmentKey) {
      setSelectedDepartmentKey(lockedDepartmentKey);
    }
  }, [lockedDepartmentKey]);

  const selectedDepartmentOption = departmentOptions.find(
    (department) => `${department.scope}:${department.id}` ===
   selectedDepartmentKey
  );

  const selectedDepartmentContext: ReportingDepartmentContext | null = useMemo(() => {
    if (selectedDepartmentKey ===
   'all') return null;
    const [scope, id] = selectedDepartmentKey.split(':');
    if (!scope || !id) return null;
    if (scope !== 'school' && scope !== 'central') return null;
    return {
      departmentScope: scope,
      departmentId: id,
    };
  }, [selectedDepartmentKey]);

  const selectedDepartmentLabel = selectedDepartmentOption
    ? `${selectedDepartmentOption.scope ===
   'school' ? 'School' : 'Central'} - ${selectedDepartmentOption.displayLabel}`
    : null;

  const getUserDepartmentKey = (user?: Pick<UserOption, 'departmentId' | 'departmentScope'> | null) => {
    if (!user?.departmentId || !user?.departmentScope) return null;
    return `${user.departmentScope}:${user.departmentId}`;
  };

  const isCrossDepartmentPair = (
    source?: Pick<UserOption, 'departmentId' | 'departmentScope'> | null,
    target?: Pick<UserOption, 'departmentId' | 'departmentScope'> | null,
  ) => {
    const sourceKey = getUserDepartmentKey(source);
    const targetKey = getUserDepartmentKey(target);
    if (!sourceKey || !targetKey) return false;
    return sourceKey !== targetKey;
  };

  // Filter users by search query
  const filterUsers = (
    query: string,
    excludeIds: string[] = [],
    options: { limitToSelectedDepartment?: boolean } = {}
  ) => {
    const q = query.toLowerCase().trim();
    return allUsers
      .filter((user) => {
        if (!options.limitToSelectedDepartment || selectedDepartmentKey ===
   'all') {
          return true;
        }
        return getUserDepartmentKey(user) ===
   selectedDepartmentKey;
      })
      .filter((user) => !excludeIds.includes(user.id))
      .filter((user) => {
        if (!q) return true;
        return (
          user.displayName.toLowerCase().includes(q) ||
          (user.empId?.toLowerCase() || '').includes(q) ||
          (user.email?.toLowerCase() || '').includes(q) ||
          (user.uid?.toLowerCase() || '').includes(q)
        );
      })
        .slice(0, 10); // Show max 10 results
  };

  // Fetch hierarchy info for a batch of user IDs (for search dropdown badges)
  const pendingFetchRef = useRef<Set<string>>(new Set());
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHierarchyInfo = useCallback((userIds: string[]) => {
    // Only queue IDs we don't already have cached
    const toFetch = userIds.filter((id) => !(id in hierarchyInfoMap));
    if (!toFetch.length) return;
    toFetch.forEach((id) => pendingFetchRef.current.add(id));

    // Debounce: batch API call 150ms after last invocation
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(async () => {
      const ids = Array.from(pendingFetchRef.current);
      pendingFetchRef.current.clear();
      if (!ids.length) return;
      try {
        const res = await reportingStructureService.getBulkHierarchyInfo(
          ids,
          selectedDepartmentContext || undefined,
        );
        setHierarchyInfoMap((prev) => ({ ...prev, ...res.data }));
      } catch {
        // Silently fail — badges just won't show
      }
    }, 150);
  }, [hierarchyInfoMap, selectedDepartmentContext]);

  // Get selected user display
  const getSelectedUserDisplay = (userId: string) => {
    const user = allUsers.find((u) => u.id ===
   userId);
    if (!user) return '';
    const ids = [user.uid, user.empId].filter(Boolean).join(' | ');
    return `${user.displayName} (${ids})`;
  };

  useEffect(() => {
    fetchData();
  }, [selectedDepartmentContext]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-dropdown-container')) {
        setShowEmployeeDropdown(false);
        setShowManagerDropdowns(prev => prev.map(() => false));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Fetch hierarchy + users.
   * @param silent  When true the full-page loading spinner is NOT shown
   *                (used after mutations so the UI stays stable).
   */
  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setRefreshing(true);

      const [treeRes, usersRes, departmentsRes] = await Promise.all([
        reportingStructureService.getHierarchyTree(selectedDepartmentContext || undefined),
        reportingStructureService.getAllUsers(),
        reportingStructureService.getDepartmentOptions(),
      ]);

      setHierarchyTree(treeRes.data || []);
      setDepartmentOptions(departmentsRes.data || []);

      // Transform users for display
      const transformedUsers: UserOption[] = (usersRes.data || []).map((user) => {
        const schoolDepartment = user.employeeDetails?.primaryDepartment;
        const centralDepartment = user.employeeDetails?.primaryCentralDept;
        const resolvedDepartment =
          schoolDepartment?.departmentName || centralDepartment?.departmentName;
        const departmentScope: UserOption['departmentScope'] = schoolDepartment
          ? 'school'
          : centralDepartment
            ? 'central'
            : null;

        return {
          id: user.id,
          uid: user.uid,
          email: user.email,
          displayName:
            user.employeeDetails?.displayName ||
            `${user.employeeDetails?.firstName || ''} ${user.employeeDetails?.lastName || ''}`.trim() ||
            user.email,
          empId: user.employeeDetails?.empId,
          department: resolvedDepartment,
          departmentId: schoolDepartment?.id || centralDepartment?.id || null,
          departmentScope,
          departmentCode:
            schoolDepartment?.departmentCode ||
            centralDepartment?.departmentCode ||
            null,
          departmentType: centralDepartment?.departmentType || null,
          school: user.employeeDetails?.primarySchool?.facultyName,
          designation:
            typeof user.employeeDetails?.designation ===
   'string'
              ? user.employeeDetails.designation
              : user.employeeDetails?.designation?.designationName,
          roleCode:
            typeof user.employeeDetails?.designation ===
   'object'
              ? user.employeeDetails?.designation?.roleCode
              : undefined,
        };
      });

      setAllUsers(transformedUsers);
    } catch (error: unknown) {
      logger.error('Failed to fetch reporting structure:', error);
      toast({
        type: 'error',
        message: extractErrorMessage(error, 'Failed to load reporting structure'),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAssign = async () => {
    if (selectedDepartmentKey ===
   'all') {
      toast({ type: 'warning', message: 'Please select a department first, then assign reporting managers.' });
      return;
    }

    if (!selectedDepartmentContext) {
      toast({ type: 'warning', message: 'Please select a valid department first.' });
      return;
    }

    if (!selectedUserId) {
      toast({ type: 'warning', message: 'Please select an employee' });
      return;
    }

    // Validate all levels have managers selected
    const filledManagers = managerChain.filter(m => m !== '');
    if (filledManagers.length !== hierarchyLevels) {
      toast({ type: 'warning', message: `Please select all ${hierarchyLevels} level(s) of managers` });
      return;
    }

    // Check for duplicates in chain
    const uniqueManagers = new Set(filledManagers);
    if (uniqueManagers.size !== filledManagers.length) {
      toast({ type: 'error', message: 'Cannot select the same person in multiple levels' });
      return;
    }

    // Check if employee is in their own chain
    if (filledManagers.includes(selectedUserId)) {
      toast({ type: 'error', message: 'Employee cannot be in their own reporting chain' });
      return;
    }

    const selectedEmployee = allUsers.find((u) => u.id ===
   selectedUserId);
    const crossDepartmentManagers = filledManagers
      .map((id) => allUsers.find((u) => u.id ===
   id))
      .filter((manager): manager is UserOption =>
        !!manager && isCrossDepartmentPair(selectedEmployee, manager)
      );

    if (crossDepartmentManagers.length > 0) {
      const confirmed = await confirm({
        title: 'Cross-Department Assignment',
        message: `Selected manager(s) belong to a different department (${crossDepartmentManagers
          .map((manager) => manager.displayName)
          .join(', ')}). Do you want to continue?`,
        type: 'warning',
        confirmText: 'Continue',
      });
      if (!confirmed) return;
    }

    try {
      setAssigning(true);
      
      // Call new multi-level API
      await reportingStructureService.assignManagerChain({
        userId: selectedUserId,
        managerChain: filledManagers,
        departmentScope: selectedDepartmentContext.departmentScope,
        departmentId: selectedDepartmentContext.departmentId,
      });
      
      toast({ 
        type: 'success', 
        message: `Successfully assigned ${hierarchyLevels}-level reporting hierarchy` 
      });
      
      // Reset and refresh
      setShowAssignDialog(false);
      setSelectedUserId('');
      setHierarchyLevels(1);
      setManagerChain(['']);
      fetchData(true);
    } catch (error: unknown) {
      logger.error('Failed to assign manager chain:', error);
      toast({
        type: 'error',
        message: extractErrorMessage(error, 'Failed to assign reporting hierarchy'),
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (userId: string, userName: string) => {
    const confirmed = await confirm({
      title: 'Remove Reporting Relationship',
      message: `Are you sure you want to remove the reporting relationship for ${userName}? This action cannot be undone.`,
      type: 'warning',
      confirmText: 'Remove',
    });

    if (!confirmed) return;

    try {
      if (!selectedDepartmentContext) {
        toast({ type: 'warning', message: 'Please select a department first.' });
        return;
      }

      await reportingStructureService.removeReportingRelationship(userId, selectedDepartmentContext);
      toast({ type: 'success', message: 'Reporting relationship removed successfully' });
      fetchData(true);
    } catch (error: unknown) {
      logger.error('Failed to remove relationship:', error);
      toast({
        type: 'error',
        message: extractErrorMessage(error, 'Failed to remove reporting relationship'),
      });
    }
  };

  const openMoveDialog = (userId: string, userName: string) => {
    if (selectedDepartmentKey ===
   'all') {
      const user = allUsers.find((u) => u.id ===
   userId);
      const userDepartmentKey = getUserDepartmentKey(user);

      if (!userDepartmentKey) {
        toast({ type: 'warning', message: 'Please select a department from the department cards page first.' });
        return;
      }

      setSelectedDepartmentKey(userDepartmentKey);
    }

    setMoveUserId(userId);
    setMoveUserName(userName);
    setMoveNewManagerId('');
    setMoveManagerSearch('');
    setShowMoveManagerDropdown(false);
    setShowMoveDialog(true);
  };

  const handleMove = async () => {
    if (!moveUserId || !moveNewManagerId) {
      toast({ type: 'warning', message: 'Please select a new manager' });
      return;
    }

    if (moveUserId ===
   moveNewManagerId) {
      toast({ type: 'error', message: 'A user cannot report to themselves' });
      return;
    }

    if (!selectedDepartmentContext) {
      toast({ type: 'warning', message: 'Please select a valid department first.' });
      return;
    }

    const selectedUser = allUsers.find((u) => u.id ===
   moveUserId);
    const targetManager = allUsers.find((u) => u.id ===
   moveNewManagerId);

    if (isCrossDepartmentPair(selectedUser, targetManager)) {
      const confirmed = await confirm({
        title: 'Cross-Department Move',
        message: `${moveUserName} and ${targetManager?.displayName || 'selected manager'} belong to different departments. Do you want to continue?`,
        type: 'warning',
        confirmText: 'Continue',
      });
      if (!confirmed) return;
    }

    try {
      setMoving(true);
      await reportingStructureService.moveUser({
        userId: moveUserId,
        newManagerId: moveNewManagerId,
        departmentScope: selectedDepartmentContext.departmentScope,
        departmentId: selectedDepartmentContext.departmentId,
      });
      toast({ type: 'success', message: `Successfully moved ${moveUserName} to new position` });
      setShowMoveDialog(false);
      setHierarchyInfoMap({}); // Clear cached info since tree changed
      fetchData(true);
    } catch (error: unknown) {
      logger.error('Failed to move user:', error);
      toast({
        type: 'error',
        message: extractErrorMessage(error, 'Failed to move user'),
      });
    } finally {
      setMoving(false);
    }
  };

  const openAssignDialog = (userId?: string) => {
    if (selectedDepartmentKey ===
   'all') {
      if (!userId) {
        toast({ type: 'warning', message: 'Please select a department first, then assign reporting managers.' });
        return;
      }

      const user = allUsers.find((u) => u.id ===
   userId);
      const userDepartmentKey = getUserDepartmentKey(user);
      if (!userDepartmentKey) {
        toast({ type: 'warning', message: 'Selected employee has no mapped department. Please pick a valid department first.' });
        return;
      }

      setSelectedDepartmentKey(userDepartmentKey);
    }

    setSelectedUserId(userId || '');
    setHierarchyLevels(1);
    setManagerChain(['']);
    setEmployeeSearch('');
    setManagerSearches(['']);
    setShowEmployeeDropdown(false);
    setShowManagerDropdowns([false]);
    setShowAssignDialog(true);
  };

  const handleLevelChange = (newLevels: number) => {
    setHierarchyLevels(newLevels);
    // Resize manager chain array
    const newChain = Array(newLevels).fill('').map((_, i) => managerChain[i] || '');
    setManagerChain(newChain);
    // Reset searches for new levels
    const newSearches = Array(newLevels).fill('').map((_, i) => managerSearches[i] || '');
    setManagerSearches(newSearches);
    const newDropdowns = Array(newLevels).fill(false);
    setShowManagerDropdowns(newDropdowns);
  };

  const handleManagerChange = (levelIndex: number, managerId: string) => {
    const newChain = [...managerChain];
    newChain[levelIndex] = managerId;
    setManagerChain(newChain);
  };

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // Create a flat list for table view
  const flattenHierarchy = (): Array<{
    userId: string;
    userName: string;
    uid?: string;
    empId?: string;
    department?: string;
    departmentId?: string | null;
    departmentScope?: 'school' | 'central' | null;
    departmentKey?: string | null;
    school?: string;
    managerId?: string;
    managerName?: string;
    hierarchyDepth: number;
  }> => {
    const result: Array<any> = [];

    const traverse = (nodes: HierarchyNode[]) => {
      for (const node of nodes) {
        // Look up manager details from allUsers list
        const manager = node.managerId 
          ? allUsers.find(u => u.id ===
   node.managerId)
          : undefined;

        result.push({
          userId: node.userId,
          userName: node.name,
          uid: node.uid,
          empId: node.empId,
          department: node.department,
          departmentId: node.departmentId,
          departmentScope: node.departmentScope,
          departmentKey: node.departmentId && node.departmentScope
            ? `${node.departmentScope}:${node.departmentId}`
            : null,
          school: node.school,
          managerId: node.managerId,
          managerName: manager?.displayName || manager?.email,
          hierarchyDepth: node.hierarchyDepth,
        });

        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };

    traverse(hierarchyTree);
    return result;
  };

  const flattenHierarchyByDepartment = (nodes: HierarchyNode[]): HierarchyNode[] => {
    if (selectedDepartmentKey ===
   'all') return nodes;

    const filteredNodes: HierarchyNode[] = [];
    for (const node of nodes) {
      const children = node.children ? flattenHierarchyByDepartment(node.children) : [];
      const nodeKey = node.departmentId && node.departmentScope
        ? `${node.departmentScope}:${node.departmentId}`
        : null;
      if (nodeKey ===
   selectedDepartmentKey || children.length > 0) {
        filteredNodes.push({ ...node, children });
      }
    }

    return filteredNodes;
  };

  const departmentScopedUsers = flattenHierarchy().filter((user) =>
    selectedDepartmentKey ===
   'all' ? true : user.departmentKey ===
   selectedDepartmentKey
  );

  const filteredUsers = departmentScopedUsers.filter((user) =>
    user.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.empId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHierarchyTree = flattenHierarchyByDepartment(hierarchyTree);

  const treeStats = useMemo(() => {
    let nodeCount = 0;
    let maxDepth = 0;

    const walk = (nodes: HierarchyNode[]) => {
      for (const node of nodes) {
        nodeCount += 1;
        maxDepth = Math.max(maxDepth, node.hierarchyDepth || 0);
        if (node.children?.length) {
          walk(node.children);
        }
      }
    };

    walk(filteredHierarchyTree);
    return { nodeCount, maxDepth };
  }, [filteredHierarchyTree]);

  const collectVisibleTreeNodeIds = useCallback((nodes: HierarchyNode[]) => {
    const ids: string[] = [];
    const walk = (items: HierarchyNode[]) => {
      for (const item of items) {
        ids.push(item.userId);
        if (item.children?.length) walk(item.children);
      }
    };
    walk(nodes);
    return ids;
  }, []);

  const expandAllVisibleNodes = () => {
    setExpandedNodes(new Set(collectVisibleTreeNodeIds(filteredHierarchyTree)));
  };

  const collapseAllNodes = () => {
    setExpandedNodes(new Set());
  };

  // Render tree view recursively
  const renderTreeNode = (node: HierarchyNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.userId);
    const hasChildren = node.children && node.children.length > 0;
    const indent = Math.min(level * 24, 264);

    return (
      <div key={node.userId}>
        <div
          className="flex items-center gap-2 py-3 pr-3 bg-white border-b hover:bg-gray-50 transition-colors min-w-[980px]"
          style={{ paddingLeft: `${16 + indent}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleNodeExpansion(node.userId)}
              className="text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>
          ) : (
            <div className="w-5" />
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{node.name}</span>
              {hasChildren && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  {node.children?.length} child{(node.children?.length || 0) > 1 ? 'ren' : ''}
                </span>
              )}
              <span className="text-xs text-gray-500">
                ({node.uid}{node.empId && ` | ${node.empId}`})
              </span>
            </div>
            <div className="text-xs text-gray-600">
              {node.department && <span>{node.department}</span>}
              {node.school && <span className="ml-2">• {node.school}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Level {node.hierarchyDepth}</span>
            <button
              onClick={() => openAssignDialog(node.userId)}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
              title="Edit Reporting Relationship"
            >
              <UserPlus size={16} />
            </button>
            {node.managerId && (
              <button
                onClick={() => openMoveDialog(node.userId, node.name)}
                className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                title="Move to Different Level"
              >
                <ArrowRightLeft size={16} />
              </button>
            )}
            <button
              onClick={() => handleRemove(node.userId, node.name)}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="Remove from Reporting Structure"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading reporting structure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <GitBranch className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Reporting Structure Management</h1>
          </div>
          {isDepartmentLocked && (
            <Link
              href="/admin/reporting-structure"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={14} />
              Back to Department Cards
            </Link>
          )}
        </div>
        <p className="text-gray-600">Manage organizational reporting hierarchy ("who reports to whom")</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
            Users Visible: {filteredUsers.length}
          </span>
          <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-800">
            Tree Nodes: {treeStats.nodeCount}
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
            Max Depth: {treeStats.maxDepth}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, UID, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {selectedDepartmentLabel && (
              <p className="text-xs text-blue-700 mt-2">
                Managing department: <span className="font-semibold">{selectedDepartmentLabel}</span>
              </p>
            )}
            {!selectedDepartmentLabel && !isDepartmentLocked && (
              <p className="text-xs text-gray-500 mt-2">
                Select a department from the cards page first, then create or edit reporting structure.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode ===
   'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode ===
   'tree'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => openAssignDialog()}
              disabled={selectedDepartmentKey ===
   'all'}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus size={20} />
              Assign Manager
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Table View */}
      {viewMode ===
   'table' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[68vh]">
            <table className="w-full">
              <thead className="bg-gray-50 border-b sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    UID | Emp ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Manager
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length ===
   0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      {selectedDepartmentKey ===
   'all'
                        ? 'No reporting relationships found. Click "Assign Manager" to get started.'
                        : 'No reporting relationships found for the selected department.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.userId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.userName}</div>
                            <div className="text-xs text-gray-500">{user.school}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span className="font-medium">{user.uid || '-'}</span>
                          {user.empId && <span className="text-xs text-gray-500">{user.empId}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {user.department || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {user.managerName ? (
                          <div className="flex items-center gap-1 text-sm text-gray-900">
                            <Building2 size={14} className="text-gray-400" />
                            {user.managerName}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">No manager assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          Level {user.hierarchyDepth}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openAssignDialog(user.userId)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Manager"
                          >
                            <UserPlus size={16} />
                          </button>
                          {user.managerId && (
                            <button
                              onClick={() => openMoveDialog(user.userId, user.userName)}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Move to Different Level"
                            >
                              <ArrowRightLeft size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(user.userId, user.userName)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove from Reporting Structure"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tree View */}
      {viewMode ===
   'tree' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">
              Scroll to navigate large hierarchies. Use Expand/Collapse for better visibility.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={expandAllVisibleNodes}
                disabled={treeStats.nodeCount ===
   0}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Maximize2 size={14} />
                Expand All
              </button>
              <button
                onClick={collapseAllNodes}
                disabled={expandedNodes.size ===
   0}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minimize2 size={14} />
                Collapse All
              </button>
            </div>
          </div>

          {filteredHierarchyTree.length ===
   0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              {selectedDepartmentKey ===
   'all'
                ? 'No reporting structure defined. Click "Assign Manager" to build the hierarchy.'
                : 'No reporting structure found for the selected department.'}
            </div>
          ) : (
            <div className="max-h-[68vh] overflow-auto">
              {filteredHierarchyTree.map((node) => renderTreeNode(node))}
            </div>
          )}
        </div>
      )}

      {/* Assign Manager Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Assign Reporting Manager</h2>
                <button
                  onClick={() => setShowAssignDialog(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>

              {selectedDepartmentLabel && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Building hierarchy for: <span className="font-semibold">{selectedDepartmentLabel}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* User Selection with Search */}
                <div className="relative search-dropdown-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Employee
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={selectedUserId ? getSelectedUserDisplay(selectedUserId) : employeeSearch}
                      onChange={(e) => {
                        setEmployeeSearch(e.target.value);
                        setSelectedUserId('');
                        setShowEmployeeDropdown(e.target.value.trim().length > 0);
                      }}
                      placeholder="Type name, UID, or email to search..."
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {selectedUserId && (
                      <button
                        onClick={() => {
                          setSelectedUserId('');
                          setEmployeeSearch('');
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                  {showEmployeeDropdown && !selectedUserId && employeeSearch.trim().length > 0 && (() => {
                    const results = filterUsers(employeeSearch, []);
                    // Trigger hierarchy info fetch for visible results
                    const ids = results.map(u => u.id);
                    if (ids.length) fetchHierarchyInfo(ids);
                    return (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {results.length ===
   0 ? (
                        <div className="px-4 py-2 text-gray-500 text-sm">
                          {selectedDepartmentKey ===
   'all'
                            ? 'No employees found'
                            : 'No employees found in selected department'}
                        </div>
                      ) : (
                        results.map((user) => {
                          const hInfo = hierarchyInfoMap[user.id];
                          const isInHierarchy = hInfo?.isInHierarchy ===
   true;
                          return (
                            <button
                              key={user.id}
                              onClick={() => {
                                if (isInHierarchy) return; // Prevent selection
                                setSelectedUserId(user.id);
                                setEmployeeSearch('');
                                setShowEmployeeDropdown(false);
                              }}
                              disabled={isInHierarchy}
                              className={`w-full px-4 py-2 text-left text-sm border-b border-gray-100 last:border-0 ${
                                isInHierarchy
                                  ? 'bg-gray-50 cursor-not-allowed opacity-75'
                                  : 'hover:bg-blue-50 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-gray-900">{user.displayName}</div>
                                {isInHierarchy && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                                    <Shield size={10} />
                                    Already in Hierarchy
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {user.uid}{user.empId && ` | ${user.empId}`} | {user.department || 'No Dept'} | {user.email}
                              </div>
                              {isInHierarchy && hInfo && (
                                <div className="mt-1 flex items-center gap-2 text-xs">
                                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                    Level {hInfo.currentLevel}
                                  </span>
                                  {hInfo.parentName && (
                                    <span className="text-gray-500">
                                      Reports to: <span className="font-medium text-gray-700">{hInfo.parentName}</span>
                                    </span>
                                  )}
                                  {!hInfo.parentName && (
                                    <span className="text-gray-500 italic">Top-level (no manager)</span>
                                  )}
                                  {hInfo.subordinateCount > 0 && (
                                    <span className="text-gray-500">
                                      • {hInfo.subordinateCount} subordinate{hInfo.subordinateCount > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                    );
                  })()}
                </div>

                {/* Hierarchy Levels Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Hierarchy Levels (Max 5)
                  </label>
                  <select
                    value={hierarchyLevels}
                    onChange={(e) => handleLevelChange(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        {level} Level{level > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {`Select how many management levels you want to assign (Employee → ${Array.from({ length: hierarchyLevels }, (_, i) => `Level ${i + 1}`).join(' → ')})`}
                  </p>
                </div>

                {/* Dynamic Manager Selection with Search for Each Level */}
                {Array.from({ length: hierarchyLevels }, (_, index) => {
                  const levelNumber = index + 1;
                  const previousLevelManagers = managerChain.slice(0, index);
                  const excludedIds = [selectedUserId, ...previousLevelManagers].filter(Boolean);
                  const currentSearch = managerSearches[index] || '';
                  const currentManagerId = managerChain[index] || '';
                  const isDropdownOpen = showManagerDropdowns[index] || false;

                  return (
                    <div key={levelNumber} className="relative search-dropdown-container">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Level {levelNumber} Manager {levelNumber ===
   1 ? '(Direct Manager)' : `(Manager of Level ${levelNumber - 1})`}
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={currentManagerId ? getSelectedUserDisplay(currentManagerId) : currentSearch}
                          onChange={(e) => {
                            const newSearches = [...managerSearches];
                            newSearches[index] = e.target.value;
                            setManagerSearches(newSearches);
                            handleManagerChange(index, '');
                            const newDropdowns = [...showManagerDropdowns];
                            newDropdowns[index] = e.target.value.trim().length > 0;
                            setShowManagerDropdowns(newDropdowns);
                          }}
                          placeholder={`Type name/UID to search Level ${levelNumber} manager...`}
                          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {currentManagerId && (
                          <button
                            onClick={() => {
                              handleManagerChange(index, '');
                              const newSearches = [...managerSearches];
                              newSearches[index] = '';
                              setManagerSearches(newSearches);
                            }}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                      {isDropdownOpen && !currentManagerId && currentSearch.trim().length > 0 && (() => {
                        const results = filterUsers(currentSearch, excludedIds);
                        const ids = results.map(u => u.id);
                        if (ids.length) fetchHierarchyInfo(ids);
                        return (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                          {results.length ===
   0 ? (
                            <div className="px-4 py-2 text-gray-500 text-sm">No managers found</div>
                          ) : (
                            results.map((user) => {
                              const hInfo = hierarchyInfoMap[user.id];
                              const isInHierarchy = hInfo?.isInHierarchy ===
   true;
                              return (
                                <button
                                  key={user.id}
                                  onClick={() => {
                                    handleManagerChange(index, user.id);
                                    const newSearches = [...managerSearches];
                                    newSearches[index] = '';
                                    setManagerSearches(newSearches);
                                    const newDropdowns = [...showManagerDropdowns];
                                    newDropdowns[index] = false;
                                    setShowManagerDropdowns(newDropdowns);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium">{user.displayName}</div>
                                    {isInHierarchy && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                        Level {hInfo!.currentLevel}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {user.uid}{user.empId && ` | ${user.empId}`} | {user.designation || 'No Designation'} | {user.email}
                                  </div>
                                  {isInHierarchy && hInfo?.parentName && (
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      Currently reports to: {hInfo.parentName}
                                    </div>
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                        );
                      })()}
                    </div>
                  );
                })}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> You are creating a {hierarchyLevels}-level hierarchy:
                  </p>
                  <div className="text-xs text-blue-700 mt-2 pl-4">
                    <div className="space-y-1">
                      <div>Employee (bottom)</div>
                      {Array.from({ length: hierarchyLevels }, (_, i) => (
                        <div key={i}>↑ Level {i + 1} Manager {i ===
   hierarchyLevels - 1 && '(top)'}</div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    The system prevents circular reporting chains and duplicate selections.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-6 pt-6 border-t">
                <button
                  onClick={handleAssign}
                  disabled={assigning || !selectedUserId || managerChain.filter(m => m !== '').length !== hierarchyLevels}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {assigning ? (
                    <>
                      <RefreshCw className="animate-spin" size={20} />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <UserPlus size={20} />
                      Assign Manager
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowAssignDialog(false)}
                  disabled={assigning}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move User Dialog */}
      {showMoveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <ArrowRightLeft className="h-6 w-6 text-amber-600" />
                  Move User
                </h2>
                <button
                  onClick={() => setShowMoveDialog(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800">
                  <strong>Moving:</strong> {moveUserName}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  This will remove the user from their current position, re-parent their subordinates
                  to their current manager, and place them under the new manager. All operations are atomic.
                </p>
              </div>

              <div className="relative search-dropdown-container">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Manager
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={moveNewManagerId ? getSelectedUserDisplay(moveNewManagerId) : moveManagerSearch}
                    onChange={(e) => {
                      setMoveManagerSearch(e.target.value);
                      setMoveNewManagerId('');
                      setShowMoveManagerDropdown(e.target.value.trim().length > 0);
                    }}
                    placeholder="Type name/UID to search new manager..."
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  {moveNewManagerId && (
                    <button
                      onClick={() => {
                        setMoveNewManagerId('');
                        setMoveManagerSearch('');
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      &times;
                    </button>
                  )}
                </div>
                {showMoveManagerDropdown && !moveNewManagerId && moveManagerSearch.trim().length > 0 && (() => {
                  const results = filterUsers(moveManagerSearch, [moveUserId]);
                  const ids = results.map(u => u.id);
                  if (ids.length) fetchHierarchyInfo(ids);
                  return (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {results.length ===
   0 ? (
                      <div className="px-4 py-2 text-gray-500 text-sm">No users found</div>
                    ) : (
                      results.map((user) => {
                        const hInfo = hierarchyInfoMap[user.id];
                        const isInHierarchy = hInfo?.isInHierarchy ===
   true;
                        return (
                          <button
                            key={user.id}
                            onClick={() => {
                              setMoveNewManagerId(user.id);
                              setMoveManagerSearch('');
                              setShowMoveManagerDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-amber-50 text-sm border-b border-gray-100 last:border-0"
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{user.displayName}</div>
                              {isInHierarchy && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                  Level {hInfo!.currentLevel}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {user.uid}{user.empId && ` | ${user.empId}`} | {user.department || 'No Dept'} | {user.email}
                            </div>
                            {isInHierarchy && hInfo?.parentName && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                Currently reports to: {hInfo.parentName}
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  );
                })()}
              </div>

              <div className="flex items-center gap-3 mt-6 pt-6 border-t">
                <button
                  onClick={handleMove}
                  disabled={moving || !moveNewManagerId}
                  className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {moving ? (
                    <>
                      <RefreshCw className="animate-spin" size={20} />
                      Moving...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft size={20} />
                      Move User
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowMoveDialog(false)}
                  disabled={moving}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
