'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/shared/api/api';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { 
  GraduationCap, Plus, Edit, Search, Filter, UserCheck, UserX, 
  Key, ChevronDown, X, Loader2, AlertCircle, CheckCircle, Upload
} from 'lucide-react';
import { validateCreateStudent, validateUpdateStudent } from '@/shared/validations/student.validation';

interface Program {
  id: string;
  programName: string;
  programCode: string;
  department?: {
    departmentName: string;
    faculty?: {
      facultyName: string;
    };
  };
}

interface Section {
  id: string;
  sectionCode: string;
  academicYear: string;
  semester: number;
}

interface FacultyOption {
  id: string;
  uid: string;
  name: string;
  email?: string | null;
}

interface Student {
  id: string;
  studentId: string;
  registrationNo: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  displayName: string;
  email: string;
  phone: string | null;
  currentSemester: number;
  isActive: boolean;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  parentContact: string | null;
  emergencyContact: string | null;
  address: string | null;
  mentorId?: string | null;
  mentor?: {
    id: string;
    uid: string;
    employeeDetails?: { firstName?: string; lastName?: string; displayName?: string };
  };
  userLogin?: {
    uid: string;
    email: string;
    status: string;
  };
  program?: Program;
  section?: Section;
}

export default function StudentManagement() {
  const { toast } = useToast();
  const { confirmDelete } = useConfirm();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    studentId: '',
    registrationNo: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    programId: '',
    sectionId: '',
    mentorId: '',
    currentSemester: '1',
    admissionDate: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    parentContact: '',
    emergencyContact: '',
    address: '',
  });
  const [mentors, setMentors] = useState<FacultyOption[]>([]);
  const [mentorError, setMentorError] = useState('');

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/students', {
        params: {
          programId: filterProgram !== 'all' ? filterProgram : undefined,
          isActive: filterStatus !== 'all' ? filterStatus : undefined,
          search: searchQuery || undefined,
          page: pagination.page,
          limit: pagination.limit,
        },
      });
      setStudents(response.data.data);
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination,
      }));
    } catch (error) {
      logger.error('Error fetching students:', error);
      toast({ type: 'error', message: 'Failed to fetch students' });
    } finally {
      setLoading(false);
    }
  }, [filterProgram, filterStatus, searchQuery, pagination.page, pagination.limit, toast]);

  const fetchPrograms = useCallback(async () => {
    try {
      const response = await api.get('/students/programs');
      setPrograms(response.data.data);
    } catch (error) {
      logger.error('Error fetching programs:', error);
    }
  }, []);

  const fetchSections = useCallback(async (programId: string) => {
    try {
      const response = await api.get(`/students/programs/${programId}/sections`);
      setSections(response.data.data);
    } catch (error) {
      logger.error('Error fetching sections:', error);
      setSections([]);
    }
  }, []);

  const fetchFacultyByProgram = useCallback(async (programId: string) => {
    try {
      const response = await api.get(`/students/programs/${programId}/faculty`);
      setMentors(response.data.data || []);
      setMentorError('');
    } catch (error) {
      logger.error('Error fetching faculty:', error);
      setMentors([]);
      setMentorError('Could not load mentors for this program.');
    }
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchPrograms();
  }, [fetchStudents, fetchPrograms]);

  useEffect(() => {
    if (formData.programId) {
      fetchSections(formData.programId);
      fetchFacultyByProgram(formData.programId);
    } else {
      setSections([]);
      setMentors([]);
      setMentorError('');
    }
  }, [formData.programId, fetchSections, fetchFacultyByProgram]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchStudents();
  };

  const resetForm = () => {
    setFormData({
      studentId: '',
      registrationNo: '',
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      programId: '',
      sectionId: '',
      mentorId: '',
      currentSemester: '1',
      admissionDate: '',
      dateOfBirth: '',
      gender: '',
      bloodGroup: '',
      parentContact: '',
      emergencyContact: '',
      address: '',
    });
    setEditingStudent(null);
    setSections([]);
    setMentors([]);
    setMentorError('');
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      studentId: student.studentId,
      registrationNo: student.registrationNo || '',
      firstName: student.firstName,
      middleName: student.middleName || '',
      lastName: student.lastName || '',
      email: student.email,
      phone: student.phone || '',
      password: '',
      programId: student.program?.id || '',
      sectionId: student.section?.id || '',
      mentorId: student.mentorId || student.mentor?.id || '',
      currentSemester: student.currentSemester.toString(),
      admissionDate: '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
      gender: student.gender || '',
      bloodGroup: student.bloodGroup || '',
      parentContact: student.parentContact || '',
      emergencyContact: student.emergencyContact || '',
      address: student.address || '',
    });
    if (student.program?.id) {
      fetchSections(student.program.id);
      fetchFacultyByProgram(student.program.id);
    } else {
      setMentors([]);
    }
    setMentorError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMentorError('');
    setFormErrors({});

    // Mentor is now optional. If provided, validate that program is selected first.
    if (!editingStudent && formData.mentorId && !formData.programId) {
      setMentorError('Please select a program first to assign a mentor.');
      return;
    }

    // Prepare data for validation
    const dataToValidate = {
      ...formData,
      sectionId: formData.sectionId || '',
      mentorId: formData.mentorId || '',
      registrationNo: formData.registrationNo || '',
      middleName: formData.middleName || '',
      password: formData.password || '',
      admissionDate: formData.admissionDate || '',
      dateOfBirth: formData.dateOfBirth || '',
      gender: formData.gender || '',
      bloodGroup: formData.bloodGroup || '',
      parentContact: formData.parentContact || '',
      emergencyContact: formData.emergencyContact || '',
      address: formData.address || '',
    };

    // Validate using Zod schema
    const validation = editingStudent
      ? validateUpdateStudent(dataToValidate)
      : validateCreateStudent(dataToValidate);

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

    setSubmitting(true);
    try {
      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, validation.data);
        toast({ type: 'success', message: 'Student updated successfully' });
      } else {
        await api.post('/students', validation.data);
        toast({ type: 'success', message: 'Student created successfully' });
      }
      setShowModal(false);
      resetForm();
      fetchStudents();
    } catch (error: unknown) {
      logger.error('Error saving student:', error);
      const msg = extractErrorMessage(error);
      const errCode = (error as { response?: { data?: { error?: string; errors?: Record<string, string> } } })?.response?.data?.error;
      
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
            toast({ type: 'error', message: firstBackendError });
            return;
          }
        }
      }

      const isMentorError = errCode && ['MENTOR_REQUIRED', 'MENTOR_NOT_FOUND', 'MENTOR_NOT_FACULTY', 'MENTOR_DIFFERENT_DEPARTMENT'].includes(errCode);
      if (msg && (isMentorError || msg.toLowerCase().includes('mentor'))) {
        setMentorError(msg);
      }
      toast({ type: 'error', message: msg || 'Failed to save student' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (student: Student) => {
    try {
      await api.patch(`/students/${student.id}/toggle-status`, {});
      toast({ 
        type: 'success', 
        message: `Student ${student.isActive ? 'deactivated' : 'activated'} successfully` 
      });
      fetchStudents();
    } catch (error: unknown) {
      toast({ 
        type: 'error', 
        message: extractErrorMessage(error) || 'Failed to update status' 
      });
    }
  };

  const handleResetPassword = async (student: Student) => {
    const confirmed = await confirmDelete(
      'Reset Password',
      `Are you sure you want to reset the password for ${student.displayName} to default (Welcome@123)?`
    );
    if (!confirmed) return;
    
    try {
      await api.patch(`/students/${student.id}/reset-password`, {});
      toast({ type: 'success', message: 'Password reset successfully' });
    } catch (error: unknown) {
      toast({ 
        type: 'error', 
        message: extractErrorMessage(error) || 'Failed to reset password' 
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Student Management</h1>
              <p className="text-sm text-gray-500">Add, edit, and manage students</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/bulk-upload')}
              className="flex items-center gap-2 px-4 py-2 border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50 transition-all shadow-sm"
            >
              <Upload className="w-5 h-5" />
              Bulk Upload
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add Student
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key ===
   'Enter' && handleSearch()}
                  placeholder="Search by ID, name, email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Programs</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.programCode} - {program.programName}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : students.length ===
   0 ? (
            <div className="text-center py-12">
              <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No students found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID/Reg No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Program</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Section</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Semester</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{student.displayName}</p>
                          <p className="text-sm text-gray-500">{student.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm text-gray-900">{student.studentId}</p>
                        {student.registrationNo && (
                          <p className="text-xs text-gray-500">Reg: {student.registrationNo}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900">{student.program?.programCode || 'N/A'}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[150px]">{student.program?.programName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                          {student.section?.sectionCode || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                          Sem {student.currentSemester}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          student.isActive 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {student.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          {student.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(student)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(student)}
                            className={`p-1.5 rounded-lg transition-all ${
                              student.isActive 
                                ? 'text-red-600 hover:bg-red-50' 
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={student.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {student.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleResetPassword(student)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page ===
   1}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page ===
   pagination.totalPages}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-8 h-8" />
                  <div>
                    <h2 className="text-xl font-bold">{editingStudent ? 'Edit Student' : 'Add New Student'}</h2>
                    <p className="text-orange-100 text-sm">Fill in the student details</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Student ID / Registration No <span className="text-red-500">*</span>
                        <span className="text-gray-500 text-xs ml-1">(9-10 digits only)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.studentId}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setFormData({ ...formData, studentId: value, registrationNo: value });
                        }}
                        disabled={!!editingStudent}
                        maxLength={10}
                        placeholder="9-10 digits only"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 ${
                          formErrors.studentId ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        required
                      />
                      {formErrors.studentId && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.studentId}
                        </div>
                      )}
                    </div>
                    <div className="hidden">
                      <input
                        type="text"
                        value={formData.registrationNo}
                        onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        tabIndex={-1}
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
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                          formErrors.firstName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        required
                      />
                      {formErrors.firstName && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.firstName}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                      <input
                        type="text"
                        value={formData.middleName}
                        onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
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
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={!!editingStudent}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 ${
                          formErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        required
                      />
                      {formErrors.email && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.email}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        placeholder="10 digit number"
                        maxLength={10}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                          formErrors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {formErrors.phone && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.phone}
                        </div>
                      )}
                    </div>
                    {!editingStudent && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password <span className="text-gray-400">(Default: Welcome@123)</span>
                        </label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Leave empty for default"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
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
                  </div>
                </div>

                {/* Academic Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Program <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.programId}
                        onChange={(e) => setFormData({ ...formData, programId: e.target.value, sectionId: '', mentorId: '' })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                          formErrors.programId ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        required
                      >
                        <option value="">Select Program</option>
                        {programs.map((program) => (
                          <option key={program.id} value={program.id}>
                            {program.programCode} - {program.programName}
                          </option>
                        ))}
                      </select>
                      {formErrors.programId && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.programId}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assign Mentor <span className="text-gray-500 text-xs">(Optional)</span>
                      </label>
                      <select
                        value={formData.mentorId}
                        onChange={(e) => { setFormData({ ...formData, mentorId: e.target.value }); setMentorError(''); }}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${mentorError ? 'border-red-500' : 'border-gray-300'}`}
                        disabled={!formData.programId}
                        title={!formData.programId ? 'Select a program first' : ''}
                      >
                        <option value="">
                          {!formData.programId ? 'Select program first' : 'Select Mentor (Optional)'}
                        </option>
                        {mentors.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.uid})
                          </option>
                        ))}
                      </select>
                      {mentorError && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1" role="alert">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {mentorError}
                        </p>
                      )}
                      {!mentorError && (
                        <p className="mt-1 text-sm text-gray-500">
                          Mentor assignment is optional. If assigned, mentor must be from the same department.
                        </p>
                      )}
                      {formData.programId && mentors.length ===
   0 && !mentorError && (
                        <p className="mt-1 text-sm text-amber-600">No faculty found in this department.</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Section
                      </label>
                      <select
                        value={formData.sectionId}
                        onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 ${
                          formErrors.sectionId ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                        disabled={!formData.programId}
                      >
                        <option value="">Select Section</option>
                        {sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.sectionCode} ({section.academicYear} - Sem {section.semester})
                          </option>
                        ))}
                      </select>
                      {formErrors.sectionId && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.sectionId}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Semester</label>
                      <select
                        value={formData.currentSemester}
                        onChange={(e) => setFormData({ ...formData, currentSemester: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                          formErrors.currentSemester ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((sem) => (
                          <option key={sem} value={sem}>Semester {sem}</option>
                        ))}
                      </select>
                      {formErrors.currentSemester && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.currentSemester}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Admission Date</label>
                      <input
                        type="date"
                        value={formData.admissionDate}
                        onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                          formErrors.admissionDate ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {formErrors.admissionDate && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.admissionDate}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Personal Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                      <select
                        value={formData.bloodGroup}
                        onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                          formErrors.bloodGroup ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select Blood Group</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                      {formErrors.bloodGroup && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.bloodGroup}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parent Contact</label>
                      <input
                        type="tel"
                        value={formData.parentContact}
                        onChange={(e) => setFormData({ ...formData, parentContact: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        placeholder="10 digit number"
                        maxLength={10}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                          formErrors.parentContact ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {formErrors.parentContact && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.parentContact}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                      <input
                        type="tel"
                        value={formData.emergencyContact}
                        onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        placeholder="10 digit number"
                        maxLength={10}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                          formErrors.emergencyContact ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {formErrors.emergencyContact && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.emergencyContact}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        rows={2}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                          formErrors.address ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {formErrors.address && (
                        <div className="flex items-center mt-1 text-red-600 text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.address}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-4">
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg hover:from-orange-600 hover:to-amber-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingStudent ? 'Update Student' : 'Create Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
