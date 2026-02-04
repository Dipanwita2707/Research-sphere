const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const auditLogger = require('../../../shared/utils/auditLogger');

/**
 * Validate school data
 */
const validateSchoolData = (data) => {
  const errors = [];

  // Faculty Code validation
  if (!data.facultyCode) {
    errors.push('Faculty code is required');
  } else {
    // Allow alphanumeric pattern: letters, numbers, and hyphens/underscores
    const facultyCodePattern = /^[A-Za-z0-9_-]+$/;
    if (!facultyCodePattern.test(data.facultyCode)) {
      errors.push('Faculty code must contain only letters, numbers, hyphens, and underscores');
    }
    if (data.facultyCode.length < 2 || data.facultyCode.length > 32) {
      errors.push('Faculty code must be between 2 and 32 characters long');
    }
  }

  // Faculty Name validation
  if (!data.facultyName) {
    errors.push('Faculty name is required');
  } else if (data.facultyName.length < 2 || data.facultyName.length > 256) {
    errors.push('Faculty name must be between 2 and 256 characters long');
  }

  // Faculty Type validation
  if (!data.facultyType) {
    errors.push('Faculty type is required');
  }

  // Email validation if provided
  if (data.contactEmail) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(data.contactEmail)) {
      errors.push('Contact email must be a valid email address');
    }
  }

  // Phone validation if provided
  if (data.contactPhone) {
    const phonePattern = /^[\d\s\-\+\(\)\.]+$/;
    if (!phonePattern.test(data.contactPhone)) {
      errors.push('Contact phone must contain only numbers, spaces, and common phone symbols');
    }
  }

  // Website URL validation if provided
  if (data.websiteUrl) {
    try {
      new URL(data.websiteUrl);
    } catch {
      errors.push('Website URL must be a valid URL');
    }
  }

  // Established year validation if provided
  if (data.establishedYear) {
    const currentYear = new Date().getFullYear();
    if (data.establishedYear < 1800 || data.establishedYear > currentYear) {
      errors.push(`Established year must be between 1800 and ${currentYear}`);
    }
  }

  return errors;
};

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

    // Validate input data
    const validationErrors = validateSchoolData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
      });
    }

    // Check if faculty code already exists
    const existing = await prisma.facultySchoolList.findUnique({
      where: { facultyCode: facultyCode.toUpperCase() },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'School with this faculty code already exists',
        error: 'DUPLICATE_FACULTY_CODE',
        code: facultyCode,
      });
    }

    // Check if head of faculty exists if provided
    if (headOfFacultyId) {
      const headExists = await prisma.userLogin.findUnique({
        where: { id: headOfFacultyId },
        include: { employeeDetails: true },
      });

      if (!headExists || !headExists.employeeDetails) {
        return res.status(400).json({
          success: false,
          message: 'Invalid head of faculty ID - user not found or not an employee',
          error: 'INVALID_HEAD_OF_FACULTY',
        });
      }
    }

    const school = await prisma.facultySchoolList.create({
      data: {
        facultyCode: facultyCode.toUpperCase(), // Store as uppercase for consistency
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

    // Invalidate school cache
    await cache.delPattern(`${cache.CACHE_KEYS.SCHOOL}*`);

    res.status(201).json({
      success: true,
      message: 'School created successfully',
      data: school,
    });
  } catch (error) {
    console.error('Create school error:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      if (target?.includes('facultyCode')) {
        return res.status(409).json({
          success: false,
          message: 'School with this faculty code already exists',
          error: 'DUPLICATE_FACULTY_CODE',
        });
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create school',
      error: 'INTERNAL_SERVER_ERROR',
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

    // Validate input data (only validate provided fields)
    const validationErrors = validateSchoolData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
      });
    }

    // Check if school exists
    const existing = await prisma.facultySchoolList.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
        error: 'SCHOOL_NOT_FOUND',
      });
    }

    // Check if faculty code is being changed and already exists
    if (facultyCode && facultyCode.toUpperCase() !== existing.facultyCode) {
      const codeExists = await prisma.facultySchoolList.findUnique({
        where: { facultyCode: facultyCode.toUpperCase() },
      });

      if (codeExists) {
        return res.status(409).json({
          success: false,
          message: 'School with this faculty code already exists',
          error: 'DUPLICATE_FACULTY_CODE',
          code: facultyCode,
        });
      }
    }

    // Check if head of faculty exists if being changed
    if (headOfFacultyId && headOfFacultyId !== existing.headOfFacultyId) {
      const headExists = await prisma.userLogin.findUnique({
        where: { id: headOfFacultyId },
        include: { employeeDetails: true },
      });

      if (!headExists || !headExists.employeeDetails) {
        return res.status(400).json({
          success: false,
          message: 'Invalid head of faculty ID - user not found or not an employee',
          error: 'INVALID_HEAD_OF_FACULTY',
        });
      }
    }

    const school = await prisma.facultySchoolList.update({
      where: { id },
      data: {
        ...(facultyCode && { facultyCode: facultyCode.toUpperCase() }),
        ...(facultyName && { facultyName }),
        ...(facultyType && { facultyType }),
        ...(shortName !== undefined && { shortName }),
        ...(description !== undefined && { description }),
        ...(establishedYear !== undefined && { establishedYear }),
        ...(headOfFacultyId !== undefined && { headOfFacultyId }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(officeLocation !== undefined && { officeLocation }),
        ...(websiteUrl !== undefined && { websiteUrl }),
        ...(metadata && { metadata: { ...existing.metadata, ...metadata } }),
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

    // Invalidate school cache
    await cache.delPattern(`${cache.CACHE_KEYS.SCHOOL}*`);

    res.json({
      success: true,
      message: 'School updated successfully',
      data: school,
    });
  } catch (error) {
    console.error('Update school error:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      if (target?.includes('facultyCode')) {
        return res.status(409).json({
          success: false,
          message: 'School with this faculty code already exists',
          error: 'DUPLICATE_FACULTY_CODE',
        });
      }
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'School not found',
        error: 'SCHOOL_NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update school',
      error: 'INTERNAL_SERVER_ERROR',
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

    // Invalidate school cache
    await cache.delPattern(`${cache.CACHE_KEYS.SCHOOL}*`);

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

    // Invalidate school cache
    await cache.delPattern(`${cache.CACHE_KEYS.SCHOOL}*`);

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
