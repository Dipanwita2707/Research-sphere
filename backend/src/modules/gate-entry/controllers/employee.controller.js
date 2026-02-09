const employeeService = require('../services/employee.service');

// Response formatter helper
const formatResponse = (success, message, data = null, error = null) => {
  const response = { success, message };
  if (data) response.data = data;
  if (error) response.error = error;
  return response;
};

/**
 * Get all active employees for gate entry dropdown
 * GET /api/gate-entry/employees
 */
const getActiveEmployees = async (req, res) => {
  try {
    console.log('=== GET ACTIVE EMPLOYEES REQUEST ===');
    console.log('User:', req.user?.id);
    
    const employees = await employeeService.getActiveEmployeesForGateEntry();

    console.log('=== EMPLOYEES FETCHED ===');
    console.log('Count:', employees.length);
    console.log('Sample:', employees.slice(0, 2));

    return res.status(200).json(
      formatResponse(true, 'Active employees retrieved successfully', {
        employees,
        count: employees.length
      })
    );
  } catch (error) {
    console.error('Error in getActiveEmployees controller:', error);
    return res.status(500).json(
      formatResponse(false, error.message || 'Failed to fetch active employees')
    );
  }
};

/**
 * Get all active departments for gate entry dropdown
 * GET /api/gate-entry/departments
 */
const getActiveDepartments = async (req, res) => {
  try {
    console.log('=== GET ACTIVE DEPARTMENTS REQUEST ===');
    console.log('User:', req.user?.id);
    
    const departments = await employeeService.getActiveDepartmentsForGateEntry();

    console.log('=== DEPARTMENTS FETCHED ===');
    console.log('Count:', departments.length);

    return res.status(200).json(
      formatResponse(true, 'Active departments retrieved successfully', {
        departments,
        count: departments.length
      })
    );
  } catch (error) {
    console.error('Error in getActiveDepartments controller:', error);
    return res.status(500).json(
      formatResponse(false, error.message || 'Failed to fetch active departments')
    );
  }
};

module.exports = {
  getActiveEmployees,
  getActiveDepartments
};
