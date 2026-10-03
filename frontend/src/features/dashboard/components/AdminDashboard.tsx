'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  ChevronRight,
  Bell,
  Settings,
  Building,
  Clock,
  GraduationCap,
  Briefcase,
  FileText,
  TrendingUp,
  School,
  MoreVertical
} from 'lucide-react';
import api from '@/shared/api/api';
import Link from 'next/link';
import logger from '@/shared/utils/logger';

interface AdminOverview {
  university: {
    schools: { total: number; active: number };
    departments: { total: number; active: number };
    programmes: { total: number };
  };
  users: {
    employees: { total: number; active: number };
    students: { total: number; active: number };
  };
  ipr: {
    total: number;
    approved: number;
    pending: number;
  };
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      const response = await api.get('/analytics/overview');
      if (response.data.success) {
        setOverview(response.data.data);
      }
    } catch (error) {
      logger.error('Failed to fetch overview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-200 rounded-full animate-spin border-t-[#005b96] mx-auto"></div>
          <p className="mt-3 text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const totalUsers = overview ? (overview.users.employees.total + overview.users.students.total) : 0;
  const totalStaff = overview?.users.employees.total || 0;
  const totalStudents = overview?.users.students.total || 0;
  const totalSchools = overview?.university.schools.total || 0;
  const totalDepartments = overview?.university.departments.total || 0;
  const pendingIPR = overview?.ipr.pending || 0;
  const totalIPR = overview?.ipr.total || 0;

  return (
    <div className="space-y-6">
      {/* Page Header - Like LMS */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#005b96] to-[#03396c] flex items-center justify-center shadow-lg">
          <LayoutDashboard className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#03396c]">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">Welcome back, {user?.firstName || 'Admin'}</p>
        </div>
      </div>

      {/* LMS-Style Stat Cards - White bg with colored left borders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Blue Card - Total Users */}
        <div 
          onClick={() => router.push('/admin/employees')}
          className="bg-white rounded-2xl p-5 border-l-4 border-[#005b96] shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-500">Total Users</span>
              <p className="text-3xl font-bold text-gray-800 mt-1">{totalUsers}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> {totalStaff}
                </span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" /> {totalStudents}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#e6f2fa] flex items-center justify-center">
              <Users className="w-6 h-6 text-[#005b96]" />
            </div>
          </div>
        </div>

        {/* Green Card - Schools */}
        <div 
          onClick={() => router.push('/admin/schools')}
          className="bg-white rounded-2xl p-5 border-l-4 border-[#27ae60] shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-500">Schools</span>
              <p className="text-3xl font-bold text-gray-800 mt-1">{totalSchools}</p>
              <p className="text-xs text-gray-400 mt-2">Total registered schools</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#e8f8ef] flex items-center justify-center">
              <School className="w-6 h-6 text-[#27ae60]" />
            </div>
          </div>
        </div>

        {/* Pink Card - Departments */}
        <div 
          onClick={() => router.push('/admin/departments')}
          className="bg-white rounded-2xl p-5 border-l-4 border-[#e91e63] shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-500">Departments</span>
              <p className="text-3xl font-bold text-gray-800 mt-1">{totalDepartments}</p>
              <p className="text-xs text-gray-400 mt-2">Total departments</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-wine-100 flex items-center justify-center">
              <Building className="w-6 h-6 text-[#e91e63]" />
            </div>
          </div>
        </div>

        {/* Orange Card - Pending Tasks */}
        <div 
          onClick={() => router.push('/drd')}
          className="bg-white rounded-2xl p-5 border-l-4 border-[#f39c12] shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-500">Pending IPR</span>
              <p className="text-3xl font-bold text-gray-800 mt-1">{pendingIPR}</p>
              <p className="text-xs text-gray-400 mt-2">Awaiting review</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#fef5e7] flex items-center justify-center">
              <Clock className="w-6 h-6 text-[#f39c12]" />
            </div>
          </div>
        </div>
      </div>

      {/* Second Row - More Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Notifications Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Bell className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800">Notifications</h3>
            </div>
            <button className="p-1 hover:bg-gray-100 rounded">
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <p className="text-sm text-gray-500">Latest updates and alerts</p>
          <div className="mt-4 text-center py-6 text-gray-400 text-sm">
            No new notifications
          </div>
        </div>

        {/* System Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-800">System Overview</h3>
            </div>
            <button className="p-1 hover:bg-gray-100 rounded">
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">Key metrics and stats</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Users</span>
              <span className="text-sm font-semibold text-blue-600">{totalUsers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Active Schools</span>
              <span className="text-sm font-semibold text-green-600">{overview?.university.schools.active || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total IPR</span>
              <span className="text-sm font-semibold text-purple-600">{totalIPR}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Programs</span>
              <span className="text-sm font-semibold text-orange-600">{overview?.university.programmes.total || 0}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-800">Quick Actions</h3>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">Jump to most used features</p>
          <div className="space-y-2">
            <Link 
              href="/admin/employees" 
              className="flex items-center gap-3 p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <span className="text-sm font-medium text-gray-700">User Management</span>
                <p className="text-xs text-gray-500">Add or manage users</p>
              </div>
            </Link>
            <Link 
              href="/admin/permissions" 
              className="flex items-center gap-3 p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 text-green-600" />
              <div>
                <span className="text-sm font-medium text-gray-700">Permissions</span>
                <p className="text-xs text-gray-500">Manage user access</p>
              </div>
            </Link>
            <Link 
              href="/admin/analytics" 
              className="flex items-center gap-3 p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <div>
                <span className="text-sm font-medium text-gray-700">Analytics</span>
                <p className="text-xs text-gray-500">View detailed reports</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
