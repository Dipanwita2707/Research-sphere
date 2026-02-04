'use client';

import { useAuthStore } from '@/shared/auth/authStore';
import ModernStaffDashboard from '@/features/dashboard/components/ModernStaffDashboard';
import StudentDashboard from '@/features/dashboard/components/StudentDashboard';
import LoadingSpinner from '@/shared/ui-components/LoadingSpinner';
import { useEffect } from 'react';
import { logger } from '@/shared/utils/logger';

// Force reload - showing StudentDashboard for all users
export default function DashboardPage() {
  console.log('🔵 =================================');
  console.log('🔵 DashboardPage component loaded');
  console.log('🔵 Timestamp:', new Date().toISOString());
  console.log('🔵 =================================');
  
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    logger.debug('Dashboard - User:', user);
    logger.debug('Dashboard - isLoading:', isLoading);
    logger.debug('Dashboard - userType:', user?.userType);
  }, [user, isLoading]);

  if (isLoading) {
    logger.debug('Dashboard - Showing loading spinner');
    return <LoadingSpinner fullScreen />;
  }

  if (!user) {
    logger.debug('Dashboard - No user, redirecting...');
    return <LoadingSpinner fullScreen />;
  }

  logger.debug('Dashboard - Rendering for userType:', user.userType);

  // Check if user is a student
  const isStudent = user?.userType === 'student' || user?.role?.name === 'student';
  
  // Debug: Log the check
  logger.debug('Dashboard - isStudent check:', isStudent, 'userType:', user?.userType, 'role:', user?.role?.name);

  // Route to appropriate dashboard based on user type
  if (isStudent) {
    console.log('🟢 =================================');
    console.log('🟢 Rendering StudentDashboard component');
    console.log('🟢 Component version: NEW_REDESIGNED_VERSION_WITH_4_STATS_CARDS');
    console.log('🟢 User:', user?.username);
    console.log('🟢 =================================');
    return <StudentDashboard />;
  }

  console.log('🟣 =================================');
  console.log('🟣 Rendering ModernStaffDashboard component');
  console.log('🟣 User:', user?.username);
  console.log('🟣 =================================');
  return <ModernStaffDashboard />;
}
