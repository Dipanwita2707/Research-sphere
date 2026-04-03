'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  reportingStructureService,
  ReportingDepartmentOption,
} from '@/shared/services/reportingStructure.service';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { Search, Plus, ArrowRight, Building2, X, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const STORAGE_KEY = 'reporting:selected-department-cards';
const ITEMS_PER_PAGE = 5;

const getDepartmentKey = (department: Pick<ReportingDepartmentOption, 'scope' | 'id'>) =>
  `${department.scope}:${department.id}`;

export default function ReportingStructurePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [departmentOptions, setDepartmentOptions] = useState<ReportingDepartmentOption[]>([]);
  const [departmentKeysWithHierarchy, setDepartmentKeysWithHierarchy] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSearchQuery, setSelectedSearchQuery] = useState('');
  const [selectedDepartmentKeys, setSelectedDepartmentKeys] = useState<string[]>([]);
  const [availablePage, setAvailablePage] = useState(1);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSelectedDepartmentKeys(parsed.filter((item) => typeof item === 'string'));
      }
    } catch {
      setSelectedDepartmentKeys([]);
    }
  }, []);

  const loadDepartments = useMemo(
    () => async () => {
      try {
        setLoading(true);

        const [allResponse, hierarchyResponse] = await Promise.all([
          reportingStructureService.getDepartmentOptions(),
          reportingStructureService.getDepartmentOptions({ withHierarchyOnly: true }),
        ]);

        const allDepartments = allResponse.data || [];
        const hierarchyDepartments = hierarchyResponse.data || [];

        setDepartmentOptions(allDepartments);
        setDepartmentKeysWithHierarchy(
          new Set(hierarchyDepartments.map((department) => getDepartmentKey(department)))
        );
      } catch (error: unknown) {
        toast({
          type: 'error',
          message: extractErrorMessage(error, 'Failed to load departments'),
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if (!departmentOptions.length) return;

    const validKeys = new Set(departmentOptions.map((department) => getDepartmentKey(department)));
    const pruned = selectedDepartmentKeys.filter((key) => validKeys.has(key));

    if (pruned.length !== selectedDepartmentKeys.length) {
      setSelectedDepartmentKeys(pruned);
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    }
  }, [departmentOptions, selectedDepartmentKeys]);

  const selectedDepartments = useMemo(
    () => selectedDepartmentKeys
      .map((key) => departmentOptions.find((department) => getDepartmentKey(department) === key))
      .filter((department): department is ReportingDepartmentOption => !!department),
    [departmentOptions, selectedDepartmentKeys],
  );

  const filteredSelectedDepartments = useMemo(() => {
    const q = selectedSearchQuery.trim().toLowerCase();
    if (!q) return selectedDepartments;

    return selectedDepartments.filter((department) => (
      department.name.toLowerCase().includes(q) ||
      (department.code || '').toLowerCase().includes(q) ||
      (department.facultyName || '').toLowerCase().includes(q)
    ));
  }, [selectedDepartments, selectedSearchQuery]);

  const availableDepartments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const selectedSet = new Set(selectedDepartmentKeys);

    return departmentOptions
      .filter((department) => !selectedSet.has(getDepartmentKey(department)))
      .filter((department) => {
        if (!q) return true;
        return (
          department.name.toLowerCase().includes(q) ||
          (department.code || '').toLowerCase().includes(q) ||
          (department.facultyName || '').toLowerCase().includes(q)
        );
      });
  }, [departmentOptions, searchQuery, selectedDepartmentKeys]);

  const totalAvailablePages = Math.max(1, Math.ceil(availableDepartments.length / ITEMS_PER_PAGE));

  const paginatedAvailableDepartments = useMemo(() => {
    const start = (availablePage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return availableDepartments.slice(start, end);
  }, [availableDepartments, availablePage]);

  useEffect(() => {
    setAvailablePage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (availablePage > totalAvailablePages) {
      setAvailablePage(totalAvailablePages);
    }
  }, [availablePage, totalAvailablePages]);

  const addDepartmentCard = (department: ReportingDepartmentOption) => {
    const key = getDepartmentKey(department);
    setSelectedDepartmentKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const removeDepartmentCard = async (department: ReportingDepartmentOption) => {
    const key = getDepartmentKey(department);

    if (departmentKeysWithHierarchy.has(key)) {
      toast({
        type: 'warning',
        message: 'Remove all reporting structure first, then remove this card.',
      });
      return;
    }

    const confirmed = await confirm({
      title: 'Remove Department Card?',
      message: 'No reporting structure data found for this department. Do you still want to remove this card from quick access?',
      type: 'warning',
      confirmText: 'Remove Card',
    });

    if (!confirmed) return;

    setSelectedDepartmentKeys((prev) => prev.filter((item) => item !== key));
  };

  return (
    <ProtectedRoute>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Reporting Structure Management</h1>
          <p className="text-gray-600 mt-2">
            Choose department cards first, then open a department to manage its reporting structure.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-4 mb-6">
          <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-base md:text-lg font-semibold text-gray-900">Choose Department</h2>
            <p className="text-xs text-gray-500">
              Showing {paginatedAvailableDepartments.length} of {availableDepartments.length} department(s)
            </p>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search department by name or code"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading departments...</p>
          ) : availableDepartments.length === 0 ? (
            <p className="text-sm text-gray-500">No departments available to add.</p>
          ) : (
            <div>
              <div className="max-h-[220px] overflow-auto pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {paginatedAvailableDepartments.map((department) => (
                  <button
                    key={getDepartmentKey(department)}
                    onClick={() => addDepartmentCard(department)}
                    className="w-full text-left border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 rounded-lg px-3 py-2 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 leading-tight">{department.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                          {department.scope === 'school' ? 'School Department' : 'Central Department'}
                          {department.code ? ` • ${department.code}` : ''}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        <Plus size={12} />
                        Add
                      </span>
                    </div>
                  </button>
                ))}
                </div>
              </div>

              {totalAvailablePages > 1 && (
                <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-gray-500">
                    Page {availablePage} of {totalAvailablePages}
                  </p>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setAvailablePage((prev) => Math.max(1, prev - 1))}
                      disabled={availablePage === 1}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={14} />
                      Prev
                    </button>

                    {Array.from({ length: totalAvailablePages }, (_, index) => index + 1)
                      .slice(Math.max(0, availablePage - 3), Math.max(0, availablePage - 3) + 5)
                      .map((pageNumber) => (
                        <button
                          key={pageNumber}
                          onClick={() => setAvailablePage(pageNumber)}
                          className={`px-2.5 py-1.5 text-sm border rounded-md transition-colors ${
                            pageNumber === availablePage
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      ))}

                    <button
                      onClick={() => setAvailablePage((prev) => Math.min(totalAvailablePages, prev + 1))}
                      disabled={availablePage === totalAvailablePages}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">Selected Departments</h2>
            <button
              onClick={loadDepartments}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh Status
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-3">Click a card to open that department's reporting structure page.</p>
          <p className="text-xs text-gray-500 mb-4">
            You can remove a card only when that department has no reporting structure entries.
          </p>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={selectedSearchQuery}
              onChange={(e) => setSelectedSearchQuery(e.target.value)}
              placeholder="Search selected departments"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {selectedDepartments.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
              No department card selected yet.
            </div>
          ) : filteredSelectedDepartments.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
              No selected departments match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSelectedDepartments.map((department) => {
                const key = getDepartmentKey(department);
                const hasHierarchy = departmentKeysWithHierarchy.has(key);

                return (
                <div
                  key={key}
                  className="group border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <Building2 className="h-5 w-5 mt-0.5 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{department.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {department.scope === 'school' ? 'School Department' : 'Central Department'}
                          {department.code ? ` • ${department.code}` : ''}
                        </p>
                        <p className={`text-[11px] mt-1 font-medium ${hasHierarchy ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {hasHierarchy ? 'Reporting structure exists' : 'Reporting structure not created yet'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => removeDepartmentCard(department)}
                      className={`transition-colors ${hasHierarchy ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600'}`}
                      disabled={hasHierarchy}
                      aria-label={`Remove ${department.name} card`}
                      title={hasHierarchy ? 'Remove all reporting structure first, then remove this card.' : 'Remove card'}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <button
                    onClick={() => router.push(`/admin/reporting-structure/${department.scope}/${department.id}`)}
                    className="w-full inline-flex items-center justify-between px-3 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                  >
                    Open Reporting Structure
                    <ArrowRight size={16} />
                  </button>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
