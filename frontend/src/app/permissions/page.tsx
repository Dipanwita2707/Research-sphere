'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Edit, Shield, UserPlus } from 'lucide-react';
import PermissionCheckboxGrid from '@/shared/ui-components/PermissionCheckboxGrid';
import api from '@/shared/api/api';
import logger from '@/shared/utils/logger';

interface User {
  id: string;
  uid: string;
  email: string;
  role: string | { id: string; name: string; displayName?: string };
  employeeDetails?: {
    firstName: string;
    lastName: string;
    designation: string;
  };
}

// Helper to get role name from string or object
const getRoleName = (role: string | { id: string; name: string; displayName?: string } | undefined): string => {
  if (!role) return '';
  return typeof role ===
   'object' ? role.name : role;
};

export default function PermissionManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPermissionEditor, setShowPermissionEditor] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // You'll need to create this endpoint
      const response = await api.get('/users');
      
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      logger.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPermissions = (user: User) => {
    setSelectedUser(user);
    setShowPermissionEditor(true);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.employeeDetails?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.employeeDetails?.lastName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter ===
   'all' || user.role ===
   roleFilter;
    
    return matchesSearch && matchesRole;
  });

  if (showPermissionEditor && selectedUser) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => setShowPermissionEditor(false)}
            className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2"
          >
            ← Back to Users
          </button>
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Manage Permissions: {selectedUser.employeeDetails?.firstName} {selectedUser.employeeDetails?.lastName}
            </h1>
            <p className="text-gray-600 mt-1">
              {selectedUser.uid} • {selectedUser.email} • {getRoleName(selectedUser.role)}
            </p>
          </div>
        </div>

        <PermissionCheckboxGrid
          userId={selectedUser.id}
          designation={selectedUser.employeeDetails?.designation}
          onSave={() => {
            setShowPermissionEditor(false);
            fetchUsers();
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary-600" />
          Permission Management
        </h1>
        <p className="text-gray-600 mt-2">Manage user permissions based on designation and custom requirements</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, UID, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Role Filter */}
          <div className="sm:w-48">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Roles</option>
              <option value="faculty">Faculty</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  UID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Designation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length ===
   0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">
                          {user.employeeDetails?.firstName} {user.employeeDetails?.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-900">{user.uid}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {user.employeeDetails?.designation || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 capitalize">
                        {getRoleName(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleEditPermissions(user)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        Manage Permissions
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Total Users</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{users.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Faculty</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {users.filter(u => getRoleName(u.role) ===
   'faculty').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Staff</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {users.filter(u => getRoleName(u.role) ===
   'staff').length}
          </div>
        </div>
      </div>
    </div>
  );
}
