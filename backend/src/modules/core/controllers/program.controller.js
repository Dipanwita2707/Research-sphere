const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');

/**
 * Get all programs
 */
exports.getAllPrograms = async (req, res) => {
  try {
    const { isActive, departmentId, schoolId, programType } = req.query;

    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (schoolId) {
      where.department = {
        facultyId: schoolId,
      };
    }
    if (programType) {
      where.programType = programType;
    }

    const programs = await prisma.program.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            departmentCode: true,
            departmentName: true,
            faculty: {
              select: {
                id: true,
                facultyCode: true,
                facultyName: true,
              },
            },
          },
        },
        programCoordinator: {
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
        _count: {
          select: {
            sections: true,
            students: true,
          },
        },
      },
      orderBy: [
        { department: { departmentName: 'asc' } },
        { programName: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: programs,
    });
  } catch (error) {
    console.error('Get programs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch programs',
    });
  }
};

/**
 * Get programs by department ID
 */
exports.getProgramsByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;

    const programs = await prisma.program.findMany({
      where: {
        departmentId,
        isActive: true,
      },
      include: {
        programCoordinator: {
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
        _count: {
          select: {
            sections: true,
            students: true,
          },
        },
      },
      orderBy: { programName: 'asc' },
    });

    res.json({
      success: true,
      data: programs,
    });
  } catch (error) {
    console.error('Get programs by department error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch programs',
    });
  }
};

/**
 * Get program by ID
 */
exports.getProgramById = async (req, res) => {
  try {
    const { id } = req.params;

    const program = await prisma.program.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            departmentCode: true,
            departmentName: true,
            faculty: {
              select: {
                id: true,
                facultyCode: true,
                facultyName: true,
              },
            },
          },
        },
        programCoordinator: {
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
        sections: {
          select: {
            id: true,
            sectionName: true,
            currentStrength: true,
            maxStrength: true,
          },
        },
        _count: {
          select: {
            students: true,
            sections: true,
          },
        },
      },
    });

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found',
      });
    }

    res.json({
      success: true,
      data: program,
    });
  } catch (error) {
    console.error('Get program by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch program',
    });
  }
};

/**
 * Create a new program
 */
exports.createProgram = async (req, res) => {
  try {
    const {
      departmentId,
      programCode,
      programName,
      programType,
      shortName,
      description,
      durationYears,
      durationSemesters,
      totalCredits,
      admissionCapacity,
      programCoordinatorId,
      accreditationBody,
      accreditationStatus,
      metadata,
    } = req.body;

    // Validate required fields
    if (!departmentId || !programCode || !programName || !programType) {
      return res.status(400).json({
        success: false,
        message: 'Department, program code, program name, and program type are required',
      });
    }

    // Map programType to enum values
    const programTypeMapping = {
      'UG': 'undergraduate',
      'PG': 'postgraduate',
      'PhD': 'doctoral',
      'Diploma': 'diploma',
      'Certificate': 'certificate',
      'undergraduate': 'undergraduate',
      'postgraduate': 'postgraduate',
      'doctoral': 'doctoral',
      'diploma': 'diploma',
      'certificate': 'certificate'
    };

    const mappedProgramType = programTypeMapping[programType];
    if (!mappedProgramType) {
      return res.status(400).json({
        success: false,
        message: `Invalid program type. Expected one of: UG, PG, PhD, Diploma, Certificate`,
      });
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check for duplicate program code
    const existingProgram = await prisma.program.findFirst({
      where: { programCode },
    });

    if (existingProgram) {
      return res.status(400).json({
        success: false,
        message: 'A program with this code already exists',
      });
    }

    // Validate program coordinator if provided
    if (programCoordinatorId) {
      const coordinator = await prisma.userLogin.findUnique({
        where: { id: programCoordinatorId },
      });

      if (!coordinator) {
        return res.status(404).json({
          success: false,
          message: 'Program coordinator not found',
        });
      }
    }

    const program = await prisma.program.create({
      data: {
        department: { connect: { id: departmentId } },
        programCode,
        programName,
        programType: mappedProgramType,
        shortName,
        description,
        durationYears: durationYears != null && durationYears !== '' ? Number(durationYears) : 4,
        durationSemesters: durationSemesters != null && durationSemesters !== '' ? Number(durationSemesters) : 8,
        totalCredits: totalCredits != null && totalCredits !== '' ? Number(totalCredits) : null,
        admissionCapacity: admissionCapacity != null ? Number(admissionCapacity) : 0,
        ...(programCoordinatorId && { programCoordinator: { connect: { id: programCoordinatorId } } }),
        accreditationBody: accreditationBody || null,
        accreditationStatus: accreditationStatus || null,
        metadata: metadata ?? {},
        isActive: true,
      },
      include: {
        department: {
          select: {
            id: true,
            departmentCode: true,
            departmentName: true,
            faculty: {
              select: {
                id: true,
                facultyCode: true,
                facultyName: true,
              },
            },
          },
        },
      },
    });

    // Invalidate program cache
    await cache.delPattern(`${cache.CACHE_KEYS.PROGRAM}*`);

    res.status(201).json({
      success: true,
      message: 'Program created successfully',
      data: program,
    });
  } catch (error) {
    console.error('Create program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create program',
    });
  }
};

/**
 * Update a program
 */
exports.updateProgram = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      departmentId,
      programCode,
      programName,
      programType,
      shortName,
      description,
      durationYears,
      durationSemesters,
      totalCredits,
      admissionCapacity,
      currentEnrollment,
      programCoordinatorId,
      accreditationBody,
      accreditationStatus,
      metadata,
    } = req.body;

    // Check if program exists
    const existingProgram = await prisma.program.findUnique({
      where: { id },
    });

    if (!existingProgram) {
      return res.status(404).json({
        success: false,
        message: 'Program not found',
      });
    }

    // Check for duplicate program code if changing
    if (programCode && programCode !== existingProgram.programCode) {
      const duplicateProgram = await prisma.program.findFirst({
        where: { 
          programCode,
          id: { not: id },
        },
      });

      if (duplicateProgram) {
        return res.status(400).json({
          success: false,
          message: 'A program with this code already exists',
        });
      }
    }

    // Validate department if changing
    if (departmentId && departmentId !== existingProgram.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      });

      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found',
        });
      }
    }

    // Validate program coordinator if provided
    if (programCoordinatorId && programCoordinatorId !== existingProgram.programCoordinatorId) {
      const coordinator = await prisma.userLogin.findUnique({
        where: { id: programCoordinatorId },
      });

      if (!coordinator) {
        return res.status(404).json({
          success: false,
          message: 'Program coordinator not found',
        });
      }
    }

    // Map programType to enum values if provided
    let mappedProgramType = programType;
    if (programType) {
      const programTypeMapping = {
        'UG': 'undergraduate',
        'PG': 'postgraduate',
        'PhD': 'doctoral',
        'Diploma': 'diploma',
        'Certificate': 'certificate',
        'undergraduate': 'undergraduate',
        'postgraduate': 'postgraduate',
        'doctoral': 'doctoral',
        'diploma': 'diploma',
        'certificate': 'certificate'
      };

      mappedProgramType = programTypeMapping[programType];
      if (!mappedProgramType) {
        return res.status(400).json({
          success: false,
          message: `Invalid program type. Expected one of: UG, PG, PhD, Diploma, Certificate`,
        });
      }
    }

    const program = await prisma.program.update({
      where: { id },
      data: {
        ...(departmentId && { departmentId }),
        ...(programCode && { programCode }),
        ...(programName && { programName }),
        ...(mappedProgramType && { programType: mappedProgramType }),
        ...(shortName !== undefined && { shortName }),
        ...(description !== undefined && { description }),
        ...(durationYears !== undefined && { durationYears }),
        ...(durationSemesters !== undefined && { durationSemesters }),
        ...(totalCredits !== undefined && { totalCredits }),
        ...(admissionCapacity !== undefined && { admissionCapacity }),
        ...(currentEnrollment !== undefined && { currentEnrollment }),
        ...(programCoordinatorId !== undefined && { programCoordinatorId: programCoordinatorId || null }),
        ...(accreditationBody !== undefined && { accreditationBody }),
        ...(accreditationStatus !== undefined && { accreditationStatus }),
        ...(metadata !== undefined && { metadata }),
      },
      include: {
        department: {
          select: {
            id: true,
            departmentCode: true,
            departmentName: true,
            faculty: {
              select: {
                id: true,
                facultyCode: true,
                facultyName: true,
              },
            },
          },
        },
        programCoordinator: {
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

    // Invalidate program cache
    await cache.delPattern(`${cache.CACHE_KEYS.PROGRAM}*`);

    res.json({
      success: true,
      message: 'Program updated successfully',
      data: program,
    });
  } catch (error) {
    console.error('Update program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update program',
    });
  }
};

/**
 * Delete a program
 */
exports.deleteProgram = async (req, res) => {
  try {
    const { id } = req.params;

    const program = await prisma.program.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            sections: true,
          },
        },
      },
    });

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found',
      });
    }

    // Prevent deletion if program has students
    if (program._count.students > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete program with enrolled students. Please reassign or remove students first.',
      });
    }

    // Prevent deletion if program has sections
    if (program._count.sections > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete program with existing sections. Please remove sections first.',
      });
    }

    await prisma.program.delete({
      where: { id },
    });

    // Invalidate program cache
    await cache.delPattern(`${cache.CACHE_KEYS.PROGRAM}*`);

    res.json({
      success: true,
      message: 'Program deleted successfully',
    });
  } catch (error) {
    console.error('Delete program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete program',
    });
  }
};

/**
 * Toggle program status (active/inactive)
 */
exports.toggleProgramStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const program = await prisma.program.findUnique({
      where: { id },
    });

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found',
      });
    }

    const updatedProgram = await prisma.program.update({
      where: { id },
      data: {
        isActive: !program.isActive,
      },
    });

    // Invalidate program cache
    await cache.delPattern(`${cache.CACHE_KEYS.PROGRAM}*`);

    res.json({
      success: true,
      message: `Program ${updatedProgram.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedProgram,
    });
  } catch (error) {
    console.error('Toggle program status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle program status',
    });
  }
};

/**
 * Get program types (enum values)
 */
exports.getProgramTypes = async (req, res) => {
  try {
    // Common program types
    const programTypes = [
      { value: 'UG', label: 'Undergraduate (UG)' },
      { value: 'PG', label: 'Postgraduate (PG)' },
      { value: 'Diploma', label: 'Diploma' },
      { value: 'PhD', label: 'PhD' },
      { value: 'Certificate', label: 'Certificate' },
      { value: 'Integrated', label: 'Integrated Program' },
    ];

    res.json({
      success: true,
      data: programTypes,
    });
  } catch (error) {
    console.error('Get program types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch program types',
    });
  }
};
