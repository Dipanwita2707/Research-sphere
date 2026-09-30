/**
 * Core Module Routes
 * Central router that mounts all API routes
 * 
 * @module core/routes
 */
const express = require('express');
const router = express.Router();

// =====================================
// CORE ROUTES (Administrative, Master Data)
// =====================================
const dashboardRoutes = require('./dashboard.routes');
const permissionRoutes = require('./permission.routes');
const permissionManagementRoutes = require('./permissionManagement.routes');
const roleManagementRoutes = require('./roleManagement.routes');
const designationRoutes = require('./designation.routes');
const userRoutes = require('./user.routes');
const schoolRoutes = require('./school.routes');
const centralDepartmentRoutes = require('./centralDepartment.routes');
const departmentRoutes = require('./department.routes');
const programRoutes = require('./program.routes');
const employeeRoutes = require('./employee.routes');
const studentRoutes = require('./student.routes');
const bulkUploadRoutes = require('./bulkUpload.routes');
const reportingStructureRoutes = require('./reportingStructure.routes');
const affiliationRoutes = require('./affiliation.routes');

// =====================================
// MODULAR IMPORTS (Domain Modules)
// =====================================
const authModule = require('../../auth');
const analyticsModule = require('../../analytics');
const drdAnalyticsModule = require('../../drd-analytics');
const notificationsModule = require('../../notifications');
const researchModule = require('../../research');
const grantsModule = require('../../grants');
const iprModule = require('../../ipr');
const financeModule = require('../../finance');
const bugReportsModule = require('../../bug-reports');

// =====================================
// MOUNT CORE ROUTES
// =====================================
router.use('/auth', authModule);
// DPDP: consent/rights API, then the consent gate for every route mounted below it
// (403 CONSENT_REQUIRED until the privacy notice is accepted; see dpdp/middleware/requireConsent.js)
router.use('/dpdp', require('../../dpdp'));
router.use(require('../../dpdp').consentGate);
router.use('/dashboard', dashboardRoutes);
router.use('/permissions', permissionRoutes);
router.use('/permission-management', permissionManagementRoutes);
router.use('/roles', roleManagementRoutes);
router.use('/designations', designationRoutes);
router.use('/users', userRoutes);
router.use('/schools', schoolRoutes);
router.use('/central-departments', centralDepartmentRoutes);
router.use('/departments', departmentRoutes);
router.use('/programs', programRoutes);
router.use('/employees', employeeRoutes);
router.use('/students', studentRoutes);
router.use('/bulk-upload', bulkUploadRoutes);
router.use('/reporting-structure', reportingStructureRoutes);
router.use('/affiliation', affiliationRoutes);
router.use('/analytics', analyticsModule);
router.use('/drd-analytics', drdAnalyticsModule);
router.use('/notifications', notificationsModule);
router.use('/file-upload', require('./fileUpload.routes'));

// =====================================
// MOUNT DOMAIN MODULES
// =====================================
router.use('/research', researchModule);
router.use('/grants', grantsModule);
router.use('/ipr', iprModule);
router.use('/finance', financeModule);
router.use('/bug-reports', bugReportsModule);
router.use('/admin/bug-reports', require('../../bug-reports/routes/admin.routes'));

// =====================================
// BACKWARD COMPATIBILITY ROUTES
// Maintain compatibility with existing frontend
// =====================================
router.use('/research-policies', require('../../research/routes/policies/research.routes'));
router.use('/book-policies', require('../../research/routes/policies/book.routes'));
router.use('/book-chapter-policies', require('../../research/routes/policies/bookChapter.routes'));
router.use('/conference-policies', require('../../research/routes/policies/conference.routes'));
router.use('/grant-policies', require('../../research/routes/policies/grant.routes'));
router.use('/incentive-policies', require('../../research/routes/policies/incentive.routes'));

router.use('/research-progress', require('../../research/routes/progressTracker.routes'));
router.use('/drd-review', require('../../research/routes/drdReview.routes'));
router.use('/dean-approval', require('../../research/routes/deanApproval.routes'));
router.use('/collaborative-editing', require('../../research/routes/collaborativeEditing.routes'));
router.use('/google-docs', require('../../research/routes/googleDocs.routes'));

router.use('/ipr-management', require('../../ipr/routes/iprManagement.routes'));

// ── Public contact form ──────────────────────────────────────────────────────
// Unauthenticated, so: dedicated rate limit, strict validation, honeypot field
// (`website` — hidden in the form; bots fill it) and HTML-escaped email body.
const contactLimiter = require('express-rate-limit')({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.CONTACT_RATE_LIMIT_PER_HOUR, 10) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many messages. Please try again later.' },
});

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const CONTACT_LIMITS = { name: 100, email: 254, subject: 200, message: 5000 };
const CONTACT_EMAIL_RE = /^[^\s@<>()[\]\,;:"]+@[^\s@<>()[\]\,;:"]+\.[A-Za-z]{2,}$/;

router.post('/contact', contactLimiter, async (req, res) => {
  try {
    const body = req.body || {};

    // Honeypot: pretend success so bots learn nothing
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return res.status(200).json({ success: true, message: 'Message sent successfully' });
    }

    const fields = {};
    for (const key of Object.keys(CONTACT_LIMITS)) {
      const value = body[key];
      if (typeof value !== 'string' || value.trim() === '') {
        return res.status(400).json({ success: false, error: 'All fields are required' });
      }
      if (value.length > CONTACT_LIMITS[key]) {
        return res.status(400).json({ success: false, error: `${key} must be at most ${CONTACT_LIMITS[key]} characters` });
      }
      fields[key] = value.trim();
    }
    // Header-bearing values must be single-line
    fields.name = fields.name.replace(/[\r\n]+/g, ' ');
    fields.subject = fields.subject.replace(/[\r\n]+/g, ' ');
    if (!CONTACT_EMAIL_RE.test(fields.email)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address' });
    }

    const { name, email, subject, message } = fields;
    const { emailService } = require('../services/email.service');
    const recipient = process.env.CONTACT_EMAIL || 'admin@researchsphere.com';

    const htmlContent = `
      <h3>New Contact Us Message</h3>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message).replace(/\r?\n/g, '<br>')}</p>
    `;

    const emailResult = await emailService.sendEmail({
      to: recipient,
      subject: `[Contact Us] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage:\n${message}`,
      html: htmlContent
    });

    if (!emailResult || emailResult.success === false) {
      console.error(`[Contact Form] Delivery failed: ${emailResult?.error || 'unknown error'}`);
      return res.status(503).json({ success: false, error: 'Message could not be sent right now. Please try again later.' });
    }

    console.log('[Contact Form] Message delivered');
    return res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error in contact endpoint:', error.message);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
