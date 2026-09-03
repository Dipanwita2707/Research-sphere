'use client';

import { useAuthStore } from '@/shared/auth/authStore';
import PageLoader from '@/shared/components/PageLoader';
import { useEffect } from 'react';
import { logger } from '@/shared/utils/logger';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();

  useEffect(() => {
    logger.debug('Dashboard - User:', user);
    logger.debug('Dashboard - isLoading:', isLoading);
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <PageLoader fullScreen />;
  }

  // Check if user is a student
  const isStudent = user?.userType === 'student' || user?.role?.name === 'student';
  
  if (isStudent) {
    return <StudentDashboard />;
  }

  return <ModernStaffDashboard />;
}
