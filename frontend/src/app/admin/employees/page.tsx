'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/shared/api/api';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { Users, Plus, Edit, Trash2, Search, Filter, UserCheck, UserX } from 'lucide-react';
import { centralDepartmentService, CentralDepartment } from '@/features/admin-management/services/centralDepartment.service';

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
  employeeDetails: {
    empId: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    displayName: string;
    designation: string;
    employeeCategory: string;
    employeeType: string;
    mobileNumber: string;
    dateOfJoining: string;
    schoolId?: string;
    departmentId?: string;
    centralDepartmentId?: string;
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
          search: searchQuery || undefined,
        },
      });
      setEmployees(response.data.data);
    } catch (error) {
      logger.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterCategory, searchQuery]);

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
      const school = schools.find((s) => s.id === formData.schoolId);
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
      // Clean up the form data - remove empty strings and replace with null
      const cleanFormData = {
        ...formData,
        schoolId: formData.schoolId || null,
        departmentId: formData.departmentId || null,
        primaryCentralDeptId: formData.centralDepartmentId || null,
        middleName: formData.middleName || null,
        dateOfBirth: formData.dateOfBirth || null,
        alternateNumber: formData.alternateNumber || null,
        personalEmail: formData.personalEmail || null,
        currentAddress: formData.currentAddress || null,
        permanentAddress: formData.permanentAddress || null,
      };

      // Remove centralDepartmentId from the payload since backend expects primaryCentralDeptId
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
      toast({ type: 'error', message: extractErrorMessage(error) || 'Failed to save employee' });
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

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchEmployees();
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [fetchEmployees]);

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
                School
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
              <tr key={employee.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {employee.employeeDetails.empId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {employee.employeeDetails.displayName}
                  </div>
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
                    employee.employeeDetails.employeeCategory === 'teaching'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {employee.employeeDetails.employeeCategory}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {employee.employeeDetails.school?.facultyName || 'N/A'}
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
                    onClick={() => handleOpenModal(employee)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {employees.length === 0 && (
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

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Login Credentials */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Login Credentials</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      UID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.uid}
                      onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                      required
                      disabled={!!editingEmployee}
                      className="w-full px-3 py-2 border rounded-md"
                    />
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
                      className="w-full px-3 py-2 border rounded-md"
                    />
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
                        className="w-full px-3 py-2 border rounded-md"
                      />
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
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="faculty">Faculty</option>
                      <option value="staff">Staff</option>
                    </select>
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
                    </label>
                    <input
                      type="text"
                      value={formData.empId}
                      onChange={(e) => setFormData({ ...formData, empId: e.target.value })}
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    />
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
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Middle Name
                    </label>
                    <input
                      type="text"
                      value={formData.middleName}
                      onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    />
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
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.mobileNumber}
                      onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    />
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
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.employeeCategory}
                      onChange={(e) => setFormData({ ...formData, employeeCategory: e.target.value })}
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="teaching">Teaching</option>
                      <option value="non_teaching">Non-Teaching</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee Type
                    </label>
                    <select
                      value={formData.employeeType}
                      onChange={(e) => setFormData({ ...formData, employeeType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="permanent">Permanent</option>
                      <option value="temporary">Temporary</option>
                      <option value="contract">Contract</option>
                      <option value="visiting">Visiting</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Joining
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfJoining}
                      onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    />
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
    </div>
  );
}
