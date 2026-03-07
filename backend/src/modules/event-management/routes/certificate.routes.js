/**
 * Certificate Routes
 *
 * Handles certificate template management and bulk certificate sending
 * to event registrants.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const certificateController = require('../controllers/certificate.controller');
const { validateEventId } = require('../validators/event.validators');
const { checkAnyPermission } = require('../../../shared/middleware/auth');

const eventManagePerm = checkAnyPermission(
  ['event_manage_own', 'event_manage_all'],
  { checkDefaultPermissions: true }
);

// ── Multer config for certificate template uploads ───────────────
const memoryStorage = multer.memoryStorage();

const templateFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/svg+xml',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG, JPG, and SVG files are allowed for certificate templates.'), false);
  }
};

const uploadTemplate = multer({
  storage: memoryStorage,
  fileFilter: templateFileFilter,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB
});

// ── Routes ───────────────────────────────────────────────────────

// Upload a new certificate template
router.post(
  '/:id/certificates/templates',
  validateEventId,
  eventManagePerm,
  uploadTemplate.single('file'),
  certificateController.uploadTemplate
);

// List templates for an event
router.get(
  '/:id/certificates/templates',
  validateEventId,
  eventManagePerm,
  certificateController.getTemplates
);

// Update a template's text configuration
router.patch(
  '/:id/certificates/templates/:templateId',
  validateEventId,
  eventManagePerm,
  certificateController.updateTemplate
);

// Delete a certificate template
router.delete(
  '/:id/certificates/templates/:templateId',
  validateEventId,
  eventManagePerm,
  certificateController.deleteTemplate
);

// Get recipient counts per registration status
router.get(
  '/:id/certificates/recipients-count',
  validateEventId,
  eventManagePerm,
  certificateController.getRecipientsCount
);

// Send certificates to registrants
router.post(
  '/:id/certificates/send',
  validateEventId,
  eventManagePerm,
  certificateController.sendCertificates
);

// Send a test certificate to any email
router.post(
  '/:id/certificates/test-send',
  validateEventId,
  eventManagePerm,
  certificateController.sendTestCertificate
);

// Get certificate sending history
router.get(
  '/:id/certificates/history',
  validateEventId,
  eventManagePerm,
  certificateController.getCertificateHistory
);

module.exports = router;
