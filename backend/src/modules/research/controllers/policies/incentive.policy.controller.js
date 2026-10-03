const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');
const cache = require('../../../../shared/config/redis');
const { parseIprPolicy, sendPolicyError } = require('../../validators/incentivePolicy.validation');
const { savePolicy, policyWindowWhere } = require('../../utils/policyWindow');
const { toNumber } = require('../../utils/policyMath');
const { previewDate, sendPolicyPreview } = require('../../utils/policyPreview');
const { DEFAULT_INCENTIVE_POLICIES, resolveIprPolicy, computeIprIncentive } = require('../../utils/iprIncentive');

/**
 * Get all incentive policies
 * Accessible by: admin
 */
exports.getAllPolicies = async (req, res) => {
  try {
    // TODO: IncentivePolicy model not yet implemented in schema
    // Return empty array until migration is complete
    if (!prisma.incentivePolicy) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'IPR Incentive Policy feature not yet configured'
      });
    }
    
    const { includeInactive } = req.query;
    
    const whereClause = includeInactive === 'true' ? {} : { isActive: true };
    
    const policies = await prisma.incentivePolicy.findMany({
      where: {
        ...whereClause,
        ...(req.tenantId ? { universityId: req.tenantId } : {})
      },
      include: {
        createdBy: {
          select: {
            uid: true,
            employeeDetails: {
              select: { displayName: true }
            }
          }
        },
        updatedBy: {
          select: {
            uid: true,
            employeeDetails: {
              select: { displayName: true }
            }
          }
        }
      },
      orderBy: [
        { iprType: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: policies
    });
  } catch (error) {
    console.error('Get all policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch incentive policies'
    });
  }
};

/**
 * Get active policy for a specific IPR type
 * Accessible by: all authenticated users
 */
exports.getPolicyByType = async (req, res) => {
  try {
    const { iprType } = req.params;
    const onDate = previewDate(req.query.onDate);

    const policy = await prisma.incentivePolicy.findFirst({
      where: {
        iprType: iprType.toLowerCase(),
        // Enabled and in force on the date (default today) — the rule publication uses
        ...policyWindowWhere(onDate),
        ...(req.tenantId ? { universityId: req.tenantId } : {})
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    // Publication pays the built-in IPR defaults when no policy applies — preview exactly those.
    return sendPolicyPreview(res, {
      policy,
      defaultPolicy: { iprType, ...(DEFAULT_INCENTIVE_POLICIES[iprType.toLowerCase()] || DEFAULT_INCENTIVE_POLICIES.patent) },
    });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    console.error('Get policy by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch incentive policy'
    });
  }
};

const IPR_POLICY_INCLUDE = {
  createdBy: { select: { uid: true, employeeDetails: { select: { displayName: true } } } },
  updatedBy: { select: { uid: true, employeeDetails: { select: { displayName: true } } } },
};

/**
 * Create a new incentive policy
 * Accessible by: admin only
 *
 * One transaction: validate, close the previous enabled policy of the same IPR type the day
 * before the new one starts (or replace it when the new window covers it entirely), create.
 * isActive is the admin's switch; which policy applies is decided by its effective window.
 */
exports.createPolicy = async (req, res) => {
  try {
    const data = parseIprPolicy(req.body);
    const { policy, adjusted } = await savePolicy({
      prisma,
      model: 'incentivePolicy',
      keyWhere: { iprType: data.iprType },
      data,
      tenantId: req.tenantId,
      actorId: req.user.id,
      mode: 'supersede',
      include: IPR_POLICY_INCLUDE,
    });

    await auditLogger.logPolicyCreation(policy, 'incentive', req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(201).json({
      success: true,
      message: 'Incentive policy created successfully',
      data: policy,
      adjustedPolicies: adjusted,
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Create policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create incentive policy'
    });
  }
};

/**
 * Update an existing incentive policy
 * Accessible by: admin only
 */
exports.updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const existingPolicy = await prisma.incentivePolicy.findUnique({
      where: { id }
    });

    if (!existingPolicy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
    }

    if (req.tenantId && existingPolicy.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This policy does not belong to your university.'
      });
    }

    // Same rules as create on the merged policy; effectiveFrom/effectiveTo are honoured.
    const data = parseIprPolicy(req.body, existingPolicy);
    const { policy, adjusted } = await savePolicy({
      prisma,
      model: 'incentivePolicy',
      keyWhere: { iprType: existingPolicy.iprType },
      data,
      existing: existingPolicy,
      tenantId: req.tenantId,
      actorId: req.user.id,
      mode: 'supersede',
      include: IPR_POLICY_INCLUDE,
    });

    await auditLogger.logPolicyUpdate(existingPolicy, policy, 'incentive', req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.json({
      success: true,
      message: 'Incentive policy updated successfully',
      data: policy,
      adjustedPolicies: adjusted,
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Update policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update incentive policy'
    });
  }
};

/**
 * Delete an incentive policy
 * Accessible by: admin only
 */
exports.deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const existingPolicy = await prisma.incentivePolicy.findUnique({
      where: { id }
    });

    if (!existingPolicy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
    }

    if (req.tenantId && existingPolicy.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This policy does not belong to your university.'
      });
    }

    await prisma.incentivePolicy.delete({
      where: { id }
    });

    // Log policy deletion
    await auditLogger.logPolicyDeletion(existingPolicy, 'incentive', req.user.id, req);

    // Invalidate policy cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.json({
      success: true,
      message: 'Incentive policy deleted successfully'
    });
  } catch (error) {
    console.error('Delete policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete incentive policy'
    });
  }
};

/**
 * Calculate incentive for an IPR application
 * Uses active policy or defaults
 */
exports.calculateIncentive = async (req, res) => {
  try {
    const { iprType, filingType, projectType, inventorCount } = req.body;

    if (!iprType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide iprType'
      });
    }

    // Exactly what publication pays: the policy in force (built-in defaults when none),
    // base amount split equally among inventors. filingType/projectType are accepted for
    // compatibility but publication does not apply multipliers or bonuses.
    const { policy, usedDefaultPolicy } = await resolveIprPolicy(prisma, iprType, previewDate(req.body.onDate));
    const result = computeIprIncentive(policy, inventorCount || 1);

    res.json({
      success: true,
      policyFound: true,
      usedDefaultPolicy,
      data: {
        ...result,
        splitPolicy: 'equal',
        policyApplied: !usedDefaultPolicy,
        policyFound: true,
        usedDefaultPolicy,
        ...(filingType || projectType ? { note: 'Filing-type multipliers and project-type bonuses are not applied at publication.' } : {}),
      }
    });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    console.error('Calculate incentive error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate incentive'
    });
  }
};
