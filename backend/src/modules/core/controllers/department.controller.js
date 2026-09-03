const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const auditLogger = require('../../../shared/utils/auditLogger');

/**
 * Get all departments - OPTIMIZED WITH CACHING
 */
exports.getAllDepartments = async (req, res) => {
  try {
    const { isActive, schoolId } = req.query;
    const tenantId = req.tenantId || null;
    
    // Include tenantId in cache key to prevent cross-university cache leakage
    const cacheKey = `${cache.CACHE_KEYS.DEPARTMENT}list:${tenantId || 'global'}:${isActive || 'all'}:${schoolId || 'all'}`;
    
    const { data: departments, fromCache } = await cache.getOrSet(
      cacheKey,
      async () => {
        const where = {};
        // Tenant isolation: scope departments via their parent school's universityId
        // (Department has no direct universityId — it links through FacultySchoolList)
        if (tenantId) {
          where.faculty = { universityId: tenantId };
        }
        if (isActive !== undefined) {
          where.isActive = isActive === 'true';
        }
        if (schoolId) {
          where.facultyId = schoolId;
        }

        return await prisma.department.findMany({
          where,
          select: {
            id: true,
            departmentCode: true,
            departmentName: true,
            shortName: true,
            isActive: true,
            facultyId: true,
            faculty: {
              select: {
                id: true,
                facultyCode: true,
                facultyName: true,
              },
            },
            headOfDepartment: {
              select: {
                id: true,
                uid: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                    empId: true,
                    designation: true,
                  },
                },
              },
            },
            _count: {
              select: {
                primaryEmployees: true,
                programs: true,
              },
            },
          },
          orderBy: [
            { faculty: { facultyName: 'asc' } },
            { departmentName: 'asc' },
          ],
        });
      },
      cache.CACHE_TTL.DEPARTMENTS
    );

    res.json({
      success: true,
      data: departments || [],
      cached: fromCache
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
    });
  }
};

/**
 * Get departments by school ID - OPTIMIZED WITH CACHING
 */
exports.getDepartmentsBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const tenantId = req.tenantId || null;
    const cacheKey = `${cache.CACHE_KEYS.DEPARTMENT}bySchool:${tenantId || 'global'}:${schoolId}`;

    const { data: departments, fromCache } = await cache.getOrSet(
      cacheKey,
      async () => {
        return await prisma.department.findMany({
          where: { 
            facultyId: schoolId,
            isActive: true,
          },
          select: {
            id: true,
            departmentCode: true,
            departmentName: true,
            shortName: true,
            headOfDepartment: {
              select: {
                id: true,
                uid: true,
                employeeDetails: {
                  select: {
                    displayName: true,
                  },
                },
              },
            },
            _count: {
              select: {
                primaryEmployees: true,
                programs: true,
              },
            },
          },
          orderBy: { departmentName: 'asc' },
        });
      },
      cache.CACHE_TTL.DEPARTMENTS
    );

    res.json({
      success: true,
      data: departments || [],
      cached: fromCache
    });
  } catch (error) {
    console.error('Get departments by school error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
    });
  }
};

/**
 * Get department by ID
 */
exports.getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || null;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        faculty: {
          select: {
            id: true,
            facultyCode: true,
            facultyName: true,
            universityId: true,
          },
        },
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
        programs: {
          select: {
            id: true,
            programCode: true,
            programName: true,
            programType: true,
            shortName: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            primaryEmployees: true,
            programs: true,
          },
        },
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Tenant isolation: non-superadmin cannot fetch another university's department
    if (tenantId && department.faculty?.universityId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This department does not belong to your university.',
      });
    }

    res.json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department',
    });
  }
};

/**
 * Create new department
 */
exports.createDepartment = async (req, res) => {
  try {
    const {
      facultyId,
      departmentCode,
      departmentName,
      shortName,
      description,
      establishedYear,
      headOfDepartmentId,
      contactEmail,
      contactPhone,
      officeLocation,
      budgetAllocation,
      metadata,
    } = req.body;

    // Check if school exists
    const school = await prisma.facultySchoolList.findUnique({
      where: { id: facultyId },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    const tenantId = req.tenantId || null;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'University context is required to create a department.',
      });
    }

    // Tenant isolation: ensure the target school belongs to this university
    if (school.universityId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: The target school does not belong to your university.',
      });
    }

    // Check if department code already exists within the same university's schools
    const existing = await prisma.department.findFirst({
      where: {
        departmentCode,
        faculty: { universityId: tenantId },
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Department with this code already exists',
      });
    }

    const department = await prisma.department.create({
      data: {
        facultyId,
        departmentCode,
        departmentName,
        shortName,
        description,
        establishedYear,
        headOfDepartmentId,
        contactEmail,
        contactPhone,
        officeLocation,
        budgetAllocation,
        metadata: metadata || {},
        isActive: true,
        // Note: Department inherits university scope through its school (FacultySchoolList.universityId).
        // The school ownership check above ensures tenancy is enforced at creation time.
      },
      include: {
        faculty: {
          select: {
            id: true,
            facultyCode: true,
            facultyName: true,
          },
        },
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

    // Log department creation
    await auditLogger.logDepartmentCreation(department, req.user?.id, req);

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department,
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create department',
    });
  }
};

/**
 * Update department
 */
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      facultyId,
      departmentCode,
      departmentName,
      shortName,
      description,
      establishedYear,
      headOfDepartmentId,
      contactEmail,
      contactPhone,
      officeLocation,
      budgetAllocation,
      metadata,
    } = req.body;

    const tenantId = req.tenantId || null;

    // Check if department exists and load faculty for tenant check
    const existing = await prisma.department.findUnique({
      where: { id },
      include: { faculty: { select: { universityId: true } } },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Tenant isolation: prevent cross-university modification
    if (tenantId && existing.faculty?.universityId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This department does not belong to your university.',
      });
    }

    // Check if department code is being changed and already exists
    if (departmentCode && departmentCode !== existing.departmentCode) {
      const codeExists = await prisma.department.findUnique({
        where: { departmentCode },
      });

      if (codeExists) {
        return res.status(400).json({
          success: false,
          message: 'Department with this code already exists',
        });
      }
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        facultyId,
        departmentCode,
        departmentName,
        shortName,
        description,
        establishedYear,
        headOfDepartmentId,
        contactEmail,
        contactPhone,
        officeLocation,
        budgetAllocation,
        metadata: metadata || existing.metadata,
      },
      include: {
        faculty: {
          select: {
            id: true,
            facultyCode: true,
            facultyName: true,
          },
        },
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

    // Log department update
    await auditLogger.logDepartmentUpdate(existing, department, req.user?.id, req);

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: department,
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update department',
    });
  }
};

/**
 * Delete department
 */
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const tenantId = req.tenantId || null;

    // Check if department has programmes or employees, and fetch faculty for tenant check
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        faculty: { select: { universityId: true } },
        _count: {
          select: {
            primaryEmployees: true,
            programs: true,
          },
        },
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Tenant isolation: prevent cross-university deletion
    if (tenantId && department.faculty?.universityId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This department does not belong to your university.',
      });
    }

    if (department._count.primaryEmployees > 0 || department._count.programs > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department with existing employees or programmes. Remove them first.',
      });
    }

    await prisma.department.delete({
      where: { id },
    });

    // Invalidate department cache
    await cache.delPattern(`${cache.CACHE_KEYS.DEPARTMENT}*`);

    res.json({
      success: true,
      message: 'Department deleted successfully',
    });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete department',
    });
  }
};

/**
 * Toggle department active status
 */
exports.toggleDepartmentStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const tenantId = req.tenantId || null;

    const department = await prisma.department.findUnique({
      where: { id },
      include: { faculty: { select: { universityId: true } } },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Tenant isolation
    if (tenantId && department.faculty?.universityId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This department does not belong to your university.',
      });
    }

    const updated = await prisma.department.update({
      where: { id },
      data: {
        isActive: !department.isActive,
      },
    });

    // Invalidate department cache
    await cache.delPattern(`${cache.CACHE_KEYS.DEPARTMENT}*`);

    res.json({
      success: true,
      message: `Department ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error('Toggle department status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle department status',
    });
  }
};
/**
 * Bulk create departments
 * Body: { departments: [{ departmentCode, departmentName, facultyId, shortName? }] }
 */
exports.bulkCreate = async (req, res) => {
  try {
    const { departments } = req.body;
    if (!Array.isArray(departments) || departments.length === 0) {
      return res.status(400).json({ success: false, message: 'departments array is required' });
    }
    if (departments.length > 200) {
      return res.status(400).json({ success: false, message: 'Maximum 200 rows per upload' });
    }

    const results = { created: [], skipped: [], errors: [] };

    for (let i = 0; i < departments.length; i++) {
      const row = departments[i];
      const rowNum = i + 1;
      if (!row.departmentCode || !row.departmentName || !row.facultyId) {
        results.errors.push({ row: rowNum, departmentCode: row.departmentCode, errors: ['departmentCode, departmentName, and facultyId are required'] });
        continue;
      }
      const code = (row.departmentCode || '').toUpperCase();
      const exists = await prisma.department.findFirst({ where: { departmentCode: code, facultyId: row.facultyId } });
      if (exists) {
        results.skipped.push({ row: rowNum, departmentCode: code, reason: 'Already exists in this school' });
        continue;
      }
      const schoolExists = await prisma.facultySchoolList.findUnique({ where: { id: row.facultyId } });
      if (!schoolExists) {
        results.errors.push({ row: rowNum, departmentCode: code, errors: [`School with id ${row.facultyId} not found`] });
        continue;
      }
      try {
        const created = await prisma.department.create({
          data: {
            departmentCode: code,
            departmentName: row.departmentName,
            shortName: row.shortName || null,
            description: row.description || null,
            facultyId: row.facultyId,
            isActive: true,
            // Tenant scope inherited from the school's universityId
          },
        });
        results.created.push({ row: rowNum, departmentCode: code, id: created.id });
      } catch (e) {
        results.errors.push({ row: rowNum, departmentCode: code, errors: [e.message] });
      }
    }

    await cache.delPattern(`${cache.CACHE_KEYS.DEPARTMENT}*`);

    res.status(207).json({
      success: true,
      message: `Bulk upload complete: ${results.created.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors`,
      data: results,
    });
  } catch (error) {
    console.error('Bulk create departments error:', error);
    res.status(500).json({ success: false, message: 'Bulk upload failed' });
  }
};