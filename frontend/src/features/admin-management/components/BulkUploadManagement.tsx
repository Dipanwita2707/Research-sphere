'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  RefreshCw,
  School,
  Building2,
  BookOpen,
  Users,
  GraduationCap,
  FileDown,
  Eye,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { bulkUploadService, UploadStats, BulkUploadResult, PreviewData } from '@/features/admin-management/services/bulkUpload.service';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

type EntityType = 'schools' | 'departments' | 'programmes' | 'employees' | 'students';

interface TabConfig {
  id: EntityType;
  label: string;
  icon: React.ElementType;
  description: string;
  templateFields: string[];
  fileFormat: 'xlsx' | 'csv';
}

const tabs: TabConfig[] = [
  {
    id: 'schools',
    label: 'Schools',
    icon: School,
    description: 'Upload schools/faculties',
    templateFields: ['facultyCode', 'facultyName', 'shortName', 'description', 'establishedYear', 'website', 'contactEmail', 'contactPhone'],
    fileFormat: 'xlsx',
  },
  {
    id: 'departments',
    label: 'Departments',
    icon: Building2,
    description: 'Upload departments under schools',
    templateFields: ['facultyCode', 'departmentCode', 'departmentName', 'shortName', 'description', 'establishedYear', 'contactEmail', 'contactPhone'],
    fileFormat: 'xlsx',
  },
  {
    id: 'programmes',
    label: 'Programmes',
    icon: BookOpen,
    description: 'Upload programmes under schools and departments',
    templateFields: ['schoolCode', 'departmentCode', 'programCode', 'programName', 'programType', 'shortName', 'description', 'durationYears', 'durationMonths', 'durationSemesters', 'creditMin', 'creditMax', 'specializations', 'specializationChargeRules', 'internshipApplicable', 'internshipDurationMonths', 'internshipSpecializations', 'batchYearDocuments'],
    fileFormat: 'xlsx',
  },
  {
    id: 'employees',
    label: 'Faculty/Staff',
    icon: Users,
    description: 'Upload faculty and staff members',
    templateFields: ['empId', 'firstName', 'lastName', 'email', 'phoneNumber', 'schoolCode', 'departmentCode', 'designation', 'userType', 'password'],
    fileFormat: 'xlsx',
  },
  {
    id: 'students',
    label: 'Students',
    icon: GraduationCap,
    description: 'Upload student records',
    templateFields: ['studentId', 'registrationNo', 'firstName', 'lastName', 'email', 'phone', 'programCode', 'sectionCode', 'currentSemester', 'password'],
    fileFormat: 'xlsx',
  },
];

const isExcelFile = (fileName: string) => /\.(xlsx|xls)$/i.test(fileName);

export default function BulkUploadManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<EntityType>('schools');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const response = await bulkUploadService.getUploadStats();
      setStats(response.data);
    } catch (err: unknown) {
      logger.error('Failed to fetch stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      let blob: Blob;
      let filename: string;

      switch (activeTab) {
        case 'schools':
          blob = await bulkUploadService.downloadSchoolTemplate();
          filename = 'schools_template.xlsx';
          break;
        case 'departments':
          blob = await bulkUploadService.downloadDepartmentTemplate();
          filename = 'departments_template.xlsx';
          break;
        case 'programmes':
          blob = await bulkUploadService.downloadProgrammeTemplate();
          filename = 'programmes_template.xlsx';
          break;
        case 'employees':
          blob = await bulkUploadService.downloadEmployeeTemplate();
          filename = 'employees_template.xlsx';
          break;
        case 'students':
          blob = await bulkUploadService.downloadStudentTemplate();
          filename = 'students_template.xlsx';
          break;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      logger.error('Failed to download template:', err);
    }
  };

  const parsePreviewFile = async (selectedFile: File) => {
    try {
      setLoadingPreview(true);
      setShowPreview(false);
      
      // Use server-side preview API
      const response = await bulkUploadService.previewData(selectedFile);
      
      if (response.success && response.data.rows.length > 0) {
        setPreviewData(response.data);
        setShowPreview(true);
      } else {
        setPreviewData(null);
        setShowPreview(false);
        if (!response.success) {
          toast({
            type: 'warning',
            message: 'Failed to preview file. Please ensure it is a valid Excel file.',
          });
        }
      }
    } catch (error: any) {
      logger.error('Failed to preview file:', error);
      setPreviewData(null);
      setShowPreview(false);
      toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to preview file. Please check the file format.',
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type ===
   'dragenter' || e.type ===
   'dragover') {
      setDragActive(true);
    } else if (e.type ===
   'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    const requiresExcel = activeTabConfig.fileFormat === 'xlsx';
    const isValidFile = requiresExcel
      ? isExcelFile(selectedFile.name)
      : selectedFile.name.endsWith('.csv');

    if (!isValidFile) {
      toast({
        type: 'warning',
        message: 'Please upload an Excel file (.xlsx or .xls)',
      });
      return;
    }
    setFile(selectedFile);
    setResult(null);
    setPreviewData(null);
    setShowPreview(false);
    parsePreviewFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setResult(null);

      let response;
      switch (activeTab) {
        case 'schools':
          response = await bulkUploadService.uploadSchools(file);
          break;
        case 'departments':
          response = await bulkUploadService.uploadDepartments(file);
          break;
        case 'programmes':
          response = await bulkUploadService.uploadProgrammes(file);
          break;
        case 'employees':
          response = await bulkUploadService.uploadEmployees(file);
          break;
        case 'students':
          response = await bulkUploadService.uploadStudents(file);
          break;
      }

      setResult(response.data);
      if (response.data.successCount > 0) {
        fetchStats();
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.response?.data?.message || 'Upload failed',
        totalRecords: 0,
        successCount: 0,
        failedCount: 0,
        errors: err.response?.data?.errors,
      });
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
    setPreviewData(null);
    setShowPreview(false);
    setLoadingPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const activeTabConfig = tabs.find(t => t.id ===
   activeTab)!;
  const TabIcon = activeTabConfig.icon;
  const acceptedFileExtensions = '.xlsx,.xls'; // All uploads are now Excel
  const fileFormatLabel = 'Excel'; // All uploads are now Excel

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Upload className="w-7 h-7 text-blue-600" />
            Bulk Upload Management
          </h1>
          <p className="text-gray-500 mt-1">
            Import schools, departments, programmes, faculty, and students in bulk
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {!loadingStats && stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={School} label="Schools" value={stats.schools} color="blue" />
          <StatCard icon={Building2} label="Departments" value={stats.departments} color="indigo" />
          <StatCard icon={BookOpen} label="Programmes" value={stats.programmes} color="purple" />
          <StatCard icon={Users} label="Faculty" value={stats.employees} color="green" />
          <StatCard icon={GraduationCap} label="Students" value={stats.students} color="orange" />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  clearFile();
                }}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab ===
   tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Template Download Section */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  Download Template
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Download the {fileFormatLabel} template for {activeTabConfig.label.toLowerCase()}, fill it with your data, then upload
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-600 rounded-xl border border-blue-200 hover:bg-blue-50 font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeTabConfig.templateFields.map(field => (
                <span key={field} className="px-2 py-1 bg-white rounded-md text-xs text-gray-600 border border-blue-100">
                  {field}
                </span>
              ))}
            </div>
          </div>

          {/* File Upload Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : file
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedFileExtensions}
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />

            {file ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <button onClick={clearFile} className="p-2 hover:bg-red-50 rounded-lg text-red-500 ml-4">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    disabled={loadingPreview}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loadingPreview ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading Preview...
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        {showPreview ? 'Hide Preview' : 'Preview Data'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload {activeTabConfig.label}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <TabIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-700 font-medium mb-1">
                  Drop your {fileFormatLabel} file here, or{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    browse
                  </button>
                </p>
                <p className="text-sm text-gray-500">Upload {activeTabConfig.label.toLowerCase()} data in {fileFormatLabel} format</p>
              </div>
            )}
          </div>

          {/* Preview Table */}
          {showPreview && previewData && previewData.rows.length > 0 && (
            <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Data Preview (First {previewData.previewRows} rows)</h4>
                <span className="text-sm text-gray-500">{previewData.message}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      {previewData.headers.map(header => (
                        <th key={header} className="px-4 py-2 text-left font-medium text-gray-700">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewData.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {previewData.headers.map((header) => (
                          <td key={header} className="px-4 py-2 text-gray-600">
                            {row[header] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upload Result */}
          {result && (
            <div className={`mt-6 rounded-xl border ${
              result.success && result.failedCount ===
   0
                ? 'bg-green-50 border-green-200'
                : result.failedCount > 0
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {result.success && result.failedCount ===
   0 ? (
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                  ) : result.failedCount > 0 ? (
                    <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{result.message}</h4>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      <span className="text-gray-600">
                        Total: <span className="font-medium">{result.totalRecords}</span>
                      </span>
                      <span className="text-green-600">
                        Success: <span className="font-medium">{result.successCount}</span>
                      </span>
                      {result.failedCount > 0 && (
                        <span className="text-red-600">
                          Failed: <span className="font-medium">{result.failedCount}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Details */}
              {result.errors && result.errors.length > 0 && (
                <div className="border-t border-yellow-200 px-4 py-3">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Errors:</h5>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {result.errors.map((error, idx) => (
                      <div key={idx} className="text-sm bg-white rounded-lg p-2 border border-yellow-100">
                        <span className="text-yellow-700 font-medium">Row {error.row}:</span>{' '}
                        <span className="text-gray-600">
                          {error.field && <span className="font-mono">[{error.field}]</span>} {error.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Upload Instructions</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-blue-600" />
              Upload Order
            </h4>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>First upload <strong>Schools</strong> (faculties)</li>
              <li>Then upload <strong>Departments</strong> (requires school codes)</li>
              <li>Then upload <strong>Programmes</strong> (requires school and department codes)</li>
              <li>Upload <strong>Faculty/Staff</strong> (requires department/school codes)</li>
              <li>Finally upload <strong>Students</strong> (requires programme codes)</li>
            </ol>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-blue-600" />
              Tips
            </h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Download the template first to see required fields</li>
              <li>• Use codes consistently (e.g., SOE for School of Engineering)</li>
              <li>• For employees, use userType: FACULTY, HOD, or DEAN</li>
              <li>• Dates should be in YYYY-MM-DD format</li>
              <li>• Preview data before uploading to catch errors</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
