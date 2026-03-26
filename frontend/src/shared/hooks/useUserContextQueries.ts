import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/auth/authStore';
import api from '@/shared/api/api';
import { notificationService } from '@/shared/services/notification.service';

export interface StaffDashboardSummary {
  department: string;
  designation: string;
  faculty: string;
  permissions: Array<{
    category: string;
    permissions: string[];
  }>;
}

export const USER_CONTEXT_QUERY_KEYS = {
  staffDashboard: (userId?: string | number | null) => ['user-context', 'staff-dashboard', userId ?? 'anonymous'] as const,
  unreadCount: (userId?: string | number | null) => ['user-context', 'notifications', 'unread-count', userId ?? 'anonymous'] as const,
  volunteerAssignments: (userId?: string | number | null) => ['user-context', 'events', 'volunteer-assignments', userId ?? 'anonymous'] as const,
};

export function useStaffDashboardSummary(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: USER_CONTEXT_QUERY_KEYS.staffDashboard(userId),
    queryFn: async () => {
      const response = await api.get('/dashboard/staff');
      return response.data.data as StaffDashboardSummary;
    },
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnreadNotificationCount(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: USER_CONTEXT_QUERY_KEYS.unreadCount(userId),
    queryFn: () => notificationService.getUnreadCount(),
    enabled: enabled && !!userId,
    staleTime: 60 * 1000,
  });
}

export function useHasVolunteerAssignments(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: USER_CONTEXT_QUERY_KEYS.volunteerAssignments(userId),
    queryFn: async () => {
      const response = await api.get('/events/volunteers/my');
      const assignments = response.data?.data;
      return Array.isArray(assignments) && assignments.length > 0;
    },
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
