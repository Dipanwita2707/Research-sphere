'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { schoolService, School, CreateSchoolDto } from '@/features/admin-management/services/school.service';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

const FACULTY_TYPES = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'management', label: 'Management' },
  { value: 'arts', label: 'Arts' },
  { value: 'science', label: 'Science' },
  { value: 'medical', label: 'Medical' },
  { value: 'law', label: 'Law' },
  { value: 'other', label: 'Other' },
];

export default function SchoolManagement() {
  const toast = useToast();
  const router = useRouter();
  
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingSchool, setDeletingSchool] = useState<School | null>(null);

  const [formData, setFormData] = useState<CreateSchoolDto>({
    facultyCode: '',
    facultyName: '',
    facultyType: 'engineering',
    shortName: '',
    description: '',
    establishedYear: new Date().getFullYear(),
    contactEmail: '',
    contactPhone: '',
    officeLocation: '',
    websiteUrl: '',
  });

  const fetchSchools = useCallback(async () => {
    try {
      setLoading(true);
      const response = await schoolService.getAllSchools();
      setSchools(response.data);
    } catch (error: unknown) {
      logger.error('Failed to fetch schools', error);
      toast.error('Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const handleOpenModal = (school?: School) => {
    if (school) {
      setEditingSchool(school);
      setFormData({
        facultyCode: school.facultyCode,
        facultyName: school.facultyName,
        facultyType: school.facultyType,
        shortName: school.shortName || '',
        description: school.description || '',
        establishedYear: school.establishedYear,
        contactEmail: school.contactEmail || '',
        contactPhone: school.contactPhone || '',
        officeLocation: school.officeLocation || '',
        websiteUrl: school.websiteUrl || '',
      });
    } else {
      setEditingSchool(null);
      setFormData({
        facultyCode: '',
        facultyName: '',
        facultyType: 'engineering',
        shortName: '',
        description: '',
        establishedYear: new Date().getFullYear(),
        contactEmail: '',
        contactPhone: '',
        officeLocation: '',
        websiteUrl: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSchool(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSchool) {
        await schoolService.updateSchool(editingSchool.id, formData);
        toast.success('School updated successfully');
      } else {
        await schoolService.createSchool(formData);
        toast.success('School created successfully');
      }
      handleCloseModal();
      fetchSchools();
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!deletingSchool) return;
    try {
      await schoolService.deleteSchool(deletingSchool.id);
      toast.success('School deleted successfully');
      setShowDeleteConfirm(false);
      setDeletingSchool(null);
      fetchSchools();
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      toast.error(message);
    }
  };

  const handleToggleStatus = async (school: School) => {
    try {
      await schoolService.toggleSchoolStatus(school.id);
      toast.success(`School ${school.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchSchools();
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      toast.error(message);
    }
  };

  const openDeleteConfirm = (school: School) => {
    setDeletingSchool(school);
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
          <h1 className="text-2xl font-bold text-gray-900">School Management</h1>
          <p className="text-gray-600 mt-1">Manage faculties and schools</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/admin/bulk-upload')}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Bulk Upload
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Add New School
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                School Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Head
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Departments
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
            {schools.map((school) => (
              <tr key={school.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {school.facultyCode}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{school.facultyName}</div>
                  {school.shortName && (
                    <div className="text-sm text-gray-500">{school.shortName}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {school.facultyType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {school.headOfFaculty?.employeeDetails?.displayName || 'Not Assigned'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {school._count?.departments || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      school.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {school.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleOpenModal(school)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleStatus(school)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    {school.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(school)}
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
                {editingSchool ? 'Edit School' : 'Add New School'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Faculty Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.facultyCode}
                      onChange={(e) => setFormData({ ...formData, facultyCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Faculty Type *
                    </label>
                    <select
                      required
                      value={formData.facultyType}
                      onChange={(e) => setFormData({ ...formData, facultyType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      {FACULTY_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Faculty Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.facultyName}
                    onChange={(e) => setFormData({ ...formData, facultyName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                      Established Year
                    </label>
                    <input
                      type="number"
                      value={formData.establishedYear}
                      onChange={(e) =>
                        setFormData({ ...formData, establishedYear: parseInt(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
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
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    {editingSchool ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingSchool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deletingSchool.facultyName}</strong>? This
              action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingSchool(null);
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
