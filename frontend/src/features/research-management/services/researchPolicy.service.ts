import api from '@/shared/api/api';

// Quartile-based incentive structure (mandatory)
export interface QuartileIncentive {
  quartile: 'Top 1%' | 'Top 5%' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
  incentiveAmount: number;
  points: number;
}

// SJR range-based incentive structure
export interface SJRRange {
  id?: string;
  minSJR: number;
  maxSJR: number;
  incentiveAmount: number;
  points: number;
}

export interface RolePercentage {
  role: string;
  percentage: number;
}

// Position-based incentive structure (for author_position_based distribution)
export interface PositionPercentage {
  position: number; // 1-5 (6+ gets 0%)
  percentage: number;
}

// Distribution method determines how incentives are split among authors
export type DistributionMethod = 'author_role_based' | 'author_position_based';

// Indexing categories for research papers (multi-select) - 11 Target Research Categories
export type IndexingCategory =
  | 'nature_science_lancet_cell_nejm'    // 1. Nature/Science/The Lancet/Cell/NEJM
  | 'subsidiary_if_above_20'              // 2. Subsidiary journals (IF > 20) - requires impact factor
  | 'scopus'                              // 3. SCOPUS - requires quartile + impact factor
  | 'scie_wos'                            // 4. SCIE/SCI (WOS) - requires SJR
  | 'pubmed'                              // 5. PubMed
  | 'naas_rating_6_plus'                  // 6. NAAS (Rating ≥ 6) - requires rating
  | 'abdc_scopus_wos'                     // 7. ABDC Journals indexed in SCOPUS/WOS
  | 'sgtu_in_house'                       // 9. ResearchSphere In-House Journal
  | 'case_centre_uk';                     // 10. The Case Centre UK

// Category metadata defining required sub-fields for each category
export interface CategoryMetadata {
  value: IndexingCategory;
  label: string;
  description: string;
  requiredFields?: ('quartile' | 'impactFactor' | 'sjr' | 'naasRating' | 'subsidiaryImpactFactor')[];
  nestedIncentives?: boolean; // true if this category has nested incentive structures
  validationRules?: {
    field: string;
    min?: number;
    max?: number;
    message: string;
  }[];
}

export const INDEXING_CATEGORIES: CategoryMetadata[] = [
  { 
    value: 'nature_science_lancet_cell_nejm', 
    label: 'Nature/Science/The Lancet/Cell/NEJM', 
    description: 'Top-tier journals (Nature, Science, The Lancet, Cell, NEJM)',
    nestedIncentives: false
  },
  { 
    value: 'subsidiary_if_above_20', 
    label: 'Subsidiary Journals (IF > 20)', 
    description: 'High impact subsidiary journals of Nature/Science/Cell/The Lancet',
    requiredFields: ['subsidiaryImpactFactor'],
    nestedIncentives: false,
    validationRules: [
      { field: 'subsidiaryImpactFactor', min: 20.01, message: 'Impact Factor must be greater than 20' }
    ]
  },
  { 
    value: 'scopus', 
    label: 'SCOPUS', 
    description: 'SCOPUS indexed journals',
    requiredFields: ['quartile', 'impactFactor'],
    nestedIncentives: true // Has quartile-based nested incentives
  },
  { 
    value: 'scie_wos', 
    label: 'SCIE/SCI (WOS)', 
    description: 'Web of Science - SCIE/SCI indexed',
    requiredFields: ['sjr'],
    nestedIncentives: true // Has SJR-based nested incentives
  },
  { 
    value: 'pubmed', 
    label: 'PubMed', 
    description: 'PubMed indexed',
    nestedIncentives: false
  },
  { 
    value: 'naas_rating_6_plus', 
    label: 'NAAS (Rating ≥ 6)', 
    description: 'NAAS rating 6 or above',
    requiredFields: ['naasRating'],
    nestedIncentives: true, // Has rating-based nested incentives
    validationRules: [
      { field: 'naasRating', min: 6, message: 'NAAS Rating must be 6 or above' }
    ]
  },
  { 
    value: 'abdc_scopus_wos', 
    label: 'ABDC Journals (SCOPUS/WOS)', 
    description: 'ABDC journals indexed in SCOPUS/WOS as per guidelines',
    nestedIncentives: false
  },
  { 
    value: 'sgtu_in_house', 
    label: 'ResearchSphere In-House Journal', 
    description: 'ResearchSphere in-house publications',
    nestedIncentives: false
  },
  { 
    value: 'case_centre_uk', 
    label: 'The Case Centre UK', 
    description: 'Case studies published in The Case Centre UK',
    nestedIncentives: false
  },
];

// Indexing category bonus structure - for FLAT categories (no sub-fields)
export interface IndexingCategoryBonus {
  category: string; // e.g., 'pubmed', 'ugc', 'nature_science_lancet_cell_nejm', etc.
  incentiveAmount: number;
  points: number;
}

// SCOPUS category nested incentive structure (quartile-based)
export interface ScopusQuartileIncentive {
  quartile: 'Top 1%' | 'Top 5%' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
  incentiveAmount: number;
  points: number;
}

// WOS/SCIE category nested incentive structure (SJR-based)
export interface WosSjrIncentive {
  minSJR: number;
  maxSJR: number;
  incentiveAmount: number;
  points: number;
}

// NAAS category nested incentive structure (rating-based)
export interface NaasRatingIncentive {
  minRating: number;
  maxRating: number;
  incentiveAmount: number;
  points: number;
}

// Nested incentives for categories with sub-fields
export interface NestedCategoryIncentives {
  // SCOPUS uses quartile-based incentives
  scopusQuartileIncentives?: ScopusQuartileIncentive[];
  // WOS/SCIE uses SJR-based incentives
  wosSjrIncentives?: WosSjrIncentive[];
  // NAAS uses rating-based incentives
  naasRatingIncentives?: NaasRatingIncentive[];
}

export interface QuartileBonuses {
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  [key: string]: number | undefined;
}

export interface IndexingBonuses {
  // Legacy flat bonuses
  scopus?: number;
  wos?: number;
  sci?: number;
  pubmed?: number;
  ieee?: number;
  quartileBonuses?: QuartileBonuses;
  
  // NEW: Flat category bonuses (for categories without sub-fields)
  indexingCategoryBonuses?: IndexingCategoryBonus[];
  
  // NEW: Nested category incentives (for categories with sub-fields)
  nestedCategoryIncentives?: NestedCategoryIncentives;
  
  // Distribution percentages
  quartileIncentives?: QuartileIncentive[];
  sjrRanges?: SJRRange[];
  rolePercentages?: RolePercentage[];
  positionPercentages?: PositionPercentage[];
  
  [key: string]: number | QuartileBonuses | QuartileIncentive[] | SJRRange[] | RolePercentage[] | PositionPercentage[] | IndexingCategoryBonus[] | NestedCategoryIncentives | undefined;
}

export interface ResearchIncentivePolicy {
  id: string;
  publicationType: string;
  policyName: string;
  baseIncentiveAmount: number;
  basePoints: number;
  splitPolicy: 'percentage_based' | 'equal' | 'author_role_based' | 'weighted';
  distributionMethod?: DistributionMethod;
  primaryAuthorShare?: number;
  // Deprecated fields
  authorTypeMultipliers?: Record<string, number>;
  indexingBonuses?: IndexingBonuses;
  quartileBonuses?: QuartileBonuses;
  impactFactorTiers?: Array<{
    minIF: number;
    maxIF: number | null;
    bonus: number;
  }>;
  isActive: boolean;
  isDefault?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    uid: string;
    employeeDetails?: { displayName: string };
  };
  updatedBy?: {
    uid: string;
    employeeDetails?: { displayName: string };
  };
}

export interface CreateResearchPolicyData {
  publicationType: string;
  policyName: string;
  baseIncentiveAmount: number;
  basePoints: number;
  splitPolicy?: 'percentage_based' | 'equal' | 'author_role_based' | 'weighted';
  distributionMethod?: DistributionMethod;
  primaryAuthorShare?: number;
  // Deprecated fields
  authorTypeMultipliers?: Record<string, number>;
  indexingBonuses?: IndexingBonuses;
  quartileBonuses?: QuartileBonuses;
  impactFactorTiers?: Array<{
    minIF: number;
    maxIF: number | null;
    bonus: number;
  }>;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isActive?: boolean;
}

class ResearchPolicyService {
  /**
   * Get all research incentive policies (admin only)
   */
  async getAllPolicies(includeInactive = false): Promise<ResearchIncentivePolicy[]> {
    const response = await api.get('/research-policies', {
      params: { includeInactive }
    });
    return response.data.data;
  }

  /**
   * Get policy by publication type
   */
  async getPolicyByType(publicationType: string): Promise<ResearchIncentivePolicy> {
    const response = await api.get(`/research-policies/type/${publicationType}`);
    return response.data.data;
  }

  /**
   * Create a new research incentive policy (admin only)
   */
  async createPolicy(data: CreateResearchPolicyData): Promise<ResearchIncentivePolicy> {
    const response = await api.post('/research-policies', data);
    return response.data.data;
  }

  /**
   * Update an existing research incentive policy (admin only)
   */
  async updatePolicy(id: string, data: Partial<CreateResearchPolicyData>): Promise<ResearchIncentivePolicy> {
    const response = await api.put(`/research-policies/${id}`, data);
    return response.data.data;
  }

  /**
   * Delete a research incentive policy (admin only)
   */
  async deletePolicy(id: string): Promise<void> {
    await api.delete(`/research-policies/${id}`);
  }
}

export const researchPolicyService = new ResearchPolicyService();
