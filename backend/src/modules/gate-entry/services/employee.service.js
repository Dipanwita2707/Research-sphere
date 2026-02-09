const prisma = require('../../../shared/config/database');

/**
 * Get all active employees for gate entry dropdown
 * Returns simplified employee data with user login details
 */
const getActiveEmployeesForGateEntry = async () => {
  try {
    console.log('=== FETCHING ACTIVE EMPLOYEES ===');
    
    // First check total employees
    const totalEmployees = await prisma.employeeDetails.count({
      where: { isActive: true }
    });
    console.log('Total active employees:', totalEmployees);
    
    // Check employees with userLogin
    const employeesWithLogin = await prisma.employeeDetails.count({
      where: {
        isActive: true,
        userLoginId: { not: null }
      }
    });
    console.log('Active employees with userLoginId:', employeesWithLogin);
    
    const employees = await prisma.employeeDetails.findMany({
      where: {
        isActive: true,
        userLoginId: { not: null }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        empId: true,
        designation: true,
        email: true,
        phoneNumber: true,
        userLoginId: true,
        userLogin: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true
          }
        },
        primaryDepartment: {
          select: {
            id: true,
            departmentName: true
          }
        },
        primaryCentralDept: {
          select: {
            id: true,
            departmentName: true
          }
        }
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    });

    console.log('Raw employees from DB:', employees.length);
    console.log('Sample employee:', employees[0]);

    // Format employee data for dropdown
    const formattedEmployees = employees.map(emp => {
      const fullName = emp.displayName || 
                      `${emp.firstName}${emp.lastName ? ' ' + emp.lastName : ''}`;
      
      const department = emp.primaryDepartment?.departmentName || 
                        emp.primaryCentralDept?.departmentName || 
                        'N/A';

      return {
        id: emp.userLogin?.id || emp.id, // Use userLoginId for gate pass relation
        employeeId: emp.id,
        userLoginId: emp.userLogin?.id,
        name: fullName,
        empId: emp.empId,
        designation: emp.designation || 'N/A',
        department: department,
        email: emp.email || emp.userLogin?.email,
        phone: emp.phoneNumber,
        role: emp.userLogin?.role
      };
    });

    return formattedEmployees;
  } catch (error) {
    console.error('Error fetching active employees:', error);
    throw new Error('Failed to fetch active employees');
  }
};

/**
 * Get employee details by user login ID
 */
const getEmployeeByUserLoginId = async (userLoginId) => {
  try {
    const employee = await prisma.employeeDetails.findFirst({
      where: {
        userLoginId: userLoginId,
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        empId: true,
        designation: true,
        email: true,
        phoneNumber: true,
        userLogin: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true
          }
        },
        primaryDepartment: {
          select: {
            departmentName: true
          }
        },
        primaryCentralDept: {
          select: {
            departmentName: true
          }
        }
      }
    });

    if (!employee) {
      return null;
    }

    const fullName = employee.displayName || 
                    `${employee.firstName}${employee.lastName ? ' ' + employee.lastName : ''}`;
    
    const department = employee.primaryDepartment?.departmentName || 
                      employee.primaryCentralDept?.departmentName || 
                      'N/A';

    return {
      id: employee.userLogin.id,
      name: fullName,
      empId: employee.empId,
      designation: employee.designation || 'N/A',
      department: department,
      email: employee.email || employee.userLogin.email,
      phone: employee.phoneNumber
    };
  } catch (error) {
    console.error('Error fetching employee by user login ID:', error);
    throw new Error('Failed to fetch employee details');
  }
};

/**
 * Get all active departments for gate entry dropdown
 */
const getActiveDepartmentsForGateEntry = async () => {
  try {
    console.log('=== FETCHING ACTIVE DEPARTMENTS ===');
    
    // Fetch both regular departments and central departments
    const [departments, centralDepartments] = await Promise.all([
      prisma.department.findMany({
        where: { isActive: true },
        select: {
          id: true,
          departmentCode: true,
          departmentName: true,
          shortName: true,
          faculty: {
            select: {
              facultyName: true
            }
          }
        },
        orderBy: { departmentName: 'asc' }
      }),
      prisma.centralDepartment.findMany({
        where: { isActive: true },
        select: {
          id: true,
          departmentCode: true,
          departmentName: true,
          shortName: true,
          departmentType: true
        },
        orderBy: { departmentName: 'asc' }
      })
    ]);

    console.log('Regular departments:', departments.length);
    console.log('Central departments:', centralDepartments.length);

    // Format departments
    const formattedDepartments = [
      ...departments.map(dept => ({
        id: dept.id,
        code: dept.departmentCode,
        name: dept.departmentName,
        shortName: dept.shortName,
        type: 'academic',
        faculty: dept.faculty?.facultyName
      })),
      ...centralDepartments.map(dept => ({
        id: dept.id,
        code: dept.departmentCode,
        name: dept.departmentName,
        shortName: dept.shortName,
        type: dept.departmentType || 'central',
        faculty: null
      }))
    ];

    console.log('Total formatted departments:', formattedDepartments.length);

    return formattedDepartments;
  } catch (error) {
    console.error('Error fetching departments:', error);
    throw new Error('Failed to fetch departments');
  }
};

module.exports = {
  getActiveEmployeesForGateEntry,
  getEmployeeByUserLoginId,
  getActiveDepartmentsForGateEntry
};
