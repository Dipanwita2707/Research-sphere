'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/shared/api/api';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { Users, Plus, Edit, Trash2, Search, Filter, UserCheck, UserX, AlertCircle, X } from 'lucide-react';
import { centralDepartmentService, CentralDepartment } from '@/features/admin-management/services/centralDepartment.service';
import { validateCreateEmployee, validateUpdateEmployee } from '@/shared/validations/employee.validation';

interface School {
  id: string;
  facultyName: string;
  departments?: Department[];
}

interface Department {
  id: string;
  departmentName: string;
}

interface Employee {
  id: string;
  uid: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  employeeDetails: {
    empId: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    displayName: string;
    designation: string;
    employeeCategory: string;
    employeeType: string;
    officerLevel?: string;
    gender?: string;
    dateOfBirth?: string;
    mobileNumber: string;
    alternateNumber?: string;
    personalEmail?: string;
    currentAddress?: string;
    permanentAddress?: string;
    dateOfJoining: string;
    schoolId?: string;
    departmentId?: string;
    centralDepartmentId?: string;
    schoolName?: string;
    departmentName?: string;
    centralDepartmentName?: string;
    school?: { facultyName: string };
    department?: { departmentName: string };
  };
}

export default function EmployeeManagement() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [centralDepartments, setCentralDepartments] = useState<CentralDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDesignation, setFilterDesignation] = useState('all');
  const [designations, setDesignations] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [formData, setFormData] = useState({
    uid: '',
    email: '',
    password: '',
    role: 'faculty',
    empId: '',
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    mobileNumber: '',
    alternateNumber: '',
    personalEmail: '',
    designation: '',
    officerLevel: '',
    employeeCategory: 'teaching',
    employeeType: 'permanent',
    dateOfJoining: '',
    schoolId: '',
    departmentId: '',
    centralDepartmentId: '',
    currentAddress: '',
    permanentAddress: '',
  });

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/employees', {
        params: {
          role: filterRole !== 'all' ? filterRole : undefined,
          employeeCategory: filterCategory !== 'all' ? filterCategory : undefined,
          designation: filterDesignation !== 'all' ? filterDesignation : undefined,
          search: searchQuery || undefined,
        },
      });
      setEmployees(response.data.data);
    } catch (error) {
      logger.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterCategory, filterDesignation, searchQuery]);

  const fetchDesignations = useCallback(async () => {
    try {
      const response = await api.get('/employees/designations');
      setDesignations(response.data?.data ?? []);
    } catch (error) {
      logger.error('Error fetching designations:', error);
    }
  }, []);

  const fetchSchools = useCallback(async () => {
    try {
      const response = await api.get('/schools');
      setSchools(response.data.data);
    } catch (error) {
      logger.error('Error fetching schools:', error);
    }
  }, []);

  const fetchCentralDepartments = useCallback(async () => {
    try {
      const response = await centralDepartmentService.getAllCentralDepartments({ isActive: true });
      setCentralDepartments(response.data);
    } catch (error) {
      logger.error('Error fetching central departments:', error);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
    fetchCentralDepartments();
  }, [fetchSchools, fetchCentralDepartments]);

  useEffect(() => {
    if (formData.schoolId) {
      const school = schools.find((s) => s.id ===
   formData.schoolId);
      setDepartments(school?.departments || []);
      // Clear central department selection when school is selected
      setFormData(prev => ({ ...prev, centralDepartmentId: '' }));
    } else {
      setDepartments([]);
    }
  }, [formData.schoolId, schools]);

  // Clear school and department selection when central department is selected
  useEffect(() => {
    if (formData.centralDepartmentId) {
      setFormData(prev => ({ ...prev, schoolId: '', departmentId: '' }));
    }
  }, [formData.centralDepartmentId]);

  // Auto-populate Employee ID with UID during creation
  useEffect(() => {
    if (!editingEmployee) {
      setFormData(prev => (prev.empId ===
   formData.uid ? prev : { ...prev, empId: formData.uid }));
    }
  }, [formData.uid, editingEmployee]);

  const handleOpenModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        uid: employee.uid,
        email: employee.email,
        password: '',
        role: employee.role,
        empId: employee.employeeDetails.empId,
        firstName: employee.employeeDetails.firstName,
        middleName: employee.employeeDetails.middleName || '',
        lastName: employee.employeeDetails.lastName,
        dateOfBirth: '',
        gender: '',
        mobileNumber: employee.employeeDetails.mobileNumber,
        alternateNumber: '',
        personalEmail: '',
        designation: employee.employeeDetails.designation || '',
        employeeCategory: employee.employeeDetails.employeeCategory,
        employeeType: employee.employeeDetails.employeeType,
        dateOfJoining: employee.employeeDetails.dateOfJoining,
        schoolId: employee.employeeDetails.schoolId || '',
        departmentId: employee.employeeDetails.departmentId || '',
        centralDepartmentId: employee.employeeDetails.centralDepartmentId || '',
        currentAddress: '',
        permanentAddress: '',
        officerLevel: (employee.employeeDetails as Record<string, unknown>).officerLevel as string || '',
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        uid: '',
        email: '',
        password: '',
        role: 'faculty',
        empId: '',
        firstName: '',
        middleName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
        mobileNumber: '',
        alternateNumber: '',
        personalEmail: '',
        designation: '',
        officerLevel: '',
        employeeCategory: 'teaching',
        employeeType: 'permanent',
        dateOfJoining: '',
        schoolId: '',
        departmentId: '',
        centralDepartmentId: '',
        currentAddress: '',
        permanentAddress: '',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Reset errors
      setFormErrors({});

      // Prepare data for validation
      const dataToValidate = {
        ...formData,
        schoolId: formData.schoolId || '',
        departmentId: formData.departmentId || '',
        centralDepartmentId: formData.centralDepartmentId || '',
        middleName: formData.middleName || '',
        dateOfBirth: formData.dateOfBirth || '',
        alternateNumber: formData.alternateNumber || '',
        personalEmail: formData.personalEmail || '',
        currentAddress: formData.currentAddress || '',
        permanentAddress: formData.permanentAddress || '',
      };

      // Validate using Zod schema
      const validation = editingEmployee
        ? validateUpdateEmployee(dataToValidate)
        : validateCreateEmployee(dataToValidate);

      if (!validation.success) {
        // Set errors in state for display
        const errors: Record<string, string> = {};
        const issues = validation.error?.issues ?? (validation.error as any)?.errors ?? [];
        issues.forEach((issue: any) => {
          const path = Array.isArray(issue.path) ? issue.path.join('.') : '';
          errors[path || 'form'] = issue.message;
        });
        setFormErrors(errors);
        const firstErrorMessage = issues[0]?.message || 'Please fix the highlighted validation errors';
        toast({ type: 'error', message: firstErrorMessage });
        return;
      }

      // Clean up the form data - remove empty strings and replace with null
      const cleanFormData = {
        ...validation.data,
        schoolId: validation.data.schoolId || null,
        departmentId: validation.data.departmentId || null,
        primaryCentralDeptId: validation.data.centralDepartmentId || null,
        middleName: validation.data.middleName || null,
        dateOfBirth: validation.data.dateOfBirth || null,
        alternateNumber: validation.data.alternateNumber || null,
        personalEmail: validation.data.personalEmail || null,
        currentAddress: validation.data.currentAddress || null,
        permanentAddress: validation.data.permanentAddress || null,
      };

      // Remove centralDepartmentId from the payload since backend expects primaryCentralDeptId
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { centralDepartmentId, ...finalFormData } = cleanFormData;

      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, finalFormData);
        toast({ type: 'success', message: 'Employee updated successfully!' });
      } else {
        await api.post('/employees', finalFormData);
        toast({ type: 'success', message: 'Employee created successfully!' });
      }
      setShowModal(false);
      fetchEmployees();
    } catch (error: unknown) {
      let errorMsg = extractErrorMessage(error);
      // Check if error response has validation errors
      if (typeof error ===
   'object' && error !== null && 'response' in error) {
        const response = (error as any).response;
        if (response?.data?.errors && typeof response.data.errors ===
   'object') {
          setFormErrors(response.data.errors);
          const firstBackendError = Object.values(response.data.errors)[0];
          if (typeof firstBackendError ===
   'string' && firstBackendError.trim()) {
            errorMsg = firstBackendError;
          }
        }
      }
      toast({ type: 'error', message: errorMsg || 'Failed to save employee' });
    }
  };

  const handleToggleStatus = async (employee: Employee) => {
    try {
      await api.patch(`/employees/${employee.id}/toggle-status`, {});
      fetchEmployees();
    } catch (error) {
      toast({ type: 'error', message: 'Failed to toggle employee status' });
    }
  };

  const handleDelete = async (employee: Employee) => {
    const name = employee.employeeDetails?.displayName || employee.uid;
    if (!confirm(`Are you sure you want to delete "${name}"? This will remove the employee and their login. This action cannot be undone.`)) {
      return;
    }
    try {
      setDeletingId(employee.id);
      await api.delete(`/employees/${employee.id}`);
      toast({ type: 'success', message: 'Employee deleted successfully' });
      fetchEmployees();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) || 'Failed to delete employee' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenDetailsModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDetailsModal(true);
  };

  const formatDate = (value?: string) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchEmployees();
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [fetchEmployees]);

  useEffect(() => {
    fetchDesignations();
  }, [fetchDesignations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Users className="mr-3 text-blue-600" />
          Employee Management
        </h1>
        <p className="text-gray-600 mt-2">Manage faculty and staff members</p>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, UID, or empID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="faculty">Faculty</option>
            <option value="staff">Staff</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="teaching">Teaching</option>
            <option value="non_teaching">Non-Teaching</option>
          </select>
          <select
            value={filterDesignation}
            onChange={(e) => setFilterDesignation(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Designations</option>
            {designations.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Emp ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                UID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Designation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                School
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => (
              <tr
                key={employee.id}
                className="hover:bg-blue-50 cursor-pointer"
                onClick={() => handleOpenDetailsModal(employee)}
                title="Click to view full employee details"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {employee.employeeDetails.empId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDetailsModal(employee);
                    }}
                    className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    {employee.employeeDetails.displayName}
                  </button>
                  <div className="text-sm text-gray-500">
                    {employee.employeeDetails.mobileNumber}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {employee.uid}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {employee.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {employee.employeeDetails.designation}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    employee.employeeDetails.employeeCategory ===
   'teaching'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {employee.employeeDetails.employeeCategory}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {employee.employeeDetails.employeeType || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {employee.employeeDetails.departmentName || employee.employeeDetails.department?.departmentName || employee.employeeDetails.centralDepartmentName || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {employee.employeeDetails.schoolName || employee.employeeDetails.school?.facultyName || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(employee.employeeDetails.dateOfJoining)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleStatus(employee)}
                    className={`flex items-center px-2 py-1 text-xs rounded-full ${
                      employee.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {employee.isActive ? (
                      <>
                        <UserCheck className="w-3 h-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <UserX className="w-3 h-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenModal(employee);
                    }}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(employee);
                    }}
                    disabled={deletingId ===
   employee.id}
                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId ===
   employee.id ? (
                      <span className="inline-block w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {employees.length ===
   0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No employees found</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} noValidate className="p-6 space-y-6">
              {/* Login Credentials */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Login Credentials</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      UID <span className="text-red-500">*</span>
                      <span className="text-gray-500 text-xs ml-1">(4-5 digits only)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.uid}
                      onChange={(e) => {
                        const uidValue = e.target.value.replace(/\D/g, '').slice(0, 5);
                        setFormData({
                          ...formData,
                          uid: uidValue,
                          // Keep Employee ID in sync with UID during creation
                          empId: editingEmployee ? formData.empId : uidValue,
                        });
                      }}
                      placeholder="4-5 digits"
                      maxLength={5}
                      required
                      disabled={!!editingEmployee}
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.uid ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.uid && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.uid}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.email && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.email}
                      </div>
                    )}
                  </div>
                  {!editingEmployee && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required={!editingEmployee}
                        className={`w-full px-3 py-2 border rounded-md ${
                          formErrors.password ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {formErrors.password && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.password}
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      required
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.role ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    >
                      <option value="faculty">Faculty</option>
                      <option value="staff">Staff</option>
                    </select>
                    {formErrors.role && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.role}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Details */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Personal Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee ID <span className="text-red-500">*</span>
                      <span className="text-gray-500 text-xs ml-1">(auto-filled from UID, 4-5 digits)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.empId}
                      onChange={(e) => setFormData({ ...formData, empId: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                      required
                      disabled={!editingEmployee}
                      maxLength={5}
                      placeholder="4-5 digits"
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.empId ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      } ${!editingEmployee ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                    {formErrors.empId && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.empId}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.firstName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.firstName && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.firstName}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Middle Name
                    </label>
                    <input
                      type="text"
                      value={formData.middleName}
                      onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.middleName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.middleName && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.middleName}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.lastName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.lastName && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.lastName}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.gender ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    {formErrors.gender && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.gender}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.mobileNumber}
                      onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      placeholder="10 digit number"
                      maxLength={10}
                      required
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.mobileNumber ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.mobileNumber && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.mobileNumber}
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Contact Details */}
                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alternate Number
                    </label>
                    <input
                      type="tel"
                      value={formData.alternateNumber}
                      onChange={(e) => setFormData({ ...formData, alternateNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      placeholder="10 digit number (optional)"
                      maxLength={10}
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.alternateNumber ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.alternateNumber && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.alternateNumber}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Personal Email
                    </label>
                    <input
                      type="email"
                      value={formData.personalEmail}
                      onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                      placeholder="Personal email (optional)"
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.personalEmail ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.personalEmail && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.personalEmail}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.dateOfBirth ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.dateOfBirth && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.dateOfBirth}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Professional Details */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Professional Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Designation <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      required
                      placeholder="Professor, Assistant Professor, etc."
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.designation ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.designation && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.designation}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Officer Level
                    </label>
                    <select
                      value={formData.officerLevel}
                      onChange={(e) => setFormData({ ...formData, officerLevel: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.officerLevel ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Officer Level</option>
                      <option value="O1">O1</option>
                      <option value="O2">O2</option>
                      <option value="O3">O3</option>
                      <option value="O4">O4</option>
                      <option value="O5">O5</option>
                      <option value="O6">O6</option>
                      <option value="O7">O7</option>
                      <option value="O8">O8</option>
                      <option value="O9">O9</option>
                      <option value="O10">O10</option>
                    </select>
                    {formErrors.officerLevel && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.officerLevel}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.employeeCategory}
                      onChange={(e) => setFormData({ ...formData, employeeCategory: e.target.value })}
                      required
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.employeeCategory ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Employee Category</option>
                      <option value="teaching">Teaching</option>
                      <option value="non_teaching">Non-Teaching</option>
                    </select>
                    {formErrors.employeeCategory && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.employeeCategory}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee Type
                    </label>
                    <select
                      value={formData.employeeType}
                      onChange={(e) => setFormData({ ...formData, employeeType: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.employeeType ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Employee Type</option>
                      <option value="permanent">Permanent</option>
                      <option value="temporary">Temporary</option>
                      <option value="contract">Contract</option>
                      <option value="visiting">Visiting</option>
                    </select>
                    {formErrors.employeeType && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.employeeType}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Joining
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfJoining}
                      onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md ${
                        formErrors.dateOfJoining ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.dateOfJoining && (
                      <div className="flex items-center mt-1 text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {formErrors.dateOfJoining}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <div className="mb-4 p-4 bg-gray-50 rounded-md">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Department Assignment</h4>
                      <p className="text-xs text-gray-500 mb-3">
                        Choose either a School Department (for faculty/academic staff) or Central Department (for administrative staff like DRD, HR, Finance).
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            School/Faculty
                          </label>
                          <select
                            value={formData.schoolId}
                            onChange={(e) => setFormData({ ...formData, schoolId: e.target.value, departmentId: '' })}
                            disabled={!!formData.centralDepartmentId}
                            className={`w-full px-3 py-2 border rounded-md ${
                              formData.centralDepartmentId ? 'bg-gray-100 text-gray-500' : ''
                            }`}
                          >
                            <option value="">Select School</option>
                            {schools.map((school) => (
                              <option key={school.id} value={school.id}>
                                {school.facultyName}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            School Department
                          </label>
                          <select
                            value={formData.departmentId}
                            onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                            disabled={!formData.schoolId || !!formData.centralDepartmentId}
                            className={`w-full px-3 py-2 border rounded-md ${
                              (!formData.schoolId || formData.centralDepartmentId) ? 'bg-gray-100 text-gray-500' : ''
                            }`}
                          >
                            <option value="">Select Department</option>
                            {departments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.departmentName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300" />
                          </div>
                          <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-gray-50 text-gray-500">OR</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Central Department
                        </label>
                        <select
                          value={formData.centralDepartmentId}
                          onChange={(e) => setFormData({ ...formData, centralDepartmentId: e.target.value })}
                          disabled={!!formData.schoolId || !!formData.departmentId}
                          className={`w-full px-3 py-2 border rounded-md ${
                            (formData.schoolId || formData.departmentId) ? 'bg-gray-100 text-gray-500' : ''
                          }`}
                        >
                          <option value="">Select Central Department</option>
                          {centralDepartments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.departmentName} ({dept.departmentCode})
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          For DRD, HR, Finance, Admin, and other administrative departments
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingEmployee ? 'Update Employee' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Details Modal */}
      {showDetailsModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Employee Details</h2>
                <p className="text-sm text-gray-500 mt-1">Complete profile information</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Name</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedEmployee.employeeDetails.displayName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Status</p>
                  <p className={`text-sm font-semibold ${selectedEmployee.isActive ? 'text-green-700' : 'text-red-700'}`}>
                    {selectedEmployee.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Login & Identity</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">UID:</span> <span className="font-medium">{selectedEmployee.uid || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Employee ID:</span> <span className="font-medium">{selectedEmployee.employeeDetails.empId || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Role:</span> <span className="font-medium capitalize">{selectedEmployee.role || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedEmployee.email || 'N/A'}</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Mobile:</span> <span className="font-medium">{selectedEmployee.employeeDetails.mobileNumber || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Alternate:</span> <span className="font-medium">{selectedEmployee.employeeDetails.alternateNumber || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Personal Email:</span> <span className="font-medium">{selectedEmployee.employeeDetails.personalEmail || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Gender:</span> <span className="font-medium capitalize">{selectedEmployee.employeeDetails.gender || 'N/A'}</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Professional Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Designation:</span> <span className="font-medium">{selectedEmployee.employeeDetails.designation || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Officer Level:</span> <span className="font-medium">{selectedEmployee.employeeDetails.officerLevel || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Category:</span> <span className="font-medium capitalize">{selectedEmployee.employeeDetails.employeeCategory || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Type:</span> <span className="font-medium capitalize">{selectedEmployee.employeeDetails.employeeType || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Date of Joining:</span> <span className="font-medium">{formatDate(selectedEmployee.employeeDetails.dateOfJoining)}</span></div>
                  <div><span className="text-gray-500">Date of Birth:</span> <span className="font-medium">{formatDate(selectedEmployee.employeeDetails.dateOfBirth)}</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Department Assignment</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">School:</span> <span className="font-medium">{selectedEmployee.employeeDetails.schoolName || selectedEmployee.employeeDetails.school?.facultyName || 'N/A'}</span></div>
                  <div><span className="text-gray-500">School Department:</span> <span className="font-medium">{selectedEmployee.employeeDetails.departmentName || selectedEmployee.employeeDetails.department?.departmentName || 'N/A'}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Central Department:</span> <span className="font-medium">{selectedEmployee.employeeDetails.centralDepartmentName || 'N/A'}</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Address</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-500">Current Address</p>
                    <p className="font-medium text-gray-900">{selectedEmployee.employeeDetails.currentAddress || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Permanent Address</p>
                    <p className="font-medium text-gray-900">{selectedEmployee.employeeDetails.permanentAddress || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
