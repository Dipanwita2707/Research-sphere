import { create } from 'zustand';
import { dashboardService, Module, Permission } from '@/features/dashboard/services/dashboard.service';
import { extractErrorMessage } from '@/shared/types/api.types';

interface DashboardState {
  modules: Module[];
  permissions: Record<string, Permission[]>;
  isLoading: boolean;
  error: string | null;
  fetchDashboardData: () => Promise<void>;
  hasPermission: (permissionKey: string) => boolean;
  getModulePermissions: (moduleSlug: string) => Permission[];
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  modules: [],
  permissions: {},
  isLoading: false,
  error: null,

  fetchDashboardData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await dashboardService.getDashboardData();
      set({ modules: data.modules, permissions: data.permissions, isLoading: false });
    } catch (error: unknown) {
      set({ error: extractErrorMessage(error), isLoading: false });
    }
  },

  hasPermission: (permissionKey: string) => {
    const { permissions } = get();
    return Object.values(permissions)
      .flat()
      .some((perm) => perm.key ===
   permissionKey);
  },

  getModulePermissions: (moduleSlug: string) => {
    const { permissions } = get();
    return permissions[moduleSlug] || [];
  },
}));
