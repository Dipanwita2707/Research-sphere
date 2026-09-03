'use client';

import React, { useState, useEffect } from 'react';
import { iprService, fileUploadService } from '@/features/ipr-management/services/ipr.service';
import { schoolService } from '@/features/admin-management/services/school.service';
import { FileText, Upload, X, Plus } from 'lucide-react';
import logger from '@/shared/utils/logger';

// SDG Options (1-17)
const SDG_OPTIONS = Array.from({ length: 17 }, (_, i) => ({
  code: `SDG${i + 1}`,
  title: `Sustainable Development Goal ${i + 1}`,
}));

const PROJECT_TYPES = [
  { value: 'phd', label: 'PhD' },
  { value: 'pg_project', label: 'PG Project' },
  { value: 'ug_project', label: 'UG Project' },
  { value: 'faculty_research', label: 'Faculty Research' },
  { value: 'industry_collaboration', label: 'Industry Collaboration' },
  { value: 'any_other', label: 'Any Other' },
];

const FILING_TYPES = [
  { value: 'provisional', label: 'Provisional' },
  { value: 'complete', label: 'Complete' },
];

const APPLICANT_TYPES = [
  { value: 'internal_faculty', label: 'Internal - Faculty' },
  { value: 'internal_student', label: 'Internal - Student' },
  { value: 'internal_staff', label: 'Internal - Staff' },
  { value: 'external_academic', label: 'External - Academic' },
  { value: 'external_industry', label: 'External - Industry' },
  { value: 'external_other', label: 'External - Other' },
];

const EMPLOYEE_CATEGORIES = [
  { value: 'teaching', label: 'Teaching' },
  { value: 'non_teaching', label: 'Non-Teaching' },
  { value: 'research', label: 'Research' },
  { value: 'administrative', label: 'Administrative' },
];

const INSTITUTE_TYPES = [
  { value: 'academic', label: 'Academic' },
  { value: 'industry', label: 'Industry' },
  { value: 'government', label: 'Government' },
  { value: 'ngo', label: 'NGO' },
];

export default function PatentFilingForm() {
  const [formData, setFormData] = useState({
    // Section A: Idea Details
    iprType: 'patent' as 'patent' | 'copyright' | 'trademark',
    projectType: '',
    filingType: '',
    selectedSdgs: [] as string[],
    title: '',
    description: '',
    remarks: '',

    // School/Department
    schoolId: '',
    departmentId: '',

    // Section B: Applicant Type
    applicantType: 'internal_faculty',

    // Internal Applicant Details
    employeeCategory: '',
    employeeType: 'staff',
    uid: '',
    email: '',
    phone: '',
    universityDeptName: '',

    // External Applicant Details
    externalName: '',
    externalOption: '',
    instituteType: '',
    companyUniversityName: '',
    externalEmail: '',
    externalPhone: '',
    externalAddress: '',
  });

  const [schools, setSchools] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [annexureFile, setAnnexureFile] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch schools on mount
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const data = await schoolService.getAllSchools();
        setSchools(data.data || data);
      } catch (err) {
        logger.error('Error fetching schools:', err);
      }
    };
    fetchSchools();
  }, []);

  // Fetch departments when school changes
  useEffect(() => {
    if (formData.schoolId) {
      const school = schools.find((s) => s.id ===
   formData.schoolId);
      setDepartments(school?.departments || []);
    } else {
      setDepartments([]);
    }
  }, [formData.schoolId, schools]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSdgToggle = (sdgCode: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedSdgs: prev.selectedSdgs.includes(sdgCode)
        ? prev.selectedSdgs.filter((s) => s !== sdgCode)
        : [...prev.selectedSdgs, sdgCode],
    }));
  };

  const handleAnnexureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAnnexureFile(e.target.files[0]);
    }
  };

  const handleSupportingFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSupportingFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeSupportingFile = (index: number) => {
    setSupportingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const isInternalApplicant = formData.applicantType.startsWith('internal');

  const handleSubmit = async (e: React.FormEvent, submitType: 'draft' | 'submit') => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Upload annexure file if present
      let annexureS3Key = '';
      if (annexureFile) {
        setUploading(true);
        annexureS3Key = await fileUploadService.uploadFile(annexureFile, 'ipr/annexures');
      }

      // Upload supporting files if present
      const supportingDocsS3Keys: string[] = [];
      if (supportingFiles.length > 0) {
        for (const file of supportingFiles) {
          const s3Key = await fileUploadService.uploadFile(file, 'ipr/supporting-docs');
          supportingDocsS3Keys.push(s3Key);
        }
      }
      setUploading(false);

      // Prepare applicant details
      const applicantDetails = isInternalApplicant
        ? {
            employeeCategory: formData.employeeCategory,
            employeeType: formData.employeeType,
            uid: formData.uid,
            email: formData.email,
            phone: formData.phone,
            universityDeptName: formData.universityDeptName,
          }
        : {
            externalName: formData.externalName,
            externalOption: formData.externalOption,
            instituteType: formData.instituteType,
            companyUniversityName: formData.companyUniversityName,
            externalEmail: formData.externalEmail,
            externalPhone: formData.externalPhone,
            externalAddress: formData.externalAddress,
          };

      // Create IPR application
      const application = await iprService.createApplication({
        applicantType: formData.applicantType,
        iprType: formData.iprType,
        projectType: formData.projectType,
        filingType: formData.filingType,
        title: formData.title,
        description: formData.description,
        remarks: formData.remarks,
        schoolId: formData.schoolId || undefined,
        departmentId: formData.departmentId || undefined,
        sdgs: formData.selectedSdgs.map((code) => ({
          code,
          title: SDG_OPTIONS.find((s) => s.code ===
   code)?.title || '',
        })),
        applicantDetails,
        annexureFilePath: annexureS3Key,
        supportingDocsFilePaths: supportingDocsS3Keys,
      });

      // If submit type is 'submit', submit the application
      if (submitType ===
   'submit') {
        await iprService.submitApplication(application.id);
        setSuccess('Patent application submitted successfully!');
      } else {
        setSuccess('Patent application saved as draft!');
      }

      // Reset form
      setFormData({
        iprType: 'patent',
        projectType: '',
        filingType: '',
        selectedSdgs: [],
        title: '',
        description: '',
        remarks: '',
        schoolId: '',
        departmentId: '',
        applicantType: 'internal_faculty',
        employeeCategory: '',
        employeeType: 'staff',
        uid: '',
        email: '',
        phone: '',
        universityDeptName: '',
        externalName: '',
        externalOption: '',
        instituteType: '',
        companyUniversityName: '',
        externalEmail: '',
        externalPhone: '',
        externalAddress: '',
      });
      setAnnexureFile(null);
      setSupportingFiles([]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Patent Filing Form</h1>
        <p className="text-gray-600 mt-2">Submit your patent idea for review and approval</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, 'submit')}>
        {/* Section A: Idea Details */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">
            Section A: Idea Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Type <span className="text-red-500">*</span>
              </label>
              <select
                name="projectType"
                value={formData.projectType}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
              >
                <option value="">Select Type</option>
                {PROJECT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type of Filing <span className="text-red-500">*</span>
              </label>
              <select
                name="filingType"
                value={formData.filingType}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
              >
                <option value="">Select Filing Type</option>
                {FILING_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School/Faculty <span className="text-red-500">*</span>
              </label>
              <select
                name="schoolId"
                value={formData.schoolId}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
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
                Department <span className="text-red-500">*</span>
              </label>
              <select
                name="departmentId"
                value={formData.departmentId}
                onChange={handleInputChange}
                required
                disabled={!formData.schoolId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34] disabled:bg-gray-100"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SDG (Sustainable Development Goals) <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {SDG_OPTIONS.map((sdg) => (
                <label
                  key={sdg.code}
                  className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={formData.selectedSdgs.includes(sdg.code)}
                    onChange={() => handleSdgToggle(sdg.code)}
                    className="rounded"
                  />
                  <span className="text-sm">{sdg.code}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title of Invention <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
              placeholder="Enter patent title"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description/Abstract <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
              placeholder="Provide detailed description of your invention"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
              placeholder="Additional comments or notes"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Annexure 1 Upload (.docx, .zip) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".doc,.docx,.zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed"
                onChange={handleAnnexureUpload}
                required
                className="flex-1"
              />
              {annexureFile && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {annexureFile.name}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supporting Documents (Optional)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleSupportingFilesUpload}
              className="w-full"
            />
            {supportingFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {supportingFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <span className="text-sm flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSupportingFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section B: Applicant Details */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b">
            Section B: Applicant Details
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Applicant Type <span className="text-red-500">*</span>
            </label>
            <select
              name="applicantType"
              value={formData.applicantType}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
            >
              {APPLICANT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {isInternalApplicant ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="employeeCategory"
                  value={formData.employeeCategory}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                >
                  <option value="">Select Category</option>
                  {EMPLOYEE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="employeeType"
                  value={formData.employeeType}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                >
                  <option value="staff">Staff</option>
                  <option value="student">Student</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  UID/VID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="uid"
                  value={formData.uid}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  University/Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="universityDeptName"
                  value={formData.universityDeptName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="externalName"
                  value={formData.externalName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Option <span className="text-red-500">*</span>
                </label>
                <select
                  name="externalOption"
                  value={formData.externalOption}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                >
                  <option value="">Select Option</option>
                  <option value="national">National</option>
                  <option value="international">International</option>
                  <option value="industry">Industry</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Institute Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="instituteType"
                  value={formData.instituteType}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                >
                  <option value="">Select Type</option>
                  {INSTITUTE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company/University Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="companyUniversityName"
                  value={formData.companyUniversityName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="externalEmail"
                  value={formData.externalEmail}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="externalPhone"
                  value={formData.externalPhone}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  name="externalAddress"
                  value={formData.externalAddress}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#7d1a34]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 pt-4 border-t">
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any, 'draft')}
            disabled={loading || uploading}
            className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="submit"
            disabled={loading || uploading}
            className="flex-1 px-6 py-3 bg-[#7d1a34] text-white rounded-md hover:bg-[#5e1024] disabled:bg-blue-300 disabled:cursor-not-allowed font-medium"
          >
            {uploading ? 'Uploading Files...' : loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      </form>
    </div>
  );
}
