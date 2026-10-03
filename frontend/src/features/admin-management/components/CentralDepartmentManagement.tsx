'use client';

import { useEffect, useState } from 'react';
import {
  centralDepartmentService,
  CentralDepartment,
  CreateCentralDepartmentDto,
} from '@/features/admin-management/services/centralDepartment.service';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

const DEPARTMENT_TYPES = [
  { value: 'drd', label: 'Research & Development (DRD)' },
  { value: 'finance', label: 'Finance (research incentives & budget)' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'support', label: 'Support' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' },
];

export default function CentralDepartmentManagement() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<CentralDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<CentralDepartment | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingDepartment, setDeletingDepartment] = useState<CentralDepartment | null>(null);

  const [formData, setFormData] = useState<CreateCentralDepartmentDto>({
    departmentCode: '',
    departmentName: '',
    shortName: '',
    description: '',
    departmentType: 'administrative',
    contactEmail: '',
    contactPhone: '',
    officeLocation: '',
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await centralDepartmentService.getAllCentralDepartments();
      setDepartments(response.data);
    } catch (error: unknown) {
      logger.error('Failed to fetch central departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (department?: CentralDepartment) => {
    if (department) {
      setEditingDepartment(department);
      setFormData({
        departmentCode: department.departmentCode,
        departmentName: department.departmentName,
        shortName: department.shortName || '',
        description: department.description || '',
        departmentType: department.departmentType || 'administrative',
        contactEmail: department.contactEmail || '',
        contactPhone: department.contactPhone || '',
        officeLocation: department.officeLocation || '',
      });
    } else {
      setEditingDepartment(null);
      setFormData({
        departmentCode: '',
        departmentName: '',
        shortName: '',
        description: '',
        departmentType: 'administrative',
        contactEmail: '',
        contactPhone: '',
        officeLocation: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDepartment(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDepartment) {
        await centralDepartmentService.updateCentralDepartment(editingDepartment.id, formData);
      } else {
        await centralDepartmentService.createCentralDepartment(formData);
      }
      handleCloseModal();
      fetchDepartments();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!deletingDepartment) return;
    try {
      await centralDepartmentService.deleteCentralDepartment(deletingDepartment.id);
      setShowDeleteConfirm(false);
      setDeletingDepartment(null);
      fetchDepartments();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const handleToggleStatus = async (department: CentralDepartment) => {
    try {
      await centralDepartmentService.toggleCentralDepartmentStatus(department.id);
      fetchDepartments();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    }
  };

  const openDeleteConfirm = (department: CentralDepartment) => {
    setDeletingDepartment(department);
    setShowDeleteConfirm(true);
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Central Department Management</h1>
          <p className="text-gray-600 mt-1">Manage HR, ERP, DRD and other central departments</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-primary-600 text-wine-fg rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add New Department
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Department Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Head
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {departments.map((dept) => (
              <tr key={dept.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {dept.departmentCode}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{dept.departmentName}</div>
                  {dept.shortName && <div className="text-sm text-gray-500">{dept.shortName}</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {dept.departmentType || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {dept.headOfDepartment?.employeeDetails?.displayName || 'Not Assigned'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {dept.officeLocation || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      dept.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {dept.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleOpenModal(dept)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleStatus(dept)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    {dept.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(dept)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingDepartment ? 'Edit Central Department' : 'Add New Central Department'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.departmentCode}
                      onChange={(e) =>
                        setFormData({ ...formData, departmentCode: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department Type
                    </label>
                    <select
                      value={formData.departmentType}
                      onChange={(e) =>
                        setFormData({ ...formData, departmentType: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      {DEPARTMENT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.departmentName}
                    onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Short Name
                  </label>
                  <input
                    type="text"
                    value={formData.shortName}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Office Location
                  </label>
                  <input
                    type="text"
                    value={formData.officeLocation}
                    onChange={(e) => setFormData({ ...formData, officeLocation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-wine-fg rounded-lg hover:bg-primary-700"
                  >
                    {editingDepartment ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingDepartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deletingDepartment.departmentName}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingDepartment(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
