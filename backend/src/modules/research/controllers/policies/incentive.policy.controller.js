const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');
const cache = require('../../../../shared/config/redis');

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
      where: whereClause,
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
    
    const policy = await prisma.incentivePolicy.findFirst({
      where: {
        iprType: iprType.toLowerCase(),
        isActive: true
      }
    });

    if (!policy) {
      // Return default policy if none exists
      const defaultPolicies = {
        patent: { baseIncentiveAmount: 50000, basePoints: 50, splitPolicy: 'equal' },
        copyright: { baseIncentiveAmount: 15000, basePoints: 20, splitPolicy: 'equal' },
        trademark: { baseIncentiveAmount: 10000, basePoints: 15, splitPolicy: 'equal' },
        design: { baseIncentiveAmount: 20000, basePoints: 25, splitPolicy: 'equal' }
      };
      
      return res.json({
        success: true,
        data: {
          iprType,
          ...defaultPolicies[iprType.toLowerCase()] || defaultPolicies.patent,
          isDefault: true
        }
      });
    }

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Get policy by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch incentive policy'
    });
  }
};

/**
 * Create a new incentive policy
 * Accessible by: admin only
 */
exports.createPolicy = async (req, res) => {
  try {
    const {
      iprType,
      policyName,
      baseIncentiveAmount,
      basePoints,
      splitPolicy,
      primaryInventorShare,
      filingTypeMultiplier,
      projectTypeBonus,
      isActive,
      effectiveFrom
    } = req.body;

    // Validate required fields
    if (!iprType || !policyName || baseIncentiveAmount === undefined || basePoints === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide iprType, policyName, baseIncentiveAmount, and basePoints'
      });
    }

    // If creating an active policy, deactivate existing active policy for same type
    if (isActive !== false) {
      await prisma.incentivePolicy.updateMany({
        where: {
          iprType: iprType.toLowerCase(),
          isActive: true
        },
        data: {
          isActive: false,
          effectiveTo: new Date()
        }
      });
    }

    const policy = await prisma.incentivePolicy.create({
      data: {
        iprType: iprType.toLowerCase(),
        policyName,
        baseIncentiveAmount,
        basePoints,
        splitPolicy: splitPolicy || 'equal',
        primaryInventorShare,
        filingTypeMultiplier,
        projectTypeBonus,
        isActive: isActive !== false,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        createdById: req.user.id
      },
      include: {
        createdBy: {
          select: {
            uid: true,
            employeeDetails: {
              select: { displayName: true }
            }
          }
        }
      }
    });

    // Log policy creation
    await auditLogger.logPolicyCreation(policy, 'incentive', req.user.id, req);

    // Invalidate policy cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(201).json({
      success: true,
      message: 'Incentive policy created successfully',
      data: policy
    });
  } catch (error) {
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
    const {
      policyName,
      baseIncentiveAmount,
      basePoints,
      splitPolicy,
      primaryInventorShare,
      filingTypeMultiplier,
      projectTypeBonus,
      isActive
    } = req.body;

    const existingPolicy = await prisma.incentivePolicy.findUnique({
      where: { id }
    });

    if (!existingPolicy) {
      return res.status(404).json({
        success: false,
        message: 'Policy not found'
      });
    }

    // If activating this policy, deactivate other active policies for same type
    if (isActive === true && !existingPolicy.isActive) {
      await prisma.incentivePolicy.updateMany({
        where: {
          iprType: existingPolicy.iprType,
          isActive: true,
          id: { not: id }
        },
        data: {
          isActive: false,
          effectiveTo: new Date()
        }
      });
    }

    const policy = await prisma.incentivePolicy.update({
      where: { id },
      data: {
        policyName,
        baseIncentiveAmount,
        basePoints,
        splitPolicy,
        primaryInventorShare,
        filingTypeMultiplier,
        projectTypeBonus,
        isActive,
        updatedById: req.user.id
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
      }
    });

    // Log policy update
    await auditLogger.logPolicyUpdate(existingPolicy, policy, 'incentive', req.user.id, req);

    // Invalidate policy cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.json({
      success: true,
      message: 'Incentive policy updated successfully',
      data: policy
    });
  } catch (error) {
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

    // Get active policy for the IPR type
    let policy = await prisma.incentivePolicy.findFirst({
      where: {
        iprType: iprType.toLowerCase(),
        isActive: true
      }
    });

    // Use default if no policy exists
    const defaultPolicies = {
      patent: { baseIncentiveAmount: 50000, basePoints: 50, splitPolicy: 'equal' },
      copyright: { baseIncentiveAmount: 15000, basePoints: 20, splitPolicy: 'equal' },
      trademark: { baseIncentiveAmount: 10000, basePoints: 15, splitPolicy: 'equal' },
      design: { baseIncentiveAmount: 20000, basePoints: 25, splitPolicy: 'equal' }
    };

    if (!policy) {
      policy = {
        ...defaultPolicies[iprType.toLowerCase()] || defaultPolicies.patent,
        filingTypeMultiplier: null,
        projectTypeBonus: null,
        splitPolicy: 'equal'
      };
    }

    let totalIncentive = Number(policy.baseIncentiveAmount);
    let totalPoints = policy.basePoints;

    // Apply filing type multiplier
    if (filingType && policy.filingTypeMultiplier) {
      const multiplier = policy.filingTypeMultiplier[filingType] || 1;
      totalIncentive *= multiplier;
    }

    // Apply project type bonus
    if (projectType && policy.projectTypeBonus) {
      const bonus = policy.projectTypeBonus[projectType] || 0;
      totalIncentive += bonus;
    }

    // Calculate per-inventor share
    const count = inventorCount || 1;
    let perInventorIncentive = totalIncentive;
    let perInventorPoints = totalPoints;

    if (policy.splitPolicy === 'equal' && count > 1) {
      perInventorIncentive = Math.floor(totalIncentive / count);
      perInventorPoints = Math.floor(totalPoints / count);
    } else if (policy.splitPolicy === 'primary_inventor' && policy.primaryInventorShare && count > 1) {
      const primaryShare = Number(policy.primaryInventorShare) / 100;
      const remainingShare = (1 - primaryShare) / (count - 1);
      // Returns primary inventor's share
      perInventorIncentive = Math.floor(totalIncentive * primaryShare);
      perInventorPoints = Math.floor(totalPoints * primaryShare);
    }

    res.json({
      success: true,
      data: {
        totalIncentive,
        totalPoints,
        perInventorIncentive,
        perInventorPoints,
        inventorCount: count,
        splitPolicy: policy.splitPolicy,
        policyApplied: !!policy.id
      }
    });
  } catch (error) {
    console.error('Calculate incentive error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate incentive'
    });
  }
};
