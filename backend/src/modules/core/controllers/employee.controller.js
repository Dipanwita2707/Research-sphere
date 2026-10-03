const prisma = require('../../../shared/config/database');
const auditLogger = require('../../../shared/utils/auditLogger');
const cache = require('../../../shared/config/redis');
const logger = require('../../../shared/utils/logger');
const { REVOKE_SESSIONS_DATA } = require('../../auth/services/session.service');
const { preparePassword, PasswordPolicyError } = require('../utils/userCredentials');

const EMPLOYEE_ROLES = ['faculty', 'staff'];
const { validateCreateEmployee, validateUpdateEmployee } = require('../../../shared/validations/employee.validation');

// Create new employee (Faculty/Staff)
const createEmployee = async (req, res) => {
  try {
    // Validate input using Zod schema
    const validation = validateCreateEmployee(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const {
      // Login details
      uid,
      email,
      password,
      role, // 'faculty' or 'staff'
      
      // Employee details
      empId,
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      mobileNumber,
      alternateNumber,
      personalEmail,
      
      // Professional details
      designation,
      officerLevel,
      employeeCategory, // 'teaching' or 'non_teaching'
      employeeType, // 'permanent', 'temporary', 'contract', etc.
      dateOfJoining,
      schoolId,
      departmentId,
      
      // Address
      currentAddress,
      permanentAddress,
      
      // Other
      isActive = true,

      // Researcher IDs (admin-managed)
      scopusAuthorId,
      orcid,
      pubmedId,
    } = validation.data;

    // Employees always belong to one university (superadmin must pick one)
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        code: 'UNIVERSITY_REQUIRED',
        message: 'Select a university before creating employees.',
      });
    }

    // Check if user already exists
    const existingUser = await prisma.userLogin.findFirst({
      where: {
        OR: [{ uid }, { email }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this UID or email already exists',
      });
    }

    // Check if empId already exists
    const existingEmpId = await prisma.employeeDetails.findFirst({
      where: { empId },
    });

    if (existingEmpId) {
      return res.status(400).json({
        success: false,
        message: `Employee ID ${empId} already exists`,
      });
    }

    // Hash password (policy-checked)
    const { passwordHash: hashedPassword, passwordChangedAt } = await preparePassword(password, { uid, email });
    const normalizedMiddleName = (middleName || '').trim();
    const normalizedLastName = (lastName || '').trim();
    const storedLastName = [normalizedMiddleName, normalizedLastName].filter(Boolean).join(' ') || null;
    const displayName = [firstName, normalizedMiddleName, normalizedLastName].filter(Boolean).join(' ');

    // Create user with employee details in a transaction with extended timeout
    const result = await prisma.$transaction(async (tx) => {
      // Create user login
      const user = await tx.userLogin.create({
        data: {
          uid,
          email,
          passwordHash: hashedPassword,
          passwordChangedAt,
          role: role || 'faculty',
          status: isActive ? 'active' : 'inactive',
          // Tenant binding — required by protect() for non-superadmin users
          universityId: req.tenantId,
        },
      });

      // Create employee details
      const employee = await tx.employeeDetails.create({
        data: {
          userLogin: {
            connect: { id: user.id }
          },
          empId,
          firstName,
          lastName: storedLastName,
          displayName,
          designation,
          officerLevel: officerLevel || null,
          email: email,
          phoneNumber: mobileNumber || null,
          joinDate: dateOfJoining ? new Date(dateOfJoining) : new Date(),
          ...(schoolId && {
            primarySchool: {
              connect: { id: schoolId }
            }
          }),
          ...(departmentId && {
            primaryDepartment: {
              connect: { id: departmentId }
            }
          }),
          ...(req.body.primaryCentralDeptId && {
            primaryCentralDept: {
              connect: { id: req.body.primaryCentralDeptId }
            }
          }),
          isActive,
          metadata: {
            gender,
            mobileNumber,
            alternateNumber,
            personalEmail: personalEmail || email,
            employeeCategory,
            employeeType,
            dateOfBirth,
            currentAddress,
            permanentAddress,
          },
        },
      });

      // Assign default permissions based on department and role
      if (departmentId && (role === 'faculty' || role === 'staff')) {
        // Default permissions for faculty and staff in academic departments
        const defaultPermissions = {
          view_dashboard: true,
          view_reports: true,
          view_students: role === 'faculty', // Faculty can view students
          file_ipr: true, // All faculty/staff can file IPR
          view_own_ipr: true,
          edit_own_ipr: true,
        };

        await tx.departmentPermission.create({
          data: {
            userId: user.id,
            departmentId: departmentId,
            permissions: defaultPermissions,
            isPrimary: true,
            isActive: true,
            assignedBy: null, // System assigned
          },
        });
      }

      // TODO: Assign default permissions for central department employees
      // Note: CentralDepartmentPermission model needs to be created in schema first
      if (req.body.primaryCentralDeptId && (role === 'staff' || role === 'admin')) {
        console.log(`Employee assigned to central department: ${req.body.primaryCentralDeptId}`);
        // Permission assignment will be implemented once the permission models are created
      }

      // Upsert researcher IDs into ResearchProfileIdentity if any are provided
      const hasResearcherId = scopusAuthorId || orcid || pubmedId;
      if (hasResearcherId) {
        await tx.researchProfileIdentity.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            scopusAuthorId: scopusAuthorId || null,
            orcid: orcid || null,
            pubmedId: pubmedId || null,
            syncFrequencyDays: 1,
          },
          update: {
            scopusAuthorId: scopusAuthorId || null,
            orcid: orcid || null,
            pubmedId: pubmedId || null,
          },
        });
      }

      return { user, employee };
    });

    // Log employee creation
    await auditLogger.logEmployeeCreation(
      result.employee,
      req.user?.id || result.user.id,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: {
        userId: result.user.id,
        uid: result.user.uid,
        email: result.user.email,
        employeeId: result.employee.id,
        empId: result.employee.empId,
        displayName: result.employee.displayName,
      },
    });
  } catch (error) {
    if (error instanceof PasswordPolicyError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Create employee error:', error);
    // Unique constraint (e.g. duplicate uid/email) → return 400 with clear message
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      const field = Array.isArray(target) ? target[0] : target;
      const message = field === 'uid'
        ? 'A user with this UID already exists'
        : field === 'email'
          ? 'A user with this email already exists'
          : 'A record with this value already exists';
      return res.status(400).json({
        success: false,
        message,
        error: 'DUPLICATE_' + (field ? String(field).toUpperCase() : 'RECORD'),
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create employee',
    });
  }
};

// Get all employees with filters
const getAllEmployees = async (req, res) => {
  try {
    const { role, schoolId, departmentId, employeeCategory, designation, search, page = 1, limit = 50 } = req.query;

    const where = {
      role: {
        in: ['faculty', 'staff'],
      },
    };

    // Tenant isolation: scope employees to the requesting university
    if (req.tenantId) {
      where.universityId = req.tenantId;
    }

    if (role && role !== 'all') {
      where.role = role;
    }

    const employeeWhere = {};
    if (schoolId) employeeWhere.primarySchoolId = schoolId;
    if (departmentId) employeeWhere.primaryDepartmentId = departmentId;
    // employeeCategory is stored inside the metadata JSON column
    if (employeeCategory) {
      employeeWhere.metadata = {
        path: ['employeeCategory'],
        equals: employeeCategory,
      };
    }
    if (designation && String(designation).trim()) {
      employeeWhere.designation = { equals: String(designation).trim(), mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { uid: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
      employeeWhere.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { empId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [employees, total] = await Promise.all([
      prisma.userLogin.findMany({
        where: {
          ...where,
          employeeDetails: {
            is: employeeWhere,
          },
        },
        omit: { passwordHash: true, tokenVersion: true },
        include: {
          employeeDetails: {
            include: {
              primaryDepartment: {
                select: {
                  id: true,
                  departmentName: true,
                  faculty: {
                    select: {
                      id: true,
                      facultyName: true,
                    },
                  },
                },
              },
              primarySchool: {
                select: {
                  id: true,
                  facultyName: true,
                },
              },
              primaryCentralDept: {
                select: {
                  id: true,
                  departmentName: true,
                },
              },
            },
          },
          researchProfileIdentity: {
            select: {
              id: true,
              scopusAuthorId: true,
              orcid: true,
              pubmedId: true,
              webOfScienceId: true,
              syncStatus: true,
              lastSyncedAt: true,
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.userLogin.count({
        where: {
          ...where,
          employeeDetails: {
            is: employeeWhere,
          },
        },
      }),
    ]);

    // Format employee data to include IDs for frontend
    const formattedEmployees = employees.map(emp => {
      if (!emp.employeeDetails) {
        return emp;
      }

      const meta = (emp.employeeDetails.metadata && typeof emp.employeeDetails.metadata === 'object')
        ? emp.employeeDetails.metadata
        : {};
      const employeeDetails = {
        ...emp.employeeDetails,
        // Flatten metadata fields for easy frontend access
        gender: meta.gender || null,
        mobileNumber: meta.mobileNumber || emp.employeeDetails.phoneNumber || null,
        alternateNumber: meta.alternateNumber || null,
        personalEmail: meta.personalEmail || null,
        employeeCategory: meta.employeeCategory || null,
        employeeType: meta.employeeType || null,
        dateOfBirth: meta.dateOfBirth ? String(meta.dateOfBirth).slice(0, 10) : null,
        currentAddress: meta.currentAddress || null,
        permanentAddress: meta.permanentAddress || null,
        // Map DB field joinDate → dateOfJoining (YYYY-MM-DD)
        dateOfJoining: emp.employeeDetails.joinDate
          ? new Date(emp.employeeDetails.joinDate).toISOString().slice(0, 10)
          : null,
        // IDs
        schoolId: emp.employeeDetails.primarySchool?.id || emp.employeeDetails.primarySchoolId || null,
        schoolName: emp.employeeDetails.primarySchool?.facultyName || null,
        departmentId: emp.employeeDetails.primaryDepartment?.id || emp.employeeDetails.primaryDepartmentId || null,
        departmentName: emp.employeeDetails.primaryDepartment?.departmentName || null,
        centralDepartmentId: emp.employeeDetails.primaryCentralDept?.id || emp.employeeDetails.primaryCentralDeptId || null,
        centralDepartmentName: emp.employeeDetails.primaryCentralDept?.departmentName || null,
      };

      return {
        ...emp,
        isActive: emp.status === 'active',
        employeeDetails
      };
    });

    res.json({
      success: true,
      data: formattedEmployees,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get all employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
    });
  }
};

// Get employee by ID
const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await prisma.userLogin.findUnique({
      where: { id },
      omit: { passwordHash: true, tokenVersion: true },
      include: {
        employeeDetails: {
          include: {
            primaryDepartment: {
              include: {
                faculty: true,
              },
            },
            primaryCentralDept: true,
          },
        },
        researchProfileIdentity: {
          select: {
            id: true,
            scopusAuthorId: true,
            orcid: true,
            pubmedId: true,
            webOfScienceId: true,
            syncStatus: true,
            lastSyncedAt: true,
            autoSyncEnabled: true,
          },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    // Tenant isolation: prevent cross-university access
    if (req.tenantId && employee.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This employee does not belong to your university.',
      });
    }

    res.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error('Get employee by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee',
    });
  }
};

// Update employee
const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate input using Zod schema
    const validation = validateUpdateEmployee(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const updates = validation.data;

    // Only faculty/staff accounts of this university are managed here
    const target = await prisma.userLogin.findUnique({
      where: { id },
      select: { id: true, uid: true, email: true, role: true },
    });
    if (!target || !EMPLOYEE_ROLES.includes(target.role)) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    // Separate login updates from employee details updates
    const loginUpdates = {};
    const employeeUpdates = {};

    // Login fields
    if (updates.email) loginUpdates.email = updates.email;
    if (updates.role) loginUpdates.role = updates.role;
    if (updates.isActive !== undefined) {
      loginUpdates.status = updates.isActive ? 'active' : 'inactive';
    }
    if (updates.password) {
      const prepared = await preparePassword(updates.password, { uid: target.uid, email: updates.email || target.email });
      loginUpdates.passwordHash = prepared.passwordHash;
      loginUpdates.passwordChangedAt = prepared.passwordChangedAt;
    }
    // Role, status or password changes end every existing session of the user
    const revokeSessions = Boolean(
      (updates.role && updates.role !== target.role)
      || updates.isActive !== undefined
      || updates.password
    );
    if (revokeSessions) Object.assign(loginUpdates, REVOKE_SESSIONS_DATA);

    // Employee detail fields (only fields that exist in schema)
    if (updates.firstName) employeeUpdates.firstName = updates.firstName;
    if (updates.lastName !== undefined) employeeUpdates.lastName = updates.lastName || null;
    if (updates.designation !== undefined) employeeUpdates.designation = updates.designation || null;
    if (updates.officerLevel !== undefined) employeeUpdates.officerLevel = updates.officerLevel || null;
    if (updates.email) employeeUpdates.email = updates.email;
    if (updates.mobileNumber) employeeUpdates.phoneNumber = updates.mobileNumber;
    if (updates.dateOfJoining) employeeUpdates.joinDate = new Date(updates.dateOfJoining);
    if (updates.schoolId !== undefined) employeeUpdates.primarySchoolId = updates.schoolId || null;
    if (updates.departmentId !== undefined) employeeUpdates.primaryDepartmentId = updates.departmentId || null;
    if (updates.primaryCentralDeptId !== undefined) employeeUpdates.primaryCentralDeptId = updates.primaryCentralDeptId || null;
    if (updates.primaryCentralDeptId) {
      employeeUpdates.primarySchoolId = null;
      employeeUpdates.primaryDepartmentId = null;
    } else if (updates.schoolId || updates.departmentId) {
      employeeUpdates.primaryCentralDeptId = null;
    }
    if (updates.isActive !== undefined) employeeUpdates.isActive = updates.isActive;
    
    // Store extra fields in metadata
    const employee = await prisma.employeeDetails.findFirst({
      where: { userLoginId: id },
    });
    
    if (employee) {
      const metadata = employee.metadata || {};
      if (updates.gender) metadata.gender = updates.gender;
      if (updates.mobileNumber) metadata.mobileNumber = updates.mobileNumber;
      if (updates.employeeCategory) metadata.employeeCategory = updates.employeeCategory;
      if (updates.employeeType) metadata.employeeType = updates.employeeType;
      if (updates.dateOfBirth !== undefined) metadata.dateOfBirth = updates.dateOfBirth || null;
      if (updates.alternateNumber !== undefined) metadata.alternateNumber = updates.alternateNumber || null;
      if (updates.personalEmail !== undefined) metadata.personalEmail = updates.personalEmail || null;
      if (updates.currentAddress !== undefined) metadata.currentAddress = updates.currentAddress || null;
      if (updates.permanentAddress !== undefined) metadata.permanentAddress = updates.permanentAddress || null;
      if (Object.keys(metadata).length > 0) {
        employeeUpdates.metadata = metadata;
      }
    }

    // Update displayName if name fields changed
    if (updates.firstName !== undefined || updates.middleName !== undefined || updates.lastName !== undefined) {
      const firstName = updates.firstName || employee?.firstName || '';
      const middleName = updates.middleName !== undefined ? updates.middleName : '';
      const lastName = updates.lastName !== undefined ? updates.lastName : (employee?.lastName || '');

      employeeUpdates.displayName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    }

    // Perform updates in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.userLogin.update({
        where: { id },
        data: loginUpdates,
      });

      let updatedEmployee = null;
      if (Object.keys(employeeUpdates).length > 0) {
        updatedEmployee = await tx.employeeDetails.updateMany({
          where: { userLoginId: id },
          data: employeeUpdates,
        });
      }

      // Upsert researcher IDs if any are present in the request
      const researchIdUpdates = {};
      if (updates.scopusAuthorId !== undefined) researchIdUpdates.scopusAuthorId = updates.scopusAuthorId || null;
      if (updates.orcid !== undefined)          researchIdUpdates.orcid          = updates.orcid          || null;
      if (updates.pubmedId !== undefined)       researchIdUpdates.pubmedId       = updates.pubmedId       || null;

      if (Object.keys(researchIdUpdates).length > 0) {
        await tx.researchProfileIdentity.upsert({
          where: { userId: id },
          create: {
            userId: id,
            syncFrequencyDays: 1,
            ...researchIdUpdates,
          },
          update: researchIdUpdates,
        });
      }

      return { user: updatedUser, employee: updatedEmployee };
    });

    // Log employee update
    const updatedEmployeeDetails = await prisma.employeeDetails.findFirst({
      where: { userLoginId: id }
    });
    
    if (employee && updatedEmployeeDetails) {
      await auditLogger.logEmployeeUpdate(
        employee,
        updatedEmployeeDetails,
        req.user?.id || id,
        req
      );
    }

    // Drop the cached auth record after commit (role/status/tokenVersion may have changed)
    await cache.invalidateUser(id);

    const { passwordHash, ...safeUser } = result.user;
    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: safeUser,
    });
  } catch (error) {
    if (error instanceof PasswordPolicyError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Update employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employee',
    });
  }
};

// Reset employee password
const resetEmployeePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await prisma.userLogin.findUnique({
      where: { id },
      include: { employeeDetails: true },
    });

    if (!user || !user.employeeDetails || !['faculty', 'staff'].includes(user.role)) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    // No default password: use the admin's (policy-checked) or generate a strong one
    const { passwordHash, passwordChangedAt, generatedPassword } = await preparePassword(newPassword, user);

    await prisma.userLogin.update({
      where: { id },
      data: {
        passwordHash,
        passwordChangedAt,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...REVOKE_SESSIONS_DATA,
      },
    });
    await cache.invalidateUser(id);

    res.json({
      success: true,
      message: generatedPassword
        ? 'Password reset successfully. Share the generated password with the user; it will not be shown again.'
        : 'Password reset successfully',
      ...(generatedPassword && { data: { generatedPassword } }),
    });
  } catch (error) {
    if (error instanceof PasswordPolicyError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Reset employee password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
    });
  }
};

// Toggle employee status
const toggleEmployeeStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.userLogin.findUnique({
      where: { id },
      select: {
        status: true,
        role: true,
        employeeDetails: {
          select: { isActive: true }
        }
      },
    });

    if (!user || !EMPLOYEE_ROLES.includes(user.role)) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const newIsActive = newStatus === 'active';
    
    // Update both userLogin status and employeeDetails isActive in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update user login status
      const updatedUser = await tx.userLogin.update({
        where: { id },
        data: { status: newStatus, ...REVOKE_SESSIONS_DATA },
        select: { id: true, uid: true, email: true, role: true, status: true, universityId: true, updatedAt: true },
      });

      // Update employee details isActive
      await tx.employeeDetails.updateMany({
        where: { userLoginId: id },
        data: { isActive: newIsActive },
      });

      return updatedUser;
    });
    await cache.invalidateUser(id);

    res.json({
      success: true,
      message: `Employee ${updated.status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error('Toggle employee status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle employee status',
    });
  }
};

/** Get distinct designation values for filter dropdowns */
const getDesignations = async (req, res) => {
  try {
    const rows = await prisma.employeeDetails.findMany({
      where: { designation: { not: null } },
      select: { designation: true },
      distinct: ['designation'],
      orderBy: { designation: 'asc' },
    });
    const list = rows.map((r) => r.designation).filter(Boolean);
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Get designations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch designations',
    });
  }
};

/**
 * Records an employee leaves behind that belong to the institution (and often to other
 * people): their submissions, authorships on colleagues' papers, reviews, approvals,
 * status history, policies. If any exist the account is deactivated, never deleted.
 */
async function countEmployeeFootprint(tx, user) {
  const id = user.id;
  const authorMatch = [{ userId: id }, ...(user.uid ? [{ uid: user.uid }] : []), ...(user.email ? [{ email: user.email }] : [])];
  const counts = await Promise.all([
    tx.researchContribution.count({ where: { applicantUserId: id } }),
    tx.iprApplication.count({ where: { applicantUserId: id } }),
    tx.grantApplication.count({ where: { applicantUserId: id } }),
    tx.researchContributionAuthor.count({ where: { OR: authorMatch } }),
    tx.iprContributor.count({ where: { OR: authorMatch } }),
    tx.grantInvestigator.count({ where: { userId: id } }),
    tx.researchProgressTracker.count({ where: { userId: id } }),
    tx.researchContributionReview.count({ where: { reviewerId: id } }),
    tx.iprReview.count({ where: { reviewerId: id } }),
    tx.grantApplicationReview.count({ where: { reviewerId: id } }),
    tx.iprFinance.count({ where: { financeReviewerId: id } }),
  ]);
  return counts.reduce((sum, n) => sum + n, 0);
}

/**
 * Release work queued for this person and remove their access. Shared by deactivation
 * and deletion so nothing stays assigned to an account that can no longer sign in.
 */
async function releaseEmployeeAccess(tx, id) {
  await tx.researchContribution.updateMany({ where: { currentReviewerId: id }, data: { currentReviewerId: null } });
  await tx.iprApplication.updateMany({ where: { currentReviewerId: id }, data: { currentReviewerId: null } });
  await tx.grantApplication.updateMany({ where: { currentReviewerId: id }, data: { currentReviewerId: null } });
  await tx.userDepartmentPermission.deleteMany({ where: { userId: id } });
  await tx.departmentPermission.deleteMany({ where: { userId: id } });
  await tx.centralDepartmentPermission.deleteMany({ where: { userId: id } });
  await tx.passwordResetToken.deleteMany({ where: { userId: id } });
}

/**
 * DELETE /employees/:id
 *
 * An employee with institutional records is DEACTIVATED: sign-in blocked, sessions revoked,
 * permissions removed, review queues released — every record (theirs and everyone else's) is
 * kept. Personal data can then be anonymised through the DPDP erasure flow.
 * Only an employee with no records at all is permanently deleted.
 */
const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.userLogin.findUnique({
      where: { id },
      select: { id: true, uid: true, email: true, role: true, status: true, universityId: true, employeeDetails: { select: { id: true } } },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    // Tenant isolation: prevent cross-university deletion
    if (req.tenantId && user.universityId !== req.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied: This employee does not belong to your university.' });
    }
    if (!['faculty', 'staff'].includes(user.role)) {
      return res.status(400).json({ success: false, message: 'Only faculty or staff employees can be deleted via this endpoint' });
    }
    if (req.user?.id === id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const deactivate = () =>
      prisma.$transaction(async (tx) => {
        await releaseEmployeeAccess(tx, id);
        await tx.userLogin.update({ where: { id }, data: { status: 'inactive', ...REVOKE_SESSIONS_DATA } });
        if (user.employeeDetails?.id) {
          await tx.employeeDetails.update({ where: { id: user.employeeDetails.id }, data: { isActive: false } });
        }
      }).then(() => cache.invalidateUser(id));

    const footprint = await countEmployeeFootprint(prisma, user);
    if (footprint > 0) {
      await deactivate();
      return res.json({
        success: true,
        action: 'deactivated',
        message: `Employee deactivated. They have ${footprint} research, IPR or grant record(s), which are kept; sign-in and permissions were removed.`,
      });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await releaseEmployeeAccess(tx, id);
        // Unlink optional references that point at this person.
        await tx.grantApplication.updateMany({ where: { OR: [{ approvedById: id }, { rejectedById: id }] }, data: { approvedById: null, rejectedById: null } });
        await tx.studentDetails.updateMany({ where: { mentorId: id }, data: { mentorId: null } });
        await tx.studentDetails.updateMany({ where: { dataApprovedById: id }, data: { dataApprovedById: null } });
        await tx.userDepartmentPermission.updateMany({ where: { assignedBy: id }, data: { assignedBy: null } });
        await tx.departmentPermission.updateMany({ where: { assignedBy: id }, data: { assignedBy: null } });
        await tx.centralDepartmentPermission.updateMany({ where: { assignedBy: id }, data: { assignedBy: null } });
        await tx.auditLog.updateMany({ where: { actorId: id }, data: { actorId: null } });
        for (const model of ['incentivePolicy', 'researchIncentivePolicy', 'bookIncentivePolicy', 'bookChapterIncentivePolicy', 'conferenceIncentivePolicy', 'grantIncentivePolicy']) {
          await tx[model].updateMany({ where: { updatedById: id }, data: { updatedById: null } });
        }
        await tx.iPR.updateMany({ where: { approvedById: id }, data: { approvedById: null } });
        await tx.card.updateMany({ where: { issuedById: id }, data: { issuedById: null } });
        await tx.reissueRequest.updateMany({ where: { requestedById: id }, data: { requestedById: null } });
        await tx.reissueRequest.updateMany({ where: { approvedById: id }, data: { approvedById: null } });
        // The person's own data (settings, notifications, profile) goes with the account.
        await tx.researchProfileIdentity.deleteMany({ where: { userId: id } });
        await tx.notification.deleteMany({ where: { userId: id } });
        await tx.userSettings.deleteMany({ where: { userId: id } });
        if (user.employeeDetails?.id) {
          await tx.employeeDetails.delete({ where: { id: user.employeeDetails.id } });
        }
        await tx.userLogin.delete({ where: { id } });
      }, { maxWait: 30000, timeout: 60000 });
      await cache.invalidateUser(id);
    } catch (error) {
      // P2003: something else (HOD, coordinator, policy author, review history…) still
      // references this person. Keep the records and deactivate instead.
      if (error.code === 'P2003') {
        await deactivate();
        return res.json({
          success: true,
          action: 'deactivated',
          message: 'Employee deactivated instead of deleted because other records reference them (e.g. head of department, reviews or policies). Sign-in and permissions were removed.',
        });
      }
      throw error;
    }

    return res.json({ success: true, action: 'deleted', message: 'Employee deleted successfully' });
  } catch (error) {
    logger.error('Delete employee error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete employee' });
  }
};

// Update employee researcher IDs (admin-only)
// PATCH /api/employees/:id/research-ids
const updateEmployeeResearchIds = async (req, res) => {
  try {
    const { id } = req.params;
    const { scopusAuthorId, orcid, pubmedId } = req.body;

    // Validate ORCID format if provided
    if (orcid && !/^\d{4}-\d{4}-\d{4}-[\dX]{4}$/i.test(orcid)) {
      return res.status(400).json({
        success: false,
        message: 'ORCID must be in the format XXXX-XXXX-XXXX-XXXX (e.g., 0000-0002-1825-0097)',
      });
    }

    // Ensure the user exists and belongs to this university
    const user = await prisma.userLogin.findUnique({
      where: { id },
      select: { id: true, uid: true, role: true, universityId: true },
    });

    if (!user || !['faculty', 'staff', 'admin'].includes(user.role)) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    // Tenant isolation: prevent cross-university researcher ID updates
    if (req.tenantId && user.universityId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This employee does not belong to your university.',
      });
    }

    // Build update payload — only include fields that were sent
    const updateData = {};
    if (scopusAuthorId !== undefined) updateData.scopusAuthorId = scopusAuthorId || null;
    if (orcid !== undefined)          updateData.orcid          = orcid          || null;
    if (pubmedId !== undefined)       updateData.pubmedId       = pubmedId       || null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one of scopusAuthorId, orcid, or pubmedId must be provided',
      });
    }

    const identity = await prisma.researchProfileIdentity.upsert({
      where: { userId: id },
      create: {
        userId: id,
        syncFrequencyDays: 1,
        ...updateData,
      },
      update: updateData,
    });


    return res.json({
      success: true,
      message: 'Researcher IDs updated successfully',
      data: {
        scopusAuthorId: identity.scopusAuthorId,
        orcid: identity.orcid,
        pubmedId: identity.pubmedId,
        webOfScienceId: identity.webOfScienceId,
        syncStatus: identity.syncStatus,
        lastSyncedAt: identity.lastSyncedAt,
      },
    });
  } catch (error) {
    console.error('Update researcher IDs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update researcher IDs',
    });
  }
};

module.exports = {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  resetEmployeePassword,
  toggleEmployeeStatus,
  getDesignations,
  deleteEmployee,
  updateEmployeeResearchIds,
};
