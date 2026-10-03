'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  School,
  Building2,
  BookOpen,
  BookMarked as BookChapterIcon,
  FileText,
  Award,
  Presentation,
  RefreshCw,
  Lightbulb,
  BookMarked,
  Shield,
  GraduationCap,
  FlaskConical,
  RotateCcw,
  SlidersHorizontal,
  CalendarDays,
} from 'lucide-react';
import {
  analyticsService,
  UniversityOverview,
  SchoolStats,
  DepartmentStats,
  IprAnalytics,
  CategoryAnalytics,
  TopPerformer,
  MonthlyTrend,
  CategoryMonthlyTrend,
} from '@/features/admin-management/services/analytics.service';
import { schoolService, School as SchoolType } from '@/features/admin-management/services/school.service';
import { departmentService, Department } from '@/features/admin-management/services/department.service';
import logger from '@/shared/utils/logger';
import { AnalyticsBarChart, AnalyticsHero, AnalyticsPanel, AnalyticsShell, KpiCardGrid } from '@/components/analytics';
import type { KpiCard } from '@/components/analytics/KpiCardGrid';
import { VIZ, ui } from '@/components/analytics/theme';

type ActiveTab = 'overview' | 'research' | 'ipr' | 'schools' | 'departments';

const theadCls = 'bg-stone-50 dark:bg-gray-900/40';
const tbodyCls = 'divide-y divide-stone-100 dark:divide-gray-700';
const trCls = 'transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40';
const numTd = 'px-4 py-3 text-right text-sm tabular-nums text-stone-700 dark:text-gray-200';

export default function UniversityAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<UniversityOverview | null>(null);
  const [schoolStats, setSchoolStats] = useState<SchoolStats[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [iprAnalytics, setIprAnalytics] = useState<IprAnalytics | null>(null);
  const [categoryAnalytics, setCategoryAnalytics] = useState<CategoryAnalytics | null>(null);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [categoryTrend, setCategoryTrend] = useState<CategoryMonthlyTrend[]>([]);

  // Filters
  const [schools, setSchools] = useState<SchoolType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedSchool) {
      fetchDepartmentsBySchool(selectedSchool);
    } else {
      setDepartments([]);
      setSelectedDepartment('');
    }
  }, [selectedSchool]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [overviewRes, schoolsRes, schoolStatsRes, iprRes, categoryRes, performersRes, trendRes] = await Promise.all([
        analyticsService.getUniversityOverview(),
        schoolService.getAllSchools(),
        analyticsService.getSchoolWiseStats(),
        analyticsService.getIprAnalytics(),
        analyticsService.getCategoryAnalytics(),
        analyticsService.getTopPerformers(),
        analyticsService.getMonthlyTrend(),
      ]);

      setOverview(overviewRes.data);
      setSchools(schoolsRes.data);
      setSchoolStats(schoolStatsRes.data);
      setIprAnalytics(iprRes.data);
      setCategoryAnalytics(categoryRes.data);
      setTopPerformers(performersRes.data);
      setMonthlyTrend(trendRes.data);
      setCategoryTrend(trendRes.categoryTrend || []);
    } catch (err) {
      logger.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentsBySchool = async (schoolId: string) => {
    try {
      const response = await departmentService.getDepartmentsBySchool(schoolId);
      setDepartments(response.data);
    } catch (err) {
      logger.error('Failed to fetch departments:', err);
    }
  };

  const applyFilters = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (selectedSchool) filters.schoolId = selectedSchool;
      if (selectedDepartment) filters.departmentId = selectedDepartment;
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;

      const [iprRes, categoryRes, performersRes, deptStatsRes] = await Promise.all([
        analyticsService.getIprAnalytics(filters),
        analyticsService.getCategoryAnalytics(filters),
        analyticsService.getTopPerformers({ ...filters, limit: 10 }),
        selectedSchool ? analyticsService.getDepartmentWiseStats({ schoolId: selectedSchool }) : Promise.resolve({ data: [] }),
      ]);

      setIprAnalytics(iprRes.data);
      setCategoryAnalytics(categoryRes.data);
      setTopPerformers(performersRes.data);
      if (selectedSchool) {
        setDepartmentStats(deptStatsRes.data);
      }
    } catch (err) {
      logger.error('Failed to apply filters:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedSchool('');
    setSelectedDepartment('');
    setDateFrom('');
    setDateTo('');
    fetchInitialData();
  };

  if (loading && !overview) {
    return (
      <AnalyticsShell>
        <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading analytics">
          <div className="h-44 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
          <div className="h-14 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-80 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
            <div className="h-80 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
          </div>
        </div>
      </AnalyticsShell>
    );
  }

  const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString('en-IN');
  const selectCls = `${ui.input} w-full min-w-0 sm:w-auto sm:max-w-[16rem] disabled:cursor-not-allowed disabled:opacity-60`;

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ElementType }> = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'research', label: 'Research', icon: FlaskConical },
    { id: 'ipr', label: 'IPR', icon: Lightbulb },
    { id: 'schools', label: 'School-wise', icon: School },
    { id: 'departments', label: 'Department-wise', icon: Building2 },
  ];

  const kpi = (icon: React.ElementType, label: string, value: number): KpiCard => {
    const Icon = icon;
    return { icon: <Icon />, label, value };
  };

  const iprTrendData = monthlyTrend.map((m) => ({ label: m.monthName, values: { ipr: m.total } }));
  const categoryTrendKeys = [
    { key: 'research', label: 'Papers' },
    { key: 'book', label: 'Books' },
    { key: 'chapters', label: 'Chapters' },
    { key: 'conference', label: 'Conferences' },
    { key: 'grants', label: 'Grants' },
    { key: 'ipr', label: 'IPR' },
  ];
  const categoryTrendData = categoryTrend.map((m) => ({
    label: m.monthName,
    values: {
      research: m.researchPapers,
      book: m.books,
      chapters: m.bookChapters,
      conference: m.conferencePapers,
      grants: m.grants,
      ipr: m.ipr,
    },
  }));

  return (
    <AnalyticsShell>
      <AnalyticsHero
        eyebrow="University analytics"
        title="Research and IPR across the university"
        description="Insights across schools, departments, research papers, books, conferences, grants and IPR filings."
        actions={
          <button onClick={() => fetchInitialData()} disabled={loading} className={ui.btnSecondary}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
        chips={
          overview
            ? [
                { label: 'Schools', value: fmt(overview.university.schools.total) },
                { label: 'Faculty', value: fmt(overview.users.employees.total) },
                { label: 'Research papers', value: fmt(overview.categories?.researchPapers) },
                { label: 'IPR filings', value: fmt(overview.ipr.total) },
              ]
            : undefined
        }
      />

      {/* Filters */}
      <div className="sticky top-20 z-30 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:border-gray-700 dark:bg-gray-800/90 sm:top-[5.5rem] sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-gray-400">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </span>
          <select aria-label="School" value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)} className={selectCls}>
            <option value="">All schools</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.shortName || school.facultyName}
              </option>
            ))}
          </select>
          <select
            aria-label="Department"
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            disabled={!selectedSchool}
            className={selectCls}
          >
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.departmentName}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-stone-400 dark:text-gray-500" />
            <input type="date" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={ui.input} />
            <span className="text-xs text-stone-400 dark:text-gray-500">to</span>
            <input type="date" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={ui.input} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={clearFilters} className={ui.btnSecondary}>
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </button>
            <button onClick={applyFilters} className={ui.btnPrimary}>
              Apply
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Tab navigation */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-1 border-b border-stone-200 dark:border-gray-700" role="tablist" aria-label="Analytics sections">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'border-wine text-wine dark:border-amber dark:text-amber'
                      : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            <section aria-label="University footprint">
              <h3 className={`mb-3 ${ui.label}`}>University footprint</h3>
              <KpiCardGrid
                cards={[
                  kpi(School, 'Schools', overview.university.schools.total),
                  kpi(Building2, 'Departments', overview.university.departments.total),
                  kpi(BookOpen, 'Programmes', overview.university.programmes.total),
                  kpi(Users, 'Faculty', overview.users.employees.total),
                  kpi(GraduationCap, 'Students', overview.users.students.total),
                  kpi(FileText, 'IPR filings', overview.ipr.total),
                ]}
              />
            </section>

            <section aria-label="Research output categories">
              <h3 className={`mb-3 ${ui.label}`}>Research output categories</h3>
              <KpiCardGrid
                cards={[
                  kpi(FileText, 'Research papers', overview.categories?.researchPapers || 0),
                  kpi(BookOpen, 'Books', overview.categories?.books || 0),
                  kpi(BookChapterIcon, 'Book chapters', overview.categories?.bookChapters || 0),
                  kpi(Presentation, 'Conference papers', overview.categories?.conferencePapers || 0),
                  kpi(Award, 'Grants', overview.categories?.grants || 0),
                  kpi(Lightbulb, 'IPR filings', overview.categories?.ipr.total || 0),
                ]}
              />
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <AnalyticsBarChart
                title="IPR filing trend"
                subtitle="Filings per month, last 12 months."
                data={iprTrendData}
                keys={[{ key: 'ipr', label: 'IPR filings' }]}
                height={280}
              />

              <AnalyticsPanel title="Top IPR contributors" subtitle="Ranked by total IPR filings.">
                {topPerformers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-stone-500 dark:text-gray-400">No data for this period.</p>
                ) : (
                  <ol className="-my-2 divide-y divide-stone-100 dark:divide-gray-700">
                    {topPerformers.slice(0, 5).map((performer, idx) => (
                      <li key={performer.userId} className="flex items-center gap-3 py-2.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                            idx === 0
                              ? 'bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber'
                              : 'bg-stone-100 text-stone-600 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-stone-900 dark:text-white">{performer.name}</p>
                          <p className="text-xs capitalize text-stone-500 dark:text-gray-400">{performer.type}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm ${ui.value}`}>{fmt(performer.total)}</p>
                          <p className="text-xs text-stone-500 dark:text-gray-400">IPRs</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </AnalyticsPanel>
            </div>

            {categoryTrend.length > 0 && (
              <>
                <AnalyticsBarChart
                  title="Research output trend"
                  subtitle="Monthly output by category, last 12 months."
                  data={categoryTrendData}
                  keys={categoryTrendKeys}
                  stacked
                  height={300}
                />

                <section className={`overflow-hidden ${ui.card}`}>
                  <div className={ui.cardHeader}>
                    <div>
                      <h3 className={ui.title}>Last six months by category</h3>
                      <p className={ui.subtitle}>Exact monthly counts behind the trend.</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className={theadCls}>
                        <tr>
                          <th className={ui.th}>Month</th>
                          {categoryTrendKeys.map((k) => (
                            <th key={k.key} className={`${ui.th} text-right`}>{k.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={tbodyCls}>
                        {categoryTrend.slice(-6).map((month, idx) => (
                          <tr key={idx} className={trCls}>
                            <td className={`${ui.td} font-medium text-stone-900 dark:text-white`}>{month.monthName}</td>
                            {[month.researchPapers, month.books, month.bookChapters, month.conferencePapers, month.grants, month.ipr].map((v, i) => (
                              <td key={i} className={numTd}><Count value={v} /></td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {/* Research tab */}
        {activeTab === 'research' && categoryAnalytics && (
          <div className="space-y-6">
            <KpiCardGrid
              cols={4}
              cards={[
                kpi(FileText, 'Research papers', categoryAnalytics.researchPapers),
                kpi(BookOpen, 'Books', categoryAnalytics.books),
                kpi(BookChapterIcon, 'Book chapters', categoryAnalytics.bookChapters),
                kpi(Presentation, 'Conference papers', categoryAnalytics.conferencePapers),
                kpi(Award, 'Grants', categoryAnalytics.grants.total),
              ]}
            />

            <div className="grid gap-6 md:grid-cols-2">
              <AnalyticsPanel title="Research contributions by status" subtitle="Share of all contributions in each workflow state.">
                <StatusList entries={categoryAnalytics.byStatus || {}} />
              </AnalyticsPanel>
              <AnalyticsPanel title="Grants by status" subtitle="Share of all grant applications in each state.">
                <StatusList entries={categoryAnalytics.grants.byStatus || {}} />
              </AnalyticsPanel>
            </div>

            <section className={`overflow-hidden ${ui.card}`}>
              <div className={ui.cardHeader}>
                <div>
                  <h3 className={ui.title}>Recent research contributions</h3>
                  <p className={ui.subtitle}>Latest submissions in the current filter.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className={theadCls}>
                    <tr>
                      <th className={ui.th}>Title</th>
                      <th className={ui.th}>Type</th>
                      <th className={ui.th}>School</th>
                      <th className={ui.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody className={tbodyCls}>
                    {categoryAnalytics.recentContributions.map((item) => (
                      <tr key={item.id} className={trCls}>
                        <td className={`${ui.td} max-w-xs truncate font-medium text-stone-900 dark:text-white`} title={item.title}>{item.title}</td>
                        <td className={`${ui.td} text-stone-500 dark:text-gray-400`}>{formatStatus(item.publicationType)}</td>
                        <td className={`${ui.td} text-stone-500 dark:text-gray-400`}>{item.school?.facultyName || '—'}</td>
                        <td className="px-4 py-3"><StatusPill status={item.status} /></td>
                      </tr>
                    ))}
                    {categoryAnalytics.recentContributions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-sm text-stone-500 dark:text-gray-400">
                          No research contributions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* IPR tab */}
        {activeTab === 'ipr' && iprAnalytics && (
          <div className="space-y-6">
            <KpiCardGrid
              cols={4}
              cards={[
                kpi(FileText, 'Total IPRs', iprAnalytics.total),
                kpi(Lightbulb, 'Patents', iprAnalytics.byType?.patent || 0),
                kpi(BookMarked, 'Copyrights', iprAnalytics.byType?.copyright || 0),
                kpi(Shield, 'Trademarks', iprAnalytics.byType?.trademark || 0),
                kpi(FlaskConical, 'Designs', iprAnalytics.byType?.design || 0),
              ]}
            />

            <div className="grid gap-6 md:grid-cols-2">
              <AnalyticsPanel title="IPR by status" subtitle="Share of all filings in each state.">
                <StatusList entries={iprAnalytics.byStatus || {}} />
              </AnalyticsPanel>

              <AnalyticsPanel title="IPR by user type" subtitle="Who is filing.">
                {(() => {
                  const faculty = iprAnalytics.byUserType?.faculty || 0;
                  const student = iprAnalytics.byUserType?.student || 0;
                  const total = faculty + student || 1;
                  return (
                    <ul className="space-y-4">
                      {[
                        { label: 'Faculty', value: faculty, Icon: Users, color: VIZ[0] },
                        { label: 'Students', value: student, Icon: GraduationCap, color: VIZ[1] },
                      ].map(({ label, value, Icon, color }) => (
                        <li key={label}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-sm text-stone-700 dark:text-gray-200">
                              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                              <Icon className="h-4 w-4 text-stone-400 dark:text-gray-500" />
                              {label}
                            </span>
                            <span className="text-sm tabular-nums">
                              <span className="font-semibold text-stone-900 dark:text-white">{fmt(value)}</span>
                              <span className="ml-1.5 text-stone-500 dark:text-gray-400">{Math.round((value / total) * 100)}%</span>
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700">
                            <div className="h-full rounded-full" style={{ width: `${(value / total) * 100}%`, backgroundColor: color }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </AnalyticsPanel>
            </div>
          </div>
        )}

        {/* School-wise tab */}
        {activeTab === 'schools' && (
          <section className={`overflow-hidden ${ui.card}`}>
            <div className={ui.cardHeader}>
              <div>
                <h3 className={ui.title}>School-wise statistics</h3>
                <p className={ui.subtitle}>Structure, staff and research output per school.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={theadCls}>
                  <tr>
                    <th className={ui.th}>School</th>
                    {['Departments', 'Programmes', 'Faculty', 'Papers', 'Books', 'Conferences', 'Grants', 'IPRs'].map((h) => (
                      <th key={h} className={`${ui.th} text-right`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={tbodyCls}>
                  {schoolStats.map((school) => (
                    <tr key={school.id} className={trCls}>
                      <td className={ui.td}>
                        <p className="font-medium text-stone-900 dark:text-white">{school.name}</p>
                        <p className="text-xs text-stone-500 dark:text-gray-400">{school.code}</p>
                      </td>
                      <td className={numTd}><Count value={school.departments} /></td>
                      <td className={numTd}><Count value={school.programmes} /></td>
                      <td className={numTd}><Count value={school.employees} /></td>
                      <td className={numTd}><Count value={school.categories?.researchPapers} /></td>
                      <td className={numTd}>
                        <Count value={school.categories ? (school.categories.books ?? 0) + (school.categories.bookChapters ?? 0) : undefined} />
                      </td>
                      <td className={numTd}><Count value={school.categories?.conferencePapers} /></td>
                      <td className={numTd}><Count value={school.categories?.grants} /></td>
                      <td className={`${numTd} font-semibold`}><Count value={school.ipr.total} /></td>
                    </tr>
                  ))}
                  {schoolStats.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-sm text-stone-500 dark:text-gray-400">
                        No school data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Department-wise tab */}
        {activeTab === 'departments' && (
          <div className="space-y-4">
            {!selectedSchool && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                <School className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Select a school in the filter bar above to see department-wise statistics.</p>
              </div>
            )}

            {selectedSchool && departmentStats.length > 0 && (
              <section className={`overflow-hidden ${ui.card}`}>
                <div className={ui.cardHeader}>
                  <div>
                    <h3 className={ui.title}>Department-wise statistics</h3>
                    <p className={ui.subtitle}>{schools.find((s) => s.id === selectedSchool)?.facultyName}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className={theadCls}>
                      <tr>
                        <th className={ui.th}>Department</th>
                        {['Programmes', 'Faculty', 'Papers', 'Books', 'Conferences', 'Grants', 'IPRs'].map((h) => (
                          <th key={h} className={`${ui.th} text-right`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={tbodyCls}>
                      {departmentStats.map((dept) => (
                        <tr key={dept.id} className={trCls}>
                          <td className={ui.td}>
                            <p className="font-medium text-stone-900 dark:text-white">{dept.name}</p>
                            <p className="text-xs text-stone-500 dark:text-gray-400">{dept.code}</p>
                          </td>
                          <td className={numTd}><Count value={dept.programmes} /></td>
                          <td className={numTd}><Count value={dept.employees} /></td>
                          <td className={numTd}><Count value={dept.categories?.researchPapers} /></td>
                          <td className={numTd}>
                            <Count value={dept.categories ? (dept.categories.books ?? 0) + (dept.categories.bookChapters ?? 0) : undefined} />
                          </td>
                          <td className={numTd}><Count value={dept.categories?.conferencePapers} /></td>
                          <td className={numTd}><Count value={dept.categories?.grants} /></td>
                          <td className={`${numTd} font-semibold`}><Count value={dept.ipr.total} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {selectedSchool && departmentStats.length === 0 && (
              <div className={`${ui.card} px-6 py-12 text-center`}>
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-500 dark:bg-gray-700 dark:text-gray-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-stone-900 dark:text-white">No department data</h3>
                <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">No departments found for the selected school.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AnalyticsShell>
  );
}

/** Table count: zeros recede, missing values show an em dash. */
function Count({ value }: { value: number | undefined | null }) {
  if (value === undefined || value === null) return <span className="text-stone-300 dark:text-gray-600">—</span>;
  if (value === 0) return <span className="text-stone-300 dark:text-gray-600">0</span>;
  return <>{value.toLocaleString('en-IN')}</>;
}

type StatusTone = 'good' | 'bad' | 'wait' | 'neutral';

function getStatusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (['approved', 'completed', 'granted', 'published', 'credited'].includes(s)) return 'good';
  if (['rejected', 'cancelled'].includes(s)) return 'bad';
  if (s.startsWith('pending') || ['submitted', 'under_review', 'changes_required', 'resubmitted', 'recommended', 'filed'].includes(s)) return 'wait';
  return 'neutral';
}

const TONE_CLS: Record<StatusTone, string> = {
  good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  bad: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  wait: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  neutral: 'bg-stone-100 text-stone-600 dark:bg-gray-700 dark:text-gray-300',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${TONE_CLS[getStatusTone(status)]}`}>
      {formatStatus(status)}
    </span>
  );
}

/** Status breakdown: labelled pill, count, share, and a thin share bar. */
function StatusList({ entries }: { entries: Record<string, number> }) {
  const rows = Object.entries(entries) as Array<[string, number]>;
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-stone-500 dark:text-gray-400">No data for this period.</p>;
  }
  const total = rows.reduce((s, [, c]) => s + (c || 0), 0) || 1;
  return (
    <ul className="space-y-3.5">
      {rows
        .slice()
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .map(([status, count]) => {
          const pct = ((count || 0) / total) * 100;
          return (
            <li key={status}>
              <div className="flex items-center justify-between gap-3">
                <StatusPill status={status} />
                <span className="text-sm tabular-nums">
                  <span className="font-semibold text-stone-900 dark:text-white">{(count || 0).toLocaleString('en-IN')}</span>
                  <span className="ml-1.5 text-stone-500 dark:text-gray-400">{Math.round(pct)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: VIZ[0] }} />
              </div>
            </li>
          );
        })}
    </ul>
  );
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
