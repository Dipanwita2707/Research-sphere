'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Upload,
  FileText,
  Eye,
  ExternalLink,
  Power,
} from 'lucide-react';
import {
  programService,
  Program,
  CreateProgramDto,
  ProgramType,
  ProgramBatchYearDocument,
  ProgramMetadata,
} from '@/features/admin-management/services/program.service';
import { departmentService, Department } from '@/features/admin-management/services/department.service';
import { schoolService, School as SchoolType } from '@/features/admin-management/services/school.service';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

interface SpecializationDraft {
  name: string;
  chargeRules: Array<{
    batchYear: string;
    startSemester: string;
  }>;
}

interface BatchYearDocumentDraft {
  batchYear: string;
  admissionCapacity: string;
  file?: File;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
}

interface InternshipSpecializationOption {
  key: string;
  name: string;
}

const asProgramMetadata = (metadata: Program['metadata']): ProgramMetadata => {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
};

const numberOrUndefined = (value: string): number | undefined => {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function ProgramManagement() {
  const toast = useToast();
  const { confirmDelete, confirmAction } = useConfirm();
  const router = useRouter();
  
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
  const [formSchoolId, setFormSchoolId] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedProgramType, setSelectedProgramType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasSpecializations, setHasSpecializations] = useState(false);
  const [specializationDrafts, setSpecializationDrafts] = useState<SpecializationDraft[]>([]);
  const [creditRange, setCreditRange] = useState({ min: '', max: '' });
  const [batchYearDocuments, setBatchYearDocuments] = useState<BatchYearDocumentDraft[]>([]);
  const [internshipApplicable, setInternshipApplicable] = useState(false);
  const [internshipDurationMonths, setInternshipDurationMonths] = useState('');
  const [internshipSpecializations, setInternshipSpecializations] = useState<string[]>([]);
  const [detailsProgram, setDetailsProgram] = useState<Program | null>(null);
  const [ruleSavingKey, setRuleSavingKey] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateProgramDto>({
    departmentId: '',
    programCode: '',
    programName: '',
    programType: 'UG',
    shortName: '',
    description: '',
    durationYears: undefined,
    durationMonths: undefined,
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
      const existingSpecs = program.specializations || [];
      const metadata = asProgramMetadata(program.metadata);
      const chargeRules = Array.isArray(metadata.specializationChargeRules) ? metadata.specializationChargeRules : [];
      const creditMin = metadata.creditRange?.min ?? program.totalCredits;
      const creditMax = metadata.creditRange?.max ?? program.totalCredits;
      setHasSpecializations(existingSpecs.length > 0);
      setCreditRange({
        min: creditMin != null ? String(creditMin) : '',
        max: creditMax != null ? String(creditMax) : '',
      });
      setSpecializationDrafts(existingSpecs.map((spec) => ({
        name: spec.specializationName,
        chargeRules: chargeRules
          .filter((rule) => rule.specializationCode === spec.specializationCode || rule.specializationName === spec.specializationName)
          .map((rule) => ({
            batchYear: rule.batchYear != null ? String(rule.batchYear) : '',
            startSemester: rule.startSemester != null ? String(rule.startSemester) : '',
          })),
      })));
      setBatchYearDocuments(
        (Array.isArray(metadata.batchYearDocuments) ? metadata.batchYearDocuments : []).map((document) => ({
          batchYear: document.batchYear != null ? String(document.batchYear) : '',
          admissionCapacity: document.admissionCapacity != null ? String(document.admissionCapacity) : '',
          fileName: document.fileName,
          filePath: document.filePath,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          uploadedAt: document.uploadedAt,
        }))
      );
      setInternshipApplicable(metadata.internshipApplicable === true);
      setInternshipDurationMonths(metadata.internshipDurationMonths != null ? String(metadata.internshipDurationMonths) : '');
      setInternshipSpecializations(
        Array.isArray(metadata.internshipSpecializations)
          ? metadata.internshipSpecializations.map((item) => String(item).trim()).filter(Boolean)
          : []
      );
      setFormSchoolId(program.department?.faculty?.id || '');
      setFormData({
        departmentId: program.departmentId,
        programCode: program.programCode,
        programName: program.programName,
        programType: program.programType,
        shortName: program.shortName || '',
        description: program.description || '',
        durationYears: program.durationYears || undefined,
        durationMonths: program.durationMonths || undefined,
        durationSemesters: program.durationSemesters || undefined,
        totalCredits: program.totalCredits || undefined,
        admissionCapacity: program.admissionCapacity || undefined,
        accreditationBody: program.accreditationBody || '',
        accreditationStatus: program.accreditationStatus || '',
        metadata,
      });
    } else {
      setEditingProgram(null);
      setHasSpecializations(false);
      setSpecializationDrafts([]);
      setCreditRange({ min: '', max: '' });
      setBatchYearDocuments([]);
      setInternshipApplicable(false);
      setInternshipDurationMonths('');
      setInternshipSpecializations([]);
      setFormSchoolId(selectedSchool || '');
      setFormData({
        departmentId: selectedDepartment || '',
        programCode: '',
        programName: '',
        programType: 'UG',
        shortName: '',
        description: '',
        durationYears: undefined,
        durationMonths: undefined,
        durationSemesters: undefined,
        totalCredits: undefined,
        admissionCapacity: undefined,
        accreditationBody: '',
        accreditationStatus: '',
        metadata: {},
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

      const creditMin = numberOrUndefined(creditRange.min);
      const creditMax = numberOrUndefined(creditRange.max);
      if (creditMin != null && creditMax != null && creditMin > creditMax) {
        setError('Credit range minimum cannot be greater than maximum');
        toast.warning('Credit range minimum cannot be greater than maximum');
        return;
      }

      const validSpecs = hasSpecializations
        ? specializationDrafts.map((spec) => spec.name.trim()).filter(Boolean)
        : [];

      const uploadedDocuments: ProgramBatchYearDocument[] = [];
      for (const document of batchYearDocuments) {
        const batchYear = numberOrUndefined(document.batchYear);
        if (!batchYear) continue;
        const admissionCapacity = numberOrUndefined(document.admissionCapacity);

        if (document.file) {
          const safeCode = (formData.programCode || 'programme').toLowerCase().replace(/[^a-z0-9-]/g, '-');
          const uploadResult = await programService.uploadProgramDocument(
            document.file,
            `programmes/${safeCode}/batch-${batchYear}`
          );
          uploadedDocuments.push({
            batchYear,
            admissionCapacity,
            fileName: uploadResult.originalName || uploadResult.fileName,
            filePath: uploadResult.filePath,
            fileSize: uploadResult.fileSize,
            mimeType: uploadResult.mimeType,
            uploadedAt: new Date().toISOString(),
          });
        } else if (document.filePath && document.fileName) {
          uploadedDocuments.push({
            batchYear,
            admissionCapacity,
            fileName: document.fileName,
            filePath: document.filePath,
            fileSize: document.fileSize,
            mimeType: document.mimeType,
            uploadedAt: document.uploadedAt,
          });
        }
      }

      const metadata: ProgramMetadata = {
        ...asProgramMetadata(formData.metadata),
        creditRange: creditMin != null || creditMax != null
          ? { min: creditMin, max: creditMax }
          : undefined,
        specializationChargeRules: hasSpecializations
          ? specializationDrafts.flatMap((spec, index) => {
              const specializationName = spec.name.trim();
              if (!specializationName) return [];
              const specializationCode = `${formData.programCode || 'CODE'}-SP${index + 1}`;
              return spec.chargeRules.flatMap((rule) => {
                const batchYear = numberOrUndefined(rule.batchYear);
                const startSemester = numberOrUndefined(rule.startSemester);
                if (batchYear == null || startSemester == null) return [];
                return [{
                  specializationCode,
                  specializationName,
                  batchYear,
                  startSemester,
                  requireNonZeroCharge: true,
                }];
              });
            })
          : [],
        batchYearDocuments: uploadedDocuments,
        internshipApplicable,
        internshipDurationMonths: internshipApplicable ? numberOrUndefined(internshipDurationMonths) : undefined,
        internshipSpecializations: internshipApplicable
          ? internshipSpecializations.filter((specializationName) => validSpecs.includes(specializationName))
          : [],
      };

      const payload = {
        ...formData,
        totalCredits: creditMax ?? creditMin ?? undefined,
        metadata,
        specializations: validSpecs,
      };

      if (editingProgram) {
        await programService.updateProgram(editingProgram.id, payload);
        toast.success('Program updated successfully');
      } else {
        await programService.createProgram(payload);
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

  const handleToggleBatchYearRuleStatus = async (
    program: Program,
    batchYear: number,
    rule: NonNullable<ProgramMetadata['specializationChargeRules']>[number],
  ) => {
    const currentMetadata = asProgramMetadata(detailsProgram?.metadata || program.metadata);
    const rules = Array.isArray(currentMetadata.specializationChargeRules) ? currentMetadata.specializationChargeRules : [];
    const nextState = rule.isActive === false;
    const confirmed = await confirmAction(
      `${nextState ? 'Activate' : 'Deactivate'} Batch-Year Rule`,
      `${rule.specializationName} (${rule.specializationCode}) for batch ${batchYear} will be ${nextState ? 'activated' : 'deactivated'}.`
    );

    if (!confirmed) return;

    const ruleKey = `${batchYear}:${rule.specializationCode}:${rule.startSemester}`;

    try {
      setRuleSavingKey(ruleKey);
      const updatedMetadata: ProgramMetadata = {
        ...currentMetadata,
        specializationChargeRules: rules.map((existingRule) => (
          existingRule.batchYear === batchYear
            && existingRule.specializationCode === rule.specializationCode
            && existingRule.startSemester === rule.startSemester
            ? { ...existingRule, isActive: nextState }
            : existingRule
        )),
      };

      await programService.updateProgram(program.id, { metadata: updatedMetadata });
      toast.success(`Batch-year rule ${nextState ? 'activated' : 'deactivated'} successfully`);

      const refreshedMetadata = updatedMetadata;
      setDetailsProgram(current => current && current.id === program.id
        ? { ...current, metadata: refreshedMetadata }
        : current);

      setPrograms(currentPrograms => currentPrograms.map(currentProgram => (
        currentProgram.id === program.id
          ? { ...currentProgram, metadata: refreshedMetadata }
          : currentProgram
      )));
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setRuleSavingKey(null);
    }
  };

  const getBatchYearDetails = (program: Program) => {
    const metadata = asProgramMetadata(program.metadata);
    const documents = Array.isArray(metadata.batchYearDocuments) ? metadata.batchYearDocuments : [];
    const chargeRules = Array.isArray(metadata.specializationChargeRules) ? metadata.specializationChargeRules : [];
    const years = Array.from(new Set([
      ...documents.map((document) => document.batchYear).filter((year): year is number => Number.isFinite(year)),
      ...chargeRules.map((rule) => rule.batchYear).filter((year): year is number => Number.isFinite(year)),
    ])).sort((a, b) => b - a);

    return years.map((batchYear) => ({
      batchYear,
      documents: documents.filter((document) => document.batchYear === batchYear),
      admissionCapacity: documents.find((document) => document.batchYear === batchYear && document.admissionCapacity != null)?.admissionCapacity,
      chargeRules: chargeRules.filter((rule) => rule.batchYear === batchYear),
    }));
  };

  const getBatchCapacitySummary = (program: Program) => {
    const metadata = asProgramMetadata(program.metadata);
    const documents = Array.isArray(metadata.batchYearDocuments) ? metadata.batchYearDocuments : [];
    const capacityEntries = documents.filter((document) => document.admissionCapacity != null);
    if (capacityEntries.length === 0) return 'Batch-wise';
    return `${capacityEntries.length} batch${capacityEntries.length === 1 ? '' : 'es'} configured`;
  };

  const availableFormDepartments = departments.filter((dept) => !formSchoolId || dept.facultyId === formSchoolId);

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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/admin/bulk-upload')}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            Bulk Upload
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Program
          </button>
        </div>
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
      {filteredPrograms.length === 0 ? (
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
        <div className="w-full bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="w-[16%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    School
                  </th>
                  <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="w-[18%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Program
                  </th>
                  <th className="w-[10%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="w-[14%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="w-[10%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="w-[12%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Specializations
                  </th>
                  <th className="w-[10%] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-[22%] px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPrograms.map((program) => (
                  <tr key={program.id} className="hover:bg-gray-50/80 align-top">
                    <td className="px-4 py-4 text-sm text-gray-700 align-top">
                      {program.department?.faculty?.facultyName || '-'}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-start gap-2 text-sm text-gray-900 font-medium">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="min-w-0 break-words">{program.department?.departmentName || '-'}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{program.department?.departmentCode || ''}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p className="font-medium text-gray-900 break-words">{program.programName}</p>
                        <p className="text-sm text-gray-500">{program.programCode}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {program.programType}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-start gap-1 text-sm text-gray-700">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="break-words">
                          {program.durationYears != null
                            ? `${program.durationYears} Year${program.durationYears !== 1 ? 's' : ''}${(program.durationMonths ?? 0) > 0 ? ` ${program.durationMonths} Month${program.durationMonths !== 1 ? 's' : ''}` : ''}`
                            : '-'}
                          {program.durationSemesters ? ` (${program.durationSemesters} Sem)` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">Batch-wise</p>
                        <p className="text-xs text-gray-500">{getBatchCapacitySummary(program)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <button
                        type="button"
                        onClick={() => setDetailsProgram(program)}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline break-words text-left"
                      >
                        {(program.specializations?.length || 0) > 0
                          ? `${program.specializations?.length} specialization(s)`
                          : 'No specializations'}
                      </button>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          program.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
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
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleStatus(program)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                            program.isActive
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                          title={program.isActive ? 'Deactivate programme' : 'Activate programme'}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {program.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => setDetailsProgram(program)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
      )}

      {/* Details Modal */}
      {detailsProgram && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{detailsProgram.programName}</h2>
                <p className="text-sm text-gray-500">{detailsProgram.programCode}</p>
              </div>
              <button
                onClick={() => setDetailsProgram(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {(() => {
                const metadata = asProgramMetadata(detailsProgram.metadata);
                const credit = metadata.creditRange;
                const batchYears = getBatchYearDetails(detailsProgram);
                const documents = Array.isArray(metadata.batchYearDocuments) ? metadata.batchYearDocuments : [];
                const chargeRules = Array.isArray(metadata.specializationChargeRules) ? metadata.specializationChargeRules : [];

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-gray-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">{detailsProgram.programType}</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Duration</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {detailsProgram.durationYears ?? '-'} year{detailsProgram.durationYears === 1 ? '' : 's'}
                          {detailsProgram.durationSemesters ? ` · ${detailsProgram.durationSemesters} sem` : ''}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Credit Range</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {credit?.min || credit?.max
                            ? `${credit.min ?? '-'} - ${credit.max ?? '-'}`
                            : detailsProgram.totalCredits ?? '-'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Documents</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">{documents.length}</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Internship</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {metadata.internshipApplicable ? `${metadata.internshipDurationMonths ?? '-'} months` : 'Not applicable'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-800">Specializations</h3>
                      </div>
                      <div className="px-4 pt-3 text-xs text-gray-500">
                        Specializations are configured at the programme level. Batch-year activation is managed below for each charge rule.
                      </div>
                      <div className="divide-y divide-gray-100">
                        {(detailsProgram.specializations || []).length > 0 ? (
                          (detailsProgram.specializations || []).map((spec) => (
                            <div key={spec.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                              <span className="text-sm font-semibold text-indigo-700">{spec.specializationCode}</span>
                              <span className="text-sm text-gray-700">{spec.specializationName}</span>
                            </div>
                          ))
                        ) : (
                          <p className="px-4 py-4 text-sm text-gray-500">No specializations added.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-800">Batch Year Details</h3>
                      {batchYears.length > 0 ? (
                        batchYears.map((batch) => (
                          <div key={batch.batchYear} className="rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                              <span className="text-sm font-semibold text-blue-900">Batch {batch.batchYear}</span>
                              <span className="text-xs text-blue-700">
                                {batch.documents.length} document(s) · {batch.chargeRules.length} rule(s)
                              </span>
                            </div>
                            <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Uploaded Documents</p>
                                {batch.documents.length > 0 ? (
                                  <div className="space-y-2">
                                    {batch.documents.map((document: ProgramBatchYearDocument, index: number) => (
                                      <a
                                        key={`${document.filePath}-${index}`}
                                        href={programService.getProgramDocumentUrl(document.filePath)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                                      >
                                        <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-medium text-gray-800 truncate">{document.fileName}</p>
                                          <p className="text-xs text-gray-500">
                                            {formatFileSize(document.fileSize)}
                                            {document.uploadedAt ? `${document.fileSize ? ' · ' : ''}${new Date(document.uploadedAt).toLocaleDateString('en-IN')}` : ''}
                                          </p>
                                        </div>
                                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">No document uploaded for this batch year.</p>
                                )}
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Admission Capacity</p>
                                <div className="rounded-lg border border-gray-200 px-3 py-2 mb-4">
                                  <p className="text-sm font-medium text-gray-800">
                                    {batch.admissionCapacity != null ? batch.admissionCapacity : 'Not set'}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">Maintained for batch {batch.batchYear}.</p>
                                </div>

                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Specialization Charge Rules</p>
                                {batch.chargeRules.length > 0 ? (
                                  <div className="space-y-2">
                                    {batch.chargeRules.map((rule, index) => (
                                      <div key={`${rule.specializationCode}-${index}`} className="rounded-lg border border-gray-200 px-3 py-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-sm font-semibold text-gray-800">{rule.specializationCode}</span>
                                          <span className="text-sm text-gray-600">{rule.specializationName}</span>
                                          <span className={`ml-auto text-xs font-medium ${rule.isActive === false ? 'text-gray-400' : 'text-green-600'}`}>
                                            {rule.isActive === false ? 'Inactive for this batch' : 'Active for this batch'}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleToggleBatchYearRuleStatus(detailsProgram, batch.batchYear, rule)}
                                            disabled={ruleSavingKey === `${batch.batchYear}:${rule.specializationCode}:${rule.startSemester}`}
                                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                                              rule.isActive === false
                                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                            }`}
                                          >
                                            <Power className="w-3 h-3" />
                                            {ruleSavingKey === `${batch.batchYear}:${rule.specializationCode}:${rule.startSemester}`
                                              ? 'Saving...'
                                              : rule.isActive === false ? 'Activate' : 'Deactivate'}
                                          </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                          Charge cannot be zero from semester {rule.startSemester}.
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">No charge rule configured for this batch year.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-gray-200 p-5 text-sm text-gray-500">
                          No batch-year documents or specialization charge rules configured yet.
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-800">Internship Applicability</h3>
                      </div>
                      <div className="p-4 space-y-2 text-sm text-gray-700">
                        <p>
                          Status: <span className="font-medium">{metadata.internshipApplicable ? 'Applicable' : 'Not applicable'}</span>
                        </p>
                        <p>
                          Duration: <span className="font-medium">{metadata.internshipApplicable ? `${metadata.internshipDurationMonths ?? '-'} months` : '-'}</span>
                        </p>
                        <div>
                          <p className="mb-1 font-medium">Applicable specializations</p>
                          {metadata.internshipSpecializations?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {metadata.internshipSpecializations.map((specializationName) => (
                                <span key={specializationName} className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                                  {specializationName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500">No specializations selected.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
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
              {/* School and Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  School <span className="text-red-500">*</span>
                </label>
                <select
                  value={formSchoolId}
                  onChange={(e) => {
                    setFormSchoolId(e.target.value);
                    setFormData({ ...formData, departmentId: '' });
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select School</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.facultyName} ({school.facultyCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  disabled={!formSchoolId}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">{formSchoolId ? 'Select Department' : 'Select a school first'}</option>
                  {availableFormDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.departmentName} ({dept.departmentCode})
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
              <div className="space-y-3">
                {/* Duration grouped block */}
                <div className="border border-blue-100 rounded-xl p-3 bg-blue-50/30">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Programme Duration
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={formData.durationYears ?? ''}
                        onChange={(e) => setFormData({ ...formData, durationYears: e.target.value !== '' ? parseInt(e.target.value) : undefined })}
                        placeholder="Years"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-xs text-gray-500 mt-0.5 ml-1">Years</span>
                    </div>
                    <span className="text-gray-400 font-semibold text-lg pb-5">+</span>
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0"
                        max="11"
                        value={formData.durationMonths ?? ''}
                        onChange={(e) => setFormData({ ...formData, durationMonths: e.target.value !== '' ? parseInt(e.target.value) : undefined })}
                        placeholder="Months"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-xs text-gray-500 mt-0.5 ml-1">Months (0–11)</span>
                    </div>
                    {(formData.durationYears != null || formData.durationMonths != null) && (
                      <div className="text-sm font-medium text-blue-700 bg-blue-100 px-3 py-2 rounded-xl whitespace-nowrap pb-6">
                        = {formData.durationYears ?? 0} Yr{(formData.durationYears ?? 0) !== 1 ? 's' : ''}{(formData.durationMonths ?? 0) > 0 ? ` ${formData.durationMonths} Mo` : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Semesters + Credit Range */}
                <div className="grid grid-cols-2 gap-4">
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
                    Credit Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="1"
                      value={creditRange.min}
                      onChange={(e) => setCreditRange({ ...creditRange, min: e.target.value })}
                      placeholder="Min"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="number"
                      min="1"
                      value={creditRange.max}
                      onChange={(e) => setCreditRange({ ...creditRange, max: e.target.value })}
                      placeholder="Max"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                </div>
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

              {/* Specialization */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Has Specializations?</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setHasSpecializations(false); setSpecializationDrafts([]); }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!hasSpecializations ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasSpecializations(true)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${hasSpecializations ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Yes
                    </button>
                  </div>
                </div>

                {hasSpecializations && (
                  <div className="space-y-3">
                    {specializationDrafts.map((spec, index) => {
                      const code = `${formData.programCode || 'CODE'}-SP${index + 1}`;
                      return (
                        <div key={index} className="rounded-xl border border-gray-200 p-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-1.5 rounded-lg w-36 flex-shrink-0 text-center">
                              {code}
                            </span>
                            <input
                              type="text"
                              value={spec.name}
                              onChange={(e) => {
                                const updated = [...specializationDrafts];
                                updated[index] = { ...updated[index], name: e.target.value };
                                setSpecializationDrafts(updated);
                              }}
                              placeholder={`Specialization ${index + 1} name`}
                              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => setSpecializationDrafts(specializationDrafts.filter((_, i) => i !== index))}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Charge Start Rules
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...specializationDrafts];
                                  updated[index] = {
                                    ...updated[index],
                                    chargeRules: [...updated[index].chargeRules, { batchYear: '', startSemester: '' }],
                                  };
                                  setSpecializationDrafts(updated);
                                }}
                                className="text-xs font-medium text-blue-600 hover:text-blue-700"
                              >
                                Add Rule
                              </button>
                            </div>
                            {spec.chargeRules.map((rule, ruleIndex) => (
                              <div key={ruleIndex} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                <input
                                  type="number"
                                  min="2000"
                                  max="2100"
                                  value={rule.batchYear}
                                  onChange={(e) => {
                                    const updated = [...specializationDrafts];
                                    const rules = [...updated[index].chargeRules];
                                    rules[ruleIndex] = { ...rules[ruleIndex], batchYear: e.target.value };
                                    updated[index] = { ...updated[index], chargeRules: rules };
                                    setSpecializationDrafts(updated);
                                  }}
                                  placeholder="Batch year"
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <input
                                  type="number"
                                  min="1"
                                  max={formData.durationSemesters || 20}
                                  value={rule.startSemester}
                                  onChange={(e) => {
                                    const updated = [...specializationDrafts];
                                    const rules = [...updated[index].chargeRules];
                                    rules[ruleIndex] = { ...rules[ruleIndex], startSemester: e.target.value };
                                    updated[index] = { ...updated[index], chargeRules: rules };
                                    setSpecializationDrafts(updated);
                                  }}
                                  placeholder="Start sem"
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...specializationDrafts];
                                    updated[index] = {
                                      ...updated[index],
                                      chargeRules: updated[index].chargeRules.filter((_, i) => i !== ruleIndex),
                                    };
                                    setSpecializationDrafts(updated);
                                  }}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSpecializationDrafts([...specializationDrafts, { name: '', chargeRules: [] }])}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Specialization
                    </button>
                  </div>
                )}
              </div>

              {/* Internship Applicability */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Internship Applicable?</label>
                    <p className="text-xs text-gray-500 mt-1">If yes, choose the specializations and internship duration in months.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setInternshipApplicable(false);
                        setInternshipDurationMonths('');
                        setInternshipSpecializations([]);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!internshipApplicable ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setInternshipApplicable(true)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${internshipApplicable ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Yes
                    </button>
                  </div>
                </div>

                {internshipApplicable && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Internship Duration (months)</label>
                      <input
                        type="number"
                        min="1"
                        value={internshipDurationMonths}
                        onChange={(e) => setInternshipDurationMonths(e.target.value)}
                        placeholder="Enter duration in months"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Applicable Specializations</label>
                      <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 p-3 space-y-2">
                        {(specializationDrafts || []).filter((spec) => spec.name.trim()).length > 0 ? (
                          specializationDrafts
                            .map((spec, index) => ({ key: `${formData.programCode || 'CODE'}-SP${index + 1}`, name: spec.name.trim() }))
                            .filter((spec) => spec.name)
                            .map((specialization) => (
                              <label key={specialization.key} className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={internshipSpecializations.includes(specialization.name)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setInternshipSpecializations((current) => [...current, specialization.name]);
                                    } else {
                                      setInternshipSpecializations((current) => current.filter((item) => item !== specialization.name));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>{specialization.key} - {specialization.name}</span>
                              </label>
                            ))
                        ) : (
                          <p className="text-sm text-gray-500">Add specializations first to select internship applicability.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Batch Year Documents */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Batch Year Documents and Capacity</label>
                  <button
                    type="button"
                    onClick={() => setBatchYearDocuments([...batchYearDocuments, { batchYear: '', admissionCapacity: '' }])}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Document
                  </button>
                </div>

                {batchYearDocuments.length > 0 && (
                  <div className="space-y-2">
                    {batchYearDocuments.map((document, index) => (
                      <div key={index} className="grid grid-cols-[120px_140px_1fr_auto] gap-2 items-center">
                        <input
                          type="number"
                          min="2000"
                          max="2100"
                          value={document.batchYear}
                          onChange={(e) => {
                            const updated = [...batchYearDocuments];
                            updated[index] = { ...updated[index], batchYear: e.target.value };
                            setBatchYearDocuments(updated);
                          }}
                          placeholder="Batch year"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          type="number"
                          min="0"
                          value={document.admissionCapacity}
                          onChange={(e) => {
                            const updated = [...batchYearDocuments];
                            updated[index] = { ...updated[index], admissionCapacity: e.target.value };
                            setBatchYearDocuments(updated);
                          }}
                          placeholder="Capacity"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <label className="flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                          {document.file || document.filePath ? (
                            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          ) : (
                            <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="truncate">
                            {document.file?.name || document.fileName || 'Choose document'}
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,image/*"
                            onChange={(e) => {
                              const selectedFile = e.target.files?.[0];
                              if (!selectedFile) return;
                              const updated = [...batchYearDocuments];
                              updated[index] = {
                                ...updated[index],
                                file: selectedFile,
                                fileName: selectedFile.name,
                                filePath: undefined,
                                fileSize: selectedFile.size,
                                mimeType: selectedFile.type,
                                uploadedAt: undefined,
                              };
                              setBatchYearDocuments(updated);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setBatchYearDocuments(batchYearDocuments.filter((_, i) => i !== index))}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
