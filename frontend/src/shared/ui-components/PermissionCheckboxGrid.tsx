import React, { useState, useEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import api from '@/shared/api/api';
import { useToast } from '@/shared/ui-components/Toast';
import { logger } from '@/shared/utils/logger';

interface Permission {
  key: string;
  label: string;
}

interface PermissionCategory {
  label: string;
  permissions: Permission[];
}

interface PermissionCategories {
  [key: string]: PermissionCategory;
}

interface PermissionMap {
  [category: string]: string[];
}

interface PermissionCheckboxGridProps {
  userId: string;
  designation?: string;
  onSave?: (permissions: PermissionMap) => void;
}

export default function PermissionCheckboxGrid({ userId, designation, onSave }: PermissionCheckboxGridProps) {
  const toast = useToast();
  const [categories, setCategories] = useState<PermissionCategories>({});
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionMap>({});
  const [designationDefaults, setDesignationDefaults] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch permission categories
      const categoriesRes = await api.get('/designations/permissions/categories');
      
      if (categoriesRes.data.success) {
        setCategories(categoriesRes.data.data);
      }

      // Fetch user permissions
      if (userId) {
        const userPermsRes = await api.get(`/designations/users/${userId}/permissions`);
        
        if (userPermsRes.data.success) {
          setSelectedPermissions(userPermsRes.data.data.effectivePermissions || {});
          setDesignationDefaults(userPermsRes.data.data.designationDefaults || {});
        }
      }
    } catch (error) {
      logger.error('Failed to fetch permissions', error);
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions, designation]);

  const handlePermissionToggle = (categoryKey: string, permissionKey: string) => {
    setSelectedPermissions(prev => {
      const categoryPerms = prev[categoryKey] || [];
      const isSelected = categoryPerms.includes(permissionKey);
      
      return {
        ...prev,
        [categoryKey]: isSelected
          ? categoryPerms.filter(p => p !== permissionKey)
          : [...categoryPerms, permissionKey]
      };
    });
  };

  const isPermissionSelected = (categoryKey: string, permissionKey: string) => {
    return selectedPermissions[categoryKey]?.includes(permissionKey) || false;
  };

  const isFromDesignation = (categoryKey: string, permissionKey: string) => {
    return designationDefaults[categoryKey]?.includes(permissionKey) || false;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Save for each department that has permissions
      for (const [, perms] of Object.entries(selectedPermissions)) {
        if (perms.length > 0) {
          await api.put(`/designations/users/${userId}/permissions`, {
            department: 'REGISTRAR', // You may need to map categories to departments
            permissions: selectedPermissions
          });
        }
      }

      if (onSave) {
        onSave(selectedPermissions);
      }

      toast.success('Permissions saved successfully!');
    } catch (error) {
      logger.error('Failed to save permissions', error);
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = (categoryKey: string) => {
    const allPerms = categories[categoryKey]?.permissions.map(p => p.key) || [];
    setSelectedPermissions(prev => ({
      ...prev,
      [categoryKey]: allPerms
    }));
  };

  const handleDeselectAll = (categoryKey: string) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [categoryKey]: []
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Permission Management</h3>
          {designation && (
            <p className="text-sm text-gray-600 mt-1">
              Designation: <span className="font-medium">{designation}</span>
              <span className="ml-2 text-xs text-primary-600">(Auto-selected permissions shown in blue)</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-wine-fg rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>

      {/* Permission Categories Grid */}
      <div className="space-y-6">
        {Object.entries(categories).map(([categoryKey, category]) => (
          <div key={categoryKey} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">{category.label}</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSelectAll(categoryKey)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => handleDeselectAll(categoryKey)}
                  className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {category.permissions.map(permission => {
                  const isSelected = isPermissionSelected(categoryKey, permission.key);
                  const isDefault = isFromDesignation(categoryKey, permission.key);
                  
                  return (
                    <label
                      key={permission.key}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                        ${isSelected 
                          ? isDefault
                            ? 'bg-primary-50 border-primary-300 hover:bg-primary-100'
                            : 'bg-green-50 border-green-300 hover:bg-green-100'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handlePermissionToggle(categoryKey, permission.key)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {permission.label}
                          </span>
                          {isDefault && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                              Auto
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className={`w-4 h-4 flex-shrink-0 ${isDefault ? 'text-primary-600' : 'text-green-600'}`} />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              Total Selected: <span className="font-semibold text-gray-900">
                {Object.values(selectedPermissions).flat().length}
              </span> permissions
            </p>
            {designation && (
              <p className="text-xs text-gray-500 mt-1">
                From designation: {Object.values(designationDefaults).flat().length} | 
                Custom: {Object.values(selectedPermissions).flat().length - Object.values(designationDefaults).flat().length}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
