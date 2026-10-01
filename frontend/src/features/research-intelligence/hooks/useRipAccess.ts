import { useQuery } from '@tanstack/react-query';
import { researchIntelligenceService } from '../services/researchIntelligence.service';
import type { RipAccess, RipPermissionKey } from '../types';

export const RIP_ACCESS_QUERY_KEY = ['research-intelligence', 'access'] as const;

/**
 * The signed-in user's Research Intelligence access: whether their university has the module
 * and which capabilities they hold. Cached for 5 minutes; failures resolve to "no access".
 */
export function useRipAccess({ enabled = true }: { enabled?: boolean } = {}) {
  const query = useQuery<RipAccess>({
    queryKey: RIP_ACCESS_QUERY_KEY,
    queryFn: () => researchIntelligenceService.getMyAccess(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const can = (key: RipPermissionKey) => !!query.data?.enabled && !!query.data.permissions?.[key];
  return { ...query, moduleEnabled: !!query.data?.enabled, can };
}
