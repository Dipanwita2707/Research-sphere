const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');
const cache = require('../../../../shared/config/redis');

// Conference sub-types
const CONFERENCE_SUB_TYPES = [
  'paper_indexed_scopus',
  'paper_not_indexed',
  'keynote_speaker_invited_talks',
  'organizer_coordinator_member'
];

/**
 * Get all conference policies
 */
exports.getAllConferencePolicies = async (req, res) => {
  try {
    const policies = await prisma.conferenceIncentivePolicy.findMany({
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
    console.error('Get conference policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conference policies',
      error: error.message
    });
  }
};

/**
 * Get active policy by conference sub-type
 */
exports.getActivePolicyBySubType = async (req, res) => {
  try {
    const { subType } = req.params;
    
    if (!CONFERENCE_SUB_TYPES.includes(subType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid conference sub-type. Valid types: ${CONFERENCE_SUB_TYPES.join(', ')}`
      });
    }

    const currentDate = new Date();
    const policy = await prisma.conferenceIncentivePolicy.findFirst({
      where: {
        conferenceSubType: subType,
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
        message: `No active policy found for conference sub-type: ${subType}`
      });
    }

    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Get active conference policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active conference policy',
      error: error.message
    });
  }
};

/**
 * Get policy by ID
 */
exports.getConferencePolicyById = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await prisma.conferenceIncentivePolicy.findUnique({
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
        message: 'Conference policy not found'
      });
    }

    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Get conference policy by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conference policy',
      error: error.message
    });
  }
};

/**
 * Create conference policy
 */
exports.createConferencePolicy = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      policyName,
      conferenceSubType,
      quartileIncentives,
      rolePercentages,
      flatIncentiveAmount,
      flatPoints,
      splitPolicy,
      internationalBonus,
      bestPaperAwardBonus,
      effectiveFrom,
      effectiveTo
    } = req.body;

    // Validate required fields
    if (!policyName || !conferenceSubType) {
      return res.status(400).json({
        success: false,
        message: 'Policy name and conference sub-type are required'
      });
    }

    if (!CONFERENCE_SUB_TYPES.includes(conferenceSubType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid conference sub-type. Valid types: ${CONFERENCE_SUB_TYPES.join(', ')}`
      });
    }

    // For paper_indexed_scopus, require quartile incentives
    if (conferenceSubType === 'paper_indexed_scopus') {
      if (!quartileIncentives || !Array.isArray(quartileIncentives) || quartileIncentives.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Quartile incentives are required for Scopus-indexed conference papers'
        });
      }
    } else {
      // For other types, require flat incentive
      if (flatIncentiveAmount === undefined || flatPoints === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Flat incentive amount and points are required for this conference type'
        });
      }
    }

    // Check for overlapping active policies
    const effectiveFromDate = new Date(effectiveFrom || new Date());
    const effectiveToDate = effectiveTo ? new Date(effectiveTo) : null;

    const overlapping = await prisma.conferenceIncentivePolicy.findFirst({
      where: {
        conferenceSubType,
        isActive: true,
        ...(req.tenantId ? { universityId: req.tenantId } : {}),
        OR: [
          {
            AND: [
              { effectiveFrom: { lte: effectiveFromDate } },
              {
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: effectiveFromDate } }
                ]
              }
            ]
          },
          effectiveToDate ? {
            AND: [
              { effectiveFrom: { lte: effectiveToDate } },
              {
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: effectiveFromDate } }
                ]
              }
            ]
          } : {}
        ]
      }
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: 'An active policy already exists for this conference type and date range'
      });
    }

    const policy = await prisma.conferenceIncentivePolicy.create({
      data: {
        policyName,
        conferenceSubType,
        quartileIncentives: conferenceSubType === 'paper_indexed_scopus' ? quartileIncentives : [],
        rolePercentages: rolePercentages || [],
        flatIncentiveAmount: conferenceSubType !== 'paper_indexed_scopus' ? parseFloat(flatIncentiveAmount) : null,
        flatPoints: conferenceSubType !== 'paper_indexed_scopus' ? parseInt(flatPoints) : null,
        splitPolicy: splitPolicy || 'equal',
        internationalBonus: parseFloat(internationalBonus) || 5000,
        bestPaperAwardBonus: parseFloat(bestPaperAwardBonus) || 5000,
        effectiveFrom: effectiveFromDate,
        effectiveTo: effectiveToDate,
        createdById: userId,
        isActive: true,
        ...(req.tenantId ? { universityId: req.tenantId } : {})
      }
    });

    // Log policy creation
    await auditLogger.logPolicyCreation(policy, 'conference', req.user.id, req);

    // Invalidate policy cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(201).json({
      success: true,
      message: 'Conference policy created successfully',
      data: policy
    });
  } catch (error) {
    console.error('Create conference policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conference policy',
      error: error.message
    });
  }
};

/**
 * Update conference policy
 */
exports.updateConferencePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      policyName,
      quartileIncentives,
      rolePercentages,
      flatIncentiveAmount,
      flatPoints,
      splitPolicy,
      internationalBonus,
      bestPaperAwardBonus,
      effectiveFrom,
      effectiveTo,
      isActive
    } = req.body;

    const existingPolicy = await prisma.conferenceIncentivePolicy.findUnique({
      where: { id }
    });

    if (!existingPolicy) {
      return res.status(404).json({
        success: false,
        message: 'Conference policy not found'
      });
    }

    if (req.tenantId && existingPolicy.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This policy does not belong to your university.'
      });
    }

    const updateData = {
      updatedById: userId,
      updatedAt: new Date()
    };

    if (policyName !== undefined) updateData.policyName = policyName;
    if (quartileIncentives !== undefined) updateData.quartileIncentives = quartileIncentives;
    if (rolePercentages !== undefined) updateData.rolePercentages = rolePercentages;
    if (flatIncentiveAmount !== undefined) updateData.flatIncentiveAmount = parseFloat(flatIncentiveAmount);
    if (flatPoints !== undefined) updateData.flatPoints = parseInt(flatPoints);
    if (splitPolicy !== undefined) updateData.splitPolicy = splitPolicy;
    if (internationalBonus !== undefined) updateData.internationalBonus = parseFloat(internationalBonus);
    if (bestPaperAwardBonus !== undefined) updateData.bestPaperAwardBonus = parseFloat(bestPaperAwardBonus);
    if (effectiveFrom !== undefined) updateData.effectiveFrom = new Date(effectiveFrom);
    if (effectiveTo !== undefined) updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const policy = await prisma.conferenceIncentivePolicy.update({
      where: { id },
      data: updateData
    });

    // Log policy update
    await auditLogger.logPolicyUpdate(existingPolicy, policy, 'conference', req.user.id, req);

    // Invalidate policy cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(200).json({
      success: true,
      message: 'Conference policy updated successfully',
      data: policy
    });
  } catch (error) {
    console.error('Update conference policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update conference policy',
      error: error.message
    });
  }
};

/**
 * Delete conference policy
 */
exports.deleteConferencePolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const existingPolicy = await prisma.conferenceIncentivePolicy.findUnique({
      where: { id }
    });

    if (!existingPolicy) {
      return res.status(404).json({
        success: false,
        message: 'Conference policy not found'
      });
    }

    if (req.tenantId && existingPolicy.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This policy does not belong to your university.'
      });
    }

    await prisma.conferenceIncentivePolicy.delete({
      where: { id }
    });

    // Log policy deletion
    await auditLogger.logPolicyDeletion(existingPolicy, 'conference', req.user.id, req);

    // Invalidate policy cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(200).json({
      success: true,
      message: 'Conference policy deleted successfully'
    });
  } catch (error) {
    console.error('Delete conference policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conference policy',
      error: error.message
    });
  }
};
