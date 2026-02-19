'use client';

import { useEffect, useState, useRef } from 'react';
import {
  reportingStructureService,
  HierarchyNode,
  AssignManagerRequest,
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
} from 'lucide-react';

interface UserOption {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  empId?: string;
  department?: string;
  school?: string;
  designation?: string;
  roleCode?: string;
}

export default function ReportingStructureManagement() {
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [hierarchyTree, setHierarchyTree] = useState<HierarchyNode[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Filter users by search query
  const filterUsers = (query: string, excludeIds: string[] = []) => {
    const q = query.toLowerCase().trim();
    return allUsers
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

  // Get selected user display
  const getSelectedUserDisplay = (userId: string) => {
    const user = allUsers.find((u) => u.id === userId);
    if (!user) return '';
    const ids = [user.uid, user.empId].filter(Boolean).join(' | ');
    return `${user.displayName} (${ids})`;
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [treeRes, usersRes] = await Promise.all([
        reportingStructureService.getHierarchyTree(),
        reportingStructureService.getAllUsers(),
      ]);

      setHierarchyTree(treeRes.data || []);
      
      // Transform users for display
      const transformedUsers = (usersRes.data || []).map((user) => ({
        id: user.id,
        uid: user.uid,
        email: user.email,
        displayName: user.employeeDetails?.displayName || 
                     `${user.employeeDetails?.firstName || ''} ${user.employeeDetails?.lastName || ''}`.trim() ||
                     user.email,
        empId: user.employeeDetails?.empId,
        department: user.employeeDetails?.primaryDepartment?.departmentName,
        school: user.employeeDetails?.primarySchool?.facultyName,
        designation: typeof user.employeeDetails?.designation === 'string' 
          ? user.employeeDetails.designation 
          : user.employeeDetails?.designation?.designationName,
        roleCode: typeof user.employeeDetails?.designation === 'object' 
          ? user.employeeDetails?.designation?.roleCode 
          : undefined,
      }));

      setAllUsers(transformedUsers);
    } catch (error: unknown) {
      logger.error('Failed to fetch reporting structure:', error);
      toast({
        type: 'error',
        message: extractErrorMessage(error, 'Failed to load reporting structure'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
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

    try {
      setAssigning(true);
      
      // Call new multi-level API
      await reportingStructureService.assignManagerChain({
        userId: selectedUserId,
        managerChain: filledManagers,
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
      fetchData();
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
      await reportingStructureService.removeReportingRelationship(userId);
      toast({ type: 'success', message: 'Reporting relationship removed successfully' });
      fetchData();
    } catch (error: unknown) {
      logger.error('Failed to remove relationship:', error);
      toast({
        type: 'error',
        message: extractErrorMessage(error, 'Failed to remove reporting relationship'),
      });
    }
  };

  const openAssignDialog = (userId?: string) => {
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
          ? allUsers.find(u => u.id === node.managerId)
          : undefined;

        result.push({
          userId: node.userId,
          userName: node.name,
          uid: node.uid,
          empId: node.empId,
          department: node.department,
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

  const filteredUsers = flattenHierarchy().filter((user) =>
    user.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.empId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render tree view recursively
  const renderTreeNode = (node: HierarchyNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.userId);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.userId} style={{ marginLeft: `${level * 24}px` }}>
        <div className="flex items-center gap-2 p-3 bg-white border-b hover:bg-gray-50 transition-colors">
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
                onClick={() => handleRemove(node.userId, node.name)}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
                title="Remove Relationship"
              >
                <Trash2 size={16} />
              </button>
            )}
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
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <GitBranch className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Reporting Structure Management</h1>
        </div>
        <p className="text-gray-600">Manage organizational reporting hierarchy ("who reports to whom")</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1 max-w-md">
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
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'tree'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => openAssignDialog()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <UserPlus size={20} />
              Assign Manager
            </button>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw size={20} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
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
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No reporting relationships found. Click "Assign Manager" to get started.
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
                              onClick={() => handleRemove(user.userId, user.userName)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove Relationship"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
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
      {viewMode === 'tree' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {hierarchyTree.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No reporting structure defined. Click "Assign Manager" to build the hierarchy.
            </div>
          ) : (
            <div>
              {hierarchyTree.map((node) => renderTreeNode(node))}
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
                        setShowEmployeeDropdown(true);
                      }}
                      onFocus={() => setShowEmployeeDropdown(true)}
                      placeholder="Search by name, UID, or email..."
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
                  {showEmployeeDropdown && !selectedUserId && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filterUsers(employeeSearch).length === 0 ? (
                        <div className="px-4 py-2 text-gray-500 text-sm">No employees found</div>
                      ) : (
                        filterUsers(employeeSearch).map((user) => (
                          <button
                            key={user.id}
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setEmployeeSearch('');
                              setShowEmployeeDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
                          >
                            <div className="font-medium">{user.displayName}</div>
                            <div className="text-xs text-gray-500">
                              {user.uid}{user.empId && ` | ${user.empId}`} | {user.department || 'No Dept'} | {user.email}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
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
                    Select how many management levels you want to assign (Employee → Level 1 → Level 2 → ... → Level {hierarchyLevels})
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
                        Level {levelNumber} Manager {levelNumber === 1 ? '(Direct Manager)' : `(Manager of Level ${levelNumber - 1})`}
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
                            newDropdowns[index] = true;
                            setShowManagerDropdowns(newDropdowns);
                          }}
                          onFocus={() => {
                            const newDropdowns = [...showManagerDropdowns];
                            newDropdowns[index] = true;
                            setShowManagerDropdowns(newDropdowns);
                          }}
                          placeholder={`Search Level ${levelNumber} manager...`}
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
                      {isDropdownOpen && !currentManagerId && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filterUsers(currentSearch, excludedIds).length === 0 ? (
                            <div className="px-4 py-2 text-gray-500 text-sm">No managers found</div>
                          ) : (
                            filterUsers(currentSearch, excludedIds).map((user) => (
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
                                <div className="font-medium">{user.displayName}</div>
                                <div className="text-xs text-gray-500">
                                  {user.uid}{user.empId && ` | ${user.empId}`} | {user.designation || 'No Designation'} | {user.email}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> You are creating a {hierarchyLevels}-level hierarchy:
                  </p>
                  <div className="text-xs text-blue-700 mt-2 pl-4">
                    {hierarchyLevels === 1 && (
                      <div>Employee → Level 1 Manager</div>
                    )}
                    {hierarchyLevels > 1 && (
                      <div className="space-y-1">
                        <div>Employee (bottom)</div>
                        {Array.from({ length: hierarchyLevels }, (_, i) => (
                          <div key={i}>↑ Level {i + 1} Manager {i === hierarchyLevels - 1 && '(top)'}</div>
                        ))}
                      </div>
                    )}
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
    </div>
  );
}
