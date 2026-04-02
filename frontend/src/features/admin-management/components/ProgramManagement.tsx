'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
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
  Building2,
  School,
  Clock,
  Award,
} from 'lucide-react';
import { programService, Program, CreateProgramDto, ProgramType } from '@/features/admin-management/services/program.service';
import { departmentService, Department } from '@/features/admin-management/services/department.service';
import { schoolService, School as SchoolType } from '@/features/admin-management/services/school.service';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

export default function ProgramManagement() {
  const toast = useToast();
  const { confirmDelete } = useConfirm();
  
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [schools, setSchools] = useState<SchoolType[]>([]);
  const [programTypes, setProgramTypes] = useState<ProgramType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedProgramType, setSelectedProgramType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState<CreateProgramDto>({
    departmentId: '',
    programCode: '',
    programName: '',
    programType: 'UG',
    shortName: '',
    description: '',
    durationYears: undefined,
    durationSemesters: undefined,
    totalCredits: undefined,
    admissionCapacity: undefined,
    accreditationBody: '',
    accreditationStatus: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [programResponse, deptResponse, schoolResponse, typesResponse] = await Promise.all([
        programService.getAllPrograms(),
        departmentService.getAllDepartments(),
        schoolService.getAllSchools(),
        programService.getProgramTypes(),
      ]);
      setPrograms(programResponse.data);
      setDepartments(deptResponse.data);
      setSchools(schoolResponse.data);
      setProgramTypes(typesResponse.data);
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      logger.error('Failed to fetch program data', err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (program?: Program) => {
    if (program) {
      setEditingProgram(program);
      setFormData({
        departmentId: program.departmentId,
        programCode: program.programCode,
        programName: program.programName,
        programType: program.programType,
        shortName: program.shortName || '',
        description: program.description || '',
        durationYears: program.durationYears || undefined,
        durationSemesters: program.durationSemesters || undefined,
        totalCredits: program.totalCredits || undefined,
        admissionCapacity: program.admissionCapacity || undefined,
        accreditationBody: program.accreditationBody || '',
        accreditationStatus: program.accreditationStatus || '',
      });
    } else {
      setEditingProgram(null);
      setFormData({
        departmentId: selectedDepartment || '',
        programCode: '',
        programName: '',
        programType: 'UG',
        shortName: '',
        description: '',
        durationYears: undefined,
        durationSemesters: undefined,
        totalCredits: undefined,
        admissionCapacity: undefined,
        accreditationBody: '',
        accreditationStatus: '',
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      if (!formData.departmentId || !formData.programCode || !formData.programName || !formData.programType) {
        setError('Please fill in all required fields');
        toast.warning('Please fill in all required fields');
        return;
      }

      if (editingProgram) {
        await programService.updateProgram(editingProgram.id, formData);
        toast.success('Program updated successfully');
      } else {
        await programService.createProgram(formData);
        toast.success('Program created successfully');
      }

      setShowModal(false);
      fetchData();
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (program: Program) => {
    const confirmed = await confirmDelete(program.programName);
    if (!confirmed) return;

    try {
      await programService.deleteProgram(program.id);
      toast.success('Program deleted successfully');
      fetchData();
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      setError(message);
      toast.error(message);
    }
  };

  const handleToggleStatus = async (program: Program) => {
    try {
      await programService.toggleProgramStatus(program.id);
      toast.success(`Program ${program.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchData();
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      setError(message);
      toast.error(message);
    }
  };

  // Filter departments by selected school
  const filteredDepartments = departments.filter(dept => 
    !selectedSchool || dept.facultyId ===
   selectedSchool
  );

  // Filter programs
  const filteredPrograms = programs.filter(prog => {
    const matchesSchool = !selectedSchool || prog.department?.faculty?.id ===
   selectedSchool;
    const matchesDepartment = !selectedDepartment || prog.departmentId ===
   selectedDepartment;
    const matchesType = !selectedProgramType || prog.programType ===
   selectedProgramType;
    const matchesSearch = !searchTerm ||
      prog.programName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prog.programCode.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSchool && matchesDepartment && matchesType && matchesSearch;
  });

  // Group programs by department
  const groupedPrograms = filteredPrograms.reduce((acc, prog) => {
    const deptId = prog.departmentId;
    if (!acc[deptId]) {
      acc[deptId] = {
        department: prog.department,
        programs: [],
      };
    }
    acc[deptId].programs.push(prog);
    return acc;
  }, {} as Record<string, { department: any; programs: Program[] }>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-gray-500 mt-3">Loading programs...</p>
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
            <GraduationCap className="w-7 h-7 text-blue-600" />
            Program Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage programs under departments ({filteredPrograms.length} programs)
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Program
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-5 h-5 text-red-600" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search programs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* School Filter */}
          <div className="relative">
            <School className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedSchool}
              onChange={(e) => {
                setSelectedSchool(e.target.value);
                setSelectedDepartment('');
              }}
              className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="">All Schools</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.facultyName}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="">All Departments</option>
              {filteredDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.departmentName}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          {/* Program Type Filter */}
          <div className="relative">
            <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedProgramType}
              onChange={(e) => setSelectedProgramType(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="">All Types</option>
              {programTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Programs List Grouped by Department */}
      {Object.keys(groupedPrograms).length ===
   0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700">No programs found</h3>
          <p className="text-gray-500 mt-1">
            {searchTerm || selectedSchool || selectedDepartment || selectedProgramType
              ? 'Try adjusting your filters'
              : 'Click "Add Program" to create one'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedPrograms).map(({ department, programs: deptPrograms }) => (
            <div key={department?.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Department Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gray-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{department?.departmentName}</h3>
                    <p className="text-sm text-gray-500">
                      {department?.faculty?.facultyName} • {deptPrograms.length} program(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Programs Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Program
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Capacity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {deptPrograms.map((program) => (
                      <tr key={program.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{program.programName}</p>
                            <p className="text-sm text-gray-500">{program.programCode}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {program.programType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            {program.durationYears ? `${program.durationYears} Years` : '-'}
                            {program.durationSemesters && ` (${program.durationSemesters} Sem)`}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">
                              {program.currentEnrollment || 0} / {program.admissionCapacity || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleStatus(program)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              program.isActive
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {program.isActive ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                Active
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3.5 h-3.5" />
                                Inactive
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(program)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(program)}
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
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingProgram ? 'Edit Program' : 'Add New Program'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.departmentName} ({dept.faculty?.facultyName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Program Code and Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Program Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.programCode}
                    onChange={(e) => setFormData({ ...formData, programCode: e.target.value.toUpperCase() })}
                    placeholder="e.g., BTECH-CSE"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    placeholder="e.g., B.Tech CSE"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Program Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Program Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.programName}
                  onChange={(e) => setFormData({ ...formData, programName: e.target.value })}
                  placeholder="e.g., Bachelor of Technology in Computer Science"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Program Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Program Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.programType}
                  onChange={(e) => setFormData({ ...formData, programType: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {programTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration and Credits */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (Years)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.durationYears || ''}
                    onChange={(e) => setFormData({ ...formData, durationYears: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="e.g., 4"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Semesters
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.durationSemesters || ''}
                    onChange={(e) => setFormData({ ...formData, durationSemesters: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="e.g., 8"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Credits
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.totalCredits || ''}
                    onChange={(e) => setFormData({ ...formData, totalCredits: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="e.g., 160"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Admission Capacity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admission Capacity
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.admissionCapacity || ''}
                  onChange={(e) => setFormData({ ...formData, admissionCapacity: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Maximum students per batch"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Accreditation */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accreditation Body
                  </label>
                  <input
                    type="text"
                    value={formData.accreditationBody}
                    onChange={(e) => setFormData({ ...formData, accreditationBody: e.target.value })}
                    placeholder="e.g., NBA, NAAC"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accreditation Status
                  </label>
                  <select
                    value={formData.accreditationStatus}
                    onChange={(e) => setFormData({ ...formData, accreditationStatus: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Status</option>
                    <option value="Accredited">Accredited</option>
                    <option value="Applied">Applied</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Not Applied">Not Applied</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the program..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingProgram ? 'Update Program' : 'Create Program'}
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
