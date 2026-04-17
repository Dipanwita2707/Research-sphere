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
  User,
  Building,
  Award,
  Clock,
  BookOpen,
  GraduationCap,
  Briefcase,
  TrendingUp
} from 'lucide-react';
import api from '@/shared/api/api';
import { logger } from '@/shared/utils/logger';
import PermissionBasedDashboard from './PermissionBasedDashboard';
import Link from 'next/link';

interface StaffStats {
  department: string;
  designation: string;
  faculty: string;
  permissions: Array<{
    category: string;
    permissions: string[];
  }>;
}

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

export default function StaffDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const isAdmin = user?.userType ===
   'admin' || user?.role?.name ===
   'admin';

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch staff data
      const staffResponse = await api.get('/dashboard/staff');
      setStats(staffResponse.data.data);

      // If admin, fetch overview stats
      if (user?.userType ===
   'admin' || user?.role?.name ===
   'admin') {
        try {
          const overviewResponse = await api.get('/analytics/overview');
          if (overviewResponse.data.success) {
            setAdminOverview(overviewResponse.data.data);
          }
        } catch (err) {
          logger.debug('Analytics not available');
        }
      }
    } catch (error) {
      logger.error('Failed to fetch data:', error);
      setStats({
        department: 'N/A',
        designation: 'N/A',
        faculty: 'N/A',
        permissions: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-200 rounded-full animate-spin border-t-[#03396c] mx-auto"></div>
          <p className="mt-3 text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalUsers = adminOverview 
    ? (adminOverview.users.employees.total + adminOverview.users.students.total) 
    : 0;
  const totalStaff = adminOverview?.users.employees.total || 0;
  const totalStudents = adminOverview?.users.students.total || 0;
  const totalSchools = adminOverview?.university.schools.total || 0;
  const totalDepartments = adminOverview?.university.departments.total || 0;
  const pendingTasks = adminOverview?.ipr.pending || 0;

  return (
    <div className="space-y-5">
      {/* Page Header - Like LMS */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-xl bg-[#005b96] flex items-center justify-center">
          <LayoutDashboard className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isAdmin ? 'Admin Dashboard' : 'Staff Dashboard'}
          </h1>
          <p className="text-gray-500 text-sm">
            Welcome back, {user?.firstName || user?.username}
          </p>
        </div>
      </div>

      {/* Quick Info Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Building className="w-4 h-4" />
            <span className="text-xs font-medium">Department</span>
          </div>
          <p className="text-lg font-semibold text-gray-800 truncate">{stats?.department || 'N/A'}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Award className="w-4 h-4" />
            <span className="text-xs font-medium">Modules Active</span>
          </div>
          <p className="text-lg font-semibold text-gray-800">{stats?.permissions?.length || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Pending Tasks</span>
          </div>
          <p className="text-lg font-semibold text-gray-800">{pendingTasks}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-medium">Faculty</span>
          </div>
          <p className="text-lg font-semibold text-gray-800 truncate">{stats?.faculty || 'Central Department'}</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's Overview - LMS Style Colored Cards */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">Today's Overview</h2>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatDate()}
            </span>
          </div>
          
          {/* Different cards for Admin vs Staff */}
          {isAdmin ? (
            /* Admin Cards - System-wide stats */
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Blue Card - Total Users */}
              <div 
                onClick={() => router.push('/admin/employees')}
                className="bg-white rounded-2xl p-5 border-l-4 border-[#005b96] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500 font-medium">Total Users</span>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{totalUsers}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> {totalStaff}
                      </span>
                      {' · '}
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" /> {totalStudents}
                      </span>
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#e6f2fa] flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#005b96]" />
                  </div>
                </div>
              </div>

              {/* Green Card - Schools */}
              <div 
                onClick={() => router.push('/admin/schools')}
                className="bg-white rounded-2xl p-5 border-l-4 border-[#27ae60] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500 font-medium">Schools</span>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{totalSchools}</p>
                    <p className="text-xs text-gray-400 mt-1">Total schools</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#e8f8ef] flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-[#27ae60]" />
                  </div>
                </div>
              </div>

              {/* Pink Card - Departments */}
              <div 
                onClick={() => router.push('/admin/departments')}
                className="bg-white rounded-2xl p-5 border-l-4 border-[#e91e63] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500 font-medium">Departments</span>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{totalDepartments}</p>
                    <p className="text-xs text-gray-400 mt-1">Total departments</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#fce4ec] flex items-center justify-center">
                    <Building className="w-6 h-6 text-[#e91e63]" />
                  </div>
                </div>
              </div>

              {/* Orange Card - Pending Tasks */}
              <div 
                onClick={() => router.push('/drd')}
                className="bg-white rounded-2xl p-5 border-l-4 border-[#f39c12] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500 font-medium">Pending IPR</span>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{pendingTasks}</p>
                    <p className="text-xs text-gray-400 mt-1">Awaiting action</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#fef5e7] flex items-center justify-center">
                    <Clock className="w-6 h-6 text-[#f39c12]" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Staff/Faculty Cards - Personal stats */
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Blue Card - My IPR Applications */}
              <div 
                onClick={() => router.push('/ipr/my-applications')}
                className="bg-white rounded-2xl p-5 border-l-4 border-[#005b96] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500 font-medium">My IPR</span>
                    <p className="text-3xl font-bold text-gray-800 mt-1">-</p>
                    <p className="text-xs text-gray-400 mt-1">Applications filed</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#e6f2fa] flex items-center justify-center">
                    <Award className="w-6 h-6 text-[#005b96]" />
                  </div>
                </div>
              </div>

              {/* Green Card - Published */}
              <div 
                onClick={() => router.push('/ipr/my-applications')}
                className="bg-white rounded-2xl p-5 border-l-4 border-[#27ae60] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500 font-medium">Published</span>
                    <p className="text-3xl font-bold text-gray-800 mt-1">-</p>
                    <p className="text-xs text-gray-400 mt-1">IPR published</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#e8f8ef] flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-[#27ae60]" />
                  </div>
                </div>
              </div>

              {/* Purple Card - Incentives Earned */}
              <div 
                onClick={() => router.push('/ipr/my-applications')}
                className="bg-white rounded-2xl p-5 border-l-4 border-[#9b59b6] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500 font-medium">Incentives</span>
                    <p className="text-3xl font-bold text-gray-800 mt-1">₹0</p>
                    <p className="text-xs text-gray-400 mt-1">Total earned</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#f3e5f5] flex items-center justify-center">
                    <Award className="w-6 h-6 text-[#9b59b6]" />
                  </div>
                </div>
              </div>

              {/* Orange Card - Pending Tasks */}
              <div 
                onClick={() => router.push('/drd')}
                className="bg-white rounded-2xl p-5 border-l-4 border-[#f39c12] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500 font-medium">Pending</span>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{pendingTasks}</p>
                    <p className="text-xs text-gray-400 mt-1">Action required</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#fef5e7] flex items-center justify-center">
                    <Clock className="w-6 h-6 text-[#f39c12]" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Links - Like LMS */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Quick Links</h2>
          <div className="space-y-2">
            <Link 
              href="/notifications" 
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">Notifications</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            </Link>
            
            <Link 
              href="/settings" 
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">Settings</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            </Link>

            <Link 
              href="/profile" 
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">My Profile</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            </Link>

            <Link 
              href="/research/progress-tracker" 
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">Monthly Progress Tracker</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            </Link>
          </div>
        </div>
      </div>

      {/* Your Modules Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-800">Your Modules</h2>
          <p className="text-xs text-gray-500 mt-0.5">Access your assigned modules and features</p>
        </div>
        <PermissionBasedDashboard 
          userPermissions={stats?.permissions || []} 
          userRole={user?.role?.name || 'staff'}
        />
      </div>
    </div>
  );
}
