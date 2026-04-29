'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Save, X, Edit2, Upload, Download, CheckCircle, AlertCircle, Copy, ChevronsRight } from 'lucide-react';
import { useFeeStructure } from '../hooks/useFeeStructure';
import { FeeStructure, BulkRow, BulkResult, BulkSemesterKey, feeStructureService } from '../services/feeStructure.service';
import { programService, Program, Specialization } from '@/features/admin-management/services/program.service';

// ─── Types & helpers ──────────────────────────────────────────────────────────
interface HeadRow {
  tempId: string;
  headName: string;
  totalAmount: string;
  amounts: Record<number, string>;
}

interface BulkDraftGroup {
  tempId: string;
  rawProgramCode: string;
  rawSpecializationCode: string;
  programId: string;
  specializationId: string;
  batchYear: number;
  uploadedSemesterNumbers: number[];
  heads: HeadRow[];
}

const makeAmountMap = (sems: number, source?: Record<number, string>): Record<number, string> =>
  Object.fromEntries(Array.from({ length: sems }, (_, i) => [i + 1, source?.[i + 1] ?? '']));

const makeEmptyRow = (sems: number): HeadRow => ({
  tempId: Math.random().toString(36).slice(2),
  headName: '',
  totalAmount: '',
  amounts: makeAmountMap(sems),
});

const makeSpecAmounts = (sems: number): Record<number, string> => makeAmountMap(sems);

const MAX_BULK_SEMS = 8;

const isExcelFile = (fileName: string) => /\.(xlsx|xls)$/i.test(fileName);

const getSemesterNumbersFromHeaders = (headers: string[]) =>
  [...new Set(headers
    .map((header) => {
      const match = /^sem(\d+)$/i.exec(header);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value !== null && Number.isInteger(value) && value > 0))]
    .sort((a, b) => a - b);

const hasAnyHeadAmount = (head: HeadRow, semCount: number) =>
  (Number(head.totalAmount) || 0) > 0
  || Array.from({ length: semCount }, (_, i) => Number(head.amounts[i + 1]) || 0).some(value => value > 0);

const getRowSemesterTotal = (head: HeadRow, semCount: number) =>
  Array.from({ length: semCount }, (_, i) => Number(head.amounts[i + 1]) || 0).reduce((sum, value) => sum + value, 0);

const getHeadRowIssues = (head: HeadRow, semCount: number, label: string) => {
  const issues: string[] = [];
  const name = head.headName.trim();
  const total = Number(head.totalAmount) || 0;
  const semTotal = getRowSemesterTotal(head, semCount);
  const hasSemesterValue = Array.from({ length: semCount }, (_, i) => Number(head.amounts[i + 1]) || 0).some(value => value > 0);

  if (!name && (total > 0 || hasSemesterValue)) {
    issues.push(`${label}: head name is required.`);
  }
  if (name && total <= 0) {
    issues.push(`${label} (${name}): total amount is required.`);
  }
  if (name && total > 0 && !hasSemesterValue) {
    issues.push(`${label} (${name}): enter semester amounts.`);
  }
  if (name && total > 0 && semTotal !== total) {
    issues.push(`${label} (${name}): semester total ${semTotal.toLocaleString('en-IN')} must match head total ${total.toLocaleString('en-IN')}.`);
  }

  return issues;
};

/** Minimal CSV line parser — handles double-quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

async function readTabularFile(file: File): Promise<string[][]> {
  if (isExcelFile(file.name)) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new Error('Excel file must contain at least one worksheet');
    }

    return XLSX.utils
      .sheet_to_json<(string | number | null)[]>(workbook.Sheets[firstSheetName], {
        header: 1,
        raw: false,
        defval: '',
      })
      .map(row => row.map(cell => String(cell ?? '').trim()));
  }

  const text = await file.text();
  return text
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map(parseCSVLine);
}

// ─── SemGrid ─────────────────────────────────────────────────────────────────
// MUST live outside AcademicFeeTab.  If defined inside, React treats it as a
// brand-new component type on every render → unmount/remount → input loses
// focus after every keystroke.
interface SemGridProps {
  heads: HeadRow[];
  semCols: number[];
  onNameChange: (i: number, v: string) => void;
  onTotalChange: (i: number, v: string) => void;
  onAmtChange: (i: number, sem: number, v: string) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  onFillAll?: (i: number) => void;
}
function SemGrid({ heads, semCols, onNameChange, onTotalChange, onAmtChange, onRemove, onAdd, onFillAll }: SemGridProps) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  const focusCell = (rowIdx: number, colIdx: number) => {
    if (!tbodyRef.current) return;
    const rows = tbodyRef.current.querySelectorAll('tr');
    const row = rows[rowIdx];
    if (!row) return;
    const inputs = row.querySelectorAll<HTMLInputElement>('input');
    inputs[colIdx]?.focus();
  };

  // Enter on head-name → jump to first sem amount of same row
  const onNameKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'Enter') { e.preventDefault(); focusCell(i, 1); }
  };

  const onTotalKeyDown = (e: React.KeyboardEvent, rowIdx: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    focusCell(rowIdx, 2);
  };

  // Enter on a sem amount → move to next row head-name, or add a new row on last
  const onAmtKeyDown = (e: React.KeyboardEvent, rowIdx: number, semIdx: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const isLastSem = semIdx === semCols.length - 1;
    if (!isLastSem) {
      focusCell(rowIdx, semIdx + 2); // +1 for name, +1 for next sem (1-indexed semCols)
      return;
    }
    // Last sem in this row
    const isLastRow = rowIdx === heads.length - 1;
    if (isLastRow) {
      onAdd();
      // Focus new row's name input after React re-renders
      requestAnimationFrame(() => focusCell(rowIdx + 1, 0));
    } else {
      focusCell(rowIdx + 1, 0);
    }
  };

  return (
    <div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="text-sm min-w-max w-full">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="sm:sticky sm:left-0 bg-gray-100 px-3 py-2 text-left font-medium text-gray-700 w-52 min-w-[200px]">
                Particulars
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-700 min-w-[120px]">
                Total
              </th>
              {semCols.map(s => (
                <th key={s} className="px-3 py-2 text-right font-medium text-gray-700 min-w-[100px]">
                  Sem {s}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody ref={tbodyRef} className="divide-y divide-gray-100">
            {heads.map((head, i) => (
              <tr key={head.tempId} className="hover:bg-gray-50">
                <td className="sm:sticky sm:left-0 bg-white px-2 py-1.5">
                  <input
                    type="text"
                    placeholder="e.g. Tuition Fee"
                    value={head.headName}
                    onChange={e => onNameChange(i, e.target.value)}
                    onKeyDown={e => onNameKeyDown(e, i)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {semCols.length > 1 && onFillAll && (
                    <button
                      type="button"
                      onClick={() => onFillAll(i)}
                      title="Copy Sem 1 amount to all semesters"
                      className="mt-1 flex items-center gap-1 text-xs text-primary-500 hover:text-primary-700 font-medium"
                    >
                      <ChevronsRight className="w-3 h-3" /> Same for all semesters
                    </button>
                  )}
                </td>
                <td className="px-1.5 py-1.5">
                  <input
                    type="number"
                    value={head.totalAmount}
                    onChange={e => onTotalChange(i, e.target.value)}
                    onKeyDown={e => onTotalKeyDown(e, i)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    min={0}
                    step="1"
                    placeholder="0"
                  />
                </td>
                {semCols.map((s, si) => (
                  <td key={s} className="px-1.5 py-1.5">
                    <input
                      type="number"
                      value={head.amounts[s] ?? ''}
                      onChange={e => onAmtChange(i, s, e.target.value)}
                      onKeyDown={e => onAmtKeyDown(e, i, si)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      min={0}
                      step="1"
                      placeholder="0"
                    />
                  </td>
                ))}
                <td className="px-1 py-1.5 text-center">
                  {heads.length > 1 && (
                    <button
                      onClick={() => onRemove(i)}
                      className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
              <td className="sm:sticky sm:left-0 bg-gray-50 px-3 py-2 text-gray-800">Total</td>
              <td className="px-3 py-2 text-right text-gray-800">
                {heads.reduce((acc, h) => acc + (Number(h.totalAmount) || 0), 0).toLocaleString('en-IN')}
              </td>
              {semCols.map(s => (
                <td key={s} className="px-3 py-2 text-right text-gray-800">
                  {heads.reduce((acc, h) => acc + (Number(h.amounts[s]) || 0), 0).toLocaleString('en-IN')}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <button
        onClick={onAdd}
        className="mt-2 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
      >
        <Plus className="w-3.5 h-3.5" /> Add Row
      </button>
    </div>
  );
}

// ─── SpecAddOnGrid ────────────────────────────────────────────────────────────
// Single row of per-semester additional fees — no head-name field needed.
// Also defined outside parent component for the same remount reason.
interface SpecAddOnGridProps {
  semCols: number[];
  totalAmount: string;
  amounts: Record<number, string>;
  onTotalChange: (v: string) => void;
  onChange: (sem: number, v: string) => void;
}
function SpecAddOnGrid({ semCols, totalAmount, amounts, onTotalChange, onChange }: SpecAddOnGridProps) {
  return (
    <div className="overflow-x-auto border border-blue-200 rounded-lg">
      <table className="text-sm min-w-max w-full">
        <thead>
          <tr className="bg-blue-50 border-b border-blue-200">
            <th className="sm:sticky sm:left-0 bg-blue-50 px-3 py-2 text-left font-medium text-blue-700 w-52 min-w-[200px]">
              Additional Fee (per semester)
            </th>
            <th className="px-3 py-2 text-right font-medium text-blue-700 min-w-[120px]">
              Total
            </th>
            {semCols.map(s => (
              <th key={s} className="px-3 py-2 text-right font-medium text-blue-700 min-w-[100px]">
                Sem {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-white">
            <td className="sm:sticky sm:left-0 bg-white px-3 py-2 text-sm text-gray-400 italic">
              Added on top of base fee
            </td>
            <td className="px-1.5 py-1.5">
              <input
                type="number"
                value={totalAmount}
                onChange={e => onTotalChange(e.target.value)}
                className="w-full px-2 py-1.5 border border-blue-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                min={0}
                step="1"
                placeholder="0"
              />
            </td>
            {semCols.map(s => (
              <td key={s} className="px-1.5 py-1.5">
                <input
                  type="number"
                  value={amounts[s] ?? ''}
                  onChange={e => onChange(s, e.target.value)}
                  className="w-full px-2 py-1.5 border border-blue-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  min={0}
                  step="1"
                  placeholder="0"
                />
              </td>
            ))}
          </tr>
        </tbody>
        <tfoot>
          <tr className="bg-blue-50 border-t border-blue-200 font-semibold">
            <td className="sm:sticky sm:left-0 bg-blue-50 px-3 py-2 text-blue-800">Total Add-on</td>
            <td className="px-3 py-2 text-right text-blue-800">{(Number(totalAmount) || 0).toLocaleString('en-IN')}</td>
            {semCols.map(s => (
              <td key={s} className="px-3 py-2 text-right text-blue-800">
                {(Number(amounts[s]) || 0).toLocaleString('en-IN')}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function AcademicFeeTab() {
  const { list, loading, saving, error, fetchAll, createAcademicBatch, update, remove } = useFeeStructure();
  const [programs, setPrograms] = useState<Program[]>([]);

  // filter
  const [filterProgramId, setFilterProgramId] = useState('');

  // form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formProgramId, setFormProgramId] = useState('');
  const [formBatchYear, setFormBatchYear] = useState(new Date().getFullYear());
  const [totalSemesters, setTotalSemesters] = useState(0);
  const [baseHeads, setBaseHeads] = useState<HeadRow[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [specAmounts, setSpecAmounts] = useState<Record<string, Record<number, string>>>({});
  const [specTotals, setSpecTotals] = useState<Record<string, string>>({});
  const [specEnabled, setSpecEnabled] = useState<Record<string, boolean>>({});

  // bulk upload state
  const [uploading, setUploading] = useState(false);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BulkResult | null>(null);
  const [bulkDrafts, setBulkDrafts] = useState<BulkDraftGroup[]>([]);
  const [bulkDraftFileName, setBulkDraftFileName] = useState('');
  const [bulkDraftErrors, setBulkDraftErrors] = useState<string[]>([]);

  useEffect(() => {
    programService.getAllPrograms({ isActive: true }).then(res => setPrograms(res.data || []));
  }, []);

  useEffect(() => {
    fetchAll({ type: 'ACADEMIC', programId: filterProgramId || undefined });
  }, [filterProgramId, fetchAll]);

  const handleFormProgramChange = useCallback(async (programId: string) => {
    setFormProgramId(programId);
    if (!programId) {
      setTotalSemesters(0); setBaseHeads([]); setSpecializations([]); setSpecAmounts({}); setSpecTotals({}); setSpecEnabled({});
      return;
    }
    const prog = programs.find(p => p.id === programId);
    const sems = prog?.durationSemesters || 0;
    setTotalSemesters(sems);
    setBaseHeads(sems > 0 ? [makeEmptyRow(sems)] : []);

    // Use specializations already embedded in the programme list (from getAllPrograms).
    // Only fall back to a separate API call if the list response didn't include them.
    const inlineSpecs = prog?.specializations ?? null;
    const specs = inlineSpecs !== null
      ? inlineSpecs
      : await programService.getSpecializations(programId).then(r => r.data || []).catch(() => []);

    setSpecializations(specs);
    const sa: Record<string, Record<number, string>> = {};
    const st: Record<string, string> = {};
    const se: Record<string, boolean> = {};
    specs.forEach(s => { sa[s.id] = sems > 0 ? makeSpecAmounts(sems) : {}; st[s.id] = ''; se[s.id] = false; });
    setSpecAmounts(sa); setSpecTotals(st); setSpecEnabled(se);
  }, [programs]);

  const resetForm = () => {
    setShowForm(false); setEditingId(null); setFormProgramId('');
    setFormBatchYear(new Date().getFullYear()); setTotalSemesters(0);
    setBaseHeads([]); setSpecializations([]); setSpecAmounts({}); setSpecTotals({}); setSpecEnabled({});
    setFormSaveError(null);
  };

  const startEdit = (fs: FeeStructure) => {
    const prog = programs.find(p => p.id === fs.programId);
    const sems = prog?.durationSemesters ||
      (fs.heads.length > 0
        ? Math.max(...fs.heads.flatMap(h => h.semesterAmounts ? Object.keys(h.semesterAmounts).map(Number) : [1]))
        : 0);
    setEditingId(fs.id); setFormProgramId(fs.programId || '');
    setFormBatchYear(fs.batchYear); setTotalSemesters(sems);
    setBaseHeads(fs.heads.map(h => ({
      tempId: h.id || Math.random().toString(36).slice(2),
      headName: h.headName,
      totalAmount: String(h.amount ?? ''),
      amounts: Object.fromEntries(Array.from({ length: sems }, (_, i) => [
        i + 1,
        String((h.semesterAmounts as any)?.[i + 1] ?? h.amount ?? ''),
      ])),
    })));
    setShowForm(true);
  };

  // ── base head mutations ──────────────────────────────────────────────────
  const updBaseName = (i: number, v: string) => setBaseHeads(h => h.map((r, idx) => idx === i ? { ...r, headName: v } : r));
  const updBaseTotal = (i: number, v: string) => setBaseHeads(h => h.map((r, idx) => idx === i ? { ...r, totalAmount: v } : r));
  const updBaseAmt = (i: number, sem: number, v: string) => setBaseHeads(h => h.map((r, idx) => idx === i ? { ...r, amounts: { ...r.amounts, [sem]: v } } : r));
  const remBaseRow = (i: number) => setBaseHeads(h => h.filter((_, idx) => idx !== i));
  const addBaseRow = () => setBaseHeads(h => [...h, makeEmptyRow(totalSemesters)]);

  // Fill all semesters of a head row with the Sem 1 value
  const fillAllSems = useCallback((rowIndex: number) => {
    setBaseHeads(prev => prev.map((row, i) => {
      if (i !== rowIndex) return row;
      const fillValue = row.amounts[1] ?? '';
      return { ...row, amounts: Object.fromEntries(Object.keys(row.amounts).map(k => [Number(k), fillValue])) };
    }));
  }, []);

  // Copy head names (not amounts) from any existing base fee structure
  const [cloneSourceId, setCloneSourceId] = useState('');
  const [formSaveError, setFormSaveError] = useState<string | null>(null);
  const handleCopyHeadNames = useCallback(() => {
    const source = list.find(fs => fs.id === cloneSourceId);
    if (!source || totalSemesters === 0) return;
    setBaseHeads(source.heads.map(h => ({
      tempId: Math.random().toString(36).slice(2),
      headName: h.headName,
      totalAmount: '',
      amounts: makeAmountMap(totalSemesters),
    })));
    setCloneSourceId('');
  }, [cloneSourceId, list, totalSemesters]);

  // Clone a base fee structure into the New form
  const startClone = useCallback(async (fs: FeeStructure) => {
    if (!fs.programId) return;
    const prog = programs.find(p => p.id === fs.programId);
    const sems = prog?.durationSemesters ||
      (fs.heads.length > 0
        ? Math.max(...fs.heads.flatMap(h => h.semesterAmounts ? Object.keys(h.semesterAmounts).map(Number) : [1]))
        : 0);
    setEditingId(null);
    setFormProgramId(fs.programId);
    setFormBatchYear(new Date().getFullYear());
    setTotalSemesters(sems);
    setBaseHeads(fs.heads.map(h => ({
      tempId: Math.random().toString(36).slice(2),
      headName: h.headName,
      totalAmount: String(h.amount ?? ''),
      amounts: Object.fromEntries(Array.from({ length: sems }, (_, i) => [
        i + 1,
        String((h.semesterAmounts as any)?.[i + 1] ?? h.amount ?? ''),
      ])),
    })));
    const inlineSpecs = prog?.specializations ?? null;
    const specs = inlineSpecs !== null
      ? inlineSpecs
      : await programService.getSpecializations(fs.programId).then(r => r.data || []).catch(() => []);
    setSpecializations(specs);
    const sa: Record<string, Record<number, string>> = {};
    const st: Record<string, string> = {};
    const se: Record<string, boolean> = {};
    specs.forEach(s => { sa[s.id] = sems > 0 ? makeSpecAmounts(sems) : {}; st[s.id] = ''; se[s.id] = false; });
    setSpecAmounts(sa); setSpecTotals(st); setSpecEnabled(se);
    setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }, [programs]);

  // ── spec amount mutations ────────────────────────────────────────────────
  const updSpecAmt = (sid: string, sem: number, v: string) =>
    setSpecAmounts(sa => ({ ...sa, [sid]: { ...sa[sid], [sem]: v } }));
  const updSpecTotal = (sid: string, v: string) =>
    setSpecTotals(current => ({ ...current, [sid]: v }));

  // ── build head payloads ──────────────────────────────────────────────────
  const buildHeads = (rows: HeadRow[]) =>
    rows.filter(h => h.headName.trim()).map(h => {
      const semesterAmounts: Record<number, number> = {};
      for (let s = 1; s <= totalSemesters; s++) {
        const v = Number(h.amounts[s]) || 0;
        semesterAmounts[s] = v;
      }
      return { headName: h.headName.trim(), amount: Number(h.totalAmount) || 0, semesterAmounts };
    });

  const buildSpecHead = (specName: string, totalAmount: string, amounts: Record<number, string>) => {
    const semesterAmounts: Record<number, number> = {};
    for (let s = 1; s <= totalSemesters; s++) {
      const v = Number(amounts[s]) || 0;
      semesterAmounts[s] = v;
    }
    return [{ headName: `${specName} Additional Fee`, amount: Number(totalAmount) || 0, semesterAmounts }];
  };

  const getSpecializationChargeRule = (spec: Specialization) => {
    const program = programs.find(p => p.id === formProgramId);
    const rules = program?.metadata?.specializationChargeRules || [];
    return rules.find(rule =>
      Number(rule.batchYear) === Number(formBatchYear) &&
      (rule.specializationCode === spec.specializationCode || rule.specializationName === spec.specializationName)
    );
  };

  const getSpecializationChargeRuleIssue = (spec: Specialization) => {
    const rule = getSpecializationChargeRule(spec);
    if (!rule) return null;
    const amounts = specAmounts[spec.id] || {};
    for (let semester = rule.startSemester; semester <= totalSemesters; semester++) {
      if ((Number(amounts[semester]) || 0) <= 0) {
        return `${spec.specializationCode} requires a non-zero add-on charge from semester ${rule.startSemester} for batch year ${formBatchYear}.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!formProgramId) return;
    setFormSaveError(null);

    // Client-side duplicate guard: same programme + same batch year (base or specialization)
    if (!editingId) {
      const conflictBase = list.find(
        fs => fs.programId === formProgramId && fs.batchYear === formBatchYear && !fs.specializationId
      );
      if (conflictBase) {
        setFormSaveError(
          `A base fee structure for ${conflictBase.program?.programCode || 'this programme'} · ${formBatchYear} already exists. Edit the existing entry instead.`
        );
        return;
      }
    }

    try {
      const baseIssues = baseHeads.flatMap((head, index) => getHeadRowIssues(head, totalSemesters, `Base row ${index + 1}`));
      if (baseIssues.length > 0) {
        setFormSaveError(baseIssues[0]);
        return;
      }

      const mainHeads = buildHeads(baseHeads);
      if (editingId) {
        await update(editingId, { heads: mainHeads });
      } else {
        const specIssues = specializations
          .filter(spec => specEnabled[spec.id])
          .flatMap(spec => [
            ...getHeadRowIssues({
              tempId: spec.id,
              headName: `${spec.specializationName} Additional Fee`,
              totalAmount: specTotals[spec.id] || '',
              amounts: specAmounts[spec.id] || {},
            }, totalSemesters, `${spec.specializationCode} add-on`),
            getSpecializationChargeRuleIssue(spec),
          ].filter(Boolean) as string[]);
        if (specIssues.length > 0) {
          setFormSaveError(specIssues[0]);
          return;
        }

        const specializationStructures = specializations
          .filter(spec => specEnabled[spec.id])
          .map(spec => {
            const amounts = specAmounts[spec.id] || {};
            return {
              specializationId: spec.id,
              heads: buildSpecHead(spec.specializationName, specTotals[spec.id] || '', amounts),
              hasAmount: (Number(specTotals[spec.id]) || 0) > 0 || Object.values(amounts).some(v => Number(v) > 0),
            };
          })
          .filter(structure => structure.hasAmount)
          .map(({ specializationId, heads }) => ({ specializationId, heads }));

        await createAcademicBatch({
          batchYear: formBatchYear,
          programId: formProgramId,
          baseHeads: mainHeads,
          specializationStructures,
        });
      }
      resetForm();
      fetchAll({ type: 'ACADEMIC', programId: filterProgramId || undefined });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save fee structure';
      setFormSaveError(msg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fee structure?')) return;
    try { await remove(id); fetchAll({ type: 'ACADEMIC', programId: filterProgramId || undefined }); } catch {}
  };

  const getProgramById = (programId: string) => programs.find(program => program.id === programId) || null;

  const getBulkDraftSemCount = (draft: BulkDraftGroup) => {
    const program = getProgramById(draft.programId);
    const uploadedMax = Math.max(...draft.uploadedSemesterNumbers, 1);
    return program?.durationSemesters || uploadedMax;
  };

  const getBulkDraftSpecializations = (draft: BulkDraftGroup) =>
    (getProgramById(draft.programId)?.specializations || []).filter(spec => spec.isActive);

  const getBulkDraftReview = (draft: BulkDraftGroup) => {
    const program = getProgramById(draft.programId);
    const specializationOptions = getBulkDraftSpecializations(draft);
    const specialization = draft.specializationId
      ? specializationOptions.find(spec => spec.id === draft.specializationId) || null
      : null;
    const semCount = getBulkDraftSemCount(draft);
    const maxUploadedSemester = Math.max(...draft.uploadedSemesterNumbers, 0);
    const issues: string[] = [];

    if (!draft.programId) {
      issues.push(`Imported programme code "${draft.rawProgramCode || '—'}" was not matched. Select a programme before importing.`);
    }

    if (program && semCount === 0) {
      issues.push('The selected programme has no semester duration configured.');
    }

    if (program && maxUploadedSemester > semCount) {
      issues.push(`The upload file contains amounts up to Sem ${maxUploadedSemester}, but ${program.programCode} is configured for ${semCount} semester(s).`);
    }

    if (draft.rawSpecializationCode && !draft.specializationId) {
      issues.push(`Imported specialization code "${draft.rawSpecializationCode}" was not matched. Select a specialization or clear the field.`);
    }

    if (draft.specializationId && !specialization) {
      issues.push('The selected specialization does not belong to the chosen programme.');
    }

    let validHeadCount = 0;
    let unnamedRows = 0;
    let zeroAmountRows = 0;

    for (const head of draft.heads) {
      const hasName = Boolean(head.headName.trim());
      const hasAmount = hasAnyHeadAmount(head, semCount);
      const rowIssues = getHeadRowIssues(head, semCount, `Head row ${validHeadCount + unnamedRows + zeroAmountRows + 1}`);

      if (hasName && hasAmount) validHeadCount++;
      else if (!hasName && hasAmount) unnamedRows++;
      else if (hasName && !hasAmount) zeroAmountRows++;

      issues.push(...rowIssues);
    }

    if (unnamedRows > 0) issues.push(`${unnamedRows} row(s) have semester amounts but no head name.`);
    if (zeroAmountRows > 0) issues.push(`${zeroAmountRows} head row(s) have a name but no semester amounts.`);
    if (validHeadCount === 0) issues.push('Add at least one fee head with a name and semester amounts before importing.');

    return { program, specialization, specializationOptions, semCount, validHeadCount, issues };
  };

  const clearBulkDrafts = () => {
    setBulkDrafts([]);
    setBulkDraftFileName('');
    setBulkDraftErrors([]);
  };

  const updateBulkDraft = (draftId: string, updater: (draft: BulkDraftGroup) => BulkDraftGroup) => {
    setBulkDrafts(currentDrafts => currentDrafts.map(draft => draft.tempId === draftId ? updater(draft) : draft));
  };

  const handleBulkDraftProgramChange = (draftId: string, programId: string) => {
    updateBulkDraft(draftId, (draft) => {
      const nextProgram = programs.find(program => program.id === programId) || null;
      const nextSemCount = nextProgram?.durationSemesters || Math.max(...draft.uploadedSemesterNumbers, 1);
      const nextSpecs = (nextProgram?.specializations || []).filter(spec => spec.isActive);
      const specializationId = nextSpecs.some(spec => spec.id === draft.specializationId) ? draft.specializationId : '';

      return {
        ...draft,
        programId,
        specializationId,
        heads: draft.heads.map(head => ({ ...head, amounts: makeAmountMap(nextSemCount, head.amounts) })),
      };
    });
  };

  const handleBulkDraftSpecializationChange = (draftId: string, specializationId: string) => {
    updateBulkDraft(draftId, draft => ({ ...draft, specializationId }));
  };

  const handleBulkDraftBatchYearChange = (draftId: string, batchYear: number) => {
    updateBulkDraft(draftId, draft => ({ ...draft, batchYear }));
  };

  const handleBulkDraftNameChange = (draftId: string, headIndex: number, value: string) => {
    updateBulkDraft(draftId, draft => ({
      ...draft,
      heads: draft.heads.map((head, index) => index === headIndex ? { ...head, headName: value } : head),
    }));
  };

  const handleBulkDraftTotalChange = (draftId: string, headIndex: number, value: string) => {
    updateBulkDraft(draftId, draft => ({
      ...draft,
      heads: draft.heads.map((head, index) => index === headIndex ? { ...head, totalAmount: value } : head),
    }));
  };

  const handleBulkDraftAmountChange = (draftId: string, headIndex: number, sem: number, value: string) => {
    updateBulkDraft(draftId, draft => ({
      ...draft,
      heads: draft.heads.map((head, index) => index === headIndex
        ? { ...head, amounts: { ...head.amounts, [sem]: value } }
        : head),
    }));
  };

  const handleBulkDraftRemoveHead = (draftId: string, headIndex: number) => {
    updateBulkDraft(draftId, draft => ({
      ...draft,
      heads: draft.heads.filter((_, index) => index !== headIndex),
    }));
  };

  const handleBulkDraftAddHead = (draftId: string) => {
    updateBulkDraft(draftId, draft => ({
      ...draft,
      heads: [...draft.heads, makeEmptyRow(getBulkDraftSemCount(draft))],
    }));
  };

  const handleBulkImport = async () => {
    setUploadResult(null);
    setUploading(true);

    try {
      const validRows = bulkDrafts.flatMap((draft) => {
        const review = getBulkDraftReview(draft);
        if (review.issues.length > 0 || !review.program) return [];

        return draft.heads
          .filter(head => head.headName.trim() && hasAnyHeadAmount(head, review.semCount))
          .map((head) => {
            const row: BulkRow = {
              programCode: review.program?.programCode || draft.rawProgramCode,
              batchYear: draft.batchYear,
              specializationCode: review.specialization?.specializationCode || '',
              headName: head.headName.trim(),
              totalAmount: Number(head.totalAmount) || 0,
            };

            for (let sem = 1; sem <= review.semCount; sem++) {
              const semKey = `sem${sem}` as BulkSemesterKey;
              row[semKey] = Number(head.amounts[sem]) || 0;
            }

            return row;
          });
      });

      if (validRows.length === 0) {
        throw new Error('No valid fee structures are ready to import. Resolve the draft issues first.');
      }

      const response = await feeStructureService.bulkCreate(validRows);
      setUploadResult(response.data);
      clearBulkDrafts();
      fetchAll({ type: 'ACADEMIC', programId: filterProgramId || undefined });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setUploadResult({ created: 0, skipped: 0, errors: [message], groups: [] });
    } finally {
      setUploading(false);
    }
  };

  // ── Bulk download template ──────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    setTemplateDownloading(true);
    try {
      const blob = await feeStructureService.downloadAcademicTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fee-structure-template-${new Date().getFullYear()}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to download template';
      setUploadResult({ created: 0, skipped: 0, errors: [message], groups: [] });
    } finally {
      setTemplateDownloading(false);
    }
  };

  // ── Bulk file upload (CSV/XLSX) ─────────────────────────────────────────
  const handleCSVUpload = async (file: File) => {
    setUploadResult(null);
    setBulkDraftErrors([]);
    try {
      const rows = await readTabularFile(file);
      if (rows.length < 2) throw new Error('The upload file must have a header row and at least one data row');

      // Find the actual header row — it must contain 'programcode'.
      // This tolerates an optional instruction/tip row above the real headers
      // (as generated by the ExcelJS template).
      const headerRowIndex = rows.findIndex(row =>
        row.some(cell => cell.toLowerCase().trim() === 'programcode')
      );
      if (headerRowIndex === -1) {
        throw new Error('The upload file must have a header row containing "programCode". Make sure you are using the downloaded template.');
      }

      const headers = rows[headerRowIndex].map(header => header.toLowerCase().trim());
      const semesterNumbers = getSemesterNumbersFromHeaders(headers);
      if (semesterNumbers.length === 0) {
        throw new Error('The upload file must include semester columns such as sem1, sem2, ...');
      }

      const programCodeMap = new Map(programs.map(program => [program.programCode.trim().toUpperCase(), program]));
      const groupedDrafts = new Map<string, BulkDraftGroup>();
      const parseErrors: string[] = [];
      let lastProgramCode = '';
      let lastBatchYear = new Date().getFullYear();

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const vals = rows[i];
        const row: Record<string, string> = {};
        headers.forEach((h, j) => { row[h] = (vals[j] || '').trim(); });
        if (Object.values(row).every(value => !value)) continue;

        const rawProgramCode = (row['programcode'] || lastProgramCode).trim().toUpperCase();
        if (!rawProgramCode) {
          parseErrors.push(`Row ${i + 1}: programme code is required. You can leave it blank only after a previous programme row.`);
          continue;
        }
        lastProgramCode = rawProgramCode;

        const rawSpecializationCode = (row['specializationcode'] || '').trim().toUpperCase();
        const batchYear = Number(row['batchyear']) || lastBatchYear;
        lastBatchYear = batchYear;
        const groupKey = `${rawProgramCode}|||${batchYear}|||${rawSpecializationCode}`;
        const matchedProgram = programCodeMap.get(rawProgramCode);
        const matchedSpecialization = rawSpecializationCode && matchedProgram
          ? (matchedProgram.specializations || []).find(spec => spec.isActive && spec.specializationCode.trim().toUpperCase() === rawSpecializationCode)
          : null;

        if (!groupedDrafts.has(groupKey)) {
          const semCount = matchedProgram?.durationSemesters || Math.max(...semesterNumbers, 1);
          groupedDrafts.set(groupKey, {
            tempId: Math.random().toString(36).slice(2),
            rawProgramCode,
            rawSpecializationCode,
            programId: matchedProgram?.id || '',
            specializationId: matchedSpecialization?.id || '',
            batchYear,
            uploadedSemesterNumbers: semesterNumbers,
            heads: [],
          });

          if (!matchedProgram) {
            parseErrors.push(`Programme code "${rawProgramCode}" was not matched automatically. Review it before importing.`);
          }
          if (rawSpecializationCode && !matchedSpecialization) {
            parseErrors.push(`Specialization code "${rawSpecializationCode}" for programme "${rawProgramCode}" was not matched automatically.`);
          }
          if (matchedProgram && Math.max(...semesterNumbers, 0) > (matchedProgram.durationSemesters || 0)) {
            parseErrors.push(`Programme "${rawProgramCode}" is configured for ${matchedProgram.durationSemesters || 0} semester(s), but the file includes higher semester columns.`);
          }
        }

        const draft = groupedDrafts.get(groupKey);
        if (!draft) continue;

        const headName = (row['headname'] || '').trim();
        if (!headName) {
          parseErrors.push(`Row ${i + 1}: head name is required for programme "${rawProgramCode}".`);
          continue;
        }

        draft.heads.push({
          tempId: Math.random().toString(36).slice(2),
          headName,
          totalAmount: row['totalamount'] || row['total'] || '',
          amounts: makeAmountMap(
            matchedProgram?.durationSemesters || Math.max(...draft.uploadedSemesterNumbers, 1),
            Object.fromEntries(semesterNumbers.map(sem => [sem, row[`sem${sem}`] || ''])),
          ),
        });
      }

      const drafts = Array.from(groupedDrafts.values());
      if (drafts.length === 0) throw new Error('No valid data rows were found in the uploaded file');

      setBulkDraftFileName(file.name);
      setBulkDraftErrors([...new Set(parseErrors)]);
      setBulkDrafts(drafts);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadResult({ created: 0, skipped: 0, errors: [msg], groups: [] });
    }
  };

  const semCols = Array.from({ length: totalSemesters }, (_, i) => i + 1);
  const bulkDraftReviews = bulkDrafts.map(draft => ({ draft, review: getBulkDraftReview(draft) }));
  const validBulkDraftCount = bulkDraftReviews.filter(({ review }) => review.issues.length === 0).length;

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <h3 className="text-lg font-semibold text-gray-900">Academic Fee Structures</h3>
          <select value={filterProgramId} onChange={e => setFilterProgramId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-auto">
            <option value="">All Programmes</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.programCode} — {p.programName}</option>
            ))}
          </select>
        </div>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 sm:w-auto">
            <Plus className="w-4 h-4" /> Add Academic Fee
          </button>
        )}
      </div>

      {/* ── Bulk Upload toolbar ── */}
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bulk Upload</span>

        <button
          onClick={handleDownloadTemplate}
          disabled={programs.length === 0 || templateDownloading}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
        >
          <Download className="w-3.5 h-3.5" /> {templateDownloading ? 'Preparing template...' : 'Download Excel Template'}
        </button>

        <label className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors sm:w-auto ${
          uploading
            ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'border-primary-300 bg-primary-50 hover:bg-primary-100 text-primary-700'
        }`}>
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Importing...' : 'Review XLSX / CSV'}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            disabled={uploading}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) { handleCSVUpload(f); e.target.value = ''; }
            }}
          />
        </label>

        <span className="text-xs text-gray-400 hidden sm:block">
          The template groups fee heads per programme. Enter <span className="font-medium text-gray-500">programCode / batchYear</span> once on the first row — leave them blank in additional head rows or specialization rows and the system carries those values forward.
        </span>

        {uploadResult && (
          <button
            onClick={() => setUploadResult(null)}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium sm:ml-auto sm:w-auto ${
              uploadResult.errors.length > 0
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}
          >
            {uploadResult.errors.length > 0
              ? <AlertCircle className="w-4 h-4" />
              : <CheckCircle className="w-4 h-4" />}
            {uploadResult.created} created · {uploadResult.skipped} skipped
            {uploadResult.errors.length > 0 && ` · ${uploadResult.errors.length} error(s)`}
            <X className="w-3.5 h-3.5 ml-1 opacity-50" />
          </button>
        )}
      </div>

      {uploadResult && uploadResult.errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
          <p className="font-semibold text-red-700 mb-1">Upload errors:</p>
          <ul className="list-disc list-inside space-y-0.5 text-red-600">
            {uploadResult.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {uploadResult && uploadResult.groups.length > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <p className="mb-3 font-semibold text-gray-900">Import result details</p>
          <div className="space-y-2">
            {uploadResult.groups.map(group => (
              <div
                key={group.key}
                className={`rounded-lg border px-3 py-2 ${
                  group.status === 'created'
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : group.status === 'skipped'
                      ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">
                    {group.programCode} · {group.batchYear} · {group.specializationCode || 'Base programme'}
                  </span>
                  <span className="text-xs uppercase tracking-wider">{group.status}</span>
                </div>
                <p className="mt-1 text-xs sm:text-sm">{group.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {bulkDrafts.length > 0 && (
        <div className="mb-6 rounded-xl border border-primary-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-base font-semibold text-gray-900">Review Bulk Import</h4>
              <p className="mt-1 text-sm text-gray-500">
                {bulkDraftFileName || 'CSV draft'} · {bulkDrafts.length} grouped structure{bulkDrafts.length !== 1 ? 's' : ''} detected · {validBulkDraftCount} ready to import
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={clearBulkDrafts}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear Draft
              </button>
              <button
                onClick={handleBulkImport}
                disabled={uploading || validBulkDraftCount === 0}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? 'Importing...' : `Import ${validBulkDraftCount} Valid Structure${validBulkDraftCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          {bulkDraftErrors.length > 0 && (
            <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              <p className="mb-1 font-semibold">Items to review before import</p>
              <ul className="list-disc list-inside space-y-0.5">
                {bulkDraftErrors.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-5 space-y-5">
            {bulkDraftReviews.map(({ draft, review }) => (
              <div key={draft.tempId} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Programme</label>
                    <select
                      value={draft.programId}
                      onChange={e => handleBulkDraftProgramChange(draft.tempId, e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select programme...</option>
                      {programs.map(program => (
                        <option key={program.id} value={program.id}>
                          {program.programCode} — {program.programName}
                        </option>
                      ))}
                    </select>
                    {draft.rawProgramCode && !draft.programId && (
                      <p className="mt-1 text-xs text-red-600">Imported code: {draft.rawProgramCode}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Batch Year</label>
                    <input
                      type="number"
                      value={draft.batchYear}
                      onChange={e => handleBulkDraftBatchYearChange(draft.tempId, Number(e.target.value) || new Date().getFullYear())}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min={2020}
                      max={2050}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Specialization</label>
                    <select
                      value={draft.specializationId}
                      onChange={e => handleBulkDraftSpecializationChange(draft.tempId, e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Base programme fee</option>
                      {review.specializationOptions.map(spec => (
                        <option key={spec.id} value={spec.id}>
                          {spec.specializationCode} — {spec.specializationName}
                        </option>
                      ))}
                    </select>
                    {draft.rawSpecializationCode && !draft.specializationId && (
                      <p className="mt-1 text-xs text-red-600">Imported code: {draft.rawSpecializationCode}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-600">
                    {review.program?.programCode || draft.rawProgramCode || 'Unmatched programme'}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-600">
                    {review.specialization?.specializationCode || (draft.specializationId ? 'Selected specialization' : 'Base programme')}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-600">
                    {review.semCount} semester{review.semCount !== 1 ? 's' : ''}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-600">
                    {review.validHeadCount} valid head{review.validHeadCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {review.issues.length > 0 && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <p className="mb-1 font-semibold">Resolve before import</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {review.issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}
                    </ul>
                  </div>
                )}

                <div className="mt-4">
                  <SemGrid
                    heads={draft.heads}
                    semCols={Array.from({ length: review.semCount }, (_, index) => index + 1)}
                    onNameChange={(headIndex, value) => handleBulkDraftNameChange(draft.tempId, headIndex, value)}
                    onTotalChange={(headIndex, value) => handleBulkDraftTotalChange(draft.tempId, headIndex, value)}
                    onAmtChange={(headIndex, sem, value) => handleBulkDraftAmountChange(draft.tempId, headIndex, sem, value)}
                    onRemove={(headIndex) => handleBulkDraftRemoveHead(draft.tempId, headIndex)}
                    onAdd={() => handleBulkDraftAddHead(draft.tempId)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <h4 className="font-semibold text-gray-900 text-base">
              {editingId ? 'Edit' : 'New'} Academic Fee Structure
            </h4>
            <button onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          {formSaveError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 w-4 h-4 shrink-0" />
              <span>{formSaveError}</span>
            </div>
          )}

          {!editingId && (
            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Programme</label>
                <select value={formProgramId} onChange={e => { handleFormProgramChange(e.target.value); setFormSaveError(null); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select programme...</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.programCode} — {p.programName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Year</label>
                <input type="number" value={formBatchYear} onChange={e => { setFormBatchYear(Number(e.target.value)); setFormSaveError(null); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min={2020} max={2050} />
              </div>
            </div>
          )}

          {formProgramId && totalSemesters === 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-sm mb-4">
              This programme has no semesters defined. Please update the programme&apos;s duration first.
            </div>
          )}

          {totalSemesters > 0 && (
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h5 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Base Fee Heads</h5>
                  {!editingId && list.filter(fs => !fs.specializationId).length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={cloneSourceId}
                        onChange={e => setCloneSourceId(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Copy heads from…</option>
                        {list
                          .filter(fs => !fs.specializationId)
                          .map(fs => (
                            <option key={fs.id} value={fs.id}>
                              {fs.program?.programCode || '—'} · {fs.batchYear}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!cloneSourceId}
                        onClick={handleCopyHeadNames}
                        className="flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Copy className="w-3 h-3" /> Copy head names
                      </button>
                    </div>
                  )}
                </div>
                <SemGrid
                  heads={baseHeads}
                  semCols={semCols}
                  onNameChange={updBaseName}
                  onTotalChange={updBaseTotal}
                  onAmtChange={updBaseAmt}
                  onRemove={remBaseRow}
                  onAdd={addBaseRow}
                  onFillAll={fillAllSems}
                />
              </div>

              {!editingId && specializations.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-600 mb-1 uppercase tracking-wider">
                    Specialization Add-on Fees
                  </h5>
                  <p className="text-xs text-gray-400 mb-3">
                    Enable a specialization to enter additional per-semester charges on top of the base fees above.
                  </p>
                  <div className="space-y-3">
                    {specializations.map(spec => {
                      const chargeRule = getSpecializationChargeRule(spec);
                      return (
                      <div key={spec.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        <label className="flex cursor-pointer select-none flex-col gap-2 bg-gray-50 px-4 py-3 transition-colors hover:bg-gray-100 sm:flex-row sm:items-center sm:gap-3">
                          <input type="checkbox" checked={specEnabled[spec.id] || false}
                            onChange={e => setSpecEnabled(se => ({ ...se, [spec.id]: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800">{spec.specializationCode}</span>
                            <span className="text-sm text-gray-500">— {spec.specializationName}</span>
                          </div>
                          <span className="text-xs text-gray-400 sm:ml-auto">
                            {chargeRule ? `Required from sem ${chargeRule.startSemester}` : specEnabled[spec.id] ? 'Enter add-on amounts below' : 'Click to add extra fees'}
                          </span>
                        </label>
                        {specEnabled[spec.id] && (
                          <div className="p-4 bg-blue-50/30 border-t border-gray-200">
                            <SpecAddOnGrid
                              semCols={semCols}
                              totalAmount={specTotals[spec.id] || ''}
                              amounts={specAmounts[spec.id] || {}}
                              onTotalChange={value => updSpecTotal(spec.id, value)}
                              onChange={(sem, v) => updSpecAmt(spec.id, sem, v)}
                            />
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-1">
                <button onClick={handleSave} disabled={saving || !formProgramId || totalSemesters === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50 sm:w-auto">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Fee Structure'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-gray-500 text-center py-10">No academic fee structures configured yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-[860px] w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3 font-medium">Programme</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Batch Year</th>
                <th className="px-4 py-3 font-medium">Heads</th>
                <th className="px-4 py-3 font-medium text-right">Grand Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map(fs => {
                const total = fs.heads.reduce((s, h) => s + Number(h.amount), 0);
                return (
                  <tr key={fs.id} className={`hover:bg-gray-50 transition-colors ${fs.specializationId ? 'bg-blue-50/20' : ''}`}>
                    <td className="px-4 py-3 font-medium">
                      {fs.specializationId ? (
                        <span className="ml-5 text-blue-700 flex items-center gap-1">
                          <span className="text-gray-300 mr-0.5">↳</span>
                          {fs.specialization?.specializationCode || '—'}
                        </span>
                      ) : (
                        fs.program?.programCode || '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fs.specializationId ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {fs.specializationId ? 'Add-on' : 'Base'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{fs.batchYear}</td>
                    <td className="px-4 py-3 text-gray-500">{fs.heads.length} head{fs.heads.length !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{total.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${fs.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {fs.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!fs.specializationId && (
                          <button
                            onClick={() => startClone(fs)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Clone to new fee structure"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => startEdit(fs)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(fs.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
