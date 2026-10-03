const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');
const cache = require('../../../../shared/config/redis');
const { parseGrantPolicy, sendPolicyError } = require('../../validators/incentivePolicy.validation');
const { savePolicy, policyWindowWhere } = require('../../utils/policyWindow');
const { previewDate, sendPolicyPreview } = require('../../utils/policyPreview');
const { toNumber } = require('../../utils/policyMath');

const GRANT_POLICY_INCLUDE = {
  createdBy: { select: { id: true, email: true } },
  updatedBy: { select: { id: true, email: true } },
};

// Project categories and types
const PROJECT_CATEGORIES = ['govt', 'non_govt', 'industry'];
const PROJECT_TYPES = ['indian', 'international'];

/**
 * Get all grant policies
 */
exports.getAllGrantPolicies = async (req, res) => {
  try {
    const policies = await prisma.grantIncentivePolicy.findMany({
      where: {
        isActive: true,
        ...(req.tenantId ? { universityId: req.tenantId } : {})
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      data: policies
    });
  } catch (error) {
    console.error('Get grant policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grant policies',
    });
  }
};

/**
 * Get active policy by project category and type
 */
exports.getActivePolicyByCategoryAndType = async (req, res) => {
  try {
    const { projectCategory, projectType } = req.params;
    
    if (!PROJECT_CATEGORIES.includes(projectCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid project category. Valid categories: ${PROJECT_CATEGORIES.join(', ')}`
      });
    }

    if (!PROJECT_TYPES.includes(projectType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid project type. Valid types: ${PROJECT_TYPES.join(', ')}`
      });
    }

    // ?onDate = the grant's policy date (sanction → submission → approval), default today.
    const currentDate = previewDate(req.query.onDate);
    const policy = await prisma.grantIncentivePolicy.findFirst({
      where: {
        projectCategory,
        projectType,
        ...(req.tenantId ? { universityId: req.tenantId } : {}),
        ...policyWindowWhere(currentDate)
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    // Grants have no built-in defaults: without a policy approval pays ₹0 (after confirmation).
    return sendPolicyPreview(res, {
      policy,
      reason: `No grant incentive policy covers ${projectCategory} / ${projectType} grants on this date`,
    });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    console.error('Get active grant policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active grant policy',
    });
  }
};

/**
 * Get policy by ID
 */
exports.getGrantPolicyById = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await prisma.grantIncentivePolicy.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, email: true }
        },
        updatedBy: {
          select: { id: true, email: true }
        }
      }
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Grant policy not found'
      });
    }

    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Get grant policy by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grant policy',
    });
  }
};

/**
 * Create grant policy
 */
exports.createGrantPolicy = async (req, res) => {
  try {
    const data = parseGrantPolicy(req.body);

    // Validate, reject overlap with an enabled policy for the same category/type and
    // create — in one transaction.
    const { policy } = await savePolicy({
      prisma,
      model: 'grantIncentivePolicy',
      keyWhere: { projectCategory: data.projectCategory, projectType: data.projectType },
      data,
      tenantId: req.tenantId,
      actorId: req.user.id,
      mode: 'reject',
      setUpdatedByOnCreate: true,
      include: GRANT_POLICY_INCLUDE,
    });

    await auditLogger.logPolicyCreation(policy, 'grant', req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(201).json({
      success: true,
      message: 'Grant policy created successfully',
      data: policy
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Create grant policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create grant policy',
    });
  }
};

/**
 * Update grant policy
 */
exports.updateGrantPolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const existingPolicy = await prisma.grantIncentivePolicy.findUnique({
      where: { id }
    });

    if (!existingPolicy) {
      return res.status(404).json({
        success: false,
        message: 'Grant policy not found'
      });
    }

    if (req.tenantId && existingPolicy.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This policy does not belong to your university.'
      });
    }

    const data = parseGrantPolicy(req.body, existingPolicy);
    const { policy } = await savePolicy({
      prisma,
      model: 'grantIncentivePolicy',
      keyWhere: { projectCategory: data.projectCategory, projectType: data.projectType },
      data,
      existing: existingPolicy,
      tenantId: req.tenantId,
      actorId: req.user.id,
      mode: 'reject',
      include: GRANT_POLICY_INCLUDE,
    });

    await auditLogger.logPolicyUpdate(existingPolicy, policy, 'grant', req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(200).json({
      success: true,
      message: 'Grant policy updated successfully',
      data: policy
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Update grant policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update grant policy',
    });
  }
};

/**
 * Delete grant policy
 */
exports.deleteGrantPolicy = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if policy exists
    const existingPolicy = await prisma.grantIncentivePolicy.findUnique({
      where: { id }
    });

    if (!existingPolicy) {
      return res.status(404).json({
        success: false,
        message: 'Grant policy not found'
      });
    }

    if (req.tenantId && existingPolicy.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This policy does not belong to your university.'
      });
    }

    // Soft delete by setting isActive to false
    await prisma.grantIncentivePolicy.update({
      where: { id },
      data: { isActive: false }
    });

    // Log policy deletion
    await auditLogger.logPolicyDeletion(existingPolicy, 'grant', req.user.id, req);

    // Invalidate cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(200).json({
      success: true,
      message: 'Grant policy deleted successfully'
    });
  } catch (error) {
    console.error('Delete grant policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete grant policy',
    });
  }
};

/**
 * Calculate incentive for a grant based on policy
 */
exports.calculateIncentive = async (req, res) => {
  try {
    const {
      projectCategory,
      projectType,
      submittedAmount,
      numberOfConsortiumOrgs
    } = req.body;

    // Validate required fields
    if (!projectCategory || !projectType) {
      return res.status(400).json({
        success: false,
        message: 'Project category and project type are required'
      });
    }

    // Policy in force on the grant's policy date (body.onDate), default today — same rule as approval.
    const currentDate = previewDate(req.body.onDate);
    const policy = await prisma.grantIncentivePolicy.findFirst({
      where: {
        projectCategory,
        projectType,
        ...(req.tenantId ? { universityId: req.tenantId } : {}),
        ...policyWindowWhere(currentDate)
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    if (!policy) {
      // Same as approval: no policy → ₹0 (approval then needs an explicit confirmation).
      return res.status(200).json({
        success: true,
        policyFound: false,
        reason: `No grant incentive policy covers ${projectCategory} / ${projectType} grants on this date`,
        data: {
          policyFound: false,
          baseIncentiveAmount: 0, basePoints: 0, internationalBonus: 0, consortiumBonus: 0,
          totalIncentiveAmount: 0, totalPoints: 0,
          breakdown: { base: 0, internationalBonus: 0, consortiumBonus: 0 },
          policy: null,
        },
      });
    }

    // Calculate incentives (Decimal → number before adding)
    const baseIncentiveAmount = toNumber(policy.baseIncentiveAmount);
    const basePoints = toNumber(policy.basePoints);

    // Calculate bonuses
    let internationalBonus = 0;
    if (projectType === 'international' && policy.internationalBonus) {
      internationalBonus = toNumber(policy.internationalBonus);
    }

    let consortiumBonus = 0;
    const consortiumOrgs = toNumber(numberOfConsortiumOrgs);
    if (consortiumOrgs > 0 && policy.consortiumBonus) {
      consortiumBonus = toNumber(policy.consortiumBonus) * consortiumOrgs;
    }

    // Total calculation
    const totalIncentiveAmount = baseIncentiveAmount + internationalBonus + consortiumBonus;
    const totalPoints = basePoints;

    const calculation = {
      policyFound: true,
      baseIncentiveAmount,
      basePoints,
      internationalBonus,
      consortiumBonus,
      totalIncentiveAmount,
      totalPoints,
      breakdown: {
        base: baseIncentiveAmount,
        internationalBonus,
        consortiumBonus
      },
      policy: {
        id: policy.id,
        policyName: policy.policyName,
        splitPolicy: policy.splitPolicy,
        rolePercentages: policy.rolePercentages
      }
    };

    res.status(200).json({
      success: true,
      policyFound: true,
      data: calculation
    });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    console.error('Calculate grant incentive error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate grant incentive',
    });
  }
};
