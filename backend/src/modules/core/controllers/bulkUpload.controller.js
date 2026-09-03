const prisma = require('../../../shared/config/database');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { parseErrorWithContext, isValidationError, isSystemError } = require('../../../shared/utils/prismaErrorHandler');

const log = createModuleLogger('bulk-upload');

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
  
  // Create worksheet with headers and sample data
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  
  // Define fields that should support multi-line content
  const multiLineFields = [
    'description', 'programName', 'departmentName', 'facultyName', 'shortName',
    'headName', 'specializations', 'internshipSpecializations', 'contactEmail',
    'officeLocation', 'websiteUrl', 'firstName', 'lastName', 'designation'
  ];
  
  // Set column widths and formatting for better readability
  worksheet['!cols'] = headers.map((header, index) => {
    const cleanHeader = header.replace(/\*$/, ''); // Remove asterisk for comparison
    const isMultiLine = multiLineFields.includes(cleanHeader);
    
    return { 
      wch: isMultiLine ? Math.max(header.length + 8, 25) : Math.max(header.length + 4, 18)
    };
  });
  
  // Set default row height for data rows to accommodate multi-line content
  worksheet['!rows'] = [];
  for (let i = 0; i <= sampleRows.length; i++) {
    worksheet['!rows'][i] = { hpt: i === 0 ? 25 : 35 }; // Header row: 25pt, Data rows: 35pt
  }
  
  // Add header formatting (make headers bold)
  const headerRange = XLSX.utils.decode_range(worksheet['!ref']);
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellAddress]) continue;
    
    const header = headers[col];
    const cleanHeader = header.replace(/\*$/, '');
    const isMultiLine = multiLineFields.includes(cleanHeader);
    
    // Set cell style for headers
    worksheet[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "E6E6FA" } }, // Light purple background
      alignment: { 
        horizontal: "center",
        vertical: "center",
        wrapText: true
      }
    };
    
    // Set formatting for data cells in multi-line columns
    if (isMultiLine) {
      for (let row = 1; row <= sampleRows.length; row++) {
        const dataCellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (worksheet[dataCellAddress]) {
          worksheet[dataCellAddress].s = {
            alignment: { 
              vertical: "top",
              wrapText: true
            }
          };
        }
      }
    }
  }
  
  // Add data validation and comments for specific fields
  if (sheetName === 'Schools') {
    // Add comment for facultyType field
    const facultyTypeCell = 'C2'; // Assuming facultyType is in column C
    if (worksheet[facultyTypeCell]) {
      worksheet[facultyTypeCell].c = [{
        a: 'System',
        t: 'Valid values: engineering, management, arts, science, medical, law, other'
      }];
    }
  }
  
  if (sheetName === 'Employees') {
    // Add comment for userType field
    const userTypeCell = 'I2'; // Assuming userType is in column I
    if (worksheet[userTypeCell]) {
      worksheet[userTypeCell].c = [{
        a: 'System',
        t: 'Valid values: faculty, staff, admin'
      }];
    }
  }
  
  // Add instructions sheet with comprehensive guidance
  const instructionsData = [
    ['SGT UNIVERSITY BULK UPLOAD INSTRUCTIONS'],
    [''],
    ['📋 BASIC INSTRUCTIONS:'],
    ['1. Fill in the data starting from row 2 (keep the headers in row 1)'],
    ['2. Required fields are marked with * in the template'],
    ['3. Do not modify the header row'],
    ['4. Save the file and upload it using the bulk upload feature'],
    [''],
    ['📝 MULTI-LINE CONTENT SUPPORT:'],
    ['• For fields like descriptions, names, specializations, etc.'],
    ['• Press ALT + ENTER to create new lines within the same cell'],
    ['• Example: "Computer Science\\nArtificial Intelligence" (use ALT+ENTER instead of \\n)'],
    ['• Cells are pre-configured with text wrapping for better display'],
    [''],
    ['⌨️ EXCEL KEYBOARD SHORTCUTS:'],
    ['• ALT + ENTER: Create new line within cell (recommended)'],
    ['• F2: Enter edit mode for the selected cell'],
    ['• CTRL + ENTER: Finish editing and stay in same cell'],
    ['• ESC: Cancel editing and revert changes'],
    [''],
    ['📊 FIELD-SPECIFIC GUIDELINES:'],
    ['• Names (firstName, lastName): Can include titles, prefixes'],
    ['• Descriptions: Use ALT+ENTER for detailed multi-line descriptions'],
    ['• Specializations: Separate multiple items with | or use ALT+ENTER'],
    ['• Email addresses: Must be unique across the system'],
    ['• Phone numbers: Include country code if international'],
    ['• Codes (studentId, empId, etc.): Must be unique identifiers'],
    [''],
    ['⚠️ IMPORTANT NOTES:'],
    ['• Email addresses must be unique across the system'],
    ['• IDs must be unique (empId, studentId, facultyCode, etc.)'],
    ['• Use exact values for dropdown fields (see comments in cells)'],
    ['• Leave optional fields empty if not applicable'],
    ['• Multi-line content is supported in description and name fields'],
    [''],
    ['🔧 EXCEL SETTINGS (Optional):'],
    ['• File → Options → Advanced → "After pressing Enter, move selection"'],
    ['• Uncheck this option to prevent automatic cell movement'],
    ['• Or change direction preference (Down/Right/Up/Left)'],
    [''],
    ['📞 SUPPORT:'],
    ['For technical support or questions about bulk upload,'],
    ['contact the system administrator or IT helpdesk.']
  ];
  
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  
  // Set column width and formatting for instructions
  instructionsSheet['!cols'] = [{ wch: 70 }]; // Wide column for instructions
  
  // Set row heights for better readability
  instructionsSheet['!rows'] = instructionsData.map((row, index) => {
    if (row[0] && row[0].includes('INSTRUCTIONS')) return { hpt: 30 }; // Title rows
    if (row[0] && row[0].includes(':')) return { hpt: 25 }; // Section headers
    if (row[0] === '') return { hpt: 15 }; // Empty rows
    return { hpt: 20 }; // Regular rows
  });
  
  // Format the instructions sheet
  instructionsData.forEach((row, rowIndex) => {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: 0 });
    if (!instructionsSheet[cellAddress]) return;
    
    const cellValue = row[0];
    let cellStyle = {
      alignment: { vertical: "top", wrapText: true }
    };
    
    // Style different types of content
    if (cellValue && cellValue.includes('INSTRUCTIONS')) {
      // Main title
      cellStyle = {
        ...cellStyle,
        font: { bold: true, size: 16, color: { rgb: "1F4E79" } },
        fill: { fgColor: { rgb: "D9E2F3" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
      };
    } else if (cellValue && cellValue.match(/^[📋📝⌨️📊⚠️🔧📞]/)) {
      // Section headers with emojis
      cellStyle = {
        ...cellStyle,
        font: { bold: true, size: 12, color: { rgb: "2F5597" } },
        fill: { fgColor: { rgb: "F2F2F2" } }
      };
    } else if (cellValue && cellValue.startsWith('•')) {
      // Bullet points
      cellStyle = {
        ...cellStyle,
        font: { size: 10 },
        alignment: { ...cellStyle.alignment, indent: 1 }
      };
    } else if (cellValue && cellValue.match(/^\d+\./)) {
      // Numbered lists
      cellStyle = {
        ...cellStyle,
        font: { size: 11, bold: true }
      };
    }
    
    instructionsSheet[cellAddress].s = cellStyle;
  });
  
  // Add sheets to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
  
  // Generate buffer
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
      'facultyCode*',
      'facultyName*',
      'facultyType*',
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
      'School of Computer Science\nAdvanced Computing & AI',
      'science',
      'SCS',
      'School offering computer science programs\nSpecializing in AI, ML, and Data Science',
      '2010',
      'socs@sgtuniversity.ac.in',
      '1234567890',
      'Block A, Floor 2\nRoom 201-205',
      'https://sgtuniversity.ac.in/socs',
    ]];

    sendExcelTemplate(res, headers, sampleRows, 'schools_template.xlsx', 'Schools');
  } catch (error) {
    log.logError('get_school_template_error', error);
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
};

/**
 * Generate Excel template for departments
 */
exports.getDepartmentTemplate = async (req, res) => {
  try {
    // Fetch existing schools to pre-fill
    const schools = await prisma.facultySchoolList.findMany({
      select: { facultyCode: true, facultyName: true, id: true },
      orderBy: { facultyName: 'asc' }
    });

    // Fetch existing departments
    const existingDepartments = await prisma.department.findMany({
      include: { faculty: { select: { facultyCode: true, facultyName: true } } },
      orderBy: [{ faculty: { facultyName: 'asc' } }, { departmentName: 'asc' }]
    });

    const headers = [
      'schoolCode*',
      'departmentCode*',
      'departmentName*',
      'shortName',
      'description',
      'establishedYear',
      'contactEmail',
      'contactPhone',
      'officeLocation',
    ];

    // Generate sample rows with first school pre-filled if available
    const sampleRows = schools.length > 0 ? [[
      schools[0].facultyCode,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]] : [[
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

    // Create workbook with three sheets
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: Template for new departments
    const templateSheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    templateSheet['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));
    XLSX.utils.book_append_sheet(workbook, templateSheet, 'Template');
    
    // Sheet 2: Schools Reference - all schools with code and name for cross-checking
    const schoolsRefHeaders = ['School Code', 'School Name'];
    const schoolsRefRows = schools.map(s => [s.facultyCode, s.facultyName]);
    const schoolsRefSheet = XLSX.utils.aoa_to_sheet([schoolsRefHeaders, ...schoolsRefRows]);
    schoolsRefSheet['!cols'] = [{ wch: 20 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(workbook, schoolsRefSheet, 'Schools Reference');

    // Sheet 3: Existing Departments
    const existingHeaders = ['School Code', 'School Name', 'Department Code', 'Department Name', 'Short Name', 'Description'];
    const existingRows = existingDepartments.map(d => [
      d.faculty?.facultyCode || '',
      d.faculty?.facultyName || '',
      d.departmentCode,
      d.departmentName,
      d.shortName || '',
      d.description || ''
    ]);
    const existingSheet = XLSX.utils.aoa_to_sheet([existingHeaders, ...existingRows]);
    existingSheet['!cols'] = existingHeaders.map(h => ({ wch: Math.max(h.length + 4, 25) }));
    XLSX.utils.book_append_sheet(workbook, existingSheet, 'Existing Departments');
    
    // Send response
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=departments_template.xlsx`);
    res.send(buffer);
  } catch (error) {
    log.logError('get_department_template_error', error);
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
};

/**
 * Generate Excel template for programmes
 */
exports.getProgrammeTemplate = async (req, res) => {
  try {
    // Fetch existing schools and departments to pre-fill
    const departments = await prisma.department.findMany({
      include: { faculty: { select: { facultyCode: true, facultyName: true } } },
      orderBy: [{ faculty: { facultyName: 'asc' } }, { departmentName: 'asc' }]
    });

    // Fetch existing programmes
    const existingProgrammes = await prisma.program.findMany({
      include: {
        department: {
          include: { faculty: { select: { facultyCode: true, facultyName: true } } }
        }
      },
      orderBy: [{ department: { faculty: { facultyName: 'asc' } } }, { programName: 'asc' }]
    });

    const headers = [
      'schoolCode*',
      'departmentCode*',
      'programCode*',
      'programName*',
      'programType*',
      'shortName',
      'description',
      'durationYears',
      'durationMonths',
      'durationSemesters',
      'creditMin',
      'creditMax',
      'specializations',
      'specializationChargeRules',
      'internshipApplicable',
      'internshipDurationMonths',
      'internshipSpecializations',
      'batchYearDocuments',
    ];

    // Generate sample rows with first department pre-filled if available
    const sampleRows = departments.length > 0 ? [[
      departments[0].faculty?.facultyCode || '',
      departments[0].departmentCode || '',
      '',
      '',
      'undergraduate',
      '',
      '',
      '4',
      '48',
      '8',
      '',
      '',
      '',
      '',
      'No',
      '',
      '',
      '',
    ]] : [[
      'SOCS',
      'CS',
      'BTECH-CS',
      'B.Tech Computer Science\nArtificial Intelligence',
      'undergraduate',
      'B.Tech CS',
      'Bachelor of Technology in Computer Science\nFocusing on modern computing technologies\nand artificial intelligence applications',
      '4',
      '48',
      '8',
      '140',
      '160',
      'AI and ML\nData Science\nCybersecurity',
      'AI and ML:2026:3|Data Science:2026:5',
      'Yes',
      '6',
      'AI and ML\nData Science',
      '2026:60:programmes/btech-cs/batch-2026/approval.pdf:approval.pdf',
    ]];

    // Fetch all schools for reference sheet
    const allSchools = await prisma.facultySchoolList.findMany({
      select: { facultyCode: true, facultyName: true },
      orderBy: { facultyName: 'asc' }
    });

    // Create workbook with four sheets
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: Template for new programmes
    const templateSheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    templateSheet['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 20) }));
    XLSX.utils.book_append_sheet(workbook, templateSheet, 'Template');

    // Sheet 2: Schools Reference - all school codes and names
    const schoolsRefHeaders = ['School Code', 'School Name'];
    const schoolsRefRows = allSchools.map(s => [s.facultyCode, s.facultyName]);
    const schoolsRefSheet = XLSX.utils.aoa_to_sheet([schoolsRefHeaders, ...schoolsRefRows]);
    schoolsRefSheet['!cols'] = [{ wch: 20 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(workbook, schoolsRefSheet, 'Schools Reference');

    // Sheet 3: Departments Reference - all department codes with their school
    const deptRefHeaders = ['School Code', 'School Name', 'Department Code', 'Department Name'];
    const deptRefRows = departments.map(d => [
      d.faculty?.facultyCode || '',
      d.faculty?.facultyName || '',
      d.departmentCode,
      d.departmentName
    ]);
    const deptRefSheet = XLSX.utils.aoa_to_sheet([deptRefHeaders, ...deptRefRows]);
    deptRefSheet['!cols'] = [{ wch: 20 }, { wch: 45 }, { wch: 20 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(workbook, deptRefSheet, 'Departments Reference');
    
    // Sheet 4: Existing Programmes
    const existingHeaders = ['School Code', 'School Name', 'Department Code', 'Department Name', 'Programme Code', 'Programme Name', 'Type', 'Duration (Years)'];
    const existingRows = existingProgrammes.map(p => [
      p.department?.faculty?.facultyCode || '',
      p.department?.faculty?.facultyName || '',
      p.department?.departmentCode || '',
      p.department?.departmentName || '',
      p.programCode,
      p.programName,
      p.programType,
      p.durationYears || ''
    ]);
    const existingSheet = XLSX.utils.aoa_to_sheet([existingHeaders, ...existingRows]);
    existingSheet['!cols'] = existingHeaders.map(h => ({ wch: Math.max(h.length + 4, 25) }));
    XLSX.utils.book_append_sheet(workbook, existingSheet, 'Existing Programmes');
    
    // Send response
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=programmes_template.xlsx`);
    res.send(buffer);
  } catch (error) {
    log.logError('get_programme_template_error', error);
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
};

/**
 * Generate Excel template for employees
 */
exports.getEmployeeTemplate = async (req, res) => {
  try {
    const headers = [
      'empId*',
      'firstName*',
      'lastName',
      'email*',
      'phoneNumber',
      'schoolCode',
      'departmentCode',
      'designation',
      'userType*',
      'password',
      'scopusAuthorId',
      'orcid',
      'pubmedId',
    ];

    const sampleRows = [[
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
      '57205678901',           // scopusAuthorId (optional)
      '0000-0002-1825-0097',   // orcid (optional)
      '',                      // pubmedId (optional)
    ]];

    sendExcelTemplate(res, headers, sampleRows, 'employees_template.xlsx', 'Employees');
  } catch (error) {
    log.logError('get_employee_template_error', error);
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
};

/**
 * Generate Excel template for students
 */
exports.getStudentTemplate = async (req, res) => {
  try {
    const headers = [
      'studentId*',
      'registrationNo',
      'firstName*',
      'lastName',
      'email*',
      'phone',
      'programCode*',
      'sectionCode',
      'currentSemester',
      'password',
    ];

    const sampleRows = [
      [
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
      ],
      [
        'STU2025002',
        'REG2025002',
        'John',
        'Doe',
        'john.doe@student.sgtuniversity.ac.in',
        '9876543211',
        'BTECH-CS',
        '', // Empty sectionCode to show it's optional
        '1',
        'Welcome@123',
      ]
    ];

    sendExcelTemplate(res, headers, sampleRows, 'students_template.xlsx', 'Students');
  } catch (error) {
    log.logError('get_student_template_error', error);
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

  // Clean headers by removing asterisks and quotes
  const headers = normalizedRows[0].map((header) => 
    header.replace(/^"|"$/g, '').replace(/\*$/, '')
  );
  
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

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value) {
  const raw = String(value || '').trim().toLowerCase();
  return ['true', 'yes', '1', 'y', 'on'].includes(raw);
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
      const [batchYear, admissionCapacity, filePath, fileName] = item.split(':').map((part) => (part || '').trim());
      return {
        batchYear: numberOrNull(batchYear),
        admissionCapacity: numberOrNull(admissionCapacity),
        filePath,
        fileName: fileName || (filePath ? filePath.split('/').pop() : ''),
        uploadedAt: new Date().toISOString(),
      };
    })
    .filter((document) => document.batchYear !== null && document.filePath && document.fileName);
}

function mapProgramType(value) {
  const raw = String(value || '').trim();
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
  return programTypeMapping[raw] || programTypeMapping[raw.toLowerCase()];
}

/**
 * Bulk upload schools
 */
exports.bulkUploadSchools = async (req, res) => {
  try {
    let parsedData;
    if (req.file) {
      parsedData = parseUploadedFile(req.file);
    } else if (req.body.excelContent) {
      // Handle base64 encoded Excel content if needed
      parsedData = parseUploadedFile({
        buffer: Buffer.from(req.body.excelContent, 'base64'),
        originalname: 'upload.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    } else {
      return res.status(400).json({ success: false, message: 'Excel file is required' });
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
            error: `School with code '${row.facultyCode}' already exists. Please use a different school code or update the existing record.`,
          });
          continue;
        }

        // Validate facultyType
        const validTypes = ['engineering', 'management', 'arts', 'science', 'medical', 'law', 'other'];
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
        // Log the technical error for debugging
        log.logError('bulk_upload_schools_row_error', error, {
          rowNumber,
          rowData: row,
          operation: 'create school'
        });

        // Provide user-friendly error message
        const userMessage = parseErrorWithContext(error, 'create school', row);
        results.failed.push({
          row: rowNumber,
          data: row,
          error: userMessage,
        });
      }
    }

    res.json(formatBulkUploadResponse(rows, results));
  } catch (error) {
    log.logError('bulk_upload_schools_error', error, {
      userId: req.user?.id,
      hasFile: !!req.file,
      hasCsvContent: !!req.body.csvContent
    });
    
    // Provide user-friendly error message
    if (isSystemError(error)) {
      res.status(500).json({ 
        success: false, 
        message: 'System error occurred. Please try again later or contact support if the problem persists.' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to process school bulk upload. Please check your file format and data.' 
      });
    }
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
    } else if (req.body.excelContent) {
      // Handle base64 encoded Excel content if needed
      parsedData = parseUploadedFile({
        buffer: Buffer.from(req.body.excelContent, 'base64'),
        originalname: 'upload.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    } else {
      return res.status(400).json({ success: false, message: 'Excel file is required' });
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
            error: `Department with code '${row.departmentCode}' already exists. Please use a different department code or update the existing record.`,
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
        // Log the technical error for debugging
        log.logError('bulk_upload_departments_row_error', error, {
          rowNumber,
          rowData: row,
          operation: 'create department'
        });

        // Provide user-friendly error message
        const userMessage = parseErrorWithContext(error, 'create department', row);
        results.failed.push({
          row: rowNumber,
          data: row,
          error: userMessage,
        });
      }
    }

    res.json(formatBulkUploadResponse(rows, results));
  } catch (error) {
    log.logError('bulk_upload_departments_error', error, {
      userId: req.user?.id,
      hasFile: !!req.file,
      hasCsvContent: !!req.body.csvContent
    });
    
    // Provide user-friendly error message
    if (isSystemError(error)) {
      res.status(500).json({ 
        success: false, 
        message: 'System error occurred. Please try again later or contact support if the problem persists.' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to process department bulk upload. Please check your file format and data.' 
      });
    }
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
    } else if (req.body.excelContent) {
      // Handle base64 encoded Excel content if needed
      parsedData = parseUploadedFile({
        buffer: Buffer.from(req.body.excelContent, 'base64'),
        originalname: 'upload.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    } else {
      return res.status(400).json({ success: false, message: 'Excel file is required' });
    }

    const { rows } = parsedData;
    
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found in the uploaded file' });
    }

    const results = { success: [], failed: [] };

    const schools = await prisma.facultySchoolList.findMany({
      select: { id: true, facultyCode: true },
    });
    const schoolMap = new Map(schools.map((school) => [String(school.facultyCode).trim().toUpperCase(), school.id]));

    // Cache departments for lookup
    const departments = await prisma.department.findMany({
      select: { id: true, departmentCode: true, facultyId: true },
    });
    const deptMap = new Map(departments.map((department) => [
      `${department.facultyId}:${String(department.departmentCode).trim().toUpperCase()}`,
      department.id,
    ]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        // Validate required fields
        if (!row.schoolCode || !row.departmentCode || !row.programCode || !row.programName || !row.programType) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: 'Missing required fields: schoolCode, departmentCode, programCode, programName, or programType',
          });
          continue;
        }

        const schoolCode = String(row.schoolCode).trim().toUpperCase();
        const departmentCode = String(row.departmentCode).trim().toUpperCase();
        const programCode = String(row.programCode).trim().toUpperCase();

        const schoolId = schoolMap.get(schoolCode);
        if (!schoolId) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `School with code ${row.schoolCode} not found`,
          });
          continue;
        }

        // Find department
        const deptId = deptMap.get(`${schoolId}:${departmentCode}`);
        if (!deptId) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Department with code ${row.departmentCode} not found in school ${row.schoolCode}`,
          });
          continue;
        }

        // Check if programme already exists
        const existing = await prisma.program.findUnique({
          where: { programCode },
        });

        if (existing) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Programme with code '${row.programCode}' already exists. Please use a different program code or update the existing record.`,
          });
          continue;
        }

        // Validate programType
        const mappedProgramType = mapProgramType(row.programType);
        const validTypes = ['undergraduate', 'postgraduate', 'doctoral', 'diploma', 'certificate'];
        if (!mappedProgramType) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Invalid programType. Must be one of: ${validTypes.join(', ')}`,
          });
          continue;
        }

        const specializations = parseProgrammeSpecializations(row.specializations);
        const creditMin = numberOrNull(row.creditMin);
        const creditMax = numberOrNull(row.creditMax || row.totalCredits);
        const internshipSpecializations = parseProgrammeSpecializations(row.internshipSpecializations);
        const metadata = {
          creditRange: creditMin !== null || creditMax !== null
            ? { min: creditMin ?? undefined, max: creditMax ?? undefined }
            : undefined,
          specializationChargeRules: parseSpecializationChargeRules(row.specializationChargeRules, programCode, specializations),
          batchYearDocuments: parseBatchYearDocuments(row.batchYearDocuments),
          internshipApplicable: parseBoolean(row.internshipApplicable),
          internshipDurationMonths: numberOrNull(row.internshipDurationMonths),
          internshipSpecializations,
        };

        // Create programme
        const programme = await prisma.program.create({
          data: {
            departmentId: deptId,
            programCode,
            programName: row.programName,
            programType: mappedProgramType,
            shortName: row.shortName || null,
            description: row.description || null,
            durationYears: row.durationYears ? parseInt(row.durationYears) : 4,
            durationMonths: row.durationMonths ? parseInt(row.durationMonths) : null,
            durationSemesters: row.durationSemesters ? parseInt(row.durationSemesters) : 8,
            totalCredits: creditMax ?? creditMin,
            metadata,
            isActive: true,
          },
        });

        if (specializations.length > 0) {
          await prisma.programSpecialization.createMany({
            data: specializations.map((specializationName, index) => ({
              programId: programme.id,
              specializationCode: `${programCode}-SP${index + 1}`,
              specializationName,
              isActive: true,
            })),
          });
        }

        results.success.push({
          row: rowNumber,
          data: programme,
        });
      } catch (error) {
        // Log the technical error for debugging
        log.logError('bulk_upload_programmes_row_error', error, {
          rowNumber,
          rowData: row,
          operation: 'create programme'
        });

        // Provide user-friendly error message
        const userMessage = parseErrorWithContext(error, 'create programme', row);
        results.failed.push({
          row: rowNumber,
          data: row,
          error: userMessage,
        });
      }
    }

    res.json(formatBulkUploadResponse(rows, results));
  } catch (error) {
    log.logError('bulk_upload_programmes_error', error, {
      userId: req.user?.id,
      hasFile: !!req.file,
      hasCsvContent: !!req.body.csvContent
    });
    
    // Provide user-friendly error message
    if (isSystemError(error)) {
      res.status(500).json({ 
        success: false, 
        message: 'System error occurred. Please try again later or contact support if the problem persists.' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to process programme bulk upload. Please check your file format and data.' 
      });
    }
  }
};

/**
 * Bulk upload employees
 */
exports.bulkUploadEmployees = async (req, res) => {
  try {
    log.logAction('bulk_upload_employees_start', 'Starting employee bulk upload', {
      userId: req.user?.id,
      hasFile: !!req.file,
      hasExcelContent: !!req.body.excelContent
    });
    
    let parsedData;
    if (req.file) {
      parsedData = parseUploadedFile(req.file);
    } else if (req.body.excelContent) {
      // Handle base64 encoded Excel content if needed
      parsedData = parseUploadedFile({
        buffer: Buffer.from(req.body.excelContent, 'base64'),
        originalname: 'upload.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    } else {
      return res.status(400).json({ success: false, message: 'Excel file is required' });
    }

    const { rows } = parsedData;
    
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found in the uploaded file' });
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
            error: `Employee with ID '${row.empId}' already exists. Please use a different employee ID or update the existing record.`,
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
            error: `User with email '${row.email}' already exists. Please use a different email address or update the existing record.`,
          });
          continue;
        }

        // Validate userType
        const validUserTypes = ['faculty', 'staff', 'admin'];
        if (!validUserTypes.includes(row.userType.toLowerCase())) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Invalid userType '${row.userType}'. Must be one of: ${validUserTypes.join(', ')}. Please check the spelling and case.`,
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
              error: `School with code '${row.schoolCode}' not found. Please verify the school code exists in the system or create the school first.`,
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
              error: `Department with code '${row.departmentCode}' not found. Please verify the department code exists in the system or create the department first.`,
            });
            continue;
          }
        }

        // Hash password
        const password = row.password || 'Welcome@123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Map userType to role
        const roleMapping = {
          'faculty': 'faculty',
          'staff': 'staff',
          'admin': 'admin'
        };
        const role = roleMapping[row.userType.toLowerCase()] || 'staff';

        // Create user and employee in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Create UserLogin
          const user = await tx.userLogin.create({
            data: {
              uid: row.empId,
              email: row.email,
              passwordHash: hashedPassword,
              role: role,
              status: 'active',
              // Tenant binding — required by protect() for non-superadmin users
              universityId: req.tenantId || req.user?.universityId || null,
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

          // Upsert researcher IDs if any are provided in the row
          const scopusAuthorId = (row.scopusAuthorId || '').trim() || null;
          const orcid = (row.orcid || '').trim() || null;
          const pubmedId = (row.pubmedId || '').trim() || null;

          if (scopusAuthorId || orcid || pubmedId) {
            // Validate ORCID format if provided
            if (orcid && !/^\d{4}-\d{4}-\d{4}-[\dX]{4}$/i.test(orcid)) {
              throw Object.assign(
                new Error(`Invalid ORCID format '${orcid}' — must be XXXX-XXXX-XXXX-XXXX`),
                { statusCode: 400 }
              );
            }
            await tx.researchProfileIdentity.upsert({
              where: { userId: user.id },
              create: {
                userId: user.id,
                scopusAuthorId,
                orcid,
                pubmedId,
                syncFrequencyDays: 1,
              },
              update: { scopusAuthorId, orcid, pubmedId },
            });
          }

          return { user, employee, scopusAuthorId, orcid, pubmedId };
        });

        results.success.push({
          row: rowNumber,
          data: {
            empId: row.empId,
            name: `${row.firstName} ${row.lastName || ''}`.trim(),
            email: row.email,
            userType: row.userType,
            scopusAuthorId: result.scopusAuthorId || null,
            orcid: result.orcid || null,
            pubmedId: result.pubmedId || null,
          },
        });
      } catch (error) {
        // Log the technical error for debugging
        log.logError('bulk_upload_employees_row_error', error, {
          rowNumber,
          rowData: row,
          operation: 'create employee'
        });

        // Provide user-friendly error message
        const userMessage = parseErrorWithContext(error, 'create employee', row);
        results.failed.push({
          row: rowNumber,
          data: row,
          error: userMessage,
        });
      }
    }

    log.logAction('bulk_upload_employees_complete', 'Employee bulk upload completed', {
      userId: req.user?.id,
      totalRows: rows.length,
      successCount: results.success.length,
      failedCount: results.failed.length
    });

    res.json(formatBulkUploadResponse(rows, results));
  } catch (error) {
    log.logError('bulk_upload_employees_error', error, {
      userId: req.user?.id,
      hasFile: !!req.file,
      hasExcelContent: !!req.body.excelContent
    });
    
    // Provide user-friendly error message
    if (isSystemError(error)) {
      res.status(500).json({ 
        success: false, 
        message: 'System error occurred. Please try again later or contact support if the problem persists.' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to process employee bulk upload. Please check your Excel file format and data.' 
      });
    }
  }
};

/**
 * Bulk upload students
 */
exports.bulkUploadStudents = async (req, res) => {
  try {
    let parsedData;
    if (req.file) {
      parsedData = parseUploadedFile(req.file);
    } else if (req.body.excelContent) {
      // Handle base64 encoded Excel content if needed
      parsedData = parseUploadedFile({
        buffer: Buffer.from(req.body.excelContent, 'base64'),
        originalname: 'upload.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    } else {
      return res.status(400).json({ success: false, message: 'Excel file is required' });
    }

    const { rows } = parsedData;
    
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data rows found in the uploaded file' });
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
        if (!row.studentId || !row.firstName || !row.email || !row.programCode) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: 'Missing required fields: studentId, firstName, email, or programCode',
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
            error: `Student with ID '${row.studentId}' already exists. Please use a different student ID or update the existing record.`,
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
            error: `User with email '${row.email}' already exists. Please use a different email address or update the existing record.`,
          });
          continue;
        }

        // Get programme ID
        const programId = programMap.get(row.programCode);
        if (!programId) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Programme with code '${row.programCode}' not found. Please verify the program code exists in the system or create the program first.`,
          });
          continue;
        }

        // Get section ID (optional - can be null if no section specified)
        let sectionId = null;
        if (row.sectionCode && row.sectionCode.trim()) {
          sectionId = sectionMap.get(`${programId}-${row.sectionCode.trim()}`);
          if (!sectionId) {
            results.failed.push({
              row: rowNumber,
              data: row,
              error: `Section '${row.sectionCode}' not found for programme '${row.programCode}'. Please verify the section exists or create it first, or leave sectionCode empty if not applicable.`,
            });
            continue;
          }
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
              role: 'student',
              status: 'active',
              // Tenant binding — required by protect() for non-superadmin users
              universityId: req.tenantId || req.user?.universityId || null,
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
              sectionId: sectionId, // Can be null if no section specified
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
        // Log the technical error for debugging
        log.logError('bulk_upload_students_row_error', error, {
          rowNumber,
          rowData: row,
          operation: 'create student'
        });

        // Provide user-friendly error message
        const userMessage = parseErrorWithContext(error, 'create student', row);
        results.failed.push({
          row: rowNumber,
          data: row,
          error: userMessage,
        });
      }
    }

    res.json(formatBulkUploadResponse(rows, results));
  } catch (error) {
    log.logError('bulk_upload_students_error', error, {
      userId: req.user?.id,
      hasFile: !!req.file,
      hasExcelContent: !!req.body.excelContent
    });
    
    // Provide user-friendly error message
    if (isSystemError(error)) {
      res.status(500).json({ 
        success: false, 
        message: 'System error occurred. Please try again later or contact support if the problem persists.' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to process student bulk upload. Please check your Excel file format and data.' 
      });
    }
  }
};

/**
 * Preview Excel file data before upload
 */
exports.previewExcelData = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Excel file is required for preview' });
    }

    // Parse the uploaded Excel file
    const parsedData = parseUploadedFile(req.file);
    const { headers, rows } = parsedData;

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          headers: [],
          rows: [],
          totalRows: 0,
          previewRows: 0,
          message: 'No data rows found in the uploaded file'
        }
      });
    }

    // Limit preview to first 10 rows for performance
    const previewRows = rows.slice(0, 10);
    
    res.json({
      success: true,
      data: {
        headers,
        rows: previewRows,
        totalRows: rows.length,
        previewRows: previewRows.length,
        message: `Showing first ${previewRows.length} of ${rows.length} rows`
      }
    });
  } catch (error) {
    log.logError('preview_excel_data_error', error, {
      userId: req.user?.id,
      fileName: req.file?.originalname
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to preview Excel file. Please ensure it is a valid Excel file (.xlsx).' 
    });
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
    log.logError('get_upload_stats_error', error);
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
};
