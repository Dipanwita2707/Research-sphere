import api from '@/shared/api/api';
import { logger } from '@/shared/utils/logger';
import { isAxiosError } from 'axios';

export interface RolePercentage {
  role: string;
  percentage: number;
}

export interface GrantIncentivePolicy {
  id: string;
  policyName: string;
  projectCategory: 'govt' | 'non_govt' | 'industry';
  projectType: 'indian' | 'international';
  baseIncentiveAmount: number;
  basePoints: number;
  splitPolicy: 'equal' | 'percentage_based';
  rolePercentages?: RolePercentage[];
  fundingAmountMultiplier?: any;
  internationalBonus?: number;
  consortiumBonus?: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGrantPolicyData {
  policyName: string;
  projectCategory: 'govt' | 'non_govt' | 'industry';
  projectType: 'indian' | 'international';
  baseIncentiveAmount: number;
  basePoints: number;
  splitPolicy: 'equal' | 'percentage_based';
  rolePercentages?: RolePercentage[];
  internationalBonus?: number;
  consortiumBonus?: number;
  isActive?: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface GrantIncentiveCalculation {
  baseIncentiveAmount: number;
  basePoints: number;
  internationalBonus: number;
  consortiumBonus: number;
  totalIncentiveAmount: number;
  totalPoints: number;
  breakdown: {
    base: number;
    internationalBonus: number;
    consortiumBonus: number;
  };
  policy: GrantIncentivePolicy;
}

class GrantPolicyService {
  /**
   * Get all grant policies (admin only)
   */
  async getAllPolicies(): Promise<GrantIncentivePolicy[]> {
    const response = await api.get('/grant-policies');
    return response.data.data;
  }

  /**
   * Get active policy by project category and type
   */
  async getActivePolicy(projectCategory: string, projectType: string): Promise<GrantIncentivePolicy> {
    try {
      // Disable caching to force fresh data
      const response = await api.get(`/grant-policies/active/${projectCategory}/${projectType}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      logger.debug('getActivePolicy raw response:', response);
      
      // Handle both response.data.data and response.data formats
      if (response.data?.data) {
        return response.data.data;
      } else if (response.data) {
        return response.data;
      } else {
        throw new Error('No policy data in response');
      }
    } catch (error: unknown) {
      logger.error('getActivePolicy error:', error);
      if (isAxiosError(error) && error.response?.status ===
   404) {
        throw new Error('No active policy found for this category and type');
      }
      throw error;
    }
  }

  /**
   * Get policy by ID (admin only)
   */
  async getPolicyById(id: string): Promise<GrantIncentivePolicy> {
    const response = await api.get(`/grant-policies/${id}`);
    return response.data.data;
  }

  /**
   * Create a new grant policy (admin only)
   */
  async createPolicy(data: CreateGrantPolicyData): Promise<GrantIncentivePolicy> {
    const response = await api.post('/grant-policies', data);
    return response.data.data;
  }

  /**
   * Update an existing grant policy (admin only)
   */
  async updatePolicy(id: string, data: Partial<CreateGrantPolicyData>): Promise<GrantIncentivePolicy> {
    const response = await api.put(`/grant-policies/${id}`, data);
    return response.data.data;
  }

  /**
   * Delete a grant policy (admin only)
   */
  async deletePolicy(id: string): Promise<void> {
    await api.delete(`/grant-policies/${id}`);
  }

  /**
   * Calculate incentive for a grant based on policy
   */
  async calculateIncentive(params: {
    projectCategory: string;
    projectType: string;
    submittedAmount?: number;
    numberOfConsortiumOrgs?: number;
  }): Promise<GrantIncentiveCalculation> {
    const response = await api.post('/grant-policies/calculate', params);
    return response.data.data;
  }
}

export const grantPolicyService = new GrantPolicyService();
export default grantPolicyService;
