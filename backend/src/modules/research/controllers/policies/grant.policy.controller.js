const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');
const cache = require('../../../../shared/config/redis');

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
      error: error.message
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

    const currentDate = new Date();
    const policy = await prisma.grantIncentivePolicy.findFirst({
      where: {
        projectCategory,
        projectType,
        isActive: true,
        ...(req.tenantId ? { universityId: req.tenantId } : {}),
        effectiveFrom: { lte: currentDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: currentDate } }
        ]
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: `No active policy found for ${projectCategory} ${projectType} grants`
      });
    }

    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Get active grant policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active grant policy',
      error: error.message
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
      error: error.message
    });
  }
};

/**
 * Create grant policy
 */
exports.createGrantPolicy = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      policyName,
      projectCategory,
      projectType,
      baseIncentiveAmount,
      basePoints,
      splitPolicy,
      rolePercentages,
      fundingAmountMultiplier,
      internationalBonus,
      consortiumBonus,
      effectiveFrom,
      effectiveTo
    } = req.body;

    // Validation
    if (!policyName || !projectCategory || !projectType || !baseIncentiveAmount || basePoints === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Policy name, project category, project type, base incentive amount, and base points are required'
      });
    }

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

    if (!['equal', 'percentage_based'].includes(splitPolicy)) {
      return res.status(400).json({
        success: false,
        message: 'Split policy must be either "equal" or "percentage_based"'
      });
    }

    // If percentage-based, validate role percentages
    if (splitPolicy === 'percentage_based') {
      if (!rolePercentages || !Array.isArray(rolePercentages)) {
        return res.status(400).json({
          success: false,
          message: 'Role percentages are required for percentage-based split policy'
        });
      }

      const totalPercentage = rolePercentages.reduce((sum, rp) => sum + rp.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Role percentages must total 100%. Current total: ${totalPercentage}%`
        });
      }
    }

    const policy = await prisma.grantIncentivePolicy.create({
      data: {
        policyName,
        projectCategory,
        projectType,
        baseIncentiveAmount,
        basePoints,
        splitPolicy,
        rolePercentages: rolePercentages || [],
        fundingAmountMultiplier: fundingAmountMultiplier || {},
        internationalBonus: internationalBonus || 10000,
        consortiumBonus: consortiumBonus || 5000,
        isActive: true,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        createdById: userId,
        updatedById: userId,
        ...(req.tenantId ? { universityId: req.tenantId } : {})
      },
      include: {
        createdBy: { select: { id: true, email: true } },
        updatedBy: { select: { id: true, email: true } }
      }
    });

    // Log policy creation
    await auditLogger.logPolicyCreation(policy, 'grant', req.user.id, req);

    // Invalidate cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(201).json({
      success: true,
      message: 'Grant policy created successfully',
      data: policy
    });
  } catch (error) {
    console.error('Create grant policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create grant policy',
      error: error.message
    });
  }
};

/**
 * Update grant policy
 */
exports.updateGrantPolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      policyName,
      projectCategory,
      projectType,
      baseIncentiveAmount,
      basePoints,
      splitPolicy,
      rolePercentages,
      fundingAmountMultiplier,
      internationalBonus,
      consortiumBonus,
      isActive,
      effectiveFrom,
      effectiveTo
    } = req.body;

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

    // Validation
    if (projectCategory && !PROJECT_CATEGORIES.includes(projectCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid project category. Valid categories: ${PROJECT_CATEGORIES.join(', ')}`
      });
    }

    if (projectType && !PROJECT_TYPES.includes(projectType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid project type. Valid types: ${PROJECT_TYPES.join(', ')}`
      });
    }

    if (splitPolicy && !['equal', 'percentage_based'].includes(splitPolicy)) {
      return res.status(400).json({
        success: false,
        message: 'Split policy must be either "equal" or "percentage_based"'
      });
    }

    // If percentage-based, validate role percentages
    if (splitPolicy === 'percentage_based' && rolePercentages) {
      if (!Array.isArray(rolePercentages)) {
        return res.status(400).json({
          success: false,
          message: 'Role percentages must be an array'
        });
      }

      const totalPercentage = rolePercentages.reduce((sum, rp) => sum + rp.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Role percentages must total 100%. Current total: ${totalPercentage}%`
        });
      }
    }

    const updateData = {
      updatedById: userId
    };

    if (policyName !== undefined) updateData.policyName = policyName;
    if (projectCategory !== undefined) updateData.projectCategory = projectCategory;
    if (projectType !== undefined) updateData.projectType = projectType;
    if (baseIncentiveAmount !== undefined) updateData.baseIncentiveAmount = baseIncentiveAmount;
    if (basePoints !== undefined) updateData.basePoints = basePoints;
    if (splitPolicy !== undefined) updateData.splitPolicy = splitPolicy;
    if (rolePercentages !== undefined) updateData.rolePercentages = rolePercentages;
    if (fundingAmountMultiplier !== undefined) updateData.fundingAmountMultiplier = fundingAmountMultiplier;
    if (internationalBonus !== undefined) updateData.internationalBonus = internationalBonus;
    if (consortiumBonus !== undefined) updateData.consortiumBonus = consortiumBonus;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (effectiveFrom !== undefined) updateData.effectiveFrom = new Date(effectiveFrom);
    if (effectiveTo !== undefined) updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;

    const policy = await prisma.grantIncentivePolicy.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, email: true } },
        updatedBy: { select: { id: true, email: true } }
      }
    });

    // Log policy update
    await auditLogger.logPolicyUpdate(existingPolicy, policy, 'grant', req.user.id, req);

    // Invalidate cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(200).json({
      success: true,
      message: 'Grant policy updated successfully',
      data: policy
    });
  } catch (error) {
    console.error('Update grant policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update grant policy',
      error: error.message
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
      error: error.message
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

    // Get active policy for the given category and type
    const currentDate = new Date();
    const policy = await prisma.grantIncentivePolicy.findFirst({
      where: {
        projectCategory,
        projectType,
        isActive: true,
        ...(req.tenantId ? { universityId: req.tenantId } : {}),
        effectiveFrom: { lte: currentDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: currentDate } }
        ]
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: `No active policy found for ${projectCategory} ${projectType} grants`
      });
    }

    // Calculate incentives
    const baseIncentiveAmount = parseFloat(policy.baseIncentiveAmount.toString());
    const basePoints = policy.basePoints;
    
    // Calculate bonuses
    let internationalBonus = 0;
    if (projectType === 'international' && policy.internationalBonus) {
      internationalBonus = parseFloat(policy.internationalBonus.toString());
    }
    
    let consortiumBonus = 0;
    if (numberOfConsortiumOrgs && numberOfConsortiumOrgs > 0 && policy.consortiumBonus) {
      consortiumBonus = parseFloat(policy.consortiumBonus.toString()) * numberOfConsortiumOrgs;
    }

    // Total calculation
    const totalIncentiveAmount = baseIncentiveAmount + internationalBonus + consortiumBonus;
    const totalPoints = basePoints;

    const calculation = {
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
      data: calculation
    });
  } catch (error) {
    console.error('Calculate grant incentive error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate grant incentive',
      error: error.message
    });
  }
};
