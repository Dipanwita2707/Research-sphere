const prisma = require('../../../shared/config/database');

/**
 * Get employee details by user login ID
 * Used for legacy passes that have personToMeetId
 * @deprecated - New simplified form doesn't use this, but kept for backward compatibility
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

module.exports = {
  getEmployeeByUserLoginId
};
