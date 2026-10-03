const prisma = require('../../../shared/config/database');
const { preparePassword, PasswordPolicyError } = require('../utils/userCredentials');
const { readSpreadsheet, buildWorkbookBuffer, SpreadsheetError, MAX_UPLOAD_ROWS } = require('../utils/spreadsheet');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { parseErrorWithContext, isValidationError, isSystemError } = require('../../../shared/utils/prismaErrorHandler');

const log = createModuleLogger('bulk-upload');

/**
 * Format bulk upload response consistently
 */
function formatBulkUploadResponse(rows, results) {
  const generatedCredentials = results.success
    .filter((s) => s.generatedPassword)
    .map((s) => ({ row: s.row, uid: s.data?.empId || s.data?.studentId, email: s.data?.email, generatedPassword: s.generatedPassword }));
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
      // Passwords generated for rows without one; shown only in this response
      ...(generatedCredentials.length > 0 && { generatedCredentials }),
    },
  };
}

const MULTI_LINE_FIELDS = new Set([
  'description', 'programName', 'departmentName', 'facultyName', 'shortName',
  'headName', 'specializations', 'internshipSpecializations', 'contactEmail',
  'officeLocation', 'websiteUrl', 'firstName', 'lastName', 'designation',
]);

const TEMPLATE_INSTRUCTIONS = [
  ['BULK UPLOAD INSTRUCTIONS'],
  [''],
  ['BASIC INSTRUCTIONS:'],
  ['1. Fill in the data starting from row 2 (keep the headers in row 1)'],
  ['2. Required fields are marked with * in the template'],
  ['3. Do not modify the header row'],
  ['4. Save the file as .xlsx (or .csv) and upload it using the bulk upload feature'],
  [`5. A single upload may contain at most ${MAX_UPLOAD_ROWS} data rows (1000 for employees/students) and 10MB`],
  [''],
  ['MULTI-LINE CONTENT SUPPORT:'],
  ['• For fields like descriptions, names, specializations, etc.'],
  ['• Press ALT + ENTER to create new lines within the same cell'],
  [''],
  ['FIELD-SPECIFIC GUIDELINES:'],
  ['• Specializations: Separate multiple items with | or use ALT+ENTER'],
  ['• Email addresses: Must be valid and unique across the system'],
  ['• Phone numbers: 7-15 digits; may start with + and contain spaces or dashes'],
  ['• Codes (studentId, empId, etc.): Must be unique identifiers'],
  ['• Password: optional; at least 10 characters with a letter and a digit. Leave empty to auto-generate (shown once after upload)'],
  ['• Formulas are not evaluated: enter plain values only'],
  [''],
  ['IMPORTANT NOTES:'],
  ['• Use exact values for dropdown-like fields (facultyType, userType, programType)'],
  ['• Leave optional fields empty if not applicable'],
  [''],
  ['SUPPORT:'],
  ['For questions about bulk upload, contact your system administrator.'],
];

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendWorkbook(res, buffer, fileName) {
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
}

async function sendExcelTemplate(res, headers, sampleRows, fileName, sheetName) {
  const isMultiLine = (header) => MULTI_LINE_FIELDS.has(header.replace(/\*$/, ''));
  const widths = headers.map((header) => (isMultiLine(header)
    ? Math.max(header.length + 8, 25)
    : Math.max(header.length + 4, 18)));
  const wrapColumns = headers.map((header, index) => (isMultiLine(header) ? index : -1)).filter((i) => i >= 0);

  const buffer = await buildWorkbookBuffer([
    { name: sheetName, rows: [headers, ...sampleRows], widths, wrapColumns },
    { name: 'Instructions', rows: TEMPLATE_INSTRUCTIONS, widths: [80] },
  ]);
  sendWorkbook(res, buffer, fileName);
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
      'socs@university.example.edu',
      '1234567890',
      'Block A, Floor 2\nRoom 201-205',
      'https://university.example.edu/socs',
    ]];

    await sendExcelTemplate(res, headers, sampleRows, 'schools_template.xlsx', 'Schools');
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
      'cs@university.example.edu',
      '1234567890',
      'Block A, Room 201',
    ]];

    // Sheet 2: Schools Reference - all schools with code and name for cross-checking
    const schoolsRefHeaders = ['School Code', 'School Name'];
    const schoolsRefRows = schools.map(s => [s.facultyCode, s.facultyName]);

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
    const buffer = await buildWorkbookBuffer([
      { name: 'Template', rows: [headers, ...sampleRows], widths: headers.map(h => Math.max(h.length + 4, 18)) },
      { name: 'Schools Reference', rows: [schoolsRefHeaders, ...schoolsRefRows], widths: [20, 45] },
      { name: 'Existing Departments', rows: [existingHeaders, ...existingRows], widths: existingHeaders.map(h => Math.max(h.length + 4, 25)) },
    ]);
    sendWorkbook(res, buffer, 'departments_template.xlsx');
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

    // Sheet 2: Schools Reference - all school codes and names
    const schoolsRefHeaders = ['School Code', 'School Name'];
    const schoolsRefRows = allSchools.map(s => [s.facultyCode, s.facultyName]);

    // Sheet 3: Departments Reference - all department codes with their school
    const deptRefHeaders = ['School Code', 'School Name', 'Department Code', 'Department Name'];
    const deptRefRows = departments.map(d => [
      d.faculty?.facultyCode || '',
      d.faculty?.facultyName || '',
      d.departmentCode,
      d.departmentName
    ]);
    
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
    const buffer = await buildWorkbookBuffer([
      { name: 'Template', rows: [headers, ...sampleRows], widths: headers.map(h => Math.max(h.length + 4, 20)) },
      { name: 'Schools Reference', rows: [schoolsRefHeaders, ...schoolsRefRows], widths: [20, 45] },
      { name: 'Departments Reference', rows: [deptRefHeaders, ...deptRefRows], widths: [20, 45, 20, 45] },
      { name: 'Existing Programmes', rows: [existingHeaders, ...existingRows], widths: existingHeaders.map(h => Math.max(h.length + 4, 25)) },
    ]);
    sendWorkbook(res, buffer, 'programmes_template.xlsx');
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
      'john.doe@university.example.edu',
      '9876543210',
      'SOCS',
      'CS',
      'Assistant Professor',
      'faculty',
      '',                      // password (optional: leave empty to auto-generate)
      '57205678901',           // scopusAuthorId (optional)
      '0000-0002-1825-0097',   // orcid (optional)
      '',                      // pubmedId (optional)
    ]];

    await sendExcelTemplate(res, headers, sampleRows, 'employees_template.xlsx', 'Employees');
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
        'jane.smith@student.university.example.edu',
        '9876543210',
        'BTECH-CS',
        'CS-A',
        '1',
        '', // password (optional: leave empty to auto-generate)
      ],
      [
        'STU2025002',
        'REG2025002',
        'John',
        'Doe',
        'john.doe@student.university.example.edu',
        '9876543211',
        'BTECH-CS',
        '', // Empty sectionCode to show it's optional
        '1',
        '', // password (optional: leave empty to auto-generate)
      ]
    ];

    await sendExcelTemplate(res, headers, sampleRows, 'students_template.xlsx', 'Students');
  } catch (error) {
    log.logError('get_student_template_error', error);
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
};

// ── Upload parsing & validation ─────────────────────────────────────────────
// Account uploads hash a password per row (bcrypt, 12 rounds), so they get a lower cap
// to keep one request within a few minutes.
const MAX_ACCOUNT_UPLOAD_ROWS = 1000;
const MAX_BASE64_LENGTH = Math.ceil((10 * 1024 * 1024 * 4) / 3) + 4;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{5,18}[0-9]$/;

const isValidEmail = (value) => typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value);
const isValidPhone = (value) => {
  if (typeof value !== 'string' || !PHONE_RE.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

/**
 * Get the uploaded spreadsheet from multipart `file` or a base64 `excelContent` body field.
 * Returns null when neither was sent.
 */
async function parseUploadRequest(req, opts = {}) {
  if (req.file) return readSpreadsheet(req.file, opts);
  if (req.body && typeof req.body.excelContent === 'string' && req.body.excelContent) {
    if (req.body.excelContent.length > MAX_BASE64_LENGTH) {
      throw new SpreadsheetError('File is too large (max 10MB)');
    }
    return readSpreadsheet({
      buffer: Buffer.from(req.body.excelContent, 'base64'),
      originalname: 'upload.xlsx',
    }, opts);
  }
  return null;
}

/**
 * Validate an optional contact field on a row. Returns an error message or null.
 */
function validateContactFields(row, { emailFields = [], phoneFields = [] }) {
  for (const field of emailFields) {
    if (row[field] && !isValidEmail(row[field])) return `Invalid email address in '${field}': '${row[field]}'`;
  }
  for (const field of phoneFields) {
    if (row[field] && !isValidPhone(row[field])) return `Invalid phone number in '${field}': '${row[field]}' (7-15 digits, optional leading +)`;
  }
  return null;
}

/**
 * Common preamble for every bulk upload: parse + row checks. Sends the 400 itself and
 * returns null when the request cannot proceed.
 */
async function loadUploadRows(req, res, opts = {}) {
  let parsed;
  try {
    parsed = await parseUploadRequest(req, opts);
  } catch (error) {
    if (error instanceof SpreadsheetError) {
      res.status(400).json({ success: false, message: error.message });
      return null;
    }
    throw error;
  }
  if (!parsed) {
    res.status(400).json({ success: false, message: 'Excel file is required' });
    return null;
  }
  if (parsed.rows.length === 0) {
    res.status(400).json({ success: false, message: 'No data rows found in the uploaded file' });
    return null;
  }
  return parsed;
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
    const parsedData = await loadUploadRows(req, res);
    if (!parsedData) return;
    const { rows } = parsedData;

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

        const contactError = validateContactFields(row, { emailFields: ['contactEmail'], phoneFields: ['contactPhone'] });
        if (contactError) {
          results.failed.push({ row: rowNumber, data: row, error: contactError });
          continue;
        }

        // Check if already exists (facultyCode is unique per university; tenant filter is automatic)
        const existing = await prisma.facultySchoolList.findFirst({
          where: { facultyCode: row.facultyCode },
          select: { id: true },
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
    const parsedData = await loadUploadRows(req, res);
    if (!parsedData) return;
    const { rows } = parsedData;

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

        const contactError = validateContactFields(row, { emailFields: ['contactEmail'], phoneFields: ['contactPhone'] });
        if (contactError) {
          results.failed.push({ row: rowNumber, data: row, error: contactError });
          continue;
        }

        // Check if department already exists (departmentCode is unique per university)
        const existing = await prisma.department.findFirst({
          where: { departmentCode: row.departmentCode },
          select: { id: true },
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
    const parsedData = await loadUploadRows(req, res);
    if (!parsedData) return;
    const { rows } = parsedData;

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

        // Check if programme already exists (programCode is unique per university)
        const existing = await prisma.program.findFirst({
          where: { programCode },
          select: { id: true },
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
    
    const parsedData = await loadUploadRows(req, res, { maxRows: MAX_ACCOUNT_UPLOAD_ROWS });
    if (!parsedData) return;
    const { rows } = parsedData;

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

        if (!isValidEmail(row.email)) {
          results.failed.push({ row: rowNumber, data: row, error: `Invalid email address '${row.email}'` });
          continue;
        }
        const contactError = validateContactFields(row, { phoneFields: ['phoneNumber'] });
        if (contactError) {
          results.failed.push({ row: rowNumber, data: row, error: contactError });
          continue;
        }

        // Check if employee ID already exists
        const existingEmp = await prisma.employeeDetails.findFirst({
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

        // Password: the row's (policy-checked) or a generated one returned once in the response
        const { passwordHash: hashedPassword, passwordChangedAt, generatedPassword } = await preparePassword(
          row.password,
          { uid: row.empId, email: row.email }
        );

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
              passwordChangedAt,
              role: role,
              status: 'active',
              // Tenant binding — required by protect() for non-superadmin users
              universityId: req.tenantId,
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
          generatedPassword,
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
        const userMessage = error instanceof PasswordPolicyError || error.statusCode === 400
          ? error.message
          : parseErrorWithContext(error, 'create employee', row);
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
    const parsedData = await loadUploadRows(req, res, { maxRows: MAX_ACCOUNT_UPLOAD_ROWS });
    if (!parsedData) return;
    const { rows } = parsedData;

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

        if (!isValidEmail(row.email)) {
          results.failed.push({ row: rowNumber, data: row, error: `Invalid email address '${row.email}'` });
          continue;
        }
        const contactError = validateContactFields(row, { phoneFields: ['phone'] });
        if (contactError) {
          results.failed.push({ row: rowNumber, data: row, error: contactError });
          continue;
        }

        // Check if student ID already exists
        const existingStudent = await prisma.studentDetails.findFirst({
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

        // Password: the row's (policy-checked) or a generated one returned once in the response
        const { passwordHash: hashedPassword, passwordChangedAt, generatedPassword } = await preparePassword(
          row.password,
          { uid: row.studentId, email: row.email }
        );

        // Create user and student in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Create UserLogin
          const user = await tx.userLogin.create({
            data: {
              uid: row.studentId,
              email: row.email,
              passwordHash: hashedPassword,
              passwordChangedAt,
              role: 'student',
              status: 'active',
              // Tenant binding — required by protect() for non-superadmin users
              universityId: req.tenantId,
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
          generatedPassword,
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
        const userMessage = error instanceof PasswordPolicyError
          ? error.message
          : parseErrorWithContext(error, 'create student', row);
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
    let parsedData;
    try {
      parsedData = await readSpreadsheet(req.file);
    } catch (error) {
      if (error instanceof SpreadsheetError) {
        return res.status(400).json({ success: false, message: error.message });
      }
      throw error;
    }
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
