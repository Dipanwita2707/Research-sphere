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

router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const { emailService } = require('../services/email.service');
    const recipient = process.env.CONTACT_EMAIL || 'admin@researchsphere.com';

    const htmlContent = `
      <h3>New Contact Us Message</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `;

    const emailResult = await emailService.sendEmail({
      to: recipient,
      subject: `[Contact Us] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage:\n${message}`,
      html: htmlContent
    });

    console.log(`[Contact Form] Message sent successfully to ${recipient}`);
    return res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error in contact endpoint:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
