'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, X, User, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useActiveCategories, useCreateTicket } from '@/features/ticket-management/hooks/useTickets';
import { tmsService } from '@/features/ticket-management/services/tms.service';
import { MESSAGE_TYPE_CONFIG } from '@/features/ticket-management/constants';
import type { TmsMessageType, CreateTicketPayload } from '@/features/ticket-management/types/tms.types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const CONSENT_POINTS = [
  'I have not shared my UMS password with anyone and I am solely responsible for my account activity.',
  'I take full responsibility for the content and accuracy of the information provided in this request.',
  'I acknowledge that disciplinary action may be taken against me if derogatory, abusive, or false statements are made against any Student, Faculty, Staff, or Higher Authority.',
  'The details provided in this complaint/request are true and accurate to the best of my knowledge. I understand that appropriate disciplinary action may be initiated if the information is found to be false or misleading.',
  'I confirm that I have reviewed the relevant policies and UMS notifications pertaining to this matter before submitting this request, and I was unable to find a resolution on my own.',
];

export default function NewTicketPage() {
  const router = useRouter();
  const [hasConsented, setHasConsented] = useState(false);
  const { data: categories, isLoading: categoriesLoading } = useActiveCategories();
  const createMutation = useCreateTicket();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messageType, setMessageType] = useState<TmsMessageType | ''>('');
  const [masterCategoryId, setMasterCategoryId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  // Cascading category selectors
  const selectedMaster = useMemo(
    () => categories?.find((m) => m.id === masterCategoryId),
    [categories, masterCategoryId]
  );
  const selectedCategory = useMemo(
    () => selectedMaster?.categories?.find((c) => c.id === categoryId),
    [selectedMaster, categoryId]
  );
  const selectedSubCategory = useMemo(
    () => selectedCategory?.subCategories?.find((sc) => sc.id === subCategoryId),
    [selectedCategory, subCategoryId]
  );

  // Dealing person: sub-category employee → category employee → master employee
  const dealingPerson = useMemo(() => {
    const emp = selectedSubCategory?.employee || selectedCategory?.employee || selectedMaster?.employee;
    if (!emp?.employeeDetails) return null;
    return {
      name: emp.employeeDetails.displayName,
      empId: emp.employeeDetails.empId,
      designation: emp.employeeDetails.designation,
    };
  }, [selectedSubCategory, selectedCategory, selectedMaster]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError('Only PDF, JPG, and PNG files are allowed');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 5MB');
      return;
    }
    setSelectedFile(file);
    setError('');
  };

  const handleReset = () => {
    setMessageType('');
    setMasterCategoryId('');
    setCategoryId('');
    setSubCategoryId('');
    setSubject('');
    setDescription('');
    setContactNumber('');
    setSelectedFile(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!messageType) { setError('Please select a message type'); return; }
    if (!masterCategoryId || !categoryId || !subCategoryId) { setError('Please select all category fields'); return; }
    if (!subject.trim() || subject.trim().length < 3) { setError('Subject must be at least 3 characters'); return; }
    if (!description.trim() || description.trim().length < 10) { setError('Description must be at least 10 characters'); return; }
    if (!contactNumber.trim() || !/^[0-9+\-\s()]{7,20}$/.test(contactNumber.trim())) { setError('Please enter a valid contact number'); return; }

    const payload: CreateTicketPayload = {
      messageType,
      masterCategoryId,
      categoryId,
      subCategoryId,
      subject: subject.trim(),
      description: description.trim(),
      contactNumber: contactNumber.trim(),
    };

    try {
      // Upload file first if selected
      if (selectedFile) {
        setUploading(true);
        try {
          const filePath = await tmsService.uploadAttachment(selectedFile);
          payload.documentPath = filePath;
          payload.documentName = selectedFile.name;
        } catch {
          setError('Failed to upload file. Please try again.');
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      await createMutation.mutateAsync(payload);
      router.push('/tms');
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError?.response?.data?.message || 'Failed to submit request');
    }
  };

  const selectClass =
    'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none cursor-pointer';
  const inputClass =
    'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';
  const labelClass = 'block text-sm font-semibold text-gray-800 mb-1.5';

  // ==========================================
  // CONSENT / AGREEMENT SCREEN
  // ==========================================
  if (!hasConsented) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#e8f0f8] to-[#f0f4f8] py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#004a80] rounded-2xl mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Ticket Management System</h1>
            <p className="text-sm text-gray-500 mt-1">Please read and accept the following before proceeding</p>
          </div>

          {/* Consent Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <div className="space-y-4">
              {CONSENT_POINTS.map((point, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">{point}</p>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => setHasConsented(true)}
                className="w-full sm:w-auto px-8 py-3 bg-[#e87722] hover:bg-[#d06a1e] text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
              >
                Agree &amp; Proceed
              </button>
              <button
                onClick={() => router.back()}
                className="w-full sm:w-auto px-8 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // TICKET FORM (shown after consent)
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Submit New Request</h1>
            <p className="text-sm text-gray-500">Fill in the details below to submit your request</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6"
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Message Type */}
          <div>
            <label className={labelClass}>
              Message Type <span className="text-red-500">*</span>
            </label>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value as TmsMessageType)}
              className={selectClass}
            >
              <option value="">Select message type</option>
              {(Object.entries(MESSAGE_TYPE_CONFIG) as [TmsMessageType, (typeof MESSAGE_TYPE_CONFIG)[TmsMessageType]][]).map(
                ([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Category Row — 3 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>
                Master Category <span className="text-red-500">*</span>
              </label>
              <select
                value={masterCategoryId}
                onChange={(e) => {
                  setMasterCategoryId(e.target.value);
                  setCategoryId('');
                  setSubCategoryId('');
                }}
                disabled={categoriesLoading}
                className={selectClass}
              >
                <option value="">Select category</option>
                {categories?.map((mc) => (
                  <option key={mc.id} value={mc.id}>{mc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubCategoryId('');
                }}
                disabled={!masterCategoryId}
                className={`${selectClass} ${!masterCategoryId ? 'opacity-60' : ''}`}
              >
                <option value="">Select category</option>
                {selectedMaster?.categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Sub Category <span className="text-red-500">*</span>
              </label>
              <select
                value={subCategoryId}
                onChange={(e) => setSubCategoryId(e.target.value)}
                disabled={!categoryId}
                className={`${selectClass} ${!categoryId ? 'opacity-60' : ''}`}
              >
                <option value="">Select sub category</option>
                {selectedCategory?.subCategories?.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dealing Person — shown after sub-category is selected */}
          {subCategoryId && dealingPerson && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-center w-9 h-9 bg-blue-100 rounded-full">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Dealing Person</p>
                <p className="text-sm font-semibold text-gray-900">
                  {dealingPerson.name}
                  {dealingPerson.designation && (
                    <span className="text-xs font-normal text-gray-500 ml-1">({dealingPerson.designation})</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {subCategoryId && !dealingPerson && (
            <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-center w-9 h-9 bg-yellow-100 rounded-full">
                <User className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Dealing Person</p>
                <p className="text-sm text-yellow-700">No employee assigned to this sub-category yet</p>
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className={labelClass}>
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter request subject"
              maxLength={256}
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Describe your request in detail..."
              maxLength={500}
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1 text-xs text-gray-400 text-right">
              {description.length}/500 characters
            </p>
          </div>

          {/* Contact Number + File Upload row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="Enter your contact number"
                maxLength={20}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Upload Supporting Document</label>
              {selectedFile ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-700 truncate flex-1">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Choose File
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="mt-1 text-xs text-gray-400">Max file size: 5MB (PDF, JPG, PNG)</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending || uploading}
              className="flex-1 py-2.5 bg-[#004a80] hover:bg-[#003d6b] text-white rounded-full text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading File...' : createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-2.5 border border-gray-300 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
