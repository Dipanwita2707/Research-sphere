const prisma = require('../../../../shared/config/database');
const auditLogger = require('../../../../shared/utils/auditLogger');

/**
 * Get all book incentive policies
 * Accessible by: admin
 */
exports.getAllBookPolicies = async (req, res) => {
  try {
    const policies = await prisma.bookIncentivePolicy.findMany({
      where: {
        isActive: true
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
      data: policies
    });
  } catch (error) {
    console.error('Get all book policies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch book policies',
      error: error.message
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
    
    const policy = await prisma[modelName].findFirst({
      where: {
        isActive: true,
        effectiveFrom: {
          lte: new Date()
        },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } }
        ]
      },
      orderBy: {
        effectiveFrom: 'desc'
      }
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: `No active policy found for ${publicationType}`
      });
    }

    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Get active policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policy',
      error: error.message
    });
  }
};

/**
 * Create a new book incentive policy
 * Accessible by: admin
 */
exports.createBookPolicy = async (req, res) => {
  try {
    const {
      publicationType,
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

    // Validation
    if (!['book', 'book_chapter'].includes(publicationType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid publication type. Must be "book" or "book_chapter"'
      });
    }

    if (!policyName || !authoredIncentiveAmount || !editedIncentiveAmount) {
      return res.status(400).json({
        success: false,
        message: 'Policy name, authored incentive, and edited incentive are required'
      });
    }

    // Choose the correct model based on publication type
    const modelName = publicationType === 'book' ? 'bookIncentivePolicy' : 'bookChapterIncentivePolicy';

    // Check for overlapping active policies
    const existingPolicies = await prisma[modelName].findMany({
      where: {
        isActive: true,
        OR: [
          {
            AND: [
              { effectiveFrom: { lte: new Date(effectiveFrom || new Date()) } },
              {
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: new Date(effectiveFrom || new Date()) } }
                ]
              }
            ]
          }
        ]
      }
    });

    if (existingPolicies.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An active policy already exists for this publication type and date range'
      });
    }

    // Create the policy
    const policy = await prisma[modelName].create({
      data: {
        policyName,
        authoredIncentiveAmount: parseFloat(authoredIncentiveAmount),
        authoredPoints: parseInt(authoredPoints) || 0,
        editedIncentiveAmount: parseFloat(editedIncentiveAmount),
        editedPoints: parseInt(editedPoints) || 0,
        splitPolicy: splitPolicy || 'equal',
        indexingBonuses: indexingBonuses || {
          scopus_indexed: 10000,
          non_indexed: 0,
          sgt_publication_house: 2000
        },
        internationalBonus: internationalBonus ? parseFloat(internationalBonus) : 5000,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        createdById: req.user.id
      }
    });

    // Log policy creation
    await auditLogger.logPolicyCreation(policy, 'book', req.user.id, req);

    res.status(201).json({
      success: true,
      message: 'Book policy created successfully',
      data: policy
    });
  } catch (error) {
    console.error('Create book policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create book policy',
      error: error.message
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
    const {
      policyName,
      authoredIncentiveAmount,
      authoredPoints,
      editedIncentiveAmount,
      editedPoints,
      splitPolicy,
      indexingBonuses,
      internationalBonus,
      isActive,
      effectiveFrom,
      effectiveTo
    } = req.body;

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

    // Build update data
    const updateData = {
      updatedById: req.user.id
    };

    if (policyName !== undefined) updateData.policyName = policyName;
    if (authoredIncentiveAmount !== undefined) updateData.authoredIncentiveAmount = parseFloat(authoredIncentiveAmount);
    if (authoredPoints !== undefined) updateData.authoredPoints = parseInt(authoredPoints);
    if (editedIncentiveAmount !== undefined) updateData.editedIncentiveAmount = parseFloat(editedIncentiveAmount);
    if (editedPoints !== undefined) updateData.editedPoints = parseInt(editedPoints);
    if (splitPolicy !== undefined) updateData.splitPolicy = splitPolicy;
    if (indexingBonuses !== undefined) updateData.indexingBonuses = indexingBonuses;
    if (internationalBonus !== undefined) updateData.internationalBonus = parseFloat(internationalBonus);
    if (isActive !== undefined) updateData.isActive = isActive;
    if (effectiveFrom !== undefined) updateData.effectiveFrom = new Date(effectiveFrom);
    if (effectiveTo !== undefined) updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;

    // Update the policy
    const updatedPolicy = await prisma.bookIncentivePolicy.update({
      where: { id },
      data: updateData
    });

    // Log policy update
    await auditLogger.logPolicyUpdate(existingPolicy, updatedPolicy, 'book', req.user.id, req);

    res.status(200).json({
      success: true,
      message: 'Book policy updated successfully',
      data: updatedPolicy
    });
  } catch (error) {
    console.error('Update book policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update book policy',
      error: error.message
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

    // Delete the policy
    await prisma.bookIncentivePolicy.delete({
      where: { id }
    });

    // Log policy deletion
    await auditLogger.logPolicyDeletion(existingPolicy, 'book', req.user.id, req);

    res.status(200).json({
      success: true,
      message: 'Book policy deleted successfully'
    });
  } catch (error) {
    console.error('Delete book policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete book policy',
      error: error.message
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

    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    console.error('Get book policy by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policy',
      error: error.message
    });
  }
};
