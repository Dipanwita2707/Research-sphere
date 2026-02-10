const prisma = require('../../../shared/config/database');
const bcrypt = require('bcryptjs');
const auditLogger = require('../../../shared/utils/auditLogger');

// Create new employee (Faculty/Staff)
const createEmployee = async (req, res) => {
  try {
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
    } = req.body;

    // Debug logging
    console.log('=== CREATE EMPLOYEE DEBUG ===');
    console.log('schoolId:', schoolId);
    console.log('departmentId:', departmentId);
    console.log('designation:', designation);
    console.log('primaryCentralDeptId:', req.body.primaryCentralDeptId);
    console.log('Full request body:', JSON.stringify(req.body, null, 2));

    // Validate required fields
    if (!uid || !email || !password || !firstName || !lastName || !empId) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: uid, email, password, firstName, lastName, empId',
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
    const existingEmpId = await prisma.employeeDetails.findUnique({
      where: { empId },
    });

    if (existingEmpId) {
      return res.status(400).json({
        success: false,
        message: `Employee ID ${empId} already exists`,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with employee details in a transaction with extended timeout
    const result = await prisma.$transaction(async (tx) => {
      // Create user login
      const user = await tx.userLogin.create({
        data: {
          uid,
          email,
          passwordHash: hashedPassword,
          role: role || 'faculty',
          status: isActive ? 'active' : 'inactive',
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
          lastName: middleName ? `${middleName} ${lastName}` : lastName,
          displayName: middleName 
            ? `${firstName} ${middleName} ${lastName}` 
            : `${firstName} ${lastName}`,
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

      return { user, employee };
    });

    // Log employee creation
    await auditLogger.logEmployeeCreation(
      result.employee,
      req.user?.id || result.user.id,
      req
    );

    // Log what was created
    console.log('=== EMPLOYEE CREATED ===');
    console.log('Employee ID:', result.employee.id);
    console.log('Primary School ID:', result.employee.primarySchoolId);
    console.log('Primary Department ID:', result.employee.primaryDepartmentId);
    console.log('Designation:', result.employee.designation);

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
      error: error.message,
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

    if (role && role !== 'all') {
      where.role = role;
    }

    const employeeWhere = {};
    if (schoolId) employeeWhere.schoolId = schoolId;
    if (departmentId) employeeWhere.departmentId = departmentId;
    if (employeeCategory) employeeWhere.employeeCategory = employeeCategory;
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

    // Debug: Log raw employee data from database
    console.log('Raw employees from DB:', employees.map(emp => ({
      id: emp.id,
      uid: emp.uid,
      hasEmployeeDetails: !!emp.employeeDetails,
      primarySchoolId: emp.employeeDetails?.primarySchoolId,
      primaryDepartmentId: emp.employeeDetails?.primaryDepartmentId,
      hasPrimarySchool: !!emp.employeeDetails?.primarySchool,
      hasPrimaryDepartment: !!emp.employeeDetails?.primaryDepartment,
    })));

    // Format employee data to include IDs for frontend
    const formattedEmployees = employees.map(emp => {
      if (!emp.employeeDetails) {
        return emp;
      }

      const employeeDetails = {
        ...emp.employeeDetails,
        schoolId: emp.employeeDetails.primarySchool?.id || emp.employeeDetails.primarySchoolId || null,
        schoolName: emp.employeeDetails.primarySchool?.facultyName || null,
        departmentId: emp.employeeDetails.primaryDepartment?.id || emp.employeeDetails.primaryDepartmentId || null,
        departmentName: emp.employeeDetails.primaryDepartment?.departmentName || null,
        centralDepartmentId: emp.employeeDetails.primaryCentralDept?.id || emp.employeeDetails.primaryCentralDeptId || null,
        centralDepartmentName: emp.employeeDetails.primaryCentralDept?.departmentName || null,
      };

      console.log('Formatted employee:', {
        id: emp.id,
        schoolId: employeeDetails.schoolId,
        departmentId: employeeDetails.departmentId,
        schoolName: employeeDetails.schoolName,
        departmentName: employeeDetails.departmentName
      });

      return {
        ...emp,
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
      error: error.message,
    });
  }
};

// Get employee by ID
const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await prisma.userLogin.findUnique({
      where: { id },
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
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
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
      error: error.message,
    });
  }
};

// Update employee
const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('=== UPDATE EMPLOYEE DEBUG ===');
    console.log('User ID:', id);
    console.log('Updates received:', JSON.stringify(updates, null, 2));

    // Separate login updates from employee details updates
    const loginUpdates = {};
    const employeeUpdates = {};

    // Login fields
    if (updates.email) loginUpdates.email = updates.email;
    if (updates.isActive !== undefined) {
      loginUpdates.status = updates.isActive ? 'active' : 'inactive';
    }
    if (updates.password) {
      loginUpdates.passwordHash = await bcrypt.hash(updates.password, 12);
    }

    // Employee detail fields (only fields that exist in schema)
    if (updates.firstName) employeeUpdates.firstName = updates.firstName;
    if (updates.lastName) employeeUpdates.lastName = updates.lastName;
    if (updates.designation !== undefined) employeeUpdates.designation = updates.designation || null;
    if (updates.officerLevel !== undefined) employeeUpdates.officerLevel = updates.officerLevel || null;
    if (updates.email) employeeUpdates.email = updates.email;
    if (updates.mobileNumber) employeeUpdates.phoneNumber = updates.mobileNumber;
    if (updates.dateOfJoining) employeeUpdates.joinDate = new Date(updates.dateOfJoining);
    if (updates.schoolId !== undefined) employeeUpdates.primarySchoolId = updates.schoolId || null;
    if (updates.departmentId !== undefined) employeeUpdates.primaryDepartmentId = updates.departmentId || null;
    if (updates.primaryCentralDeptId !== undefined) employeeUpdates.primaryCentralDeptId = updates.primaryCentralDeptId || null;
    if (updates.isActive !== undefined) employeeUpdates.isActive = updates.isActive;
    
    console.log('Employee updates to apply:', employeeUpdates);
    
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
      if (Object.keys(metadata).length > 0) {
        employeeUpdates.metadata = metadata;
      }
    }

    // Update displayName if name fields changed
    if (updates.firstName || updates.middleName || updates.lastName) {
      const firstName = updates.firstName || employee?.firstName;
      const lastName = updates.lastName || employee?.lastName;
      const middleName = updates.middleName;
      
      employeeUpdates.displayName = middleName 
        ? `${firstName} ${middleName} ${lastName}` 
        : `${firstName} ${lastName}`;
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

    console.log('=== EMPLOYEE UPDATE COMPLETE ===');
    console.log('Updated fields:', Object.keys(employeeUpdates));
    console.log('Result:', result);

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: result.user,
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employee',
      error: error.message,
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
        employeeDetails: {
          select: { isActive: true }
        }
      },
    });

    if (!user) {
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
        data: { status: newStatus },
      });

      // Update employee details isActive
      await tx.employeeDetails.updateMany({
        where: { userLoginId: id },
        data: { isActive: newIsActive },
      });

      return updatedUser;
    });

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
      error: error.message,
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
      error: error.message,
    });
  }
};

/** Delete employee (UserLogin + EmployeeDetails). Fails if user is referenced as HOD, coordinator, etc. */
const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.userLogin.findUnique({
      where: { id },
      include: { employeeDetails: true },
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }
    if (!['faculty', 'staff'].includes(user.role)) {
      return res.status(400).json({
        success: false,
        message: 'Only faculty or staff employees can be deleted via this endpoint',
      });
    }
    await prisma.$transaction(async (tx) => {
      if (user.employeeDetails?.id) {
        await tx.employeeDetails.delete({
          where: { id: user.employeeDetails.id },
        });
      }
      await tx.userLogin.delete({
        where: { id },
      });
    });
    res.json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete: employee is referenced elsewhere (e.g. as head of department, coordinator, or in permissions). Deactivate the employee instead.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to delete employee',
      error: error.message,
    });
  }
};

module.exports = {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  toggleEmployeeStatus,
  getDesignations,
  deleteEmployee,
};
