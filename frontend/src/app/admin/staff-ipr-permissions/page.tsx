'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, 
  User, 
  CheckSquare, 
  Square, 
  Save, 
  Search,
  Filter,
  Users,
  Settings
} from 'lucide-react';
import api from '@/shared/api/api';
import logger from '@/shared/utils/logger';

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  department: string;
  designation: string;
  role: string | { id: string; name: string; displayName?: string };
  permissions: string[];
}

// Helper to get role name from string or object
const getRoleName = (role: string | { id: string; name: string; displayName?: string } | undefined): string => {
  if (!role) return '';
  return typeof role ===
   'object' ? role.name : role;
};

interface IPRPermission {
  key: string;
  label: string;
  description: string;
  category: 'basic' | 'advanced' | 'admin';
}

const IPR_PERMISSIONS: IPRPermission[] = [
  // Basic Permissions
  { key: 'view_own_ipr', label: 'View Own IPR', description: 'View their own IPR applications', category: 'basic' },
  { key: 'file_ipr', label: 'File IPR Applications', description: 'Submit new IPR applications', category: 'basic' },
  { key: 'edit_own_ipr', label: 'Edit Own IPR', description: 'Edit their own draft IPR applications', category: 'basic' },
  
  // Advanced Permissions
  { key: 'view_all_ipr', label: 'View All IPR', description: 'View all IPR applications in the system', category: 'advanced' },
  { key: 'edit_all_ipr', label: 'Edit All IPR', description: 'Edit any IPR application', category: 'advanced' },
  { key: 'review_ipr', label: 'Review IPR', description: 'Review and comment on IPR applications', category: 'advanced' },
  { key: 'manage_patents', label: 'Manage Patents', description: 'Specialized patent application management', category: 'advanced' },
  { key: 'manage_copyrights', label: 'Manage Copyrights', description: 'Specialized copyright application management', category: 'advanced' },
  { key: 'manage_trademarks', label: 'Manage Trademarks', description: 'Specialized trademark application management', category: 'advanced' },
  
  // Admin Permissions
  { key: 'approve_ipr', label: 'Approve/Reject IPR', description: 'Final approval or rejection of IPR applications', category: 'admin' },
  { key: 'delete_ipr', label: 'Delete IPR', description: 'Delete IPR applications (use with caution)', category: 'admin' },
  { key: 'ipr_analytics', label: 'IPR Analytics', description: 'Access analytics and reports', category: 'admin' },
  { key: 'ipr_admin', label: 'IPR Administration', description: 'Full administrative access to IPR system', category: 'admin' }
];

export default function StaffIPRPermissions() {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchStaffMembers();
  }, []);

  const fetchStaffMembers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/employees');
      const staff = response.data.data.filter((emp: any) => {
        const roleName = getRoleName(emp.role);
        return roleName ===
   'staff' || roleName ===
   'faculty';
      });
      setStaffMembers(staff);
    } catch (error) {
      logger.error('Error fetching staff:', error);
      setMessage({ type: 'error', text: 'Failed to fetch staff members' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStaff = staffMembers.filter(staff => {
    const matchesSearch = 
      staff.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = departmentFilter ===
   'all' || 
      staff.department.toLowerCase() ===
   departmentFilter.toLowerCase();
    
    return matchesSearch && matchesDepartment;
  });

  const hasPermission = (permission: string) => {
    if (!selectedStaff) return false;
    return selectedStaff.permissions.includes(permission);
  };

  const togglePermission = (permission: string) => {
    if (!selectedStaff) return;
    
    const currentPermissions = [...selectedStaff.permissions];
    const index = currentPermissions.indexOf(permission);
    
    if (index > -1) {
      currentPermissions.splice(index, 1);
    } else {
      currentPermissions.push(permission);
    }
    
    setSelectedStaff({
      ...selectedStaff,
      permissions: currentPermissions
    });
  };

  const savePermissions = async () => {
    if (!selectedStaff) return;
    
    setIsSaving(true);
    try {
      await api.put(`/permission-management/assign-permissions`, {
        userId: selectedStaff.id,
        departmentType: 'drd',
        permissions: selectedStaff.permissions
      });
      
      setMessage({ type: 'success', text: 'Permissions updated successfully!' });
      
      // Update the staff member in the list
      setStaffMembers(prevStaff => 
        prevStaff.map(staff => 
          staff.id ===
   selectedStaff.id ? selectedStaff : staff
        )
      );
      
    } catch (error) {
      logger.error('Error saving permissions:', error);
      setMessage({ type: 'error', text: 'Failed to save permissions' });
    } finally {
      setIsSaving(false);
    }
  };

  const getPermissionsByCategory = (category: 'basic' | 'advanced' | 'admin') => {
    return IPR_PERMISSIONS.filter(p => p.category ===
   category);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      basic: 'border-green-200 bg-green-50',
      advanced: 'border-blue-200 bg-blue-50',
      admin: 'border-red-200 bg-red-50'
    };
    return colors[category as keyof typeof colors] || 'border-gray-200 bg-gray-50';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'basic': return '🟢';
      case 'advanced': return '🔵';
      case 'admin': return '🔴';
      default: return '⚪';
    }
  };

  const departments = Array.from(new Set(staffMembers.map(s => s.department)));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Staff IPR Permissions Management</h1>
        <p className="text-gray-600">
          Manage IPR (Intellectual Property Rights) permissions for faculty and staff members. 
          Students have default IPR filing permissions.
        </p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type ===
   'success' ? 'bg-green-100 text-green-800 border border-green-200' : 
          'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Staff List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Staff Members</h2>
            
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search staff..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading staff...</p>
              </div>
            ) : filteredStaff.length ===
   0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No staff members found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStaff.map((staff) => (
                  <div
                    key={staff.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedStaff?.id ===
   staff.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedStaff(staff)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {staff.firstName} {staff.lastName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {staff.employeeId} • {staff.designation}
                        </p>
                        <p className="text-sm text-gray-500">{staff.department}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          getRoleName(staff.role) ===
   'faculty' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {getRoleName(staff.role)}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {staff.permissions.length} IPR permissions
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Permission Assignment */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">IPR Permissions</h2>
              {selectedStaff && (
                <button
                  onClick={savePermissions}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
            {selectedStaff && (
              <div className="mt-2">
                <p className="text-sm text-gray-600">
                  Managing permissions for: <span className="font-medium">
                    {selectedStaff.firstName} {selectedStaff.lastName}
                  </span>
                </p>
              </div>
            )}
          </div>

          <div className="p-6">
            {!selectedStaff ? (
              <div className="text-center py-12">
                <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Staff Member</h3>
                <p className="text-gray-600">
                  Choose a staff member from the list to manage their IPR permissions.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Basic Permissions */}
                <div className={`border rounded-lg p-4 ${getCategoryColor('basic')}`}>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <span>{getCategoryIcon('basic')}</span>
                    Basic IPR Permissions
                  </h3>
                  <div className="space-y-3">
                    {getPermissionsByCategory('basic').map((permission) => (
                      <div key={permission.key} className="flex items-start gap-3">
                        <button
                          onClick={() => togglePermission(permission.key)}
                          className="flex-shrink-0 mt-0.5"
                        >
                          {hasPermission(permission.key) ? (
                            <CheckSquare className="w-5 h-5 text-green-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <div>
                          <p className="font-medium text-gray-900">{permission.label}</p>
                          <p className="text-sm text-gray-600">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Advanced Permissions */}
                <div className={`border rounded-lg p-4 ${getCategoryColor('advanced')}`}>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <span>{getCategoryIcon('advanced')}</span>
                    Advanced IPR Permissions
                  </h3>
                  <div className="space-y-3">
                    {getPermissionsByCategory('advanced').map((permission) => (
                      <div key={permission.key} className="flex items-start gap-3">
                        <button
                          onClick={() => togglePermission(permission.key)}
                          className="flex-shrink-0 mt-0.5"
                        >
                          {hasPermission(permission.key) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <div>
                          <p className="font-medium text-gray-900">{permission.label}</p>
                          <p className="text-sm text-gray-600">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Admin Permissions */}
                <div className={`border rounded-lg p-4 ${getCategoryColor('admin')}`}>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <span>{getCategoryIcon('admin')}</span>
                    Administrative IPR Permissions
                  </h3>
                  <div className="space-y-3">
                    {getPermissionsByCategory('admin').map((permission) => (
                      <div key={permission.key} className="flex items-start gap-3">
                        <button
                          onClick={() => togglePermission(permission.key)}
                          className="flex-shrink-0 mt-0.5"
                        >
                          {hasPermission(permission.key) ? (
                            <CheckSquare className="w-5 h-5 text-red-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <div>
                          <p className="font-medium text-gray-900">{permission.label}</p>
                          <p className="text-sm text-gray-600">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Permission Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Permission Summary</h4>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{selectedStaff.firstName} {selectedStaff.lastName}</span> will have 
                    <span className="font-medium text-blue-600"> {selectedStaff.permissions.length} IPR permissions</span> assigned.
                  </p>
                  {selectedStaff.permissions.length ===
   0 && (
                    <p className="text-sm text-amber-600 mt-1">
                      ⚠️ No IPR permissions assigned. Staff member won't be able to access IPR features.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Student Default Permissions Info */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <Shield className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Student IPR Permissions</h3>
            <p className="text-blue-800 mb-3">
              All students automatically receive the following IPR permissions by default:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <h4 className="font-medium text-blue-900">File IPR Applications</h4>
                <p className="text-sm text-blue-700">Submit new patent, copyright, and trademark applications</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <h4 className="font-medium text-blue-900">View Own IPR</h4>
                <p className="text-sm text-blue-700">View the status and details of their submitted applications</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <h4 className="font-medium text-blue-900">Edit Own IPR</h4>
                <p className="text-sm text-blue-700">Edit their draft applications before submission</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}