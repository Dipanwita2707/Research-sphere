'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  School,
  Building2,
  BookOpen,
  FileText,
  Award,
  Calendar,
  Filter,
  RefreshCw,
  Download,
  ChevronDown,
  Lightbulb,
  BookMarked,
  Shield,
  GraduationCap,
  Trophy,
} from 'lucide-react';
import {
  analyticsService,
  UniversityOverview,
  SchoolStats,
  DepartmentStats,
  IprAnalytics,
  TopPerformer,
  MonthlyTrend,
} from '@/features/admin-management/services/analytics.service';
import { schoolService, School as SchoolType } from '@/features/admin-management/services/school.service';
import { departmentService, Department } from '@/features/admin-management/services/department.service';
import logger from '@/shared/utils/logger';

export default function UniversityAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<UniversityOverview | null>(null);
  const [schoolStats, setSchoolStats] = useState<SchoolStats[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [iprAnalytics, setIprAnalytics] = useState<IprAnalytics | null>(null);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);

  // Filters
  const [schools, setSchools] = useState<SchoolType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'ipr' | 'schools' | 'departments'>('overview');

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
      const [overviewRes, schoolsRes, schoolStatsRes, iprRes, performersRes, trendRes] = await Promise.all([
        analyticsService.getUniversityOverview(),
        schoolService.getAllSchools(),
        analyticsService.getSchoolWiseStats(),
        analyticsService.getIprAnalytics(),
        analyticsService.getTopPerformers(),
        analyticsService.getMonthlyTrend(),
      ]);

      setOverview(overviewRes.data);
      setSchools(schoolsRes.data);
      setSchoolStats(schoolStatsRes.data);
      setIprAnalytics(iprRes.data);
      setTopPerformers(performersRes.data);
      setMonthlyTrend(trendRes.data);
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

      const [iprRes, performersRes, deptStatsRes] = await Promise.all([
        analyticsService.getIprAnalytics(filters),
        analyticsService.getTopPerformers({ ...filters, limit: 10 }),
        selectedSchool ? analyticsService.getDepartmentWiseStats({ schoolId: selectedSchool }) : Promise.resolve({ data: [] }),
      ]);

      setIprAnalytics(iprRes.data);
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-gray-500 mt-3">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-blue-600" />
            University Analytics Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Comprehensive insights across schools, departments, and IPR filings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchInitialData()}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
            <div className="relative">
              <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white text-sm"
              >
                <option value="">All Schools</option>
                {schools.map(school => (
                  <option key={school.id} value={school.id}>
                    {school.shortName || school.facultyName}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                disabled={!selectedSchool}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white text-sm disabled:bg-gray-100"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.departmentName}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Apply
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'ipr', label: 'IPR Analytics', icon: Lightbulb },
          { id: 'schools', label: 'School-wise', icon: School },
          { id: 'departments', label: 'Department-wise', icon: Building2 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
              activeTab ===
   tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab ===
   'overview' && overview && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard icon={School} label="Schools" value={overview.university.schools.total} color="blue" />
            <StatCard icon={Building2} label="Departments" value={overview.university.departments.total} color="indigo" />
            <StatCard icon={BookOpen} label="Programmes" value={overview.university.programmes.total} color="purple" />
            <StatCard icon={Users} label="Faculty" value={overview.users.employees.total} color="green" />
            <StatCard icon={GraduationCap} label="Students" value={overview.users.students.total} color="orange" />
            <StatCard icon={FileText} label="IPR Filings" value={overview.ipr.total} color="pink" />
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Monthly Trend */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                IPR Filing Trend (Last 12 Months)
              </h3>
              <div className="space-y-3">
                {monthlyTrend.slice(-6).map((month, idx) => {
                  const maxCount = Math.max(...monthlyTrend.map(m => m.total), 1);
                  const percentage = (month.total / maxCount) * 100;
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-20">{month.monthName}</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(percentage, 10)}%` }}
                        >
                          <span className="text-xs font-medium text-white">{month.total}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Performers */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Top IPR Contributors
              </h3>
              <div className="space-y-3">
                {topPerformers.slice(0, 5).map((performer, idx) => (
                  <div key={performer.userId} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      idx ===
   0 ? 'bg-yellow-100 text-yellow-700' :
                      idx ===
   1 ? 'bg-gray-100 text-gray-700' :
                      idx ===
   2 ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{performer.name}</p>
                      <p className="text-xs text-gray-500">{performer.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{performer.total}</p>
                      <p className="text-xs text-gray-500">IPRs</p>
                    </div>
                  </div>
                ))}
                {topPerformers.length ===
   0 && (
                  <p className="text-center text-gray-500 py-4">No data available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IPR Analytics Tab */}
      {activeTab ===
   'ipr' && iprAnalytics && (
        <div className="space-y-6">
          {/* IPR Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={FileText} label="Total IPRs" value={iprAnalytics.total} color="blue" />
            <StatCard icon={Lightbulb} label="Patents" value={iprAnalytics.byType?.PATENT || 0} color="yellow" />
            <StatCard icon={BookMarked} label="Copyrights" value={iprAnalytics.byType?.COPYRIGHT || 0} color="purple" />
            <StatCard icon={Shield} label="Trademarks" value={iprAnalytics.byType?.TRADEMARK || 0} color="green" />
          </div>

          {/* IPR by Status */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">IPR by Status</h3>
              <div className="space-y-4">
                {Object.entries(iprAnalytics.byStatus || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                      <span className="text-sm text-gray-700">{formatStatus(status)}</span>
                    </div>
                    <span className="font-medium text-gray-900">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">IPR by User Type</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">Faculty</span>
                  </div>
                  <span className="font-medium text-gray-900">{iprAnalytics.byUserType?.faculty || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-700">Students</span>
                  </div>
                  <span className="font-medium text-gray-900">{iprAnalytics.byUserType?.student || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* School-wise Tab */}
      {activeTab ===
   'schools' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">School-wise Statistics</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Departments</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Programmes</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Faculty</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Students</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">IPRs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {schoolStats.map(school => (
                  <tr key={school.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{school.name}</p>
                        <p className="text-sm text-gray-500">{school.code}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium">{school.departments}</td>
                    <td className="px-6 py-4 text-center font-medium">{school.programmes}</td>
                    <td className="px-6 py-4 text-center font-medium">{school.employees}</td>
                    <td className="px-6 py-4 text-center font-medium">-</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {school.ipr.total}
                      </span>
                    </td>
                  </tr>
                ))}
                {schoolStats.length ===
   0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No school data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Department-wise Tab */}
      {activeTab ===
   'departments' && (
        <div className="space-y-4">
          {!selectedSchool && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800">
              <p className="text-sm">Please select a school from the filter above to view department-wise statistics.</p>
            </div>
          )}
          
          {selectedSchool && departmentStats.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">
                  Department-wise Statistics - {schools.find(s => s.id ===
   selectedSchool)?.facultyName}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Programmes</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Faculty</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Students</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">IPRs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {departmentStats.map(dept => (
                      <tr key={dept.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{dept.name}</p>
                            <p className="text-sm text-gray-500">{dept.code}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-medium">{dept.programmes}</td>
                        <td className="px-6 py-4 text-center font-medium">{dept.employees}</td>
                        <td className="px-6 py-4 text-center font-medium">-</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {dept.ipr.total}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedSchool && departmentStats.length ===
   0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No department data</h3>
              <p className="text-gray-500">No departments found for the selected school</p>
            </div>
          )}
        </div>
      )}
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
    pink: 'bg-pink-50 text-pink-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-400',
    PENDING_HOD_APPROVAL: 'bg-yellow-400',
    PENDING_DEAN_APPROVAL: 'bg-orange-400',
    PENDING_CENTRAL_APPROVAL: 'bg-blue-400',
    APPROVED: 'bg-green-400',
    REJECTED: 'bg-red-400',
    FILED: 'bg-purple-400',
    GRANTED: 'bg-emerald-500',
  };
  return colors[status] || 'bg-gray-400';
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}
