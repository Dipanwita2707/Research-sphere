const prisma = require('../../../shared/config/database');
const bcrypt = require('bcryptjs');
const auditLogger = require('../../../shared/utils/auditLogger');
const { validateCreateStudent, validateUpdateStudent } = require('../../../shared/validations/student.validation');

/**
 * Validates that mentorId is a faculty member in the same department as the student.
 * @param {string} mentorId - UserLogin id of the mentor (optional)
 * @param {string} studentDepartmentId - Department id (from program)
 * @returns {{ valid: boolean, error?: string, code?: string }}
 */
async function validateMentorForDepartment(mentorId, studentDepartmentId) {
  // Mentor is now optional
  if (!mentorId) {
    return { valid: true }; // No mentor is valid
  }
  const mentor = await prisma.userLogin.findUnique({
    where: { id: mentorId },
    include: { employeeDetails: { include: { primaryDepartment: true } } },
  });
  if (!mentor) {
    return { valid: false, error: 'Mentor not found', code: 'MENTOR_NOT_FOUND' };
  }
  if (mentor.role !== 'faculty') {
    return { valid: false, error: 'Selected mentor must be a faculty member', code: 'MENTOR_NOT_FACULTY' };
  }
  const mentorDeptId = mentor.employeeDetails?.primaryDepartmentId || mentor.employeeDetails?.primaryDepartment?.id;
  if (!mentorDeptId || mentorDeptId !== studentDepartmentId) {
    return { valid: false, error: 'Mentor must belong to the same department as the student', code: 'MENTOR_DIFFERENT_DEPARTMENT' };
  }
  return { valid: true };
}

// Create new student
const createStudent = async (req, res) => {
  try {
    // Validate input using Zod schema
    const validation = validateCreateStudent(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const {
      studentId: rawStudentId,
      registrationNo: rawRegistrationNo,
      firstName,
      middleName,
      lastName,
      email,
      phone,
      password,
      programId,
      sectionId,
      mentorId,
      currentSemester,
      admissionDate,
      dateOfBirth,
      gender,
      bloodGroup,
      parentContact,
      emergencyContact,
      address,
    } = validation.data;

    // Ensure studentId and registrationNo are always the same
    const studentId = rawStudentId || rawRegistrationNo;
    const registrationNo = rawRegistrationNo || rawStudentId;

    // Validate that at least one of studentId or registrationNo is provided
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID or Registration Number is required',
      });
    }

    // Resolve student's department from program
    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { departmentId: true },
    });
    if (!program) {
      return res.status(400).json({
        success: false,
        message: 'Invalid program',
        error: 'INVALID_PROGRAM',
      });
    }

    const mentorValidation = await validateMentorForDepartment(mentorId, program.departmentId);
    if (!mentorValidation.valid) {
      return res.status(400).json({
        success: false,
        message: mentorValidation.error,
        error: mentorValidation.code,
      });
    }

    // Check if student ID already exists
    const existingStudent = await prisma.studentDetails.findUnique({
      where: { studentId },
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Student with this ID already exists',
      });
    }

    // Check if registration number already exists
    const existingRegistration = await prisma.studentDetails.findUnique({
      where: { registrationNo },
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'Student with this Registration Number already exists',
      });
    }

    // Check if email already exists
    const existingUser = await prisma.userLogin.findFirst({
      where: {
        OR: [
          { email },
          { uid: studentId },
        ],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or UID already exists',
      });
    }

    // Hash password (default: Welcome@123)
    const defaultPassword = password || 'Welcome@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    // Create user and student in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create UserLogin
      const user = await tx.userLogin.create({
        data: {
          uid: studentId,
          email,
          passwordHash: hashedPassword,
          role: 'student',
          status: 'active',
        },
      });

      // Build display name
      let displayName = firstName;
      if (middleName) displayName += ` ${middleName}`;
      if (lastName) displayName += ` ${lastName}`;

      // Create StudentDetails (mentorId and section are now optional)
      const student = await tx.studentDetails.create({
        data: {
          userLogin: { connect: { id: user.id } },
          studentId,
          registrationNo,
          firstName,
          middleName: middleName || null,
          lastName: lastName || null,
          displayName,
          email,
          phone: phone || null,
          ...(programId && { program: { connect: { id: programId } } }),
          ...(mentorId && { mentor: { connect: { id: mentorId } } }),
          ...(sectionId && { section: { connect: { id: sectionId } } }),
          currentSemester: currentSemester ? parseInt(currentSemester) : 1,
          admissionDate: admissionDate ? new Date(admissionDate) : null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender: gender || null,
          bloodGroup: bloodGroup || null,
          parentContact: parentContact || null,
          emergencyContact: emergencyContact || null,
          address: address || null,
          isActive: true,
          dataEntryStatus: 'approved',
        },
      });

      return { user, student };
    });

    // Log student creation
    await auditLogger.logStudentCreation(
      result.student,
      req.user?.id || result.user.id,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: {
        userId: result.user.id,
        studentId: result.student.studentId,
        name: result.student.displayName,
        email: result.student.email,
      },
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create student',
      error: error.message,
    });
  }
};

// Get all students with filters
const getAllStudents = async (req, res) => {
  try {
    const {
      search,
      programId,
      sectionId,
      semester,
      isActive,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};

    // Search filter
    if (search) {
      where.OR = [
        { studentId: { contains: search, mode: 'insensitive' } },
        { registrationNo: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Program filter
    if (programId) {
      where.programId = programId;
    }

    // Section filter
    if (sectionId) {
      where.sectionId = sectionId;
    }

    // Semester filter
    if (semester) {
      where.currentSemester = parseInt(semester);
    }

    // Active status filter
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [students, total] = await Promise.all([
      prisma.studentDetails.findMany({
        where,
        include: {
          userLogin: {
            select: {
              uid: true,
              email: true,
              status: true,
            },
          },
          mentor: {
            select: {
              id: true,
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
          program: {
            select: {
              id: true,
              programName: true,
              programCode: true,
              department: {
                select: {
                  departmentName: true,
                  faculty: {
                    select: {
                      facultyName: true,
                    },
                  },
                },
              },
            },
          },
          section: {
            select: {
              id: true,
              sectionCode: true,
              academicYear: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.studentDetails.count({ where }),
    ]);

    res.json({
      success: true,
      data: students,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message,
    });
  }
};

// Get student by ID
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await prisma.studentDetails.findUnique({
      where: { id },
      include: {
        userLogin: {
          select: {
            uid: true,
            email: true,
            status: true,
            createdAt: true,
          },
        },
        mentor: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
        program: {
          select: {
            id: true,
            programName: true,
            programCode: true,
            department: {
              select: {
                departmentName: true,
                faculty: {
                  select: {
                    facultyName: true,
                  },
                },
              },
            },
          },
        },
        section: {
          select: {
            id: true,
            sectionCode: true,
            academicYear: true,
            semester: true,
          },
        },
        parents: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    res.json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student',
      error: error.message,
    });
  }
};

// Update student
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      middleName,
      lastName,
      phone,
      programId,
      sectionId,
      mentorId,
      currentSemester,
      admissionDate,
      dateOfBirth,
      gender,
      bloodGroup,
      parentContact,
      emergencyContact,
      address,
    } = req.body;

    // Check if student exists
    const existingStudent = await prisma.studentDetails.findUnique({
      where: { id },
    });

    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // If mentorId is being set/updated, validate mentor is faculty in same department
    const effectiveProgramId = programId || existingStudent.programId;
    if (mentorId) {
      if (!effectiveProgramId) {
        return res.status(400).json({
          success: false,
          message: 'Student must have a program to assign a mentor',
          error: 'PROGRAM_REQUIRED',
        });
      }
      const program = await prisma.program.findUnique({
        where: { id: effectiveProgramId },
        select: { departmentId: true },
      });
      if (!program) {
        return res.status(400).json({
          success: false,
          message: 'Invalid program',
          error: 'INVALID_PROGRAM',
        });
      }
      const mentorValidation = await validateMentorForDepartment(mentorId, program.departmentId);
      if (!mentorValidation.valid) {
        return res.status(400).json({
          success: false,
          message: mentorValidation.error,
          error: mentorValidation.code,
        });
      }
    }

    // Build display name
    let displayName = firstName || existingStudent.firstName;
    if (middleName) displayName += ` ${middleName}`;
    else if (existingStudent.middleName) displayName += ` ${existingStudent.middleName}`;
    if (lastName) displayName += ` ${lastName}`;
    else if (existingStudent.lastName) displayName += ` ${existingStudent.lastName}`;

    const updateData = {
      firstName: firstName || existingStudent.firstName,
      middleName: middleName !== undefined ? middleName : existingStudent.middleName,
      lastName: lastName !== undefined ? lastName : existingStudent.lastName,
      displayName,
      phone: phone !== undefined ? phone : existingStudent.phone,
      programId: programId || existingStudent.programId,
      sectionId: sectionId !== undefined ? (sectionId || null) : existingStudent.sectionId,
      currentSemester: currentSemester ? parseInt(currentSemester) : existingStudent.currentSemester,
      admissionDate: admissionDate ? new Date(admissionDate) : existingStudent.admissionDate,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingStudent.dateOfBirth,
      gender: gender !== undefined ? gender : existingStudent.gender,
      bloodGroup: bloodGroup !== undefined ? bloodGroup : existingStudent.bloodGroup,
      parentContact: parentContact !== undefined ? parentContact : existingStudent.parentContact,
      emergencyContact: emergencyContact !== undefined ? emergencyContact : existingStudent.emergencyContact,
      address: address !== undefined ? address : existingStudent.address,
      mentorId: mentorId !== undefined ? (mentorId || null) : existingStudent.mentorId,
    };

    const updatedStudent = await prisma.studentDetails.update({
      where: { id },
      data: updateData,
      include: {
        program: {
          select: {
            programName: true,
            programCode: true,
          },
        },
        section: {
          select: {
            sectionCode: true,
          },
        },
      },
    });

    // Log student update
    await auditLogger.logStudentUpdate(
      existingStudent,
      updatedStudent,
      req.user?.id,
      req
    );

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent,
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update student',
      error: error.message,
    });
  }
};

// Toggle student status
const toggleStudentStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await prisma.studentDetails.findUnique({
      where: { id },
      include: { userLogin: true },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Update both student and user login status
    await prisma.$transaction(async (tx) => {
      await tx.studentDetails.update({
        where: { id },
        data: { isActive: !student.isActive },
      });

      if (student.userLoginId) {
        await tx.userLogin.update({
          where: { id: student.userLoginId },
          data: { status: student.isActive ? 'inactive' : 'active' },
        });
      }
    });

    res.json({
      success: true,
      message: `Student ${student.isActive ? 'deactivated' : 'activated'} successfully`,
      data: { isActive: !student.isActive },
    });
  } catch (error) {
    console.error('Toggle student status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle student status',
      error: error.message,
    });
  }
};

// Get programs for dropdown
const getPrograms = async (req, res) => {
  try {
    const programs = await prisma.program.findMany({
      where: { isActive: true },
      select: {
        id: true,
        programName: true,
        programCode: true,
        department: {
          select: {
            departmentName: true,
            faculty: {
              select: {
                facultyName: true,
              },
            },
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
    console.error('Get programs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch programs',
      error: error.message,
    });
  }
};

// Get sections by program
const getSectionsByProgram = async (req, res) => {
  try {
    const { programId } = req.params;

    const sections = await prisma.section.findMany({
      where: {
        programId,
        status: 'active',
      },
      select: {
        id: true,
        sectionCode: true,
        academicYear: true,
        semester: true,
      },
      orderBy: [
        { academicYear: 'desc' },
        { semester: 'asc' },
        { sectionCode: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: sections,
    });
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sections',
      error: error.message,
    });
  }
};

// Get faculty (mentors) by program — only faculty from the program's department
const getFacultyByProgram = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { departmentId: true },
    });
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found',
      });
    }

    const faculty = await prisma.userLogin.findMany({
      where: {
        role: 'faculty',
        status: 'active',
        employeeDetails: {
          is: {
            primaryDepartmentId: program.departmentId,
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        uid: true,
        email: true,
        employeeDetails: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
      orderBy: { uid: 'asc' },
    });

    const data = faculty.map((f) => {
      const name = f.employeeDetails?.displayName ||
        [f.employeeDetails?.firstName, f.employeeDetails?.lastName].filter(Boolean).join(' ') ||
        f.uid;
      return { id: f.id, uid: f.uid, name, email: f.email };
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get faculty by program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch faculty',
      error: error.message,
    });
  }
};

// Reset student password
const resetStudentPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const student = await prisma.studentDetails.findUnique({
      where: { id },
      include: { userLogin: true },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    if (!student.userLoginId) {
      return res.status(400).json({
        success: false,
        message: 'Student does not have a login account',
      });
    }

    const password = newPassword || 'Welcome@123';
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.userLogin.update({
      where: { id: student.userLoginId },
      data: { passwordHash: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message,
    });
  }
};

module.exports = {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  toggleStudentStatus,
  getPrograms,
  getSectionsByProgram,
  getFacultyByProgram,
  resetStudentPassword,
};
