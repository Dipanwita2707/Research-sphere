'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  Bus, Building2, GraduationCap, FileText, TrendingUp, Calendar,
  Printer, Share2, ChevronDown, ChevronUp, X, User, BookOpen, Search, Mail, History,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  financeAnalyticsService, FinanceAnalyticsData, FinanceAnalyticsSection, ProgramBreakdownItem,
  ProgramLetterGroup, StaffLetterGroup, LoanLetterSummary, LoanLetterRegistryItem, LoanLetterDetailPage,
} from '../services/financeAnalytics.service';
import LoanLetterPrintView from '../../loan-letter/components/LoanLetterPrintView';
import LoanLetterTemplateAuditLog from '../../loan-letter/components/LoanLetterTemplateAuditLog';
import { loanLetterService, LoanLetter } from '../../loan-letter/services/loanLetter.service';
import { departmentService, Department } from '@/features/admin-management/services/department.service';
import { programService, Program } from '@/features/admin-management/services/program.service';

const PIE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type Tab = 'overview' | 'loan-letters' | 'all-loan-letters' | 'fee-structures' | 'template-audit';

const EMPTY_ANALYTICS_DATA: FinanceAnalyticsData = {
  feeStructures: {
    TRANSPORT: 0,
    HOSTEL: 0,
    ACADEMIC: 0,
  },
  loanLetters: {
    total: 0,
    thisMonth: 0,
    thisYear: 0,
  },
  programBreakdown: [],
  loanLettersByProgram: [],
  loanLettersBySchool: [],
  loanLettersByStaff: [],
  loanLetterMonthlyTrend: [],
};

const OVERVIEW_ANALYTICS_SECTIONS: FinanceAnalyticsSection[] = [
  'summary',
  'loanLetterMonthlyTrend',
  'loanLettersBySchool',
  'loanLettersByProgram',
  'loanLettersByStaff',
];

function LetterDetailPanel({
  title,
  subtitle,
  letters,
  total,
  page,
  totalPages,
  loading,
  onClose,
  onLetterClick,
  onPageChange,
}: {
  title: string;
  subtitle?: string;
  letters: LoanLetterSummary[];
  total?: number;
  page?: number;
  totalPages?: number;
  loading?: boolean;
  onClose: () => void;
  onLetterClick?: (id: string) => void;
  onPageChange?: (page: number) => void;
}) {
  const currentPage = page || 1;
  const pageCount = totalPages || 1;
  const totalLetters = total ?? letters.length;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 bg-indigo-50/60">
        <div>
          <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide mb-0.5">Details</p>
          <h3 className="text-sm font-bold text-gray-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Summary bar */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-xs text-gray-600">
        <span className="font-semibold text-indigo-700 text-sm">{totalLetters}</span> letter{totalLetters !== 1 ? 's' : ''} issued
      </div>

      {/* Letters list */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : letters.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-10">No letters</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {letters.map((l, idx) => (
              <div key={l.id} className="px-5 py-3.5 hover:bg-gray-50/80 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono w-5 text-right flex-shrink-0">{idx + 1}.</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{l.studentName}</p>
                      {(l.relationPrefix || l.relationName) && (
                        <p className="text-xs text-gray-500">{l.relationPrefix} {l.relationName}</p>
                      )}
                    </div>
                  </div>
                  {onLetterClick ? (
                    <button
                      type="button"
                      onClick={() => onLetterClick(l.id)}
                      className="text-xs font-mono text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded flex-shrink-0 transition-colors"
                    >
                      {l.uniqueNumber}
                    </button>
                  ) : (
                    <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded flex-shrink-0">
                      {l.uniqueNumber}
                    </span>
                  )}
                </div>

                <div className="ml-7 space-y-1">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> App:{' '}
                      <span className="font-medium text-gray-700 font-mono">{l.applicationNumber}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(l.issuedAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>

                  {/* Programme (shown in staff panel) */}
                  {l.programName && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <BookOpen className="w-3 h-3" />
                      <span className="font-medium text-gray-700">{l.programName}</span>
                      {l.programCode && <span className="font-mono text-gray-400">({l.programCode})</span>}
                    </div>
                  )}

                  {/* Specialization */}
                  {l.specialization && (
                    <span className="inline-block text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                      {l.specialization.specializationName}
                    </span>
                  )}

                  {/* Semesters */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {l.selectedSemesters.map(s => (
                      <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        Sem {s}
                      </span>
                    ))}
                    {l.transportIncluded && (
                      <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Transport</span>
                    )}
                    {l.hostelIncluded && (
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Hostel</span>
                    )}
                  </div>

                  {/* Printed by (in programme panel) */}
                  {l.printedBy && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <User className="w-3 h-3" />
                      {l.printedBy.name} <span className="font-mono">({l.printedBy.uid})</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {onPageChange && pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-600">
          <span>Page {currentPage} of {pageCount}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || loading}
              className="rounded border border-gray-300 px-2 py-1 text-gray-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage >= pageCount || loading}
              className="rounded border border-gray-300 px-2 py-1 text-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FinanceAnalytics() {
  const [data, setData] = useState<FinanceAnalyticsData>(EMPTY_ANALYTICS_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loadingSections, setLoadingSections] = useState<Record<string, boolean>>({});
  const [expandedProg, setExpandedProg] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<ProgramLetterGroup | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffLetterGroup | null>(null);
  const [programLetterDetails, setProgramLetterDetails] = useState<LoanLetterDetailPage | null>(null);
  const [staffLetterDetails, setStaffLetterDetails] = useState<LoanLetterDetailPage | null>(null);
  const [programDetailLoading, setProgramDetailLoading] = useState(false);
  const [staffDetailLoading, setStaffDetailLoading] = useState(false);
  const [viewLetter, setViewLetter] = useState<LoanLetter | null>(null);
  const [viewLetterLoading, setViewLetterLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [registryItems, setRegistryItems] = useState<LoanLetterRegistryItem[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryPage, setRegistryPage] = useState(1);
  const [registryTotal, setRegistryTotal] = useState(0);
  const [registryTotalPages, setRegistryTotalPages] = useState(1);
  const [expandedRegistryId, setExpandedRegistryId] = useState<string | null>(null);
  const [registrySearchInput, setRegistrySearchInput] = useState('');
  const [registrySearch, setRegistrySearch] = useState('');
  const [registryDepartmentId, setRegistryDepartmentId] = useState('');
  const [registryProgramId, setRegistryProgramId] = useState('');
  const printRef = useRef<HTMLDivElement>(null);
  const loadedSectionsRef = useRef<Set<FinanceAnalyticsSection>>(new Set());
  const filterOptionsLoadedRef = useRef(false);

  const filteredPrograms = registryDepartmentId
    ? programs.filter(program => program.departmentId === registryDepartmentId)
    : programs;

  const mergeAnalyticsData = useCallback((incoming: Partial<FinanceAnalyticsData>) => {
    setData(current => ({
      feeStructures: incoming.feeStructures ?? current.feeStructures,
      loanLetters: incoming.loanLetters ?? current.loanLetters,
      programBreakdown: incoming.programBreakdown ?? current.programBreakdown,
      loanLettersByProgram: incoming.loanLettersByProgram ?? current.loanLettersByProgram,
      loanLettersBySchool: incoming.loanLettersBySchool ?? current.loanLettersBySchool,
      loanLettersByStaff: incoming.loanLettersByStaff ?? current.loanLettersByStaff,
      loanLetterMonthlyTrend: incoming.loanLetterMonthlyTrend ?? current.loanLetterMonthlyTrend,
    }));
  }, []);

  const loadAnalyticsSections = useCallback(async (
    sections: FinanceAnalyticsSection[],
    options?: { initial?: boolean }
  ) => {
    const pendingSections = sections.filter(section => !loadedSectionsRef.current.has(section));
    if (pendingSections.length === 0) {
      if (options?.initial) setLoading(false);
      return;
    }

    setLoadingSections(current => ({
      ...current,
      ...Object.fromEntries(pendingSections.map(section => [section, true])),
    }));

    if (options?.initial) {
      setLoading(true);
      setError(null);
    }

    try {
      const res = await financeAnalyticsService.getAnalytics(pendingSections);
      mergeAnalyticsData(res.data);
      pendingSections.forEach(section => loadedSectionsRef.current.add(section));
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to load analytics';
      if (options?.initial) {
        setError(message);
      } else {
        console.error(message, err);
      }
    } finally {
      setLoadingSections(current => ({
        ...current,
        ...Object.fromEntries(pendingSections.map(section => [section, false])),
      }));
      if (options?.initial) setLoading(false);
    }
  }, [mergeAnalyticsData]);

  const loadFilterOptions = useCallback(async () => {
    if (filterOptionsLoadedRef.current) return;

    try {
      const [departmentResponse, programResponse] = await Promise.all([
        departmentService.getAllDepartments({ isActive: true }),
        programService.getAllPrograms({ isActive: true }),
      ]);
      setDepartments(departmentResponse.data || []);
      setPrograms(programResponse.data || []);
      filterOptionsLoadedRef.current = true;
    } catch (err) {
      console.error('Failed to load finance registry filters', err);
    }
  }, []);

  const loadRegistry = useCallback(async (pageToLoad = registryPage) => {
    setRegistryLoading(true);
    try {
      const res = await financeAnalyticsService.getLoanLetterRegistry({
        page: pageToLoad,
        limit: 12,
        search: registrySearch || undefined,
        departmentId: registryDepartmentId || undefined,
        programId: registryProgramId || undefined,
      });
      setRegistryItems(res.data || []);
      setRegistryTotal(res.total || 0);
      setRegistryTotalPages(res.totalPages || 1);
    } catch {}
    finally {
      setRegistryLoading(false);
    }
  }, [registryDepartmentId, registryPage, registryProgramId, registrySearch]);

  const loadProgramLetterDetails = useCallback(async (program: ProgramLetterGroup, pageToLoad = 1) => {
    setProgramDetailLoading(true);
    try {
      const res = await financeAnalyticsService.getProgramLoanLetters(program.programId, {
        page: pageToLoad,
        limit: 25,
      });
      setProgramLetterDetails(res);
    } catch (err) {
      console.error('Failed to load programme loan-letter details', err);
      setProgramLetterDetails({
        success: false,
        data: [],
        total: program.count,
        page: pageToLoad,
        limit: 25,
        totalPages: 1,
      });
    } finally {
      setProgramDetailLoading(false);
    }
  }, []);

  const loadStaffLetterDetails = useCallback(async (staff: StaffLetterGroup, pageToLoad = 1) => {
    setStaffDetailLoading(true);
    try {
      const res = await financeAnalyticsService.getStaffLoanLetters(staff.staffId, {
        page: pageToLoad,
        limit: 25,
      });
      setStaffLetterDetails(res);
    } catch (err) {
      console.error('Failed to load staff loan-letter details', err);
      setStaffLetterDetails({
        success: false,
        data: [],
        total: staff.count,
        page: pageToLoad,
        limit: 25,
        totalPages: 1,
      });
    } finally {
      setStaffDetailLoading(false);
    }
  }, []);

  const handleProgramSelect = useCallback((program: ProgramLetterGroup) => {
    const isSelected = selectedProgram?.programId === program.programId;
    if (isSelected) {
      setSelectedProgram(null);
      setProgramLetterDetails(null);
      return;
    }

    setSelectedProgram(program);
    setProgramLetterDetails(null);
    void loadProgramLetterDetails(program, 1);
  }, [loadProgramLetterDetails, selectedProgram]);

  const handleStaffSelect = useCallback((staff: StaffLetterGroup) => {
    const isSelected = selectedStaff?.staffId === staff.staffId;
    if (isSelected) {
      setSelectedStaff(null);
      setStaffLetterDetails(null);
      return;
    }

    setSelectedStaff(staff);
    setStaffLetterDetails(null);
    void loadStaffLetterDetails(staff, 1);
  }, [loadStaffLetterDetails, selectedStaff]);

  const handleLetterClick = async (id: string) => {
    setViewLetterLoading(true);
    try {
      const res = await loanLetterService.getById(id);
      setViewLetter(res.data);
    } catch {}
    finally { setViewLetterLoading(false); }
  };

  useEffect(() => {
    void loadAnalyticsSections(OVERVIEW_ANALYTICS_SECTIONS, { initial: true });
  }, [loadAnalyticsSections]);

  useEffect(() => {
    if (activeTab === 'fee-structures') {
      void loadAnalyticsSections(['programBreakdown']);
    }

    if (activeTab === 'all-loan-letters') {
      void loadFilterOptions();
    }
  }, [activeTab, loadAnalyticsSections, loadFilterOptions]);

  useEffect(() => {
    if (activeTab !== 'all-loan-letters') return;
    void loadRegistry(registryPage);
  }, [activeTab, loadRegistry, registryPage, registrySearch, registryDepartmentId, registryProgramId]);

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: 'SGT Finance Analytics', url });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard');
    }
  };

  const handleRegistrySearch = () => {
    setRegistryPage(1);
    setExpandedRegistryId(null);
    setRegistrySearch(registrySearchInput.trim());
  };

  const resetRegistryFilters = () => {
    setRegistryPage(1);
    setExpandedRegistryId(null);
    setRegistrySearchInput('');
    setRegistrySearch('');
    setRegistryDepartmentId('');
    setRegistryProgramId('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>;
  }

  const analyticsLoading = loading || OVERVIEW_ANALYTICS_SECTIONS.some(section => loadingSections[section]);
  const feeStructureLoading = Boolean(loadingSections.programBreakdown) && data.programBreakdown.length === 0;

  const feeCards = [
    { label: 'Transport Structures', count: data.feeStructures.TRANSPORT, icon: Bus, color: 'bg-orange-100 text-orange-600' },
    { label: 'Hostel Structures', count: data.feeStructures.HOSTEL, icon: Building2, color: 'bg-blue-100 text-blue-600' },
    { label: 'Academic Structures', count: data.feeStructures.ACADEMIC, icon: GraduationCap, color: 'bg-green-100 text-green-600' },
  ];

  const letterCards = [
    { label: 'Total Letters', count: data.loanLetters.total, icon: FileText, color: 'bg-purple-100 text-purple-600' },
    { label: 'This Month', count: data.loanLetters.thisMonth, icon: Calendar, color: 'bg-pink-100 text-pink-600' },
    { label: 'This Year', count: data.loanLetters.thisYear, icon: TrendingUp, color: 'bg-indigo-100 text-indigo-600' },
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'loan-letters', label: 'Loan Letters' },
    { id: 'all-loan-letters', label: 'All Loan Letters' },
    { id: 'fee-structures', label: 'Fee Structures' },
    { id: 'template-audit', label: 'Template Audit' },
  ];

  const renderFeeStructureTable = (
    structure: ProgramBreakdownItem['specializations'][number],
    options?: {
      title?: string;
      subtitle?: string;
      totalLabel?: string;
      totalValue?: number;
      accentClassName?: string;
    }
  ) => {
    const semNums = structure.semesters && structure.semesters.length > 0
      ? structure.semesters
      : Array.from(new Set(structure.heads.flatMap(h => h.semesterAmounts ? Object.keys(h.semesterAmounts).map(Number) : []))).sort((a, b) => a - b);
    const hasSemData = semNums.length > 0;

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm text-gray-900">{options?.title || structure.name || 'Programme Fee Structure'}</span>
              {structure.code && <span className="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{structure.code}</span>}
              {structure.batchYear && <span className="text-xs text-gray-400">Batch {structure.batchYear}</span>}
            </div>
            {options?.subtitle && <p className="text-xs text-gray-500 mt-2">{options.subtitle}</p>}
          </div>
          <div className="text-left lg:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{options?.totalLabel || 'Total Fee'}</p>
            <p className={`text-xl font-bold ${options?.accentClassName || 'text-indigo-700'}`}>&#8377;{(options?.totalValue ?? structure.amount).toLocaleString('en-IN')}</p>
          </div>
        </div>
        {hasSemData ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-indigo-50 text-left text-gray-600">
                  <th className="px-4 py-2 font-semibold min-w-[140px]">Fee Head</th>
                  {semNums.map(s => (
                    <th key={s} className="px-3 py-2 font-semibold text-center min-w-[80px]">Sem {s}</th>
                  ))}
                  <th className="px-3 py-2 font-semibold text-right min-w-[90px]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {structure.heads.map(h => (
                  <tr key={h.headName} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{h.headName}</td>
                    {semNums.map(s => {
                      const val = h.semesterAmounts ? Number(h.semesterAmounts[String(s)] ?? 0) : 0;
                      return (
                        <td key={s} className="px-3 py-2 text-center text-gray-600">
                          {val > 0 ? `\u20B9${val.toLocaleString('en-IN')}` : <span className="text-gray-300">&mdash;</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-semibold text-gray-800">&#8377;{h.amount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                <tr className="bg-indigo-50 font-bold">
                  <td className="px-4 py-2 text-gray-700">Total</td>
                  {semNums.map(s => {
                    const total = structure.heads.reduce((sum, h) => {
                      return sum + (h.semesterAmounts ? Number(h.semesterAmounts[String(s)] ?? 0) : 0);
                    }, 0);
                    return (
                      <td key={s} className="px-3 py-2 text-center text-indigo-700">
                        {total > 0 ? `\u20B9${total.toLocaleString('en-IN')}` : <span className="text-gray-300">&mdash;</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right text-indigo-700">&#8377;{structure.amount.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {structure.heads.map(h => (
              <span key={h.headName} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {h.headName}: &#8377;{h.amount.toLocaleString('en-IN')}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 1cm; }
          body * { visibility: hidden !important; }
          #finance-analytics-print, #finance-analytics-print * { visibility: visible !important; }
          #finance-analytics-print { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div id="finance-analytics-print" ref={printRef} className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Finance Analytics</h1>
            <p className="text-gray-500 mt-1 text-sm">
              SGT University &middot; {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="no-print flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {[...feeCards, ...letterCards].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.count}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="no-print mb-6 overflow-x-auto">
          <div className="flex min-w-max gap-1 rounded-xl bg-gray-100 p-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id);
                  setSelectedProgram(null);
                  setSelectedStaff(null);
                  setProgramLetterDetails(null);
                  setStaffLetterDetails(null);
                  if (t.id === 'fee-structures') {
                    void loadAnalyticsSections(['programBreakdown']);
                  }
                  if (t.id === 'all-loan-letters') {
                    void loadFilterOptions();
                  }
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === t.id
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          analyticsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
          <div className="space-y-6">
            {/* Monthly Trend Bar Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Loan Letter Trend &mdash; {new Date().getFullYear()}</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.loanLetterMonthlyTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="Letters Issued" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By School Pie */}
              {data.loanLettersBySchool.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-4">Loan Letters by School</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.loanLettersBySchool}
                        dataKey="count"
                        nameKey="schoolName"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={false}
                      >
                        {data.loanLettersBySchool.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, _n, p) => [v, p.payload.schoolName]} contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* By Programme Bar */}
              {data.loanLettersByProgram.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-4">Loan Letters by Programme</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={data.loanLettersByProgram.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis dataKey="programCode" type="category" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="count" name="Letters" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Issued By Staff */}
            {data.loanLettersByStaff.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">Letters Issued by Staff</h2>
                </div>
                <table className="min-w-[960px] w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600 text-xs">
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Staff Name</th>
                      <th className="px-4 py-3 font-medium">UID</th>
                      <th className="px-4 py-3 font-medium text-right">Letters Issued</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.loanLettersByStaff.map((s, i) => (
                      <tr key={s.uid} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium">{s.name}</td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{s.uid}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                            {s.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )
        )}

        {/* LOAN LETTERS TAB */}
        {activeTab === 'loan-letters' && (
          analyticsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Trend */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Monthly Trend</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.loanLetterMonthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" name="Letters" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* By School Pie */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Distribution by School</h2>
                {data.loanLettersBySchool.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={data.loanLettersBySchool} dataKey="count" nameKey="schoolName" cx="50%" cy="50%" innerRadius={50} outerRadius={90}>
                        {data.loanLettersBySchool.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, _n, p) => [v, p.payload.schoolName]} contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-400 text-sm text-center py-16">No data</p>}
              </div>
            </div>

            {/* Programme breakdown — master/detail layout */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Programme-wise Loan Letter Count</h2>
                {selectedProgram && (
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                    Showing: {selectedProgram.programCode}
                  </span>
                )}
              </div>
              {data.loanLettersByProgram.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">No loan letters issued yet</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:divide-x divide-gray-100 lg:min-h-[540px]">
                  <div className="p-4 bg-slate-50/50 lg:h-[540px] overflow-hidden">
                    <div className="mb-3 grid grid-cols-[minmax(0,1.5fr)_88px_64px] gap-3 px-3 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      <span>Programme</span>
                      <span>Code</span>
                      <span className="text-right">Letters</span>
                    </div>
                    <div className="space-y-3 h-[470px] overflow-y-auto pr-1">
                      {data.loanLettersByProgram.map(r => {
                        const pct = data.loanLetters.total > 0 ? (r.count / data.loanLetters.total) * 100 : 0;
                        const isSelected = selectedProgram?.programId === r.programId;
                        return (
                          <button
                            key={r.programId}
                            type="button"
                            onClick={() => handleProgramSelect(r)}
                            className={`w-full rounded-2xl border text-left transition-all ${
                              isSelected
                                ? 'border-indigo-300 bg-indigo-50 shadow-sm ring-1 ring-indigo-100'
                                : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
                            }`}
                          >
                            <div className="grid grid-cols-[minmax(0,1.5fr)_88px_64px] gap-3 px-4 py-4 items-start">
                              <div>
                                <p className="text-sm font-semibold text-gray-900 leading-5">{r.programName}</p>
                                <p className="mt-1 text-xs text-gray-500">{r.count} loan letter{r.count !== 1 ? 's' : ''}</p>
                              </div>
                              <div className="pt-0.5 text-xs font-mono text-gray-500 break-all">{r.programCode}</div>
                              <div className="pt-0.5 text-right">
                                <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                  {r.count}
                                </span>
                              </div>
                            </div>
                            <div className="px-4 pb-4">
                              <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 rounded-full bg-gray-200 overflow-hidden">
                                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-12 text-right text-xs font-medium text-gray-500">{pct.toFixed(1)}%</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white lg:h-[540px] overflow-hidden">
                    {selectedProgram ? (
                      <div className="h-full overflow-hidden flex flex-col">
                        <LetterDetailPanel
                          title={selectedProgram.programName}
                          subtitle={`Code: ${selectedProgram.programCode}`}
                          letters={programLetterDetails?.data || []}
                          total={programLetterDetails?.total ?? selectedProgram.count}
                          page={programLetterDetails?.page || 1}
                          totalPages={programLetterDetails?.totalPages || 1}
                          loading={programDetailLoading}
                          onClose={() => {
                            setSelectedProgram(null);
                            setProgramLetterDetails(null);
                          }}
                          onLetterClick={handleLetterClick}
                          onPageChange={(page) => loadProgramLetterDetails(selectedProgram, page)}
                        />
                      </div>
                    ) : (
                      <div className="h-full min-h-[540px] flex items-center justify-center p-8 bg-gradient-to-br from-white via-slate-50 to-indigo-50/40">
                        <div className="max-w-sm text-center">
                          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                            <FileText className="h-6 w-6" />
                          </div>
                          <h3 className="text-base font-semibold text-gray-900">Select a programme</h3>
                          <p className="mt-2 text-sm leading-6 text-gray-500">
                            Choose a programme from the left to view all issued loan letters. Clicking the loan letter number opens the preview in the side drawer.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Staff issuance — master/detail layout */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Staff Issuance Details</h2>
                {selectedStaff && (
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                    Showing: {selectedStaff.uid}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)] lg:divide-x divide-gray-100 lg:min-h-[460px]">
                <div className="p-4 bg-slate-50/50 lg:h-[460px] overflow-hidden">
                  <div className="mb-3 grid grid-cols-[minmax(0,1.4fr)_100px_60px] gap-3 px-3 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    <span>Name</span>
                    <span>UID</span>
                    <span className="text-right">Count</span>
                  </div>
                  <div className="space-y-3 h-[390px] overflow-y-auto pr-1">
                    {data.loanLettersByStaff.map(s => {
                      const isSelected = selectedStaff?.uid === s.uid;
                      return (
                        <button
                          key={s.uid}
                          type="button"
                          onClick={() => handleStaffSelect(s)}
                          className={`w-full rounded-2xl border text-left transition-all ${
                            isSelected
                              ? 'border-indigo-300 bg-indigo-50 shadow-sm ring-1 ring-indigo-100'
                              : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
                          }`}
                        >
                          <div className="grid grid-cols-[minmax(0,1.4fr)_100px_60px] gap-3 items-start px-4 py-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 leading-5">{s.name}</p>
                              <p className="mt-1 text-xs text-gray-500">{s.count} issued letter{s.count !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="pt-0.5 text-xs font-mono text-gray-500 break-all">{s.uid}</div>
                            <div className="pt-0.5 text-right">
                              <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                {s.count}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white lg:h-[460px] overflow-hidden">
                  {selectedStaff ? (
                    <div className="h-full overflow-hidden flex flex-col">
                      <LetterDetailPanel
                        title={selectedStaff.name}
                        subtitle={`UID: ${selectedStaff.uid}`}
                        letters={staffLetterDetails?.data || []}
                        total={staffLetterDetails?.total ?? selectedStaff.count}
                        page={staffLetterDetails?.page || 1}
                        totalPages={staffLetterDetails?.totalPages || 1}
                        loading={staffDetailLoading}
                        onClose={() => {
                          setSelectedStaff(null);
                          setStaffLetterDetails(null);
                        }}
                        onLetterClick={handleLetterClick}
                        onPageChange={(page) => loadStaffLetterDetails(selectedStaff, page)}
                      />
                    </div>
                  ) : (
                    <div className="h-full min-h-[460px] flex items-center justify-center p-8 bg-gradient-to-br from-white via-slate-50 to-indigo-50/30">
                      <div className="max-w-sm text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                          <User className="h-6 w-6" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">Select a staff member</h3>
                        <p className="mt-2 text-sm leading-6 text-gray-500">
                          Choose a staff member from the left to see the loan letters they issued and open any loan letter directly in the preview drawer.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
          )
        )}

        {activeTab === 'all-loan-letters' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">All Loan Letters</h2>
                <p className="text-sm text-gray-500 mt-1">Filter by department, programme, or search by application number, student name, email, or loan letter number.</p>
              </div>

              <div className="border-b border-gray-100 bg-slate-50/60 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="relative md:col-span-2">
                    <input
                      type="text"
                      value={registrySearchInput}
                      onChange={e => setRegistrySearchInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRegistrySearch()}
                      placeholder="Search by LL no, application no, student, or email"
                      className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <select
                    value={registryDepartmentId}
                    onChange={e => {
                      setRegistryPage(1);
                      setRegistryDepartmentId(e.target.value);
                      setRegistryProgramId('');
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All departments</option>
                    {departments.map(department => (
                      <option key={department.id} value={department.id}>{department.departmentCode} - {department.departmentName}</option>
                    ))}
                  </select>
                  <select
                    value={registryProgramId}
                    onChange={e => {
                      setRegistryPage(1);
                      setRegistryProgramId(e.target.value);
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All programmes</option>
                    {filteredPrograms.map(program => (
                      <option key={program.id} value={program.id}>{program.programCode} - {program.programName}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button onClick={handleRegistrySearch} className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700">Apply Filters</button>
                  <button onClick={resetRegistryFilters} className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">Reset</button>
                </div>
              </div>

              {registryLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : registryItems.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">No loan letters matched the current filters.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-[1080px] w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-gray-600 text-xs border-b border-gray-200">
                          <th className="px-4 py-3 font-medium">Loan Letter</th>
                          <th className="px-4 py-3 font-medium">Application</th>
                          <th className="px-4 py-3 font-medium">Student</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium">Department</th>
                          <th className="px-4 py-3 font-medium">Programme</th>
                          <th className="px-4 py-3 font-medium text-center">Reprints</th>
                          <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {registryItems.map(letter => {
                          const isExpanded = expandedRegistryId === letter.id;
                          const printedByName = letter.printedBy?.employeeDetails?.displayName
                            || (letter.printedBy?.employeeDetails ? `${letter.printedBy.employeeDetails.firstName} ${letter.printedBy.employeeDetails.lastName || ''}`.trim() : letter.printedBy?.uid || 'N/A');

                          return (
                            <Fragment key={letter.id}>
                              <tr className="hover:bg-gray-50 align-top">
                                <td className="px-4 py-3 font-mono text-xs font-medium">
                                  <button onClick={() => handleLetterClick(letter.id)} className="text-primary-600 hover:underline">{letter.uniqueNumber}</button>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs">{letter.applicationNumber}</td>
                                <td className="px-4 py-3">{letter.studentName}</td>
                                <td className="px-4 py-3 text-xs text-gray-600">{letter.studentEmail || '—'}</td>
                                <td className="px-4 py-3 text-xs text-gray-600">{letter.program?.department?.departmentName || '—'}</td>
                                <td className="px-4 py-3 text-xs text-gray-600">{letter.programName} ({letter.programCode})</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center min-w-[2rem] rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{letter.reprintCount || 0}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => setExpandedRegistryId(isExpanded ? null : letter.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Details
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-gray-50/70">
                                  <td colSpan={8} className="px-4 py-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Record Details</h4>
                                        <div className="space-y-2 text-sm text-gray-600">
                                          <div><span className="font-medium text-gray-800">Application No.:</span> <span className="font-mono">{letter.applicationNumber}</span></div>
                                          <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" /><span>{letter.studentEmail || 'No email recorded'}</span></div>
                                          <div><span className="font-medium text-gray-800">Relation:</span> {letter.relationPrefix} {letter.relationName}</div>
                                          <div><span className="font-medium text-gray-800">Printed By:</span> {printedByName}{letter.printedBy?.uid ? ` (${letter.printedBy.uid})` : ''}</div>
                                          <div><span className="font-medium text-gray-800">Issued On:</span> {new Date(letter.issuedAt).toLocaleString('en-IN')}</div>
                                          <div><span className="font-medium text-gray-800">Semesters:</span> {letter.selectedSemesters.join(', ')}</div>
                                        </div>
                                      </div>

                                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Reprint History</h4>
                                        {letter.reprints && letter.reprints.length > 0 ? (
                                          <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                                            {letter.reprints.map(reprint => (
                                              <div key={reprint.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                                                <div className="font-medium text-gray-800">{reprint.printedBy.name} ({reprint.printedBy.uid})</div>
                                                <div className="text-xs text-gray-500 mt-1">{new Date(reprint.printedAt).toLocaleString('en-IN')}</div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-gray-400">No reprints recorded yet.</p>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {registryTotalPages > 1 && (
                    <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-gray-600">Showing {(registryPage - 1) * 12 + 1}-{Math.min(registryPage * 12, registryTotal)} of {registryTotal}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRegistryPage(page => Math.max(1, page - 1))}
                          disabled={registryPage === 1}
                          className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setRegistryPage(page => Math.min(registryTotalPages, page + 1))}
                          disabled={registryPage >= registryTotalPages}
                          className="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* FEE STRUCTURES TAB */}
        {activeTab === 'fee-structures' && (
          feeStructureLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Programme &amp; Specialization Fee Detail</h2>
                <p className="text-sm text-gray-500 mt-1">The base programme fee is shown first. Each specialization below shows the additional fee and the combined total with specialization.</p>
              </div>
              {data.programBreakdown.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">No fee structures found</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600 text-xs">
                      <th className="px-4 py-3 font-medium">Programme</th>
                      <th className="px-4 py-3 font-medium">School</th>
                      <th className="px-4 py-3 font-medium text-center">Structures</th>
                      <th className="px-4 py-3 font-medium text-right">Total Amount</th>
                      <th className="px-4 py-3 font-medium no-print"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.programBreakdown.map((prog: ProgramBreakdownItem) => (
                      (() => {
                        const baseStructure = prog.specializations.find(spec => !spec.id) || null;
                        const specializationStructures = prog.specializations.filter(spec => spec.id);
                        const displayTotal = baseStructure?.amount ?? prog.totalAmount;

                        return (
                      <Fragment key={prog.programId}>
                        <tr
                          className="hover:bg-gray-50 border-t border-gray-100 cursor-pointer"
                          onClick={() => setExpandedProg(expandedProg === prog.programId ? null : prog.programId)}
                        >
                          <td className="px-4 py-3 font-medium">
                            {prog.programName}
                            <span className="ml-2 text-xs text-gray-400 font-mono">{prog.programCode}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{prog.schoolName || '\u2014'}</td>
                          <td className="px-4 py-3 text-center">{prog.totalStructures}</td>
                          <td className="px-4 py-3 text-right font-semibold">&#8377;{displayTotal.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right no-print">
                            {prog.specializations.length > 0 && (
                              expandedProg === prog.programId
                                ? <ChevronUp className="w-4 h-4 text-gray-400 inline" />
                                : <ChevronDown className="w-4 h-4 text-gray-400 inline" />
                            )}
                          </td>
                        </tr>
                        {expandedProg === prog.programId && prog.specializations.length > 0 && (
                          <tr key={`${prog.programId}-spec`} className="bg-indigo-50/40">
                            <td colSpan={5} className="px-8 py-4">
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Fee Structure — Semester-wise Breakdown</p>
                              <div className="space-y-4">
                                {baseStructure ? renderFeeStructureTable(baseStructure, {
                                  title: prog.programName,
                                  subtitle: 'Without specialization',
                                  totalLabel: 'Base Fee',
                                  totalValue: baseStructure.amount,
                                }) : (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                    Base programme fee structure is not separately available for this programme.
                                  </div>
                                )}

                                {specializationStructures.length > 0 && (
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Specialization options</p>
                                      {baseStructure && <p className="text-xs text-gray-500">Without specialization: <span className="font-semibold text-gray-800">&#8377;{baseStructure.amount.toLocaleString('en-IN')}</span></p>}
                                    </div>
                                    {specializationStructures.map((spec, si) => (
                                      <div key={spec.id ?? si} className="space-y-3">
                                        {(() => {
                                          const semNums = Array.from(new Set([
                                            ...spec.semesters,
                                            ...(baseStructure?.semesters || []),
                                            ...spec.heads.flatMap(h => h.semesterAmounts ? Object.keys(h.semesterAmounts).map(Number) : []),
                                            ...(baseStructure?.heads.flatMap(h => h.semesterAmounts ? Object.keys(h.semesterAmounts).map(Number) : []) || []),
                                          ])).sort((a, b) => a - b);

                                          const specializationTotals = semNums.map(sem => spec.heads.reduce(
                                            (sum, head) => sum + (head.semesterAmounts ? Number(head.semesterAmounts[String(sem)] ?? 0) : 0),
                                            0
                                          ));

                                          const combinedTotals = baseStructure
                                            ? semNums.map(sem => {
                                                const baseTotal = baseStructure.heads.reduce(
                                                  (sum, head) => sum + (head.semesterAmounts ? Number(head.semesterAmounts[String(sem)] ?? 0) : 0),
                                                  0
                                                );
                                                const specializationTotal = spec.heads.reduce(
                                                  (sum, head) => sum + (head.semesterAmounts ? Number(head.semesterAmounts[String(sem)] ?? 0) : 0),
                                                  0
                                                );
                                                return baseTotal + specializationTotal;
                                              })
                                            : [];

                                          return (
                                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                              <div className="flex flex-col gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 lg:flex-row lg:items-start lg:justify-between">
                                                <div>
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-sm text-gray-900">{spec.name || 'Specialization'}</span>
                                                    {spec.code && <span className="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{spec.code}</span>}
                                                    {spec.batchYear && <span className="text-xs text-gray-400">Batch {spec.batchYear}</span>}
                                                  </div>
                                                  <p className="text-xs text-gray-500 mt-2">
                                                    Additional specialization fee
                                                    {baseStructure ? ` . With specialization: \u20B9${(baseStructure.amount + spec.amount).toLocaleString('en-IN')}` : ''}
                                                  </p>
                                                </div>
                                                <div className="text-left lg:text-right">
                                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Specialization Fee</p>
                                                  <p className="text-xl font-bold text-purple-700">&#8377;{spec.amount.toLocaleString('en-IN')}</p>
                                                </div>
                                              </div>

                                              <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="bg-indigo-50 text-left text-gray-600">
                                                      <th className="px-4 py-2 font-semibold min-w-[170px]">Fee Head</th>
                                                      {semNums.map(sem => (
                                                        <th key={sem} className="px-3 py-2 text-center font-semibold min-w-[80px]">Sem {sem}</th>
                                                      ))}
                                                      <th className="px-3 py-2 text-right font-semibold min-w-[90px]">Total</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-gray-100">
                                                    {spec.heads.map(head => (
                                                      <tr key={head.headName} className="hover:bg-gray-50">
                                                        <td className="px-4 py-2 font-medium text-gray-800">{head.headName}</td>
                                                        {semNums.map(sem => {
                                                          const val = head.semesterAmounts ? Number(head.semesterAmounts[String(sem)] ?? 0) : 0;
                                                          return (
                                                            <td key={sem} className="px-3 py-2 text-center text-gray-600">
                                                              {val > 0 ? `\u20B9${val.toLocaleString('en-IN')}` : <span className="text-gray-300">&mdash;</span>}
                                                            </td>
                                                          );
                                                        })}
                                                        <td className="px-3 py-2 text-right font-semibold text-gray-800">&#8377;{head.amount.toLocaleString('en-IN')}</td>
                                                      </tr>
                                                    ))}
                                                    <tr className="bg-purple-50 font-bold">
                                                      <td className="px-4 py-2 text-purple-700">Specialization total</td>
                                                      {specializationTotals.map((amount, idx) => (
                                                        <td key={semNums[idx]} className="px-3 py-2 text-center text-purple-700">
                                                          {amount > 0 ? `\u20B9${amount.toLocaleString('en-IN')}` : <span className="text-gray-300">&mdash;</span>}
                                                        </td>
                                                      ))}
                                                      <td className="px-3 py-2 text-right text-purple-700">&#8377;{spec.amount.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                    {baseStructure && (
                                                      <tr className="bg-indigo-50 font-bold">
                                                        <td className="px-4 py-2 text-indigo-700">Basic + specialization</td>
                                                        {combinedTotals.map((amount, idx) => (
                                                          <td key={semNums[idx]} className="px-3 py-2 text-center text-indigo-700">
                                                            {amount > 0 ? `\u20B9${amount.toLocaleString('en-IN')}` : <span className="text-gray-300">&mdash;</span>}
                                                          </td>
                                                        ))}
                                                        <td className="px-3 py-2 text-right text-indigo-700">&#8377;{(baseStructure.amount + spec.amount).toLocaleString('en-IN')}</td>
                                                      </tr>
                                                    )}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                        );
                      })()
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          )
        )}

        {/* TEMPLATE AUDIT TAB */}
        {activeTab === 'template-audit' && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <LoanLetterTemplateAuditLog />
          </div>
        )}
      </div>

      {/* Right-side loan letter drawer */}
      {(viewLetter || viewLetterLoading) && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 no-print"
            onClick={() => { setViewLetter(null); }}
          />
          {/* Drawer */}
          <div className="fixed top-0 right-0 z-50 flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl no-print">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {viewLetter ? viewLetter.uniqueNumber : 'Loading...'}
                  </p>
                  {viewLetter && (
                    <p className="text-xs text-gray-500 font-mono">App: {viewLetter.applicationNumber}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewLetter(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {viewLetterLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
              </div>
            ) : viewLetter ? (
              <div className="flex-1 overflow-y-auto">
                <LoanLetterPrintView
                  letter={viewLetter}
                  onClose={() => setViewLetter(null)}
                  recordReprint
                  onReprintRecorded={() => loadRegistry(registryPage)}
                  showPrintButton={false}
                  showCloseButton={false}
                />
              </div>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}
