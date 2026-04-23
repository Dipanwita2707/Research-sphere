const prisma = require('../../../shared/config/database');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');

/**
 * Format bulk upload response consistently
 */
function formatBulkUploadResponse(rows, results) {
  return {
    success: true,
    message: `Processed ${rows.length} rows: ${results.success.length} succeeded, ${results.failed.length} failed`,
    data: {
      success: true,
      message: `Processed ${rows.length} rows: ${results.success.length} succeeded, ${results.failed.length} failed`,
      totalRecords: rows.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      errors: results.failed.map(f => ({
        row: f.row,
        field: '',
        message: f.error,
        data: f.data,
      })),
    },
  };
}

function sendExcelTemplate(res, headers, sampleRows, fileName, sheetName) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 4, 18) }));
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
  res.send(buffer);
}

/**
 * Generate Excel template for schools
 */
exports.getSchoolTemplate = async (req, res) => {
  try {
    const headers = [
      'facultyCode',
      'facultyName',
      'facultyType',
      'shortName',
      'description',
      'establishedYear',
      'contactEmail',
      'contactPhone',
      'officeLocation',
      'websiteUrl',
    ];

    const sampleRows = [[
      'SOCS',
      'School of Computer Science',
      'school',
      'SCS',
      'School offering computer science programs',
      '2010',
      'socs@sgtuniversity.ac.in',
      '1234567890',
      'Block A, Floor 2',
      'https://sgtuniversity.ac.in/socs',
    ]];

    sendExcelTemplate(res, headers, sampleRows, 'schools_template.xlsx', 'Schools');
  } catch (error) {
    console.error('Get school template error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
};

/**
 * Generate Excel template for departments
 */
exports.getDepartmentTemplate = async (req, res) => {
  try {
    const headers = [
      'schoolCode',
      'departmentCode',
      'departmentName',
      'shortName',
      'description',
      'establishedYear',
      'contactEmail',
      'contactPhone',
      'officeLocation',
    ];

    const sampleRows = [[
      'SOCS',
      'CS',
      'Computer Science',
      'CS',
      'Department of Computer Science',
      '2010',
      'cs@sgtuniversity.ac.in',
      '1234567890',
      'Block A, Room 201',
    ]];

    sendExcelTemplate(res, headers, sampleRows, 'departments_template.xlsx', 'Departments');
  } catch (error) {
    console.error('Get department template error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
};

/**
 * Generate Excel template for programmes
 */
exports.getProgrammeTemplate = async (req, res) => {
  try {
    const headers = [
      'departmentCode',
      'programCode',
      'programName',
      'programType',
      'shortName',
      'description',
      'durationYears',
      'durationSemesters',
    ];

    const sampleRows = [[
      'CS',
      'BTECH-CS',
      'B.Tech Computer Science',
      'undergraduate',
      'B.Tech CS',
      'Bachelor of Technology in Computer Science',
      '4',
      '8',
    ]];

    sendExcelTemplate(res, headers, sampleRows, 'programmes_template.xlsx', 'Programmes');
  } catch (error) {
    console.error('Get programme template error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
};

/**
 * Generate CSV template for employees
 */
exports.getEmployeeTemplate = async (req, res) => {
  try {
    const headers = [
      'empId',
      'firstName',
      'lastName',
      'email',
      'phoneNumber',
      'schoolCode',
      'departmentCode',
      'designation',
      'userType',
      'password',
    ];

    const sampleData = [
      'EMP001',
      'John',
      'Doe',
      'john.doe@sgtuniversity.ac.in',
      '9876543210',
      'SOCS',
      'CS',
      'Assistant Professor',
      'faculty',
      'Welcome@123',
    ];

    const csv = headers.join(',') + '\n' + sampleData.join(',');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=employees_template.csv');
    res.send(csv);
  } catch (error) {
    console.error('Get employee template error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
};

/**
 * Generate CSV template for students
 */
exports.getStudentTemplate = async (req, res) => {
  try {
    const headers = [
      'studentId',
      'registrationNo',
      'firstName',
      'lastName',
      'email',
      'phone',
      'programCode',
      'sectionCode',
      'currentSemester',
      'password',
    ];

    const sampleData = [
      'STU2025001',
      'REG2025001',
      'Jane',
      'Smith',
      'jane.smith@student.sgtuniversity.ac.in',
      '9876543210',
      'BTECH-CS',
      'CS-A',
      '1',
      'Welcome@123',
    ];

    const csv = headers.join(',') + '\n' + sampleData.join(',');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=students_template.csv');
    res.send(csv);
  } catch (error) {
    console.error('Get student template error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
};

/**
 * Parse CSV content
 */
function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
  }

  return { headers, rows };
}

function parseTabularRows(matrix) {
  const normalizedRows = matrix
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some((cell) => cell));

  if (normalizedRows.length < 2) return { headers: [], rows: [] };

  const headers = normalizedRows[0].map((header) => header.replace(/^"|"$/g, ''));
  const rows = normalizedRows.slice(1).map((values) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || '').replace(/^"|"$/g, '');
    });
    return row;
  });

  return { headers, rows };
}

function parseUploadedFile(file) {
  const isExcelFile = file
    && (/\.(xlsx|xls)$/i.test(file.originalname)
      || [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ].includes(file.mimetype));

  if (isExcelFile) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return { headers: [], rows: [] };
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
      header: 1,
      raw: false,
      defval: '',
    });
    return parseTabularRows(matrix);
  }

  return parseCSV(file.buffer.toString('utf-8'));
}

/**
 * Bulk upload schools
 */
exports.bulkUploadSchools = async (req, res) => {
  try {
    let parsedData;
    if (req.file) {
      parsedData = parseUploadedFile(req.file);
    } else if (req.body.csvContent) {
      parsedData = parseCSV(req.body.csvContent);
    } else {
      return res.status(400).json({ success: false, message: 'Spreadsheet file or CSV content is required' });
    }

    const { rows } = parsedData;
    
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found in the uploaded file' });
    }

    const results = { success: [], failed: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // Account for header row

      try {
        // Validate required fields
        if (!row.facultyCode || !row.facultyName || !row.facultyType) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: 'Missing required fields: facultyCode, facultyName, or facultyType',
          });
          continue;
        }

        // Check if already exists
        const existing = await prisma.facultySchoolList.findUnique({
          where: { facultyCode: row.facultyCode },
        });

        if (existing) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `School with code ${row.facultyCode} already exists`,
          });
          continue;
        }

        // Validate facultyType
        const validTypes = ['school', 'faculty', 'institute', 'center'];
        if (!validTypes.includes(row.facultyType.toLowerCase())) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Invalid facultyType. Must be one of: ${validTypes.join(', ')}`,
          });
          continue;
        }

        // Create school
        const school = await prisma.facultySchoolList.create({
          data: {
            facultyCode: row.facultyCode,
            facultyName: row.facultyName,
            facultyType: row.facultyType.toLowerCase(),
            shortName: row.shortName || null,
            description: row.description || null,
            establishedYear: row.establishedYear ? parseInt(row.establishedYear) : null,
            contactEmail: row.contactEmail || null,
            contactPhone: row.contactPhone || null,
            officeLocation: row.officeLocation || null,
            websiteUrl: row.websiteUrl || null,
            isActive: true,
          },
        });

        results.success.push({
          row: rowNumber,
          data: school,
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    res.json(formatBulkUploadResponse(rows, results));
  } catch (error) {
    console.error('Bulk upload schools error:', error);
    res.status(500).json({ success: false, message: 'Failed to process bulk upload' });
  }
};

/**
 * Bulk upload departments
 */
exports.bulkUploadDepartments = async (req, res) => {
  try {
    let parsedData;
    if (req.file) {
      parsedData = parseUploadedFile(req.file);
    } else if (req.body.csvContent) {
      parsedData = parseCSV(req.body.csvContent);
    } else {
      return res.status(400).json({ success: false, message: 'Spreadsheet file or CSV content is required' });
    }

    const { rows } = parsedData;
    
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found in the uploaded file' });
    }

    const results = { success: [], failed: [] };

    // Cache schools for lookup
    const schools = await prisma.facultySchoolList.findMany();
    const schoolMap = new Map(schools.map(s => [s.facultyCode, s.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        // Validate required fields
        if (!row.schoolCode || !row.departmentCode || !row.departmentName) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: 'Missing required fields: schoolCode, departmentCode, or departmentName',
          });
          continue;
        }

        // Find school
        const schoolId = schoolMap.get(row.schoolCode);
        if (!schoolId) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `School with code ${row.schoolCode} not found`,
          });
          continue;
        }

        // Check if department already exists
        const existing = await prisma.department.findUnique({
          where: { departmentCode: row.departmentCode },
        });

        if (existing) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Department with code ${row.departmentCode} already exists`,
          });
          continue;
        }

        // Create department
        const department = await prisma.department.create({
          data: {
            facultyId: schoolId,
            departmentCode: row.departmentCode,
            departmentName: row.departmentName,
            shortName: row.shortName || null,
            description: row.description || null,
            establishedYear: row.establishedYear ? parseInt(row.establishedYear) : null,
            contactEmail: row.contactEmail || null,
            contactPhone: row.contactPhone || null,
            officeLocation: row.officeLocation || null,
            isActive: true,
          },
        });

        results.success.push({
          row: rowNumber,
          data: department,
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    res.json(formatBulkUploadResponse(rows, results));
  } catch (error) {
    console.error('Bulk upload departments error:', error);
    res.status(500).json({ success: false, message: 'Failed to process bulk upload' });
  }
};

/**
 * Bulk upload programmes
 */
exports.bulkUploadProgrammes = async (req, res) => {
  try {
    let parsedData;
    if (req.file) {
      parsedData = parseUploadedFile(req.file);
    } else if (req.body.csvContent) {
      parsedData = parseCSV(req.body.csvContent);
    } else {
      return res.status(400).json({ success: false, message: 'Spreadsheet file or CSV content is required' });
    }

    const { rows } = parsedData;
    
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found in the uploaded file' });
    }

    const results = { success: [], failed: [] };

    // Cache departments for lookup
    const departments = await prisma.department.findMany();
    const deptMap = new Map(departments.map(d => [d.departmentCode, d.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        // Validate required fields
        if (!row.departmentCode || !row.programCode || !row.programName || !row.programType) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: 'Missing required fields: departmentCode, programCode, programName, or programType',
          });
          continue;
        }

        // Find department
        const deptId = deptMap.get(row.departmentCode);
        if (!deptId) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Department with code ${row.departmentCode} not found`,
          });
          continue;
        }

        // Check if programme already exists
        const existing = await prisma.program.findUnique({
          where: { programCode: row.programCode },
        });

        if (existing) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Programme with code ${row.programCode} already exists`,
          });
          continue;
        }

        // Validate programType
        const validTypes = ['undergraduate', 'postgraduate', 'diploma', 'certificate', 'doctorate', 'integrated'];
        if (!validTypes.includes(row.programType.toLowerCase())) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Invalid programType. Must be one of: ${validTypes.join(', ')}`,
          });
          continue;
        }

        // Create programme
        const programme = await prisma.program.create({
          data: {
            departmentId: deptId,
            programCode: row.programCode,
            programName: row.programName,
            programType: row.programType.toLowerCase(),
            shortName: row.shortName || null,
            description: row.description || null,
            durationYears: row.durationYears ? parseInt(row.durationYears) : 4,
            durationSemesters: row.durationSemesters ? parseInt(row.durationSemesters) : 8,
            isActive: true,
          },
        });

        results.success.push({
          row: rowNumber,
          data: programme,
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    res.json(formatBulkUploadResponse(rows, results));
  } catch (error) {
    console.error('Bulk upload programmes error:', error);
    res.status(500).json({ success: false, message: 'Failed to process bulk upload' });
  }
};

/**
 * Bulk upload employees
 */
exports.bulkUploadEmployees = async (req, res) => {
  try {
    // Handle both file upload and direct csvContent
    let csvContent;
    if (req.file) {
      csvContent = req.file.buffer.toString('utf-8');
    } else if (req.body.csvContent) {
      csvContent = req.body.csvContent;
    } else {
      return res.status(400).json({ success: false, message: 'CSV file or content is required' });
    }

    const { headers, rows } = parseCSV(csvContent);
    
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found in CSV' });
    }

    const results = { success: [], failed: [] };

    // Cache schools and departments for lookup
    const schools = await prisma.facultySchoolList.findMany();
    const departments = await prisma.department.findMany();
    const schoolMap = new Map(schools.map(s => [s.facultyCode, s.id]));
    const deptMap = new Map(departments.map(d => [d.departmentCode, d.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        // Validate required fields
        if (!row.empId || !row.firstName || !row.email || !row.userType) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: 'Missing required fields: empId, firstName, email, or userType',
          });
          continue;
        }

        // Check if employee ID already exists
        const existingEmp = await prisma.employeeDetails.findUnique({
          where: { empId: row.empId },
        });

        if (existingEmp) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Employee with ID ${row.empId} already exists`,
          });
          continue;
        }

        // Check if email already exists
        const existingUser = await prisma.userLogin.findUnique({
          where: { email: row.email },
        });

        if (existingUser) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `User with email ${row.email} already exists`,
          });
          continue;
        }

        // Validate userType
        const validUserTypes = ['faculty', 'staff', 'admin'];
        if (!validUserTypes.includes(row.userType.toLowerCase())) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Invalid userType. Must be one of: ${validUserTypes.join(', ')}`,
          });
          continue;
        }

        // Get school and department IDs if provided
        let schoolId = null;
        let deptId = null;

        if (row.schoolCode) {
          schoolId = schoolMap.get(row.schoolCode);
          if (!schoolId) {
            results.failed.push({
              row: rowNumber,
              data: row,
              error: `School with code ${row.schoolCode} not found`,
            });
            continue;
          }
        }

        if (row.departmentCode) {
          deptId = deptMap.get(row.departmentCode);
          if (!deptId) {
            results.failed.push({
              row: rowNumber,
              data: row,
              error: `Department with code ${row.departmentCode} not found`,
            });
            continue;
          }
        }

        // Hash password
        const password = row.password || 'Welcome@123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user and employee in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Create UserLogin
          const user = await tx.userLogin.create({
            data: {
              uid: row.empId,
              email: row.email,
              passwordHash: hashedPassword,
              userType: row.userType.toLowerCase(),
              isActive: true,
              isEmailVerified: true,
            },
          });

          // Create EmployeeDetails
          const employee = await tx.employeeDetails.create({
            data: {
              userLoginId: user.id,
              empId: row.empId,
              firstName: row.firstName,
              lastName: row.lastName || null,
              displayName: row.lastName ? `${row.firstName} ${row.lastName}` : row.firstName,
              email: row.email,
              phoneNumber: row.phoneNumber || null,
              primarySchoolId: schoolId,
              primaryDepartmentId: deptId,
              designation: row.designation || null,
              isActive: true,
            },
          });

          return { user, employee };
        });

        results.success.push({
          row: rowNumber,
          data: {
            empId: row.empId,
            name: `${row.firstName} ${row.lastName || ''}`.trim(),
            email: row.email,
            userType: row.userType,
          },
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    res.json(formatBulkUploadResponse(rows, results));
  } catch (error) {
    console.error('Bulk upload employees error:', error);
    res.status(500).json({ success: false, message: 'Failed to process bulk upload' });
  }
};

/**
 * Bulk upload students
 */
exports.bulkUploadStudents = async (req, res) => {
  try {
    // Handle both file upload and direct csvContent
    let csvContent;
    if (req.file) {
      csvContent = req.file.buffer.toString('utf-8');
    } else if (req.body.csvContent) {
      csvContent = req.body.csvContent;
    } else {
      return res.status(400).json({ success: false, message: 'CSV file or content is required' });
    }

    const { headers, rows } = parseCSV(csvContent);
    
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found in CSV' });
    }

    const results = { success: [], failed: [] };

    // Cache programmes and sections for lookup
    const programmes = await prisma.program.findMany();
    const sections = await prisma.section.findMany();
    const programMap = new Map(programmes.map(p => [p.programCode, p.id]));
    const sectionMap = new Map(sections.map(s => [`${s.programId}-${s.sectionCode}`, s.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        // Validate required fields
        if (!row.studentId || !row.firstName || !row.email || !row.programCode || !row.sectionCode) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: 'Missing required fields: studentId, firstName, email, programCode, or sectionCode',
          });
          continue;
        }

        // Check if student ID already exists
        const existingStudent = await prisma.studentDetails.findUnique({
          where: { studentId: row.studentId },
        });

        if (existingStudent) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Student with ID ${row.studentId} already exists`,
          });
          continue;
        }

        // Check if email already exists
        const existingUser = await prisma.userLogin.findUnique({
          where: { email: row.email },
        });

        if (existingUser) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `User with email ${row.email} already exists`,
          });
          continue;
        }

        // Get programme ID
        const programId = programMap.get(row.programCode);
        if (!programId) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Programme with code ${row.programCode} not found`,
          });
          continue;
        }

        // Get section ID
        const sectionId = sectionMap.get(`${programId}-${row.sectionCode}`);
        if (!sectionId) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Section ${row.sectionCode} not found for programme ${row.programCode}`,
          });
          continue;
        }

        // Hash password
        const password = row.password || 'Welcome@123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user and student in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Create UserLogin
          const user = await tx.userLogin.create({
            data: {
              uid: row.studentId,
              email: row.email,
              passwordHash: hashedPassword,
              userType: 'student',
              isActive: true,
              isEmailVerified: true,
            },
          });

          // Create StudentDetails
          const student = await tx.studentDetails.create({
            data: {
              userLoginId: user.id,
              studentId: row.studentId,
              registrationNo: row.registrationNo || null,
              firstName: row.firstName,
              lastName: row.lastName || null,
              displayName: row.lastName ? `${row.firstName} ${row.lastName}` : row.firstName,
              email: row.email,
              phone: row.phone || null,
              programId: programId,
              sectionId: sectionId,
              currentSemester: row.currentSemester ? parseInt(row.currentSemester) : 1,
              isActive: true,
            },
          });

          return { user, student };
        });

        results.success.push({
          row: rowNumber,
          data: {
            studentId: row.studentId,
            name: `${row.firstName} ${row.lastName || ''}`.trim(),
            email: row.email,
            programme: row.programCode,
          },
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    res.json(formatBulkUploadResponse(rows, results));
  } catch (error) {
    console.error('Bulk upload students error:', error);
    res.status(500).json({ success: false, message: 'Failed to process bulk upload' });
  }
};

/**
 * Get upload summary/stats
 */
exports.getUploadStats = async (req, res) => {
  try {
    const [schools, departments, programmes, employees, students] = await Promise.all([
      prisma.facultySchoolList.count(),
      prisma.department.count(),
      prisma.program.count(),
      prisma.employeeDetails.count(),
      prisma.studentDetails.count(),
    ]);

    res.json({
      success: true,
      data: {
        schools,
        departments,
        programmes,
        employees,
        students,
      },
    });
  } catch (error) {
    console.error('Get upload stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
};
