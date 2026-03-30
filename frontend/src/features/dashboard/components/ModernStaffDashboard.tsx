'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/auth/authStore';
import {
  Users, 
  School,
  Building,
  Award,
  TrendingUp,
  BookOpen,
  DollarSign,
  CheckCircle
} from 'lucide-react';
import HeroSection from './HeroSection';
import AnimatedStatsGrid from './AnimatedStatsGrid';
import QuickAccessModules from './QuickAccessModules';
import UniversityEventsSlideshow from './UniversityEventsSlideshow';
import PermissionBasedDashboard from './PermissionBasedDashboard';
import CurrentActionSection from './CurrentActionSection';
import RecentNotifications from './RecentNotifications';
import SocialFootprints from './SocialFootprints';
import Footer from '../layouts/Footer';
import { FadeInUp } from '../animations/AnimatedComponents';
import api from '@/shared/api/api';
import { useStaffDashboardSummary } from '@/shared/hooks/useUserContextQueries';

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

export default function ModernStaffDashboard() {
  const { user } = useAuthStore();
  const isAdmin = user?.userType === 'admin' || user?.role?.name === 'admin';
  const {
    data: statsData,
    isLoading: isStatsLoading,
  } = useStaffDashboardSummary({ enabled: !!user });
  const {
    data: adminOverview,
    isLoading: isAdminOverviewLoading,
  } = useQuery({
    queryKey: ['analytics', 'overview', user?.id ?? 'anonymous'],
    queryFn: async () => {
      const response = await api.get('/analytics/overview');
      return response.data.success ? (response.data.data as AdminOverview) : null;
    },
    enabled: !!user && isAdmin,
    staleTime: 2 * 60 * 1000,
  });

  const stats: StaffStats = statsData ?? {
    department: 'N/A',
    designation: 'N/A',
    faculty: 'N/A',
    permissions: [],
  };
  const isLoading = isStatsLoading || (isAdmin && isAdminOverviewLoading);

  const getUserName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) return user.firstName;
    if (user?.employee?.displayName) return user.employee.displayName;
    if (user?.role?.displayName) return user.role.displayName;
    return user?.username || 'User';
  };

  const isStudent = user?.userType === 'student' || user?.role?.name === 'student';

  const getUserType = () => {
    if (isAdmin) return 'Administrator';
    if (user?.userType === 'faculty') return 'Faculty';
    if (isStudent) return 'Student';
    return 'Staff';
  };

  // Prepare stats for the animated grid
  const getStatsData = () => {
    if (isAdmin && adminOverview) {
      const totalUsers = (adminOverview.users.employees.total || 0) + (adminOverview.users.students.total || 0);
      const totalSchools = adminOverview.university.schools.total || 0;
      const totalDepartments = adminOverview.university.departments.total || 0;
      const pendingIPR = adminOverview.ipr.pending || 0;

      return [
        {
          title: 'Total Users',
          value: totalUsers,
          icon: Users,
          color: 'from-blue-500 to-cyan-500',
          change: '+12%',
          changeType: 'increase' as const,
        },
        {
          title: 'Schools',
          value: totalSchools,
          icon: School,
          color: 'from-green-500 to-emerald-500',
          progress: 85,
        },
        {
          title: 'Departments',
          value: totalDepartments,
          icon: Building,
          color: 'from-purple-500 to-pink-500',
          progress: 92,
        },
        {
          title: 'Pending IPR',
          value: pendingIPR,
          icon: Award,
          color: 'from-orange-500 to-red-500',
          change: '-5%',
          changeType: 'decrease' as const,
        },
      ];
    }

    // Stats for students
    if (isStudent) {
      return [
        {
          title: 'My Research',
          value: 3,
          icon: BookOpen,
          color: 'from-blue-500 to-cyan-500',
          progress: 60,
        },
        {
          title: 'IPR Applications',
          value: 2,
          icon: Award,
          color: 'from-green-500 to-emerald-500',
          change: '+1',
          changeType: 'increase' as const,
        },
        {
          title: 'Incentives Earned',
          value: '₹15,000',
          icon: DollarSign,
          color: 'from-purple-500 to-pink-500',
          change: '+10%',
          changeType: 'increase' as const,
        },
        {
          title: 'Pending Submissions',
          value: 2,
          icon: CheckCircle,
          color: 'from-orange-500 to-red-500',
        },
      ];
    }

    // Default stats for staff/faculty
    return [
      {
        title: 'My IPR Applications',
        value: 8,
        icon: Award,
        color: 'from-blue-500 to-cyan-500',
        progress: 75,
      },
      {
        title: 'Published Work',
        value: 12,
        icon: BookOpen,
        color: 'from-green-500 to-emerald-500',
        change: '+3',
        changeType: 'increase' as const,
      },
      {
        title: 'Incentives Earned',
        value: '₹45,000',
        icon: DollarSign,
        color: 'from-purple-500 to-pink-500',
        change: '+15%',
        changeType: 'increase' as const,
      },
      {
        title: 'Pending Tasks',
        value: 5,
        icon: CheckCircle,
        color: 'from-orange-500 to-red-500',
      },
    ];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6 lg:space-y-8 px-2 sm:px-0">
        {/* Animated Hero Section */}
        <HeroSection 
          userName={getUserName()} 
          userType={getUserType()}
        />

        {/* Quick Access Modules (LMS & RFID) */}
        <FadeInUp delay={0.3}>
          <QuickAccessModules />
        </FadeInUp>

        {/* University Events Slideshow */}
        <UniversityEventsSlideshow />

        {/* Animated Stats Grid */}
        <FadeInUp delay={0.5}>
          <AnimatedStatsGrid stats={getStatsData()} />
        </FadeInUp>

        {/* Permission-Based Dashboard (Existing Widgets) + Current Action Section */}
        <FadeInUp delay={0.7}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Your Modules - Left Side */}
            <div>
              <div className="bg-white/70 backdrop-blur-sm dark:bg-gray-800 rounded-2xl shadow-md p-4 sm:p-6 border border-blue-100 dark:border-gray-700 h-full">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Your Modules</h2>
                <PermissionBasedDashboard 
                  userPermissions={stats.permissions || []}
                  userRole={user?.role?.name || user?.userType || 'staff'}
                />
              </div>
            </div>

            {/* Current Action + Recent Notifications - Right Side */}
            <div className="space-y-4 sm:space-y-6">
              <CurrentActionSection userName={getUserName()} userId={user?.id} />
              <RecentNotifications />
            </div>
          </div>
        </FadeInUp>

        {/* Social Footprints Section */}
        <FadeInUp delay={0.9}>
          <SocialFootprints />
        </FadeInUp>
      </div>

      {/* Footer - Full Width Outside Main Container */}
      <Footer />
    </>
  );
}
