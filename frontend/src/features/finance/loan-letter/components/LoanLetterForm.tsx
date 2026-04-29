'use client';

import { useEffect, useState } from 'react';
import { FileText, Send } from 'lucide-react';
import { useLoanLetter } from '../hooks/useLoanLetter';
import { useLoanLetterTemplate } from '../hooks/useLoanLetterTemplate';
import { programService, Program } from '@/features/admin-management/services/program.service';
import LoanLetterPrintView from './LoanLetterPrintView';
import type { LoanLetter } from '../services/loanLetter.service';

const relationPrefixes = ['Son of', 'Daughter of', 'Ward of'];

export default function LoanLetterForm() {
  const { generatedLetter, setGeneratedLetter, saving, error, create } = useLoanLetter();
  const { template } = useLoanLetterTemplate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [previewIsExisting, setPreviewIsExisting] = useState(false);
  const [duplicateLetter, setDuplicateLetter] = useState<LoanLetter | null>(null);
  const [form, setForm] = useState({
    applicationNumber: '',
    studentEmail: '',
    studentPhone: '',
    studentName: '',
    relationPrefix: 'Son of',
    relationName: '',
    programId: '',
    specializationId: '' as string | null,
    selectedSemesters: [] as number[],
    accommodation: 'none' as 'none' | 'transport' | 'hostel',
  });

  useEffect(() => {
    programService.getAllPrograms({ isActive: true }).then(res => setPrograms(res.data || []));
  }, []);

  const selectedProgram = programs.find(p => p.id === form.programId);
  const totalSemesters = selectedProgram?.durationSemesters || 0;
  const specializations = selectedProgram?.specializations || [];

  const toggleSemester = (sem: number) => {
    setForm(prev => ({
      ...prev,
      selectedSemesters: prev.selectedSemesters.includes(sem)
        ? prev.selectedSemesters.filter(s => s !== sem)
        : [...prev.selectedSemesters, sem].sort((a, b) => a - b),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.applicationNumber || !form.studentName || !form.relationName || !form.programId || form.selectedSemesters.length === 0) return;
    if (!form.specializationId) return; // must pick specialization or 'none'
    if (!/^[Ss][Gg][Tt][A-Za-z0-9]+$/.test(form.applicationNumber)) return;
    try {
      setPreviewIsExisting(false);
      const specializationId = form.specializationId === 'none' ? null : form.specializationId;
      await create({
        ...form,
        specializationId,
        studentPhone: form.studentPhone || null,
        transportIncluded: form.accommodation === 'transport',
        hostelIncluded: form.accommodation === 'hostel',
      });
    } catch (err: any) {
      if (err.existingLetter) {
        setDuplicateLetter(err.existingLetter);
      }
      // err.message is already set via setError() in the hook — no extra handling needed
    }
  };

  if (generatedLetter) {
    return (
      <LoanLetterPrintView
        letter={generatedLetter}
        template={template}
        onClose={() => {
          setGeneratedLetter(null);
          setPreviewIsExisting(false);
        }}
        recordReprint={previewIsExisting}
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Generate Loan Letter
        </h3>
        <p className="text-sm text-gray-600 mt-1">Fill in the student details to generate a loan letter with a unique number</p>
      </div>

      {error && !duplicateLetter && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {duplicateLetter && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg text-sm">
          <p className="font-semibold text-amber-800 mb-1">Application number already exists</p>
          <p className="text-amber-700 mb-3">A loan letter with application number <span className="font-mono font-bold">{form.applicationNumber}</span> already exists in the system.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setGeneratedLetter(duplicateLetter); setPreviewIsExisting(true); setDuplicateLetter(null); }}
              className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700"
            >
              View Existing Letter
            </button>
            <button
              type="button"
              onClick={() => setDuplicateLetter(null)}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded text-xs font-medium hover:bg-amber-50"
            >
              Use a Different Number
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Application Number</label>
          <input
            type="text"
            value={form.applicationNumber}
            onChange={e => {
              const val = e.target.value;
              setForm({ ...form, applicationNumber: val });
            }}
            className={`w-full px-3 py-2 border rounded-lg text-sm ${
              form.applicationNumber && !/^[Ss][Gg][Tt][A-Za-z0-9]+$/.test(form.applicationNumber)
                ? 'border-red-400 bg-red-50'
                : 'border-gray-300'
            }`}
            placeholder="e.g. SGT20250001"
            required
          />
          {form.applicationNumber && !/^[Ss][Gg][Tt][A-Za-z0-9]+$/.test(form.applicationNumber) && (
            <p className="mt-1 text-xs text-red-600">Must start with &ldquo;SGT&rdquo; (case-insensitive) and contain only letters and digits (no spaces or special characters)</p>
          )}
          <p className="mt-1 text-xs text-gray-500">Format: SGT followed by alphanumeric characters only — e.g. <span className="font-mono">SGT20250001</span></p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Student Email</label>
          <input
            type="email"
            value={form.studentEmail}
            onChange={e => setForm({ ...form, studentEmail: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="For internal record only"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Student Mobile Number</label>
          <input
            type="tel"
            value={form.studentPhone}
            onChange={e => setForm({ ...form, studentPhone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="For internal record only"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
          <input
            type="text"
            value={form.studentName}
            onChange={e => setForm({ ...form, studentName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
            <select
              value={form.relationPrefix}
              onChange={e => setForm({ ...form, relationPrefix: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {relationPrefixes.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relation&apos;s Name</label>
            <input
              type="text"
              value={form.relationName}
              onChange={e => setForm({ ...form, relationName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Programme</label>
          <select
            value={form.programId}
            onChange={e => setForm({ ...form, programId: e.target.value, selectedSemesters: [], specializationId: programs.find(p => p.id === e.target.value)?.specializations?.length ? '' : 'none' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          >
            <option value="">Select programme...</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.programCode} — {p.programName}</option>
            ))}
          </select>
        </div>

        {form.programId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Specialization <span className="text-red-500">*</span>
            </label>
            <select
              value={form.specializationId ?? ''}
              onChange={e => setForm({ ...form, specializationId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            >
              {specializations.length > 0 && <option value="">Select specialization...</option>}
              <option value="none">None (General)</option>
              {specializations.map(s => (
                <option key={s.id} value={s.id}>{s.specializationCode} — {s.specializationName}</option>
              ))}
            </select>
          </div>
        )}

        {totalSemesters > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Semesters <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-300 p-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: totalSemesters }, (_, i) => i + 1).map(sem => {
                const isChecked = form.selectedSemesters.includes(sem);
                return (
                  <label
                    key={sem}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer ${
                      isChecked
                        ? 'border-primary-300 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSemester(sem)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>Semester {sem}</span>
                  </label>
                );
              })}
            </div>
            <input
              type="hidden"
              value={form.selectedSemesters.join(',')}
              required={form.selectedSemesters.length === 0}
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">
              {form.selectedSemesters.length === 0
                ? 'Select one or more semesters using the checkboxes above'
                : `${form.selectedSemesters.length} semester${form.selectedSemesters.length !== 1 ? 's' : ''} selected`}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Accommodation</label>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            {(['none', 'transport', 'hostel'] as const).map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="accommodation"
                  value={opt}
                  checked={form.accommodation === opt}
                  onChange={() => setForm({ ...form, accommodation: opt })}
                  className="border-gray-300 text-primary-600"
                />
                {opt === 'none' ? 'None' : opt === 'transport' ? 'Transport' : 'Hostel'}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !form.applicationNumber || !form.studentName || !form.relationName || !form.programId || form.selectedSemesters.length === 0 || !form.specializationId}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 sm:w-auto"
        >
          <Send className="w-4 h-4" /> {saving ? 'Generating...' : 'Generate Loan Letter'}
        </button>
      </form>
    </div>
  );
}
