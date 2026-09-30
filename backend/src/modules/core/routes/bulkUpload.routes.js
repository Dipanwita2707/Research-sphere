const express = require('express');
const router = express.Router();
const multer = require('multer');
const bulkUploadController = require('../controllers/bulkUpload.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');
const { MAX_UPLOAD_BYTES } = require('../utils/spreadsheet');
const { withTenantContext } = require('../utils/withTenantContext');

// Configure multer for spreadsheet uploads (.xlsx or .csv; content is verified again when parsed)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(xlsx|csv)$/i.test(file.originalname)
      || [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
      ].includes(file.mimetype);

    if (allowed) {
      cb(null, true);
    } else {
      const err = new Error('Only .xlsx or .csv files are allowed');
      err.code = 'UNSUPPORTED_FILE_TYPE';
      cb(err, false);
    }
  },
});

/** Run multer and turn its errors (size, type) into 400 responses instead of 500s. */
const singleFile = withTenantContext((req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `File is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)`
      : err.code === 'UNSUPPORTED_FILE_TYPE'
        ? err.message
        : 'Invalid file upload';
    return res.status(400).json({ success: false, message });
  });
});

/**
 * Bulk upload always writes into exactly one university. Tenant admins are bound to
 * theirs; a superadmin must choose one via the X-University-Id header.
 */
const requireTenant = (req, res, next) => {
  if (!req.tenantId) {
    return res.status(400).json({
      success: false,
      code: 'UNIVERSITY_REQUIRED',
      message: 'Select a university before using bulk upload (X-University-Id header is required for superadmin).',
    });
  }
  next();
};

// Admin of a tenant, or superadmin acting on one tenant
router.use(protect);
router.use(restrictTo('admin', 'superadmin'));
router.use(requireTenant);

// Template download routes
router.get('/template/schools', bulkUploadController.getSchoolTemplate);
router.get('/template/departments', bulkUploadController.getDepartmentTemplate);
router.get('/template/programmes', bulkUploadController.getProgrammeTemplate);
router.get('/template/employees', bulkUploadController.getEmployeeTemplate);
router.get('/template/students', bulkUploadController.getStudentTemplate);

// Data preview route
router.post('/preview', singleFile, bulkUploadController.previewExcelData);

// Bulk upload routes with file upload middleware
router.post('/schools', singleFile, bulkUploadController.bulkUploadSchools);
router.post('/departments', singleFile, bulkUploadController.bulkUploadDepartments);
router.post('/programmes', singleFile, bulkUploadController.bulkUploadProgrammes);
router.post('/employees', singleFile, bulkUploadController.bulkUploadEmployees);
router.post('/students', singleFile, bulkUploadController.bulkUploadStudents);

// Stats route
router.get('/stats', bulkUploadController.getUploadStats);

module.exports = router;
