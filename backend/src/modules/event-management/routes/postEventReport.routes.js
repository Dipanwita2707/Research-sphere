const express = require('express');
const multer = require('multer');
const path = require('path');

const { checkAnyPermission } = require('../../../shared/middleware/auth');
const { validateEventId } = require('../validators/event.validators');
const postEventReportController = require('../controllers/postEventReport.controller');
const {
  MAX_REPORT_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} = require('../services/postEventReport.service');

const router = express.Router({ mergeParams: true });

const eventReportUploadPerm = checkAnyPermission(
  ['event_manage_own', 'event_manage_all'],
  { checkDefaultPermissions: true },
);

const eventReportViewPerm = checkAnyPermission(
  ['event_manage_own', 'event_manage_all', 'event_view_reports'],
  { checkDefaultPermissions: true },
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_REPORT_SIZE_BYTES,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
      return;
    }

    if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Invalid report MIME type'), false);
      return;
    }

    cb(null, true);
  },
});

router.post(
  '/:id/post-reports',
  validateEventId,
  eventReportUploadPerm,
  upload.single('file'),
  postEventReportController.uploadPostEventReport,
);

router.get(
  '/:id/post-reports',
  validateEventId,
  eventReportViewPerm,
  postEventReportController.listPostEventReports,
);

router.get(
  '/:id/post-reports/:reportId/download',
  validateEventId,
  eventReportViewPerm,
  postEventReportController.downloadPostEventReport,
);

router.get(
  '/:id/post-reports/:reportId/preview',
  validateEventId,
  eventReportViewPerm,
  postEventReportController.previewPostEventReport,
);

module.exports = router;
