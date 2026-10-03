const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');
const cache = require('../../../../shared/config/redis');
const { previewDate, sendPolicyPreview } = require('../../utils/policyPreview');
const { DEFAULT_BOOK_POLICY } = require('../../services/incentive-calculator');
const { parseBookPolicy, sendPolicyError } = require('../../validators/incentivePolicy.validation');
const { savePolicy, policyWindowWhere } = require('../../utils/policyWindow');

/**
 * Get all book chapter policies
 */
exports.getAllBookChapterPolicies = async (req, res) => {
  try {
    const policies = await prisma.bookChapterIncentivePolicy.findMany({
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
      data: policies.map((p) => ({ ...p, publicationType: 'book_chapter' }))
    });
  } catch (error) {
    console.error('Get book chapter policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch book chapter policies',
    });
  }
};

/**
 * Get active policy for current date
 */
exports.getActivePolicy = async (req, res) => {
  try {
    const now = previewDate(req.query.publicationDate);

    const policy = await prisma.bookChapterIncentivePolicy.findFirst({
      where: {
        ...(req.tenantId ? { universityId: req.tenantId } : {}),
        ...policyWindowWhere(now)
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    // Without a policy the calculator pays the built-in defaults — preview exactly those.
    return sendPolicyPreview(res, {
      policy: policy && { ...policy, publicationType: 'book_chapter' },
      defaultPolicy: { ...DEFAULT_BOOK_POLICY, publicationType: 'book_chapter' },
    });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    console.error('Get active book chapter policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active book chapter policy',
    });
  }
};

/**
 * Create new book chapter policy
 */
exports.createBookChapterPolicy = async (req, res) => {
  try {
    const data = parseBookPolicy(req.body);

    // Validate, reject any overlap with an enabled policy (including engulfing windows),
    // and create — in one transaction.
    const { policy } = await savePolicy({
      prisma,
      model: 'bookChapterIncentivePolicy',
      data,
      tenantId: req.tenantId,
      actorId: req.user.id,
      mode: 'reject',
      setUpdatedByOnCreate: true,
    });

    await auditLogger.logPolicyCreation(policy, 'book_chapter', req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(201).json({
      success: true,
      message: 'Book chapter policy created successfully',
      data: { ...policy, publicationType: 'book_chapter' }
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Create book chapter policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create book chapter policy',
    });
  }
};

/**
 * Update book chapter policy
 */
exports.updateBookChapterPolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const existingPolicy = await prisma.bookChapterIncentivePolicy.findUnique({
      where: { id }
    });

    if (!existingPolicy) {
      return res.status(404).json({
        success: false,
        message: 'Book chapter policy not found'
      });
    }

    if (req.tenantId && existingPolicy.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This policy does not belong to your university.'
      });
    }

    // Only known fields reach the update (no mass assignment), validated on the merged policy.
    const data = parseBookPolicy(req.body, existingPolicy);
    const { policy } = await savePolicy({
      prisma,
      model: 'bookChapterIncentivePolicy',
      data,
      existing: existingPolicy,
      tenantId: req.tenantId,
      actorId: req.user.id,
      mode: 'reject',
    });

    await auditLogger.logPolicyUpdate(existingPolicy, policy, 'book_chapter', req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(200).json({
      success: true,
      message: 'Book chapter policy updated successfully',
      data: { ...policy, publicationType: 'book_chapter' }
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Update book chapter policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update book chapter policy',
    });
  }
};

/**
 * Delete book chapter policy
 */
exports.deleteBookChapterPolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await prisma.bookChapterIncentivePolicy.findUnique({
      where: { id }
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Book chapter policy not found'
      });
    }

    if (req.tenantId && policy.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This policy does not belong to your university.'
      });
    }

    await prisma.bookChapterIncentivePolicy.delete({
      where: { id }
    });

    // Log policy deletion
    await auditLogger.logPolicyDeletion(policy, 'book_chapter', req.user.id, req);

    // Invalidate cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(200).json({
      success: true,
      message: 'Book chapter policy deleted successfully'
    });
  } catch (error) {
    console.error('Delete book chapter policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete book chapter policy',
    });
  }
};

/**
 * Get book chapter policy by ID
 */
exports.getBookChapterPolicyById = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await prisma.bookChapterIncentivePolicy.findUnique({
      where: { id },
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
      }
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Book chapter policy not found'
      });
    }

    if (req.tenantId && policy.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This policy does not belong to your university.'
      });
    }

    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Get book chapter policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch book chapter policy',
    });
  }
};
