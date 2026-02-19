const prisma = require('../../../shared/config/database');
const reportingStructureService = require('../services/reportingStructure.service');

/**
 * Get full reporting hierarchy tree
 * Shows the complete organizational reporting structure
 * 
 * @route GET /api/reporting-structure/tree
 * @access Protected - Admin or users with view_reporting_structure permission
 */
exports.getHierarchyTree = async (req, res) => {
  try {
    const tree = await reportingStructureService.getHierarchyTree();

    res.status(200).json({
      success: true,
      data: tree,
    });
  } catch (error) {
    console.error('Get hierarchy tree error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching hierarchy tree',
    });
  }
};

/**
 * Get reporting chain for a specific user
 * Returns the user's manager and all ancestors up to the top
 * 
 * @route GET /api/reporting-structure/chain/:userId
 * @access Protected
 */
exports.getReportingChain = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check authorization - user can view their own chain, or admin can view any
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this reporting chain',
      });
    }

    const chain = await reportingStructureService.getReportingChain(userId);

    res.status(200).json({
      success: true,
      data: chain,
    });
  } catch (error) {
    console.error('Get reporting chain error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching reporting chain',
    });
  }
};

/**
 * Get direct manager for a user
 * Returns the immediate supervisor
 * 
 * @route GET /api/reporting-structure/manager/:userId
 * @access Protected
 */
exports.getDirectManager = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check authorization
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this information',
      });
    }

    const manager = await reportingStructureService.getDirectManager(userId);

    res.status(200).json({
      success: true,
      data: manager,
    });
  } catch (error) {
    console.error('Get direct manager error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching manager',
    });
  }
};

/**
 * Assign reporting manager to a user
 * Sets who a user reports to in the hierarchy
 * 
 * @route POST /api/reporting-structure/assign
 * @access Protected - Admin or users with manage_reporting_structure permission
 */
exports.assignReportingManager = async (req, res) => {
  try {
    const { userId, managerId } = req.body;

    if (!userId || !managerId) {
      return res.status(400).json({
        success: false,
        message: 'Both userId and managerId are required',
      });
    }

    // Prevent self-reporting
    if (userId === managerId) {
      return res.status(400).json({
        success: false,
        message: 'A user cannot report to themselves',
      });
    }

    // Check for circular dependency
    const hasCircular = await reportingStructureService.checkCircularDependency(
      userId,
      managerId
    );

    if (hasCircular) {
      return res.status(400).json({
        success: false,
        message: 'This assignment would create a circular reporting chain',
      });
    }

    // Get createdById from authenticated user or use userId as fallback
    const createdById = req.user?.id || userId;

    // Set the reporting relationship
    const result = await reportingStructureService.setReportingManager(userId, managerId, createdById);

    console.log('✅ Reporting relationship created:', {
      userId,
      managerId,
      createdById,
      resultId: result?.id
    });

    res.status(200).json({
      success: true,
      data: result,
      message: 'Reporting relationship assigned successfully',
    });
  } catch (error) {
    console.error('Assign reporting manager error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error assigning reporting relationship',
    });
  }
};

/**
 * Assign multi-level manager chain (up to 5 levels)
 * Creates complete reporting hierarchy: Employee → L1 → L2 → L3 → L4 → L5
 * 
 * @route POST /api/reporting-structure/assign-chain
 * @access Protected - Admin only
 */
exports.assignManagerChain = async (req, res) => {
  try {
    const { userId, managerChain } = req.body;

    if (!userId || !Array.isArray(managerChain) || managerChain.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID and manager chain array are required',
      });
    }

    if (managerChain.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 hierarchy levels allowed',
      });
    }

    // Validate no duplicates in chain
    const uniqueManagers = new Set(managerChain);
    if (uniqueManagers.size !== managerChain.length) {
      return res.status(400).json({
        success: false,
        message: 'Cannot select the same person in multiple levels',
      });
    }

    // Validate employee not in their own chain
    if (managerChain.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Employee cannot be in their own reporting chain',
      });
    }

    // Get createdById from authenticated user
    const createdById = req.user?.id || userId;

    // Call service to create the hierarchy
    const result = await reportingStructureService.assignManagerChain(userId, managerChain, createdById);

    console.log('✅ Manager chain created:', {
      userId,
      levels: managerChain.length,
      created: result.created,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: `Successfully created ${managerChain.length}-level reporting hierarchy`,
    });
  } catch (error) {
    console.error('Assign manager chain error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error assigning manager chain',
    });
  }
};

/**
 * Remove reporting relationship
 * Removes a user from the reporting hierarchy
 * 
 * @route DELETE /api/reporting-structure/:userId
 * @access Protected - Admin or users with manage_reporting_structure permission
 */
exports.removeReportingRelationship = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user has subordinates
    const subordinates = await prisma.reportingStructure.findMany({
      where: { managerId: userId },
    });

    if (subordinates.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove user with active subordinates. Reassign subordinates first.',
      });
    }

    // Delete the reporting relationship
    await prisma.reportingStructure.delete({
      where: { userId },
    });

    res.status(200).json({
      success: true,
      message: 'Reporting relationship removed successfully',
    });
  } catch (error) {
    console.error('Remove reporting relationship error:', error);

    // Handle case where no relationship exists
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'No reporting relationship found for this user',
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error removing reporting relationship',
    });
  }
};

/**
 * Get all subordinates of a user
 * Returns direct and indirect reports
 * 
 * @route GET /api/reporting-structure/subordinates/:userId
 * @access Protected
 */
exports.getSubordinates = async (req, res) => {
  try {
    const { userId } = req.params;
    const { direct } = req.query; // If true, only get direct reports

    // Check authorization
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this information',
      });
    }

    let subordinates;

    if (direct === 'true') {
      // Get only direct reports
      subordinates = await prisma.reportingStructure.findMany({
        where: { managerId: userId },
        include: {
          user: {
            select: {
              id: true,
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                  empId: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Get all subordinates (would need to implement recursive query)
      // For now, just return direct reports
      subordinates = await prisma.reportingStructure.findMany({
        where: { managerId: userId },
        include: {
          user: {
            select: {
              id: true,
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                  empId: true,
                },
              },
            },
          },
        },
      });
    }

    res.status(200).json({
      success: true,
      data: subordinates,
    });
  } catch (error) {
    console.error('Get subordinates error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching subordinates',
    });
  }
};

/**
 * Bulk import reporting structure from CSV/JSON
 * Allows admin to upload complete hierarchy
 * 
 * @route POST /api/reporting-structure/bulk-import
 * @access Protected - Admin only
 */
exports.bulkImportReportingStructure = async (req, res) => {
  try {
    const { relationships } = req.body; // Array of {userId, managerId}

    if (!Array.isArray(relationships) || relationships.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Relationships array is required',
      });
    }

    const results = {
      success: [],
      failed: [],
    };

    // Process each relationship
    for (const rel of relationships) {
      try {
        const { userId, managerId } = rel;

        // Validate
        if (!userId || !managerId) {
          results.failed.push({ ...rel, reason: 'Missing userId or managerId' });
          continue;
        }

        if (userId === managerId) {
          results.failed.push({ ...rel, reason: 'User cannot report to themselves' });
          continue;
        }

        // Check circular dependency
        const hasCircular = await reportingStructureService.checkCircularDependency(
          userId,
          managerId
        );

        if (hasCircular) {
          results.failed.push({ ...rel, reason: 'Circular dependency detected' });
          continue;
        }

        // Get createdById from authenticated user or use userId as fallback
        const createdById = req.user?.id || userId;

        // Assign
        await reportingStructureService.setReportingManager(userId, managerId, createdById);
        results.success.push(rel);
      } catch (error) {
        results.failed.push({ ...rel, reason: error.message });
      }
    }

    res.status(200).json({
      success: true,
      data: results,
      message: `Processed ${relationships.length} relationships. ${results.success.length} succeeded, ${results.failed.length} failed.`,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during bulk import',
    });
  }
};
