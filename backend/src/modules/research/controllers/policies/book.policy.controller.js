const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');
const cache = require('../../../../shared/config/redis');
const { previewDate, sendPolicyPreview } = require('../../utils/policyPreview');
const { DEFAULT_BOOK_POLICY } = require('../../services/incentive-calculator');
const { parseBookPolicy, parseBookPublicationType, sendPolicyError } = require('../../validators/incentivePolicy.validation');
const { savePolicy, policyWindowWhere } = require('../../utils/policyWindow');

/**
 * Get all book incentive policies
 * Accessible by: admin
 */
exports.getAllBookPolicies = async (req, res) => {
  try {
    const policies = await prisma.bookIncentivePolicy.findMany({
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
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      // The admin UI reads publicationType when editing a row.
      data: policies.map((p) => ({ ...p, publicationType: 'book' }))
    });
  } catch (error) {
    console.error('Get all book policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch book policies',
    });
  }
};

/**
 * Get active policy for a specific publication type
 * Accessible by: admin, faculty
 */
exports.getActivePolicyByType = async (req, res) => {
  try {
    const { publicationType } = req.params;

    if (!['book', 'book_chapter'].includes(publicationType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid publication type. Must be "book" or "book_chapter"'
      });
    }

    // Choose the correct model based on publication type
    const modelName = publicationType === 'book' ? 'bookIncentivePolicy' : 'bookChapterIncentivePolicy';
    
    const onDate = previewDate(req.query.publicationDate);
    const policy = await prisma[modelName].findFirst({
      where: {
        ...(req.tenantId ? { universityId: req.tenantId } : {}),
        ...policyWindowWhere(onDate)
      },
      orderBy: {
        effectiveFrom: 'desc'
      }
    });

    // Without a policy the calculator pays the built-in defaults — preview exactly those.
    return sendPolicyPreview(res, {
      policy: policy && { ...policy, publicationType },
      defaultPolicy: { ...DEFAULT_BOOK_POLICY, publicationType },
    });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    console.error('Get active policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policy',
    });
  }
};

/**
 * Create a new book incentive policy
 * Accessible by: admin
 */
exports.createBookPolicy = async (req, res) => {
  try {
    const publicationType = parseBookPublicationType(req.body.publicationType);
    const data = parseBookPolicy(req.body);
    const modelName = publicationType === 'book' ? 'bookIncentivePolicy' : 'bookChapterIncentivePolicy';

    // Validate, reject any overlap with an enabled policy (including windows that engulf
    // or sit inside the new one), and create — in one transaction.
    const { policy } = await savePolicy({
      prisma,
      model: modelName,
      data,
      tenantId: req.tenantId,
      actorId: req.user.id,
      mode: 'reject',
    });

    await auditLogger.logPolicyCreation(policy, publicationType, req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(201).json({
      success: true,
      message: 'Book policy created successfully',
      data: { ...policy, publicationType }
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Create book policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create book policy',
    });
  }
};

/**
 * Update a book incentive policy
 * Accessible by: admin
 */
exports.updateBookPolicy = async (req, res) => {
  try {
    const { id } = req.params;

    const existingPolicy = await prisma.bookIncentivePolicy.findUnique({
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

    // Same rules as create, applied to the merged (stored + changed) policy.
    const data = parseBookPolicy(req.body, existingPolicy);
    const { policy: updatedPolicy } = await savePolicy({
      prisma,
      model: 'bookIncentivePolicy',
      data,
      existing: existingPolicy,
      tenantId: req.tenantId,
      actorId: req.user.id,
      mode: 'reject',
    });

    await auditLogger.logPolicyUpdate(existingPolicy, updatedPolicy, 'book', req.user.id, req);
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(200).json({
      success: true,
      message: 'Book policy updated successfully',
      data: { ...updatedPolicy, publicationType: 'book' }
    });
  } catch (error) {
    if (sendPolicyError(res, error)) return;
    console.error('Update book policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update book policy',
    });
  }
};

/**
 * Delete a book incentive policy
 * Accessible by: admin
 */
exports.deleteBookPolicy = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if policy exists
    const existingPolicy = await prisma.bookIncentivePolicy.findUnique({
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

    // Delete the policy
    await prisma.bookIncentivePolicy.delete({
      where: { id }
    });

    // Log policy deletion
    await auditLogger.logPolicyDeletion(existingPolicy, 'book', req.user.id, req);

    // Invalidate cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(200).json({
      success: true,
      message: 'Book policy deleted successfully'
    });
  } catch (error) {
    console.error('Delete book policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete book policy',
    });
  }
};

/**
 * Get policy by ID
 * Accessible by: admin
 */
exports.getBookPolicyById = async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await prisma.bookIncentivePolicy.findUnique({
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
        message: 'Policy not found'
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
      data: { ...policy, publicationType: 'book' }
    });
  } catch (error) {
    console.error('Get book policy by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policy',
    });
  }
};
