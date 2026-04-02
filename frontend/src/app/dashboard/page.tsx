'use client';

import { useAuthStore } from '@/shared/auth/authStore';
import PageLoader from '@/shared/components/PageLoader';
import { useEffect } from 'react';
import { logger } from '@/shared/utils/logger';
import dynamic from 'next/dynamic';

const ModernStaffDashboard = dynamic(
  () => import('@/features/dashboard/components/ModernStaffDashboard'),
  {
    loading: () => <PageLoader fullScreen />,
  }
);

const StudentDashboard = dynamic(
  () => import('@/features/dashboard/components/StudentDashboard'),
  {
    loading: () => <PageLoader fullScreen />,
  }
);

// Force reload - showing StudentDashboard for all users
export default function DashboardPage() {
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    logger.debug('Dashboard - User:', user);
    logger.debug('Dashboard - isLoading:', isLoading);
    logger.debug('Dashboard - userType:', user?.userType);
  }, [user, isLoading]);

  if (isLoading) {
    logger.debug('Dashboard - Showing loading spinner');
    return <PageLoader fullScreen />;
  }

  if (!user) {
    logger.debug('Dashboard - No user, redirecting...');
    return <PageLoader fullScreen />;
  }

  logger.debug('Dashboard - Rendering for userType:', user.userType);

  // Check if user is a student
  const isStudent = user?.userType ===
   'student' || user?.role?.name ===
   'student';
  
  // Debug: Log the check
  logger.debug('Dashboard - isStudent check:', isStudent, 'userType:', user?.userType, 'role:', user?.role?.name);

  // Route to appropriate dashboard based on user type
  if (isStudent) {
    return <StudentDashboard />;
  }

  return <ModernStaffDashboard />;
}
