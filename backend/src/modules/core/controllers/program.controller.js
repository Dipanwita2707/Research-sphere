const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrDefault(value, fallback) {
  const parsed = numberOrNull(value);
  return parsed === null ? fallback : parsed;
}

function normalizeProgramMetadata(metadata = {}, totalCredits = null) {
  const safeMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};

  const rawCreditRange = safeMetadata.creditRange && typeof safeMetadata.creditRange === 'object'
    ? safeMetadata.creditRange
    : {};
  const creditMin = numberOrNull(rawCreditRange.min);
  const creditMax = numberOrNull(rawCreditRange.max ?? totalCredits);
  const creditRange = creditMin !== null || creditMax !== null
    ? { min: creditMin ?? undefined, max: creditMax ?? undefined }
    : undefined;

  const specializationChargeRules = Array.isArray(safeMetadata.specializationChargeRules)
    ? safeMetadata.specializationChargeRules
        .map((rule) => ({
          specializationCode: String(rule.specializationCode || '').trim(),
          specializationName: String(rule.specializationName || '').trim(),
          batchYear: numberOrNull(rule.batchYear),
          startSemester: numberOrNull(rule.startSemester),
          requireNonZeroCharge: rule.requireNonZeroCharge !== false,
          isActive: rule.isActive !== false,
        }))
        .filter((rule) => rule.specializationCode && rule.batchYear !== null && rule.startSemester !== null)
    : [];

  const batchYearDocuments = Array.isArray(safeMetadata.batchYearDocuments)
    ? safeMetadata.batchYearDocuments
        .map((document) => ({
          batchYear: numberOrNull(document.batchYear),
          admissionCapacity: numberOrNull(document.admissionCapacity),
          fileName: String(document.fileName || '').trim(),
          filePath: String(document.filePath || '').trim(),
          fileSize: numberOrNull(document.fileSize) ?? undefined,
          mimeType: document.mimeType || undefined,
          uploadedAt: document.uploadedAt || new Date().toISOString(),
        }))
        .filter((document) => document.batchYear !== null && document.fileName && document.filePath)
    : [];

  const internshipSpecializations = Array.isArray(safeMetadata.internshipSpecializations)
    ? safeMetadata.internshipSpecializations
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    : [];
  const internshipDurationMonths = numberOrNull(safeMetadata.internshipDurationMonths);

  return {
    ...safeMetadata,
    ...(creditRange ? { creditRange } : {}),
    specializationChargeRules,
    batchYearDocuments,
    internshipApplicable: safeMetadata.internshipApplicable === true,
    ...(internshipDurationMonths !== null ? { internshipDurationMonths } : {}),
    internshipSpecializations,
  };
}

function parseProgrammeSpecializations(value) {
  if (!value) return [];
  return String(value)
    .split(/[|;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSpecializationChargeRules(value, programCode, specializations) {
  if (!value) return [];
  return String(value)
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [nameOrCode, batchYear, startSemester] = item.split(':').map((part) => (part || '').trim());
      const specIndex = specializations.findIndex((name, index) => (
        name.toLowerCase() === nameOrCode.toLowerCase()
        || `${programCode}-SP${index + 1}`.toLowerCase() === nameOrCode.toLowerCase()
      ));
      if (specIndex < 0) return null;
      return {
        specializationCode: `${programCode}-SP${specIndex + 1}`,
        specializationName: specializations[specIndex],
        batchYear: numberOrNull(batchYear),
        startSemester: numberOrNull(startSemester),
        requireNonZeroCharge: true,
      };
    })
    .filter((rule) => rule && rule.batchYear !== null && rule.startSemester !== null);
}

function parseBatchYearDocuments(value) {
  if (!value) return [];
  return String(value)
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [batchYear, filePath, fileName] = item.split(':').map((part) => (part || '').trim());
      return {
        batchYear: numberOrNull(batchYear),
        filePath,
        fileName: fileName || (filePath ? filePath.split('/').pop() : ''),
        uploadedAt: new Date().toISOString(),
      };
    })
    .filter((document) => document.batchYear !== null && document.filePath && document.fileName);
}

function mapProgramType(value) {
  const programTypeMapping = {
    UG: 'undergraduate',
    PG: 'postgraduate',
    PhD: 'doctoral',
    Diploma: 'diploma',
    Certificate: 'certificate',
    undergraduate: 'undergraduate',
    postgraduate: 'postgraduate',
    doctoral: 'doctoral',
    doctorate: 'doctoral',
    diploma: 'diploma',
    certificate: 'certificate',
  };
  return programTypeMapping[value] || programTypeMapping[String(value || '').trim()];
}

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
        specializations: {
          orderBy: { specializationCode: 'asc' },
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
      durationMonths,
      durationSemesters,
      totalCredits,
      admissionCapacity,
      programCoordinatorId,
      accreditationBody,
      accreditationStatus,
      metadata,
      specializations,
    } = req.body;

    // Validate required fields
    if (!departmentId || !programCode || !programName || !programType) {
      return res.status(400).json({
        success: false,
        message: 'Department, program code, program name, and program type are required',
      });
    }

    // Map programType to enum values
    const mappedProgramType = mapProgramType(programType);
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

    const normalizedMetadata = normalizeProgramMetadata(metadata, totalCredits);
    const normalizedTotalCredits = numberOrNull(normalizedMetadata.creditRange?.max ?? totalCredits ?? normalizedMetadata.creditRange?.min);

    const program = await prisma.program.create({
      data: {
        department: { connect: { id: departmentId } },
        programCode,
        programName,
        programType: mappedProgramType,
        shortName,
        description,
        durationYears: numberOrDefault(durationYears, 4),
        durationMonths: numberOrNull(durationMonths),
        durationSemesters: numberOrDefault(durationSemesters, 8),
        totalCredits: normalizedTotalCredits,
        admissionCapacity: numberOrDefault(admissionCapacity, 0),
        ...(programCoordinatorId && { programCoordinator: { connect: { id: programCoordinatorId } } }),
        accreditationBody: accreditationBody || null,
        accreditationStatus: accreditationStatus || null,
        metadata: normalizedMetadata,
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
        specializations: { orderBy: { specializationCode: 'asc' } },
      },
    });

    // Create specializations if provided
    if (Array.isArray(specializations) && specializations.length > 0) {
      const specializationData = specializations.map((s, index) => ({
        programId: program.id,
        specializationCode: `${programCode}-SP${index + 1}`,
        specializationName: typeof s === 'string' ? s : s.name,
        isActive: true,
      }));
      await prisma.programSpecialization.createMany({ data: specializationData });
    }

    const programWithSpecs = await prisma.program.findUnique({
      where: { id: program.id },
      include: {
        department: {
          select: {
            id: true,
            departmentCode: true,
            departmentName: true,
            faculty: { select: { id: true, facultyCode: true, facultyName: true } },
          },
        },
        specializations: { orderBy: { specializationCode: 'asc' } },
      },
    });

    // Invalidate program cache
    await cache.delPattern(`${cache.CACHE_KEYS.PROGRAM}*`);

    res.status(201).json({
      success: true,
      message: 'Program created successfully',
      data: programWithSpecs,
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
      durationMonths,
      durationSemesters,
      totalCredits,
      admissionCapacity,
      currentEnrollment,
      programCoordinatorId,
      accreditationBody,
      accreditationStatus,
      metadata,
      specializations,
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
      mappedProgramType = mapProgramType(programType);
      if (!mappedProgramType) {
        return res.status(400).json({
          success: false,
          message: `Invalid program type. Expected one of: UG, PG, PhD, Diploma, Certificate`,
        });
      }
    }

    const normalizedMetadata = metadata !== undefined
      ? normalizeProgramMetadata(metadata, totalCredits)
      : undefined;
    const normalizedTotalCredits = totalCredits !== undefined || normalizedMetadata?.creditRange
      ? numberOrNull(normalizedMetadata?.creditRange?.max ?? totalCredits ?? normalizedMetadata?.creditRange?.min)
      : undefined;

    const program = await prisma.program.update({
      where: { id },
      data: {
        ...(departmentId && { departmentId }),
        ...(programCode && { programCode }),
        ...(programName && { programName }),
        ...(mappedProgramType && { programType: mappedProgramType }),
        ...(shortName !== undefined && { shortName }),
        ...(description !== undefined && { description }),
        ...(durationYears !== undefined && { durationYears: numberOrDefault(durationYears, existingProgram.durationYears) }),
        ...(durationMonths !== undefined && { durationMonths: numberOrNull(durationMonths) }),
        ...(durationSemesters !== undefined && { durationSemesters: numberOrDefault(durationSemesters, existingProgram.durationSemesters) }),
        ...(normalizedTotalCredits !== undefined && { totalCredits: normalizedTotalCredits }),
        ...(admissionCapacity !== undefined && { admissionCapacity: numberOrDefault(admissionCapacity, 0) }),
        ...(currentEnrollment !== undefined && { currentEnrollment }),
        ...(programCoordinatorId !== undefined && { programCoordinatorId: programCoordinatorId || null }),
        ...(accreditationBody !== undefined && { accreditationBody }),
        ...(accreditationStatus !== undefined && { accreditationStatus }),
        ...(normalizedMetadata !== undefined && { metadata: normalizedMetadata }),
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
        specializations: { orderBy: { specializationCode: 'asc' } },
      },
    });

    // Sync specializations if provided
    if (Array.isArray(specializations)) {
      const currentCode = program.programCode;
      // Delete all existing specializations and recreate
      await prisma.programSpecialization.deleteMany({ where: { programId: id } });
      if (specializations.length > 0) {
        const specializationData = specializations.map((s, index) => ({
          programId: id,
          specializationCode: `${currentCode}-SP${index + 1}`,
          specializationName: typeof s === 'string' ? s : s.name,
          isActive: true,
        }));
        await prisma.programSpecialization.createMany({ data: specializationData });
      }
    }

    const updatedWithSpecs = await prisma.program.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            departmentCode: true,
            departmentName: true,
            faculty: { select: { id: true, facultyCode: true, facultyName: true } },
          },
        },
        specializations: { orderBy: { specializationCode: 'asc' } },
      },
    });

    // Invalidate program cache
    await cache.delPattern(`${cache.CACHE_KEYS.PROGRAM}*`);

    res.json({
      success: true,
      message: 'Program updated successfully',
      data: updatedWithSpecs,
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

/**
 * Get specializations for a program
 */
exports.getSpecializations = async (req, res) => {
  try {
    const { id } = req.params;

    const specializations = await prisma.programSpecialization.findMany({
      where: { programId: id },
      orderBy: { specializationCode: 'asc' },
    });

    res.json({ success: true, data: specializations });
  } catch (error) {
    console.error('Get specializations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch specializations' });
  }
};

/**
 * Add a specialization to a program
 */
exports.addSpecialization = async (req, res) => {
  try {
    const { id } = req.params;
    const { specializationName } = req.body;

    if (!specializationName) {
      return res.status(400).json({ success: false, message: 'Specialization name is required' });
    }

    const program = await prisma.program.findUnique({ where: { id } });
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    // Count existing specializations to generate next sequence number
    const count = await prisma.programSpecialization.count({ where: { programId: id } });
    const specializationCode = `${program.programCode}-SP${count + 1}`;

    const specialization = await prisma.programSpecialization.create({
      data: {
        programId: id,
        specializationCode,
        specializationName,
        isActive: true,
      },
    });

    await cache.delPattern(`${cache.CACHE_KEYS.PROGRAM}*`);

    res.status(201).json({ success: true, message: 'Specialization added', data: specialization });
  } catch (error) {
    console.error('Add specialization error:', error);
    res.status(500).json({ success: false, message: 'Failed to add specialization' });
  }
};

/**
 * Update a specialization
 */
exports.updateSpecialization = async (req, res) => {
  try {
    const { specId } = req.params;
    const { specializationName, isActive } = req.body;

    const spec = await prisma.programSpecialization.findUnique({ where: { id: specId } });
    if (!spec) {
      return res.status(404).json({ success: false, message: 'Specialization not found' });
    }

    const updated = await prisma.programSpecialization.update({
      where: { id: specId },
      data: {
        ...(specializationName !== undefined && { specializationName }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await cache.delPattern(`${cache.CACHE_KEYS.PROGRAM}*`);

    res.json({ success: true, message: 'Specialization updated', data: updated });
  } catch (error) {
    console.error('Update specialization error:', error);
    res.status(500).json({ success: false, message: 'Failed to update specialization' });
  }
};

/**
 * Delete a specialization
 */
exports.deleteSpecialization = async (req, res) => {
  try {
    const { specId } = req.params;

    const spec = await prisma.programSpecialization.findUnique({ where: { id: specId } });
    if (!spec) {
      return res.status(404).json({ success: false, message: 'Specialization not found' });
    }

    await prisma.programSpecialization.delete({ where: { id: specId } });
    await cache.delPattern(`${cache.CACHE_KEYS.PROGRAM}*`);

    res.json({ success: true, message: 'Specialization deleted' });
  } catch (error) {
    console.error('Delete specialization error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete specialization' });
  }
};
/**
 * Bulk create programmes
 * Body: { programs: [{ programCode, programName, programType, departmentId, durationYears?, durationSemesters? }] }
 */
exports.bulkCreate = async (req, res) => {
  try {
    const { programs } = req.body;
    if (!Array.isArray(programs) || programs.length === 0) {
      return res.status(400).json({ success: false, message: 'programs array is required' });
    }
    if (programs.length > 200) {
      return res.status(400).json({ success: false, message: 'Maximum 200 rows per upload' });
    }

    const results = { created: [], skipped: [], errors: [] };

    for (let i = 0; i < programs.length; i++) {
      const row = programs[i];
      const rowNum = i + 1;
      if (!row.programCode || !row.programName || !row.programType || !row.departmentId) {
        results.errors.push({ row: rowNum, programCode: row.programCode, errors: ['programCode, programName, programType, and departmentId are required'] });
        continue;
      }
      const code = (row.programCode || '').toUpperCase();
      const exists = await prisma.program.findFirst({ where: { programCode: code } });
      if (exists) {
        results.skipped.push({ row: rowNum, programCode: code, reason: 'Programme code already exists' });
        continue;
      }
      const deptExists = await prisma.department.findUnique({ where: { id: row.departmentId } });
      if (!deptExists) {
        results.errors.push({ row: rowNum, programCode: code, errors: [`Department with id ${row.departmentId} not found`] });
        continue;
      }
      const mappedProgramType = mapProgramType(row.programType);
      if (!mappedProgramType) {
        results.errors.push({ row: rowNum, programCode: code, errors: ['Invalid programme type'] });
        continue;
      }
      const specializations = parseProgrammeSpecializations(row.specializations);
      const creditMin = numberOrNull(row.creditMin);
      const creditMax = numberOrNull(row.creditMax ?? row.totalCredits);
      const metadata = normalizeProgramMetadata({
        ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
        creditRange: creditMin !== null || creditMax !== null
          ? { min: creditMin ?? undefined, max: creditMax ?? undefined }
          : undefined,
        specializationChargeRules: parseSpecializationChargeRules(row.specializationChargeRules, code, specializations),
        batchYearDocuments: parseBatchYearDocuments(row.batchYearDocuments),
      }, creditMax ?? creditMin);
      try {
        const created = await prisma.program.create({
          data: {
            programCode: code,
            programName: row.programName,
            programType: mappedProgramType,
            departmentId: row.departmentId,
            durationYears: row.durationYears ? Number(row.durationYears) : 4,
            durationSemesters: row.durationSemesters ? Number(row.durationSemesters) : 8,
            durationMonths: row.durationMonths ? Number(row.durationMonths) : null,
            totalCredits: creditMax ?? creditMin,
            description: row.description || null,
            metadata,
            isActive: true,
          },
        });
        if (specializations.length > 0) {
          await prisma.programSpecialization.createMany({
            data: specializations.map((specializationName, index) => ({
              programId: created.id,
              specializationCode: `${code}-SP${index + 1}`,
              specializationName,
              isActive: true,
            })),
          });
        }
        results.created.push({ row: rowNum, programCode: code, id: created.id });
      } catch (e) {
        results.errors.push({ row: rowNum, programCode: code, errors: [e.message] });
      }
    }

    await cache.delPattern(`${cache.CACHE_KEYS.PROGRAM}*`);

    res.status(207).json({
      success: true,
      message: `Bulk upload complete: ${results.created.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors`,
      data: results,
    });
  } catch (error) {
    console.error('Bulk create programs error:', error);
    res.status(500).json({ success: false, message: 'Bulk upload failed' });
  }
};
