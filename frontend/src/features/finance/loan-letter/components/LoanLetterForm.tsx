'use client';

import { useEffect, useState } from 'react';
import { FileText, Send } from 'lucide-react';
import { useLoanLetter } from '../hooks/useLoanLetter';
import { useLoanLetterTemplate } from '../hooks/useLoanLetterTemplate';
import { programService, Program } from '@/features/admin-management/services/program.service';
import LoanLetterPrintView from './LoanLetterPrintView';

const relationPrefixes = ['Son of', 'Daughter of', 'Ward of'];

export default function LoanLetterForm() {
  const { generatedLetter, setGeneratedLetter, saving, error, create } = useLoanLetter();
  const { template } = useLoanLetterTemplate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [previewIsExisting, setPreviewIsExisting] = useState(false);
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
        setGeneratedLetter(err.existingLetter);
        setPreviewIsExisting(true);
      }
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

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Application Number</label>
          <input
            type="text"
            value={form.applicationNumber}
            onChange={e => setForm({ ...form, applicationNumber: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="e.g. APP-2025-001"
            required
          />
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
              Select Semesters ({form.selectedSemesters.length} selected)
            </label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: totalSemesters }, (_, i) => i + 1).map(sem => (
                <button
                  key={sem}
                  type="button"
                  onClick={() => toggleSemester(sem)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.selectedSemesters.includes(sem)
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                  }`}
                >
                  Semester {sem}
                </button>
              ))}
            </div>
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
