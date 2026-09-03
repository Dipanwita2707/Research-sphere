const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');
const cache = require('../../../../shared/config/redis');

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
      data: policies
    });
  } catch (error) {
    console.error('Get book chapter policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch book chapter policies',
      error: error.message
    });
  }
};

/**
 * Get active policy for current date
 */
exports.getActivePolicy = async (req, res) => {
  try {
    const now = new Date();
    
    const policy = await prisma.bookChapterIncentivePolicy.findFirst({
      where: {
        isActive: true,
        ...(req.tenantId ? { universityId: req.tenantId } : {}),
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } }
        ]
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'No active book chapter policy found'
      });
    }

    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Get active book chapter policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active book chapter policy',
      error: error.message
    });
  }
};

/**
 * Create new book chapter policy
 */
exports.createBookChapterPolicy = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      policyName,
      authoredIncentiveAmount,
      authoredPoints,
      editedIncentiveAmount,
      editedPoints,
      splitPolicy,
      indexingBonuses,
      internationalBonus,
      effectiveFrom,
      effectiveTo
    } = req.body;

    // Validate required fields
    if (!policyName || !authoredIncentiveAmount || !authoredPoints || 
        !editedIncentiveAmount || !editedPoints || !splitPolicy || !effectiveFrom) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check for overlapping active policies
    const overlapping = await prisma.bookChapterIncentivePolicy.findFirst({
      where: {
        isActive: true,
        ...(req.tenantId ? { universityId: req.tenantId } : {}),
        OR: [
          {
            AND: [
              { effectiveFrom: { lte: new Date(effectiveFrom) } },
              { OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date(effectiveFrom) } }
              ]}
            ]
          },
          effectiveTo && {
            AND: [
              { effectiveFrom: { lte: new Date(effectiveTo) } },
              { OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date(effectiveTo) } }
              ]}
            ]
          }
        ].filter(Boolean)
      }
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: 'Another active book chapter policy already exists for this date range'
      });
    }

    const policy = await prisma.bookChapterIncentivePolicy.create({
      data: {
        policyName,
        authoredIncentiveAmount: parseFloat(authoredIncentiveAmount),
        authoredPoints: parseInt(authoredPoints),
        editedIncentiveAmount: parseFloat(editedIncentiveAmount),
        editedPoints: parseInt(editedPoints),
        splitPolicy,
        indexingBonuses: indexingBonuses || { 
          scopus_indexed: 10000, 
          non_indexed: 0, 
          sgt_publication_house: 2000 
        },
        internationalBonus: internationalBonus ? parseFloat(internationalBonus) : 5000,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        createdById: userId,
        updatedById: userId,
        ...(req.tenantId ? { universityId: req.tenantId } : {})
      }
    });

    // Log policy creation
    await auditLogger.logPolicyCreation(policy, 'book_chapter', req.user.id, req);

    // Invalidate cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(201).json({
      success: true,
      message: 'Book chapter policy created successfully',
      data: policy
    });
  } catch (error) {
    console.error('Create book chapter policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create book chapter policy',
      error: error.message
    });
  }
};

/**
 * Update book chapter policy
 */
exports.updateBookChapterPolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = { ...req.body, updatedById: userId };

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

    // Convert numeric fields if present
    if (updateData.authoredIncentiveAmount) {
      updateData.authoredIncentiveAmount = parseFloat(updateData.authoredIncentiveAmount);
    }
    if (updateData.authoredPoints) {
      updateData.authoredPoints = parseInt(updateData.authoredPoints);
    }
    if (updateData.editedIncentiveAmount) {
      updateData.editedIncentiveAmount = parseFloat(updateData.editedIncentiveAmount);
    }
    if (updateData.editedPoints) {
      updateData.editedPoints = parseInt(updateData.editedPoints);
    }
    if (updateData.internationalBonus) {
      updateData.internationalBonus = parseFloat(updateData.internationalBonus);
    }
    if (updateData.effectiveFrom) {
      updateData.effectiveFrom = new Date(updateData.effectiveFrom);
    }
    if (updateData.effectiveTo) {
      updateData.effectiveTo = new Date(updateData.effectiveTo);
    }

    const policy = await prisma.bookChapterIncentivePolicy.update({
      where: { id },
      data: updateData
    });

    // Log policy update
    await auditLogger.logPolicyUpdate(existingPolicy, policy, 'book_chapter', req.user.id, req);

    // Invalidate cache
    await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);

    res.status(200).json({
      success: true,
      message: 'Book chapter policy updated successfully',
      data: policy
    });
  } catch (error) {
    console.error('Update book chapter policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update book chapter policy',
      error: error.message
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
      error: error.message
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
            firstName: true,
            lastName: true,
            email: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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
      error: error.message
    });
  }
};
