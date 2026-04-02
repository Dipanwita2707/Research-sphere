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
    () => categories?.find((m) => m.id ===
   masterCategoryId),
    [categories, masterCategoryId]
  );
  const selectedCategory = useMemo(
    () => selectedMaster?.categories?.find((c) => c.id ===
   categoryId),
    [selectedMaster, categoryId]
  );
  const selectedSubCategory = useMemo(
    () => selectedCategory?.subCategories?.find((sc) => sc.id ===
   subCategoryId),
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
    'w-full px-4 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none appearance-none cursor-pointer transition-all';
  const inputClass =
    'w-full px-4 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] placeholder-[#6497b1]/50 focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-all';
  const labelClass = 'block text-sm font-semibold text-[#011f4b] mb-1.5';

  // ===================================
    // CONSENT / AGREEMENT SCREEN
  // ===================================
    if (!hasConsented) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#e8f1f8] to-[#f8fafc] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#011f4b] to-[#005b96] rounded-2xl mb-5 shadow-lg shadow-[#005b96]/20">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#011f4b] tracking-tight">Ticket Management System</h1>
            <p className="text-sm text-[#6497b1] mt-1.5">Please read and accept the following before proceeding</p>
          </div>

          {/* Consent Card */}
          <div className="bg-white rounded-2xl border border-[#b3cde0]/30 p-7 sm:p-9" style={{ boxShadow: '0 4px 24px 0 rgba(0, 91, 150, 0.08)' }}>
            <div className="space-y-3">
              {CONSENT_POINTS.map((point, idx) => (
                <div key={idx} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#f8fafc] border border-[#b3cde0]/20 hover:border-[#005b96]/20 transition-colors">
                  <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-[#005b96]/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#005b96]">{idx + 1}</span>
                  </div>
                  <p className="text-[13px] text-[#03396c] leading-relaxed pt-0.5">{point}</p>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="mt-8 mb-6 h-px bg-gradient-to-r from-transparent via-[#b3cde0]/40 to-transparent" />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => setHasConsented(true)}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-[#e87722] to-[#d06a1e] hover:from-[#d06a1e] hover:to-[#c05e18] text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-orange-500/15"
              >
                Agree &amp; Proceed
              </button>
              <button
                onClick={() => router.back()}
                className="w-full sm:w-auto px-8 py-3 bg-[#f8fafc] border border-[#b3cde0]/40 rounded-xl text-sm font-medium text-[#6497b1] hover:bg-[#005b96]/5 hover:text-[#005b96] hover:border-[#005b96]/20 transition-all"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================================
    // TICKET FORM (shown after consent)
  // ===================================
    return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2.5 bg-white hover:bg-[#005b96]/5 border border-[#b3cde0]/40 rounded-xl transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-[#005b96]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#011f4b] tracking-tight">Submit New Request</h1>
            <p className="text-sm text-[#6497b1] mt-0.5">Fill in the details below to submit your request</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[#b3cde0]/40 p-7 space-y-6" style={{ boxShadow: '0 2px 16px 0 rgba(0, 91, 150, 0.07)' }}
        >
          {error && (
            <div className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200/50 rounded-xl text-sm text-red-700">
              <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
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
            <div className="flex items-center gap-3.5 p-4 bg-[#005b96]/[0.04] border border-[#005b96]/15 rounded-xl">
              <div className="flex items-center justify-center w-10 h-10 bg-[#005b96]/10 rounded-xl">
                <User className="w-5 h-5 text-[#005b96]" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#6497b1] font-semibold">Dealing Person</p>
                <p className="text-sm font-semibold text-[#011f4b]">
                  {dealingPerson.name}
                  {dealingPerson.designation && (
                    <span className="text-xs font-normal text-[#6497b1] ml-1.5">({dealingPerson.designation})</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {subCategoryId && !dealingPerson && (
            <div className="flex items-center gap-3.5 p-4 bg-amber-50/60 border border-amber-200/50 rounded-xl">
              <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-xl">
                <User className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#6497b1] font-semibold">Dealing Person</p>
                <p className="text-sm text-amber-700 font-medium">No employee assigned to this sub-category yet</p>
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
            <p className="mt-1 text-xs text-[#6497b1] text-right">
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
                <div className="flex items-center gap-2 px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl bg-[#005b96]/[0.03]">
                  <span className="text-sm text-[#011f4b] truncate flex-1">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-[#6497b1] hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm text-[#6497b1] hover:bg-[#005b96]/[0.03] hover:border-[#005b96]/25 transition-colors"
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
              <p className="mt-1 text-xs text-[#6497b1]">Max file size: 5MB (PDF, JPG, PNG)</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-3">
            <button
              type="submit"
              disabled={createMutation.isPending || uploading}
              className="flex-1 py-3 bg-[#005b96] hover:bg-[#03396c] text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-md shadow-[#005b96]/20 hover:shadow-lg hover:shadow-[#005b96]/30"
            >
              {uploading ? 'Uploading File...' : createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-3 border border-[#b3cde0]/40 rounded-xl text-sm font-semibold text-[#6497b1] hover:bg-[#005b96]/[0.03] hover:border-[#005b96]/25 transition-all"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
