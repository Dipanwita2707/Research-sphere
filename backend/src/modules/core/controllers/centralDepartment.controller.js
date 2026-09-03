const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');

/**
 * Get all central departments
 */
exports.getAllCentralDepartments = async (req, res) => {
  try {
    const { isActive, departmentType } = req.query;
    const tenantId = req.tenantId || null;
    
    const where = {};
    // Tenant isolation: scope to university unless superadmin global view
    if (tenantId) {
      where.universityId = tenantId;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (departmentType) {
      where.departmentType = departmentType;
    }

    const departments = await prisma.centralDepartment.findMany({
      where,
      include: {
        headOfDepartment: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                empId: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error('Get central departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch central departments',
    });
  }
};

/**
 * Get central department by ID
 */
exports.getCentralDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || null;

    const department = await prisma.centralDepartment.findUnique({
      where: { id },
      include: {
        headOfDepartment: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                empId: true,
                designation: true,
              },
            },
          },
        },
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Central department not found',
      });
    }

    // Tenant isolation: non-superadmin cannot access another university's central department
    if (tenantId && department.universityId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This central department does not belong to your university.',
      });
    }

    res.json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error('Get central department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch central department',
    });
  }
};

/**
 * Create new central department
 */
exports.createCentralDepartment = async (req, res) => {
  try {
    const {
      departmentCode,
      departmentName,
      shortName,
      description,
      headOfDepartmentId,
      contactEmail,
      contactPhone,
      officeLocation,
      departmentType,
      metadata,
    } = req.body;

    const tenantId = req.tenantId || null;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'University context is required to create a central department.',
      });
    }

    // Check if department code already exists within this university
    const existing = await prisma.centralDepartment.findFirst({
      where: { departmentCode, universityId: tenantId },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Central department with this code already exists',
      });
    }

    const department = await prisma.centralDepartment.create({
      data: {
        departmentCode,
        departmentName,
        shortName,
        description,
        headOfDepartmentId,
        contactEmail,
        contactPhone,
        officeLocation,
        departmentType,
        metadata: metadata || {},
        isActive: true,
        universityId: tenantId,
      },
      include: {
        headOfDepartment: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    // Invalidate department cache
    await cache.delPattern(`${cache.CACHE_KEYS.DEPARTMENT}*`);

    res.status(201).json({
      success: true,
      message: 'Central department created successfully',
      data: department,
    });
  } catch (error) {
    console.error('Create central department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create central department',
    });
  }
};

/**
 * Update central department
 */
exports.updateCentralDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      departmentCode,
      departmentName,
      shortName,
      description,
      headOfDepartmentId,
      contactEmail,
      contactPhone,
      officeLocation,
      departmentType,
      metadata,
    } = req.body;
    const tenantId = req.tenantId || null;

    // Check if department exists
    const existing = await prisma.centralDepartment.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Central department not found',
      });
    }

    // Tenant isolation: prevent cross-university modification
    if (tenantId && existing.universityId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This central department does not belong to your university.',
      });
    }

    // Check if department code is being changed and already exists
    if (departmentCode && departmentCode !== existing.departmentCode) {
      const codeExists = await prisma.centralDepartment.findFirst({
        where: { departmentCode, universityId: tenantId },
      });

      if (codeExists) {
        return res.status(400).json({
          success: false,
          message: 'Central department with this code already exists',
        });
      }
    }

    const department = await prisma.centralDepartment.update({
      where: { id },
      data: {
        departmentCode,
        departmentName,
        shortName,
        description,
        headOfDepartmentId,
        contactEmail,
        contactPhone,
        officeLocation,
        departmentType,
        metadata: metadata || existing.metadata,
      },
      include: {
        headOfDepartment: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    // Invalidate department cache
    await cache.delPattern(`${cache.CACHE_KEYS.DEPARTMENT}*`);

    res.json({
      success: true,
      message: 'Central department updated successfully',
      data: department,
    });
  } catch (error) {
    console.error('Update central department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update central department',
    });
  }
};

/**
 * Delete central department
 */
exports.deleteCentralDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || null;

    const department = await prisma.centralDepartment.findUnique({
      where: { id },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Central department not found',
      });
    }

    // Tenant isolation: prevent cross-university deletion
    if (tenantId && department.universityId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This central department does not belong to your university.',
      });
    }

    await prisma.centralDepartment.delete({
      where: { id },
    });

    // Invalidate department cache
    await cache.delPattern(`${cache.CACHE_KEYS.DEPARTMENT}*`);

    res.json({
      success: true,
      message: 'Central department deleted successfully',
    });
  } catch (error) {
    console.error('Delete central department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete central department',
    });
  }
};

/**
 * Toggle central department active status
 */
exports.toggleCentralDepartmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || null;

    const department = await prisma.centralDepartment.findUnique({
      where: { id },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Central department not found',
      });
    }

    // Tenant isolation
    if (tenantId && department.universityId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This central department does not belong to your university.',
      });
    }

    const updated = await prisma.centralDepartment.update({
      where: { id },
      data: {
        isActive: !department.isActive,
      },
    });

    // Invalidate department cache
    await cache.delPattern(`${cache.CACHE_KEYS.DEPARTMENT}*`);

    res.json({
      success: true,
      message: `Central department ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error('Toggle central department status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle central department status',
    });
  }
};
