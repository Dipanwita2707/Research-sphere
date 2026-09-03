import api from '@/shared/api/api';
import { isAxiosError } from 'axios';

// Conference sub-types
export type ConferenceSubType = 
  | 'paper_indexed_scopus' 
  | 'paper_not_indexed' 
  | 'keynote_speaker_invited_talks' 
  | 'organizer_coordinator_member';

export const CONFERENCE_SUB_TYPES: { value: ConferenceSubType; label: string; description: string }[] = [
  { 
    value: 'paper_indexed_scopus', 
    label: 'Paper in Conference Proceeding indexed in Scopus', 
    description: 'Uses quartile-based incentives similar to research papers' 
  },
  { 
    value: 'paper_not_indexed', 
    label: 'Papers in Conferences (not Indexed) / Seminars / Workshops', 
    description: 'Flat incentive amount' 
  },
  { 
    value: 'keynote_speaker_invited_talks', 
    label: 'Keynote Speaker / Session Chair / Invited Talks', 
    description: 'Flat incentive amount' 
  },
  { 
    value: 'organizer_coordinator_member', 
    label: 'Organizer / Coordinator / Member of Conference held at ResearchSphere', 
    description: 'Flat incentive amount' 
  },
];

// Quartile-based incentive structure (for paper_indexed_scopus)
export interface QuartileIncentive {
  quartile: 'Top 1%' | 'Top 5%' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
  incentiveAmount: number;
  points: number;
}

export interface RolePercentage {
  role: string;
  percentage: number;
}

export interface ConferenceIncentivePolicy {
  id: string;
  policyName: string;
  conferenceSubType: ConferenceSubType;
  // For paper_indexed_scopus - quartile-based incentives
  quartileIncentives?: QuartileIncentive[];
  rolePercentages?: RolePercentage[];
  // For other types - flat incentive
  flatIncentiveAmount?: number;
  flatPoints?: number;
  splitPolicy: 'equal' | 'percentage_based';
  internationalBonus?: number;
  bestPaperAwardBonus?: number;
  isActive: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    uid: string;
    email: string;
    employeeDetails?: { displayName: string };
  };
  updatedBy?: {
    uid: string;
    email: string;
    employeeDetails?: { displayName: string };
  };
}

export interface CreateConferencePolicyData {
  policyName: string;
  conferenceSubType: ConferenceSubType;
  // For paper_indexed_scopus
  quartileIncentives?: QuartileIncentive[];
  rolePercentages?: RolePercentage[];
  // For other types
  flatIncentiveAmount?: number;
  flatPoints?: number;
  splitPolicy: 'equal' | 'percentage_based';
  internationalBonus?: number;
  bestPaperAwardBonus?: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isActive?: boolean;
}

class ConferencePolicyService {
  /**
   * Get all conference incentive policies (admin only)
   */
  async getAllPolicies(): Promise<ConferenceIncentivePolicy[]> {
    const response = await api.get('/conference-policies');
    return response.data.data;
  }

  /**
   * Get active policy by conference sub-type
   */
  async getActivePolicyBySubType(subType: ConferenceSubType): Promise<ConferenceIncentivePolicy | null> {
    try {
      const response = await api.get(`/conference-policies/active/${subType}`);
      return response.data.data;
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status ===
   404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get policy by ID
   */
  async getPolicyById(id: string): Promise<ConferenceIncentivePolicy> {
    const response = await api.get(`/conference-policies/${id}`);
    return response.data.data;
  }

  /**
   * Create a new conference incentive policy (admin only)
   */
  async createPolicy(data: CreateConferencePolicyData): Promise<ConferenceIncentivePolicy> {
    const response = await api.post('/conference-policies', data);
    return response.data.data;
  }

  /**
   * Update an existing conference incentive policy (admin only)
   */
  async updatePolicy(id: string, data: Partial<CreateConferencePolicyData>): Promise<ConferenceIncentivePolicy> {
    const response = await api.put(`/conference-policies/${id}`, data);
    return response.data.data;
  }

  /**
   * Delete a conference incentive policy (admin only)
   */
  async deletePolicy(id: string): Promise<void> {
    await api.delete(`/conference-policies/${id}`);
  }
}

export const conferencePolicyService = new ConferencePolicyService();
