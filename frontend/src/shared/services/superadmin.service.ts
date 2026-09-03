import api from '@/shared/api/api';

export interface SaaSGlobalStats {
  totalUniversities: number;
  totalUsers: number;
  activeSubscriptions: number;
  monthlyRecurringRevenueCents: number;
  mtdApiRequests: number;
}

export interface UniversityAdmin {
  id: string;
  uid: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface UniversityStats {
  users: number;
  schools: number;
  centralDepts: number;
  programs: number;
}

export interface University {
  id: string;
  code: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  contactEmail?: string | null;
  websiteUrl?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  affiliationAliases?: string[] | null;
  isActive: boolean;
  createdAt: string;
  counts?: {
    users: number;
    schools: number;
    centralDepts: number;
  };
  subscription?: {
    id: string;
    status: string;
    tierName: string;
    billingCycle: string;
    currentPeriodEnd: string;
    maxApiCalls: number;
    maxUsers: number;
  } | null;
  apiUsageMtd?: number;
  stats?: UniversityStats;
}

export interface AffiliationVariantsPreview {
  canonicalName: string;
  variants: string[];
  aliases: string[];
}

export interface SaaSTier {
  id: string;
  name: string;
  displayName: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  maxUsers: number;
  maxApiCallsPerMonth: number;
  maxStorageGb: number;
  features: any;
  overagePer1kCalls: number;
  isPublic: boolean;
  sortOrder: number;
}

export interface ProvisionUniversityPayload {
  code: string;
  name: string;
  slug: string;
  contactEmail: string;
  websiteUrl?: string;
  tierId: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword?: string;
}

export interface ApiMonitorStats {
  universityId: string;
  name: string;
  code: string;
  requests: number;
  successRequests: number;
  errorRequests: number;
  avgDurationMs: number;
  p95DurationMs: number;
  endpointBreakdown: Record<string, number>;
}

export interface LicenseRecord {
  id: string;
  licenseKey: string;
  assignedTo: string;
  isActive: boolean;
  requiresApproval: boolean;
  hardwareId?: string | null;
  allowedHardwareIds?: string[];
  pendingHardwareId?: string | null;
  notes?: string | null;
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'REVOKED' | 'UNBOUND';
  activatedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface IssueLicensePayload {
  assignedTo: string;
  notes?: string;
  requiresApproval?: boolean;
  preAuthorizedHardwareId?: string;
}

class SuperadminService {
  async getGlobalStats(): Promise<SaaSGlobalStats> {
    const response = await api.get<{ success: boolean; data: SaaSGlobalStats }>('/superadmin/analytics/overview');
    return response.data.data;
  }

  async getAllUniversities(): Promise<University[]> {
    const response = await api.get<{ success: boolean; data: University[] }>('/superadmin/universities');
    return response.data.data;
  }

  async getUniversityById(id: string): Promise<University> {
    const response = await api.get<{ success: boolean; data: University }>(`/superadmin/universities/${id}`);
    return response.data.data;
  }

  async getUniversityAdmins(id: string): Promise<UniversityAdmin[]> {
    const response = await api.get<{ success: boolean; data: UniversityAdmin[] }>(`/superadmin/universities/${id}/admins`);
    return response.data.data;
  }

  async createUniversityAdmin(id: string, payload: any): Promise<UniversityAdmin> {
    const response = await api.post<{ success: boolean; data: UniversityAdmin }>(`/superadmin/universities/${id}/admins`, payload);
    return response.data.data;
  }

  async provisionUniversity(payload: ProvisionUniversityPayload): Promise<any> {
    const response = await api.post('/superadmin/universities', payload);
    return response.data;
  }

  async updateUniversity(id: string, payload: Partial<University>): Promise<University> {
    const response = await api.put<{ success: boolean; data: University }>(`/superadmin/universities/${id}`, payload);
    return response.data.data;
  }

  async suspendUniversity(id: string, suspend: boolean): Promise<any> {
    const response = await api.post(`/superadmin/universities/${id}/suspend`, { suspend });
    return response.data;
  }

  async previewAffiliationVariants(
    id: string,
    params?: { name?: string; city?: string; state?: string; aliases?: string[] }
  ): Promise<AffiliationVariantsPreview> {
    const response = await api.get<{ success: boolean; data: AffiliationVariantsPreview }>(
      `/superadmin/universities/${id}/affiliation-variants`,
      {
        params: {
          name: params?.name,
          city: params?.city,
          state: params?.state,
          aliases: params?.aliases?.join(','),
        },
      }
    );
    return response.data.data;
  }

  async getAllTiers(): Promise<SaaSTier[]> {
    const response = await api.get<{ success: boolean; data: SaaSTier[] }>('/superadmin/tiers');
    return response.data.data;
  }

  async createTier(payload: Partial<SaaSTier>): Promise<SaaSTier> {
    const response = await api.post<{ success: boolean; data: SaaSTier }>('/superadmin/tiers', payload);
    return response.data.data;
  }

  async updateTier(id: string, payload: Partial<SaaSTier>): Promise<SaaSTier> {
    const response = await api.put<{ success: boolean; data: SaaSTier }>(`/superadmin/tiers/${id}`, payload);
    return response.data.data;
  }

  async getApiMonitorStats(): Promise<ApiMonitorStats[]> {
    const response = await api.get<{ success: boolean; data: ApiMonitorStats[] }>('/superadmin/analytics/api-monitor');
    return response.data.data;
  }

  // ── License Management Methods ─────────────────────────────────────────────

  async listLicenses(): Promise<LicenseRecord[]> {
    const response = await api.get<{ success: boolean; data: LicenseRecord[] }>('/superadmin/license/list');
    return response.data.data;
  }

  async issueLicense(payload: IssueLicensePayload): Promise<LicenseRecord> {
    const response = await api.post<{ success: boolean; data: LicenseRecord }>('/superadmin/license/issue', payload);
    return response.data.data;
  }

  async approveHardware(id: string): Promise<any> {
    const response = await api.post<{ success: boolean; message: string; data?: any }>(`/superadmin/license/approve/${id}`);
    return response.data;
  }

  async authorizeHardware(id: string, hardwareId: string): Promise<any> {
    const response = await api.post<{ success: boolean; message: string }>(`/superadmin/license/authorize/${id}`, { hardwareId });
    return response.data;
  }

  async revokeLicense(id: string): Promise<any> {
    const response = await api.post<{ success: boolean; message: string }>(`/superadmin/license/revoke/${id}`);
    return response.data;
  }

  async reactivateLicense(id: string): Promise<any> {
    const response = await api.post<{ success: boolean; message: string }>(`/superadmin/license/reactivate/${id}`);
    return response.data;
  }

  async resetHardware(id: string): Promise<any> {
    const response = await api.post<{ success: boolean; message: string }>(`/superadmin/license/reset-hardware/${id}`);
    return response.data;
  }

  async deleteLicense(id: string): Promise<any> {
    const response = await api.delete<{ success: boolean; message: string }>(`/superadmin/license/${id}`);
    return response.data;
  }
}

export const superadminService = new SuperadminService();
