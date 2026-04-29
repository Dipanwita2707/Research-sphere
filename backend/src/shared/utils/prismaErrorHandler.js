/**
 * Prisma Error Handler Utility
 * Converts technical Prisma errors into user-friendly messages
 */

/**
 * Parse Prisma error and return user-friendly message
 * @param {Error} error - The Prisma error object
 * @param {string} context - Context about what operation was being performed
 * @returns {string} User-friendly error message
 */
function parsePrismaError(error, context = '') {
  if (!error) return 'An unknown error occurred';

  const errorMessage = error.message || '';
  const errorCode = error.code;

  // Handle unique constraint violations (P2002)
  if (errorCode === 'P2002') {
    const target = error.meta?.target;
    if (Array.isArray(target)) {
      const field = target[0];
      switch (field) {
        case 'email':
          return 'This email address is already registered in the system. Please use a different email address.';
        case 'empId':
          return 'This employee ID is already in use. Please use a different employee ID.';
        case 'studentId':
          return 'This student ID is already in use. Please use a different student ID.';
        case 'facultyCode':
          return 'This school/faculty code is already in use. Please use a different code.';
        case 'departmentCode':
          return 'This department code is already in use. Please use a different code.';
        case 'programCode':
          return 'This program code is already in use. Please use a different code.';
        case 'uid':
          return 'This user ID is already in use. Please use a different ID.';
        default:
          return `This ${field} is already in use. Please use a different value.`;
      }
    }
    return 'A record with this information already exists. Please check for duplicates.';
  }

  // Handle foreign key constraint failures (P2003)
  if (errorCode === 'P2003') {
    if (errorMessage.includes('facultyId') || errorMessage.includes('school')) {
      return 'The specified school/faculty code does not exist. Please verify the school code or create the school first.';
    }
    if (errorMessage.includes('departmentId') || errorMessage.includes('department')) {
      return 'The specified department code does not exist. Please verify the department code or create the department first.';
    }
    if (errorMessage.includes('programId') || errorMessage.includes('program')) {
      return 'The specified program code does not exist. Please verify the program code or create the program first.';
    }
    if (errorMessage.includes('sectionId') || errorMessage.includes('section')) {
      return 'The specified section does not exist for this program. Please verify the section code or create the section first.';
    }
    return 'Referenced record does not exist. Please verify all codes and IDs are correct.';
  }

  // Handle required field violations (P2012)
  if (errorCode === 'P2012') {
    return 'Required field is missing. Please ensure all mandatory fields are provided.';
  }

  // Handle invalid enum values (P2006)
  if (errorCode === 'P2006') {
    if (errorMessage.includes('facultyType')) {
      return 'Invalid faculty type. Must be one of: engineering, management, arts, science, medical, law, other.';
    }
    if (errorMessage.includes('role') || errorMessage.includes('userType')) {
      return 'Invalid user role. Must be one of: faculty, staff, admin, student, parent.';
    }
    if (errorMessage.includes('programType')) {
      return 'Invalid program type. Must be one of: undergraduate, postgraduate, doctoral, diploma, certificate.';
    }
    return 'Invalid value provided for a field. Please check the allowed values.';
  }

  // Handle record not found (P2025)
  if (errorCode === 'P2025') {
    return 'Record not found. The specified item does not exist in the system.';
  }

  // Handle value too long for column (P2000)
  if (errorCode === 'P2000') {
    const column = error.meta?.column_name;
    if (column) {
      return `The value for ${column} is too long. Please use a shorter value.`;
    }
    return 'One of the provided values is too long. Please use shorter text.';
  }

  // Handle null constraint violations (P2011)
  if (errorCode === 'P2011') {
    const column = error.meta?.column;
    if (column) {
      return `${column} is required and cannot be empty.`;
    }
    return 'A required field is missing or empty.';
  }

  // Handle invalid data type (P2007)
  if (errorCode === 'P2007') {
    return 'Invalid data format provided. Please check the data types and format.';
  }

  // Handle connection errors
  if (errorMessage.includes('connect') || errorMessage.includes('timeout')) {
    return 'Database connection error. Please try again later.';
  }

  // Handle validation errors from our application
  if (errorMessage.includes('Invalid') && errorMessage.includes('Expected')) {
    // Extract the field name and expected values from Prisma validation error
    const fieldMatch = errorMessage.match(/argument `(\w+)`/);
    const expectedMatch = errorMessage.match(/Expected (\w+)/);
    
    if (fieldMatch && expectedMatch) {
      const field = fieldMatch[1];
      const expected = expectedMatch[1];
      
      if (field === 'facultyType') {
        return 'Invalid faculty type. Must be one of: engineering, management, arts, science, medical, law, other.';
      }
      if (field === 'role') {
        return 'Invalid user role. Must be one of: faculty, staff, admin, student, parent.';
      }
      if (field === 'programType') {
        return 'Invalid program type. Must be one of: undergraduate, postgraduate, doctoral, diploma, certificate.';
      }
      
      return `Invalid ${field}. Expected ${expected}.`;
    }
  }

  // Handle missing argument errors
  if (errorMessage.includes('Argument') && errorMessage.includes('missing')) {
    const fieldMatch = errorMessage.match(/Argument `(\w+)` is missing/);
    if (fieldMatch) {
      const field = fieldMatch[1];
      return `${field} is required and must be provided.`;
    }
    return 'Required field is missing.';
  }

  // Handle transaction errors
  if (errorMessage.includes('transaction')) {
    return 'Operation failed due to a system error. Please try again.';
  }

  // Default fallback for unknown errors
  if (context) {
    return `Failed to ${context}. Please check your data and try again.`;
  }
  
  return 'An error occurred while processing your request. Please check your data and try again.';
}

/**
 * Enhanced error parser that provides more specific context
 * @param {Error} error - The error object
 * @param {string} operation - The operation being performed (e.g., 'create school', 'upload employee')
 * @param {Object} data - The data that caused the error (optional)
 * @returns {string} User-friendly error message
 */
function parseErrorWithContext(error, operation, data = null) {
  const baseMessage = parsePrismaError(error, operation);
  
  // Add specific context based on the data if available
  if (data && error.code === 'P2002') {
    const target = error.meta?.target;
    if (Array.isArray(target) && target.length > 0) {
      const field = target[0];
      const value = data[field];
      if (value) {
        return baseMessage.replace('Please use a different', `Please use a different ${field} (current: ${value})`);
      }
    }
  }
  
  return baseMessage;
}

/**
 * Check if error is a validation error that should be shown to user
 * @param {Error} error - The error object
 * @returns {boolean} True if it's a user-facing validation error
 */
function isValidationError(error) {
  const validationCodes = ['P2002', 'P2003', 'P2006', 'P2011', 'P2012', 'P2000', 'P2007'];
  return validationCodes.includes(error.code);
}

/**
 * Check if error is a system error that should be logged but not exposed
 * @param {Error} error - The error object
 * @returns {boolean} True if it's a system error
 */
function isSystemError(error) {
  const systemCodes = ['P1000', 'P1001', 'P1002', 'P1008', 'P1009', 'P1010'];
  return systemCodes.includes(error.code) || 
         error.message.includes('connect') || 
         error.message.includes('timeout') ||
         error.message.includes('ECONNREFUSED');
}

module.exports = {
  parsePrismaError,
  parseErrorWithContext,
  isValidationError,
  isSystemError
};