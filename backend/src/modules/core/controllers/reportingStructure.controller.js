const prisma = require('../../../shared/config/database');
const reportingStructureService = require('../services/reportingStructure.service');
const cachedDataService = require('../services/cachedData.service');

function parseDepartmentContext(source = {}, { required = false } = {}) {
  const rawScope = typeof source.departmentScope === 'string'
    ? source.departmentScope.trim().toLowerCase()
    : '';
  const rawDepartmentId = typeof source.departmentId === 'string'
    ? source.departmentId.trim()
    : '';

  const hasScope = rawScope.length > 0;
  const hasDepartmentId = rawDepartmentId.length > 0;

  if (!hasScope && !hasDepartmentId) {
    if (required) {
      throw new Error('departmentScope and departmentId are required');
    }
    return null;
  }

  if (hasScope !== hasDepartmentId) {
    throw new Error('departmentScope and departmentId must be provided together');
  }

  if (!['school', 'central'].includes(rawScope)) {
    throw new Error('departmentScope must be either "school" or "central"');
  }

  return {
    departmentScope: rawScope,
    departmentId: rawDepartmentId,
  };
}

function isContextValidationError(error) {
  const message = error?.message || '';
  return /departmentScope|departmentId|Department context/i.test(message);
}

/**
 * Get department options for reporting structure (school + central)
 *
 * @route GET /api/reporting-structure/departments
 * @access Protected
 */
exports.getDepartmentOptions = async (req, res) => {
  try {
    const withHierarchyOnly = String(req.query?.withHierarchyOnly || '').toLowerCase() === 'true';

    const [schoolDepartments, centralDepartments] = await Promise.all([
      cachedDataService.getDepartments(),
      cachedDataService.getCentralDepartments(),
    ]);

    const schoolDepartmentIdsWithHierarchy = new Set();
    const centralDepartmentIdsWithHierarchy = new Set();

    if (withHierarchyOnly) {
      const hierarchyUsers = await prisma.reportingStructure.findMany({
        where: {
          isActive: true,
          departmentScope: { not: null },
          departmentId: { not: null },
        },
        select: {
          departmentScope: true,
          departmentId: true,
        },
      });

      for (const row of hierarchyUsers) {
        if (row.departmentScope === 'school' && row.departmentId) {
          schoolDepartmentIdsWithHierarchy.add(row.departmentId);
        }
        if (row.departmentScope === 'central' && row.departmentId) {
          centralDepartmentIdsWithHierarchy.add(row.departmentId);
        }
      }
    }

    const schoolOptions = (schoolDepartments || [])
      .filter((department) => !withHierarchyOnly || schoolDepartmentIdsWithHierarchy.has(department.id))
      .map((department) => ({
      id: department.id,
      scope: 'school',
      name: department.departmentName,
      code: department.departmentCode,
      shortName: department.shortName || null,
      facultyId: department.facultyId || null,
      facultyName: department.faculty?.facultyName || null,
      departmentType: null,
      displayLabel: `${department.departmentName}${department.departmentCode ? ` (${department.departmentCode})` : ''}`,
    }));

    const centralOptions = (centralDepartments || [])
      .filter((department) => !withHierarchyOnly || centralDepartmentIdsWithHierarchy.has(department.id))
      .map((department) => ({
      id: department.id,
      scope: 'central',
      name: department.departmentName,
      code: department.departmentCode,
      shortName: null,
      facultyId: null,
      facultyName: null,
      departmentType: department.departmentType || null,
      displayLabel: `${department.departmentName}${department.departmentCode ? ` (${department.departmentCode})` : ''}`,
    }));

    const options = [...schoolOptions, ...centralOptions].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    res.status(200).json({
      success: true,
      data: options,
    });
  } catch (error) {
    console.error('Get reporting department options error:', error);
    res.status(isContextValidationError(error) ? 400 : 500).json({
      success: false,
      message: error.message || 'Server error fetching department options',
    });
  }
};

/**
 * Get full reporting hierarchy tree
 * Shows the complete organizational reporting structure
 * 
 * @route GET /api/reporting-structure/tree
 * @access Protected - Admin or users with view_reporting_structure permission
 */
exports.getHierarchyTree = async (req, res) => {
  try {
    const context = parseDepartmentContext(req.query, { required: false });
    const tree = await reportingStructureService.getHierarchyTree(context);

    res.status(200).json({
      success: true,
      data: tree,
    });
  } catch (error) {
    console.error('Get hierarchy tree error:', error);
    res.status(isContextValidationError(error) ? 400 : 500).json({
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
    const context = parseDepartmentContext(req.query, { required: false });

    // Check authorization - user can view their own chain, or admin can view any
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this reporting chain',
      });
    }

    const chain = await reportingStructureService.getReportingChain(userId, context);

    res.status(200).json({
      success: true,
      data: chain,
    });
  } catch (error) {
    console.error('Get reporting chain error:', error);
    res.status(isContextValidationError(error) ? 400 : 500).json({
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
    const context = parseDepartmentContext(req.query, { required: false });

    // Check authorization
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this information',
      });
    }

    const manager = await reportingStructureService.getDirectManager(userId, context);

    res.status(200).json({
      success: true,
      data: manager,
    });
  } catch (error) {
    console.error('Get direct manager error:', error);
    res.status(isContextValidationError(error) ? 400 : 500).json({
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
    const context = parseDepartmentContext(req.body, { required: true });

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
      managerId,
      context,
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
    const result = await reportingStructureService.setReportingManager(userId, managerId, createdById, context);

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

    const isValidationError = [
      'circular reporting',
      'cannot report to themselves',
      'Manager not found',
      'departmentScope',
      'departmentId',
    ].some(msg => error.message?.toLowerCase().includes(msg.toLowerCase()));

    res.status(isValidationError ? 400 : 500).json({
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
    const context = parseDepartmentContext(req.body, { required: true });

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
    const result = await reportingStructureService.assignManagerChain(userId, managerChain, createdById, context);

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

    // Return 400 for known validation errors instead of 500
    const isValidationError = [
      'circular reporting',
      'cannot report to themselves',
      'do not exist',
      'Maximum 5 hierarchy',
      'User ID and manager chain',
      'departmentScope',
      'departmentId',
    ].some(msg => error.message?.toLowerCase().includes(msg.toLowerCase()));

    res.status(isValidationError ? 400 : 500).json({
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
    const context = parseDepartmentContext(req.query, { required: true });

    // Delegates to service: subordinates are automatically re-parented to the
    // deleted user's own manager rather than blocking with a 400 error.
    await reportingStructureService.deleteReportingRelationship(userId, context);

    res.status(200).json({
      success: true,
      message: 'Reporting relationship removed successfully',
    });
  } catch (error) {
    console.error('Remove reporting relationship error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'No reporting relationship found for this user',
      });
    }

    res.status(isContextValidationError(error) ? 400 : 500).json({
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
    const context = parseDepartmentContext(req.query, { required: false });

    // Check authorization
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this information',
      });
    }

    let subordinates;

    if (direct === 'true') {
      subordinates = await reportingStructureService.getDirectReports(userId, context);
    } else {
      subordinates = await reportingStructureService.getDirectReports(userId, context);
    }

    res.status(200).json({
      success: true,
      data: subordinates,
    });
  } catch (error) {
    console.error('Get subordinates error:', error);
    res.status(isContextValidationError(error) ? 400 : 500).json({
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
    const context = parseDepartmentContext(req.body, { required: true });

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
          managerId,
          context,
        );

        if (hasCircular) {
          results.failed.push({ ...rel, reason: 'Circular dependency detected' });
          continue;
        }

        // Get createdById from authenticated user or use userId as fallback
        const createdById = req.user?.id || userId;

        // Assign
        await reportingStructureService.setReportingManager(userId, managerId, createdById, context);
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
    res.status(isContextValidationError(error) ? 400 : 500).json({
      success: false,
      message: error.message || 'Server error during bulk import',
    });
  }
};

/**
 * Move a user to a new position in the hierarchy
 * First removes them cleanly (re-parents children), then inserts under newManagerId.
 * Atomic via Prisma transaction.
 *
 * @route POST /api/reporting-structure/move
 * @access Protected - Admin only
 */
exports.moveUser = async (req, res) => {
  try {
    const { userId, newManagerId } = req.body;
    const context = parseDepartmentContext(req.body, { required: true });

    if (!userId || !newManagerId) {
      return res.status(400).json({
        success: false,
        message: 'Both userId and newManagerId are required',
      });
    }

    if (userId === newManagerId) {
      return res.status(400).json({
        success: false,
        message: 'A user cannot report to themselves',
      });
    }

    const createdById = req.user?.id || userId;
    const result = await reportingStructureService.moveUser(userId, newManagerId, createdById, context);

    console.log('\u2705 User moved:', { userId, newManagerId });

    res.status(200).json({
      success: true,
      data: result,
      message: 'User moved to new position successfully',
    });
  } catch (error) {
    console.error('Move user error:', error);
    res.status(isContextValidationError(error) ? 400 : 500).json({
      success: false,
      message: error.message || 'Server error moving user',
    });
  }
};

/**
 * Get hierarchy info for multiple users (batch)
 * Returns which users are already in the hierarchy along with
 * their level, parent name, subordinate count.
 *
 * @route POST /api/reporting-structure/hierarchy-info
 * @access Protected
 */
exports.getBulkHierarchyInfo = async (req, res) => {
  try {
    const { userIds } = req.body;
    const context = parseDepartmentContext(req.body, { required: false });

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userIds array is required',
      });
    }

    const info = await reportingStructureService.getBulkHierarchyInfo(userIds, context);

    res.status(200).json({
      success: true,
      data: info,
    });
  } catch (error) {
    console.error('Get bulk hierarchy info error:', error);
    res.status(isContextValidationError(error) ? 400 : 500).json({
      success: false,
      message: error.message || 'Server error fetching hierarchy info',
    });
  }
};
