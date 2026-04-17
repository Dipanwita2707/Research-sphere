'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Users,
  BookOpen,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  School,
} from 'lucide-react';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { departmentService, Department, CreateDepartmentDto } from '@/features/admin-management/services/department.service';
import { schoolService, School as SchoolType } from '@/features/admin-management/services/school.service';

export default function DepartmentManagement() {
  const { confirmDelete } = useConfirm();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [schools, setSchools] = useState<SchoolType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState<CreateDepartmentDto>({
    facultyId: '',
    departmentCode: '',
    departmentName: '',
    shortName: '',
    description: '',
    establishedYear: new Date().getFullYear(),
    contactEmail: '',
    contactPhone: '',
    officeLocation: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [deptResponse, schoolResponse] = await Promise.all([
        departmentService.getAllDepartments(),
        schoolService.getAllSchools(),
      ]);
      setDepartments(deptResponse.data);
      setSchools(schoolResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (department?: Department) => {
    if (department) {
      setEditingDepartment(department);
      setFormData({
        facultyId: department.facultyId,
        departmentCode: department.departmentCode,
        departmentName: department.departmentName,
        shortName: department.shortName || '',
        description: department.description || '',
        establishedYear: department.establishedYear || new Date().getFullYear(),
        contactEmail: department.contactEmail || '',
        contactPhone: department.contactPhone || '',
        officeLocation: department.officeLocation || '',
      });
    } else {
      setEditingDepartment(null);
      setFormData({
        facultyId: selectedSchool || '',
        departmentCode: '',
        departmentName: '',
        shortName: '',
        description: '',
        establishedYear: new Date().getFullYear(),
        contactEmail: '',
        contactPhone: '',
        officeLocation: '',
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      if (!formData.facultyId || !formData.departmentCode || !formData.departmentName) {
        setError('Please fill in all required fields');
        return;
      }

      if (editingDepartment) {
        await departmentService.updateDepartment(editingDepartment.id, formData);
        setSuccess('Department updated successfully');
      } else {
        await departmentService.createDepartment(formData);
        setSuccess('Department created successfully');
      }

      setShowModal(false);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (department: Department) => {
    const confirmed = await confirmDelete('Delete Department', `Are you sure you want to delete "${department.departmentName}"?`);
    if (!confirmed) return;

    try {
      await departmentService.deleteDepartment(department.id);
      setSuccess('Department deleted successfully');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete department');
    }
  };

  const handleToggleStatus = async (department: Department) => {
    try {
      await departmentService.toggleDepartmentStatus(department.id);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  // Filter departments
  const filteredDepartments = departments.filter(dept => {
    const matchesSchool = !selectedSchool || dept.facultyId ===
   selectedSchool;
    const matchesSearch = !searchTerm || 
      dept.departmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.departmentCode.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSchool && matchesSearch;
  });

  // Group departments by school
  const groupedDepartments = filteredDepartments.reduce((acc, dept) => {
    const schoolId = dept.facultyId;
    if (!acc[schoolId]) {
      acc[schoolId] = {
        school: dept.faculty,
        departments: [],
      };
    }
    acc[schoolId].departments.push(dept);
    return acc;
  }, {} as Record<string, { school: any; departments: Department[] }>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-gray-500 mt-3">Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-600" />
            Department Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage departments under schools ({filteredDepartments.length} departments)
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Department
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            className="pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white min-w-[200px]"
          >
            <option value="">All Schools</option>
            {schools.map(school => (
              <option key={school.id} value={school.id}>
                {school.shortName || school.facultyName}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Departments grouped by school */}
      <div className="space-y-6">
        {Object.entries(groupedDepartments).map(([schoolId, { school, departments: depts }]) => (
          <div key={schoolId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* School Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <School className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {school?.facultyName || 'Unknown School'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {school?.facultyCode} • {depts.length} department{depts.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Departments Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      HOD
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Faculty
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Programmes
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {depts.map(dept => (
                    <tr key={dept.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{dept.departmentName}</p>
                          <p className="text-sm text-gray-500">{dept.departmentCode}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {dept.headOfDepartment ? (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-600 font-medium text-sm">
                                {dept.headOfDepartment.employeeDetails?.firstName?.[0] || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {dept.headOfDepartment.employeeDetails?.displayName ||
                                  `${dept.headOfDepartment.employeeDetails?.firstName || ''} ${dept.headOfDepartment.employeeDetails?.lastName || ''}`}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Not assigned</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {dept._count?.primaryEmployees || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <BookOpen className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {dept._count?.programs || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(dept)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            dept.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {dept.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(dept)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(dept)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {filteredDepartments.length ===
   0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No departments found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || selectedSchool 
                ? 'Try adjusting your filters'
                : 'Get started by adding your first department'}
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Department
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingDepartment ? 'Edit Department' : 'Create New Department'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* School Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  School <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.facultyId}
                  onChange={(e) => setFormData({ ...formData, facultyId: e.target.value })}
                  disabled={!!editingDepartment}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select School</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.facultyName} ({school.facultyCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Code & Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.departmentCode}
                    onChange={(e) => setFormData({ ...formData, departmentCode: e.target.value.toUpperCase() })}
                    placeholder="e.g., CS, ME, EE"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Short Name
                  </label>
                  <input
                    type="text"
                    value={formData.shortName}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    placeholder="e.g., CSE"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.departmentName}
                  onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
                  placeholder="e.g., Computer Science and Engineering"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Brief description of the department..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Contact Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="dept@university.ac.in"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="Phone number"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Office Location & Year */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Office Location</label>
                  <input
                    type="text"
                    value={formData.officeLocation}
                    onChange={(e) => setFormData({ ...formData, officeLocation: e.target.value })}
                    placeholder="Building, Room No."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Established Year</label>
                  <input
                    type="number"
                    value={formData.establishedYear}
                    onChange={(e) => setFormData({ ...formData, establishedYear: parseInt(e.target.value) })}
                    min="1900"
                    max={new Date().getFullYear()}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingDepartment ? 'Update' : 'Create'}
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
