const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');
const cache = require('../../../../shared/config/redis');
const { previewDate, sendPolicyPreview } = require('../../utils/policyPreview');
const { defaultConferencePolicy } = require('../../services/incentive-calculator');
const { parseConferencePolicy, sendPolicyError } = require('../../validators/incentivePolicy.validation');
const { savePolicy, policyWindowWhere } = require('../../utils/policyWindow');

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

    const currentDate = previewDate(req.query.publicationDate);
    const policy = await prisma.conferenceIncentivePolicy.findFirst({
      where: {
        conferenceSubType: subType,
        ...(req.tenantId ? { universityId: req.tenantId } : {}),
        ...policyWindowWhere(currentDate)
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    // Without a policy the calculator pays the built-in defaults — preview exactly those.
    return sendPolicyPreview(res, { policy, defaultPolicy: defaultConferencePolicy(subType) });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    console.error('Get active conference policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active conference policy',
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
    });
  }
};

/**
 * Create conference policy
 */
exports.createConferencePolicy = async (req, res) => {
  try {
    const data = parseConferencePolicy(req.body);

    // Validate, reject overlap with an enabled policy of the same sub-type (engulfing
    // windows included) and create — in one transaction.
    const { policy } = await savePolicy({
      prisma,
      model: 'conferenceIncentivePolicy',
      keyWhere: { conferenceSubType: data.conferenceSubType },
      data,
      tenantId: req.tenantId,
      actorId: req.user.id,
      mode: 'reject',
    });

    await auditLogger.logPolicyCreation(policy, 'conference', req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(201).json({
      success: true,
      message: 'Conference policy created successfully',
      data: policy
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Create conference policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conference policy',
    });
  }
};

/**
 * Update conference policy
 */
exports.updateConferencePolicy = async (req, res) => {
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

    const data = parseConferencePolicy(req.body, existingPolicy);
    const { policy } = await savePolicy({
      prisma,
      model: 'conferenceIncentivePolicy',
      keyWhere: { conferenceSubType: existingPolicy.conferenceSubType },
      data,
      existing: existingPolicy,
      tenantId: req.tenantId,
      actorId: req.user.id,
      mode: 'reject',
    });

    await auditLogger.logPolicyUpdate(existingPolicy, policy, 'conference', req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(200).json({
      success: true,
      message: 'Conference policy updated successfully',
      data: policy
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Update conference policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update conference policy',
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
    });
  }
};
