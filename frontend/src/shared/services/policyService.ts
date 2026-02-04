import api from '@/shared/api/api';
import logger from '@/shared/utils/logger';

interface IPRPolicy {
  id?: number;
  iprType: string;
  policyName?: string;
  baseIncentiveAmount: number;
  basePoints: number;
  splitPolicy: string;
  primaryInventorShare?: number;
  filingTypeMultiplier?: any;
  projectTypeBonus?: any;
  isActive?: boolean;
  effectiveFrom?: string;
  isDefault?: boolean;
}

/**
 * Get active incentive policy for a specific IPR type
 */
export const getPolicyByType = async (iprType: string): Promise<IPRPolicy> => {
  try {
    const response = await api.get(`/incentive-policies/type/${iprType}`);
    
    if (response.data.success) {
      return response.data.data;
    }
    
    // Return default if API fails
    return getDefaultPolicy(iprType);
  } catch (error) {
    logger.error(`Failed to fetch ${iprType} policy:`, error);
    // Return default policy on error
    return getDefaultPolicy(iprType);
  }
};

/**
 * Get default policy values (fallback)
 */
const getDefaultPolicy = (iprType: string): IPRPolicy => {
  const defaults: Record<string, IPRPolicy> = {
    patent: { 
      iprType: 'patent',
      baseIncentiveAmount: 50000, 
      basePoints: 50, 
      splitPolicy: 'equal',
      isDefault: true
    },
    copyright: { 
      iprType: 'copyright',
      baseIncentiveAmount: 15000, 
      basePoints: 20, 
      splitPolicy: 'equal',
      isDefault: true
    },
    trademark: { 
      iprType: 'trademark',
      baseIncentiveAmount: 10000, 
      basePoints: 15, 
      splitPolicy: 'equal',
      isDefault: true
    },
    design: { 
      iprType: 'design',
      baseIncentiveAmount: 20000, 
      basePoints: 25, 
      splitPolicy: 'equal',
      isDefault: true
    }
  };
  
  return defaults[iprType.toLowerCase()] || defaults.patent;
};

/**
 * Calculate incentive for specific contributor
 */
export const calculateContributorIncentive = (
  policy: IPRPolicy,
  employeeCategory: string,
  employeeType: string
): { incentive: number; points: number } => {
  const baseIncentive = policy.baseIncentiveAmount;
  const basePoints = policy.basePoints;
  
  // External contributors get no incentive or points
  if (employeeCategory === 'external') {
    return { incentive: 0, points: 0 };
  }
  
  // Students get only incentives, no points
  if (employeeType === 'student') {
    return { incentive: baseIncentive, points: 0 };
  }
  
  // Staff/Faculty get both
  return { incentive: baseIncentive, points: basePoints };
};

export default {
  getPolicyByType,
  calculateContributorIncentive,
};
