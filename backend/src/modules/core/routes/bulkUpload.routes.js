const express = require('express');
const router = express.Router();
const multer = require('multer');
const bulkUploadController = require('../controllers/bulkUpload.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');

// Configure multer for spreadsheet uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for Excel files
  fileFilter: (req, file, cb) => {
    const isExcel = /\.(xlsx|xls)$/i.test(file.originalname)
      || [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ].includes(file.mimetype);

    if (isExcel) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
    }
  },
});

// All routes require admin role
router.use(protect);
router.use(restrictTo('admin'));

// Template download routes
router.get('/template/schools', bulkUploadController.getSchoolTemplate);
router.get('/template/departments', bulkUploadController.getDepartmentTemplate);
router.get('/template/programmes', bulkUploadController.getProgrammeTemplate);
router.get('/template/employees', bulkUploadController.getEmployeeTemplate);
router.get('/template/students', bulkUploadController.getStudentTemplate);

// Data preview route
router.post('/preview', upload.single('file'), bulkUploadController.previewExcelData);

// Bulk upload routes with file upload middleware
router.post('/schools', upload.single('file'), bulkUploadController.bulkUploadSchools);
router.post('/departments', upload.single('file'), bulkUploadController.bulkUploadDepartments);
router.post('/programmes', upload.single('file'), bulkUploadController.bulkUploadProgrammes);
router.post('/employees', upload.single('file'), bulkUploadController.bulkUploadEmployees);
router.post('/students', upload.single('file'), bulkUploadController.bulkUploadStudents);

// Stats route
router.get('/stats', bulkUploadController.getUploadStats);

module.exports = router;
