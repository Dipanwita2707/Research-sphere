const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const auditLogger = require('../../../shared/utils/auditLogger');

/**
 * Get all schools/faculties - OPTIMIZED WITH CACHING
 */
exports.getAllSchools = async (req, res) => {
  try {
    const { isActive, facultyType } = req.query;
    
    // Create cache key based on filters
    const cacheKey = `${cache.CACHE_KEYS.SCHOOL}list:${isActive || 'all'}:${facultyType || 'all'}`;
    
    const { data: schools, fromCache } = await cache.getOrSet(
      cacheKey,
      async () => {
        const where = {};
        if (isActive !== undefined) {
          where.isActive = isActive === 'true';
        }
        if (facultyType) {
          where.facultyType = facultyType;
        }

        return await prisma.facultySchoolList.findMany({
          where,
          select: {
            id: true,
            facultyCode: true,
            facultyName: true,
            shortName: true,
            facultyType: true,
            isActive: true,
            createdAt: true,
            headOfFaculty: {
              select: {
                id: true,
                uid: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                    empId: true,
                  },
                },
              },
            },
            departments: {
              select: {
                id: true,
                departmentCode: true,
                departmentName: true,
                shortName: true,
                isActive: true,
              },
              where: {
                isActive: true,
              },
              orderBy: {
                departmentName: 'asc',
              },
            },
            _count: {
              select: {
                departments: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      },
      cache.CACHE_TTL.SCHOOLS
    );

    res.json({
      success: true,
      data: schools || [],
      cached: fromCache
    });
  } catch (error) {
    console.error('Get schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schools',
    });
  }
};

/**
 * Get school by ID
 */
exports.getSchoolById = async (req, res) => {
  try {
    const { id } = req.params;

    const school = await prisma.facultySchoolList.findUnique({
      where: { id },
      include: {
        headOfFaculty: {
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
        departments: {
          select: {
            id: true,
            departmentCode: true,
            departmentName: true,
            shortName: true,
            isActive: true,
          },
        },
      },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    res.json({
      success: true,
      data: school,
    });
  } catch (error) {
    console.error('Get school error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch school',
    });
  }
};

/**
 * Create new school
 */
exports.createSchool = async (req, res) => {
  try {
    const {
      facultyCode,
      facultyName,
      facultyType,
      shortName,
      description,
      establishedYear,
      headOfFacultyId,
      contactEmail,
      contactPhone,
      officeLocation,
      websiteUrl,
      metadata,
    } = req.body;

    // Check if faculty code already exists
    const existing = await prisma.facultySchoolList.findUnique({
      where: { facultyCode },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'School with this code already exists',
      });
    }

    const school = await prisma.facultySchoolList.create({
      data: {
        facultyCode,
        facultyName,
        facultyType,
        shortName,
        description,
        establishedYear,
        headOfFacultyId,
        contactEmail,
        contactPhone,
        officeLocation,
        websiteUrl,
        metadata: metadata || {},
        isActive: true,
      },
      include: {
        headOfFaculty: {
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

    // Log school creation
    await auditLogger.logSchoolCreation(school, req.user?.id, req);

    res.status(201).json({
      success: true,
      message: 'School created successfully',
      data: school,
    });
  } catch (error) {
    console.error('Create school error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create school',
    });
  }
};

/**
 * Update school
 */
exports.updateSchool = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      facultyCode,
      facultyName,
      facultyType,
      shortName,
      description,
      establishedYear,
      headOfFacultyId,
      contactEmail,
      contactPhone,
      officeLocation,
      websiteUrl,
      metadata,
    } = req.body;

    // Check if school exists
    const existing = await prisma.facultySchoolList.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    // Check if faculty code is being changed and already exists
    if (facultyCode && facultyCode !== existing.facultyCode) {
      const codeExists = await prisma.facultySchoolList.findUnique({
        where: { facultyCode },
      });

      if (codeExists) {
        return res.status(400).json({
          success: false,
          message: 'School with this code already exists',
        });
      }
    }

    const school = await prisma.facultySchoolList.update({
      where: { id },
      data: {
        facultyCode,
        facultyName,
        facultyType,
        shortName,
        description,
        establishedYear,
        headOfFacultyId,
        contactEmail,
        contactPhone,
        officeLocation,
        websiteUrl,
        metadata: metadata || existing.metadata,
      },
      include: {
        headOfFaculty: {
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

    // Log school update
    await auditLogger.logSchoolUpdate(existing, school, req.user?.id, req);

    res.json({
      success: true,
      message: 'School updated successfully',
      data: school,
    });
  } catch (error) {
    console.error('Update school error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update school',
    });
  }
};

/**
 * Delete school
 */
exports.deleteSchool = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if school has departments
    const school = await prisma.facultySchoolList.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            departments: true,
          },
        },
      },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    if (school._count.departments > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete school with existing departments. Delete departments first.',
      });
    }

    await prisma.facultySchoolList.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'School deleted successfully',
    });
  } catch (error) {
    console.error('Delete school error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete school',
    });
  }
};

/**
 * Toggle school active status
 */
exports.toggleSchoolStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const school = await prisma.facultySchoolList.findUnique({
      where: { id },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    const updated = await prisma.facultySchoolList.update({
      where: { id },
      data: {
        isActive: !school.isActive,
      },
    });

    res.json({
      success: true,
      message: `School ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error('Toggle school status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle school status',
    });
  }
};
