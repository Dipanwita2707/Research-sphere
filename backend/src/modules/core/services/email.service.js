/**
 * Email Service
 * Handles sending emails with optional attachments for audit reports
 */

const nodemailer = require('nodemailer');
const config = require('../../../shared/config/app.config');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize the email transporter
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Configure transporter based on environment
      const emailConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER || process.env.SMTP_USER,
          pass: process.env.EMAIL_PASS || process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates in dev
        }
      };

      this.transporter = nodemailer.createTransport(emailConfig);

      // Verify connection
      await this.transporter.verify();
      console.log('[SUCCESS] Email service initialized successfully');
      this.initialized = true;
    } catch (error) {
      console.warn('⚠️ Email service initialization failed:', error.message);
      console.warn('📧 Email sending will be disabled until configured properly');
      this.initialized = false;
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable() {
    return this.initialized && this.transporter !== null;
  }

  /**
   * Send an email
   * @param {Object} options - Email options
   * @param {string|string[]} options.to - Recipient email(s)
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text body
   * @param {string} options.html - HTML body
   * @param {Array} options.attachments - Array of attachment objects
   */
  async sendEmail({ to, subject, text, html, attachments = [], cc = [], bcc = [] }) {
    if (!this.isAvailable()) {
      await this.initialize();
      if (!this.isAvailable()) {
        console.warn('Email service not available, skipping email send');
        return { success: false, error: 'Email service not configured' };
      }
    }

    try {
      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || 'ResearchSphere',
          address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || process.env.SMTP_USER
        },
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text,
        html,
        attachments
      };

      if (cc.length > 0) {
        mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
      }

      if (bcc.length > 0) {
        mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;
      }

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`📧 Email sent successfully: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      };
    } catch (error) {
      console.error('Failed to send email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send audit report email with Excel attachment
   */
  async sendAuditReport({ recipients, reportType, periodStart, periodEnd, excelBuffer, stats }) {
    const periodString = `${new Date(periodStart).toLocaleDateString()} - ${new Date(periodEnd).toLocaleDateString()}`;
    const monthYear = new Date(periodStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const subject = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Audit Report - ${monthYear}`;
    
    const html = this.generateAuditReportHtml({
      reportType,
      periodString,
      monthYear,
      stats
    });

    const text = `
${reportType.toUpperCase()} AUDIT REPORT
=================================Period: ${periodString}

SUMMARY
-------
Total Log Entries: ${stats.totalLogs}
Errors/Critical Issues: ${stats.errorCount}

TOP ACTIVITIES BY MODULE:
${stats.byModule.map(m => `- ${m.module}: ${m.count} actions`).join('\n')}

TOP ACTIVITIES BY ACTION TYPE:
${stats.byActionType.map(a => `- ${a.actionType}: ${a.count} occurrences`).join('\n')}

Please see the attached Excel file for detailed audit logs.

This is an automated report from ResearchSphere.
    `;

    const attachments = [
      {
        filename: `audit-report-${reportType}-${periodStart.toISOString().split('T')[0]}.xlsx`,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    ];

    return this.sendEmail({
      to: recipients,
      subject,
      text,
      html,
      attachments
    });
  }

  /**
   * Generate HTML template for audit report email
   */
  generateAuditReportHtml({ reportType, periodString, monthYear, stats }) {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0 0 10px 0; }
    .header p { margin: 0; opacity: 0.9; }
    .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-value { font-size: 28px; font-weight: bold; color: #1e3a8a; }
    .stat-label { color: #64748b; font-size: 14px; margin-top: 5px; }
    .section { margin: 25px 0; }
    .section h3 { color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-error { background: #fee2e2; color: #dc2626; }
    .badge-warning { background: #fef3c7; color: #d97706; }
    .badge-info { background: #dbeafe; color: #2563eb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>[REPORT] ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Audit Report</h1>
    <p>${periodString}</p>
  </div>
  
  <div class="content">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.totalLogs.toLocaleString()}</div>
        <div class="stat-label">Total Log Entries</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: ${stats.errorCount > 0 ? '#dc2626' : '#16a34a'}">${stats.errorCount}</div>
        <div class="stat-label">Errors/Critical</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.byModule.length}</div>
        <div class="stat-label">Active Modules</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.topActors.length}</div>
        <div class="stat-label">Active Users</div>
      </div>
    </div>

    <div class="section">
      <h3>📁 Activity by Module</h3>
      <table>
        <thead>
          <tr><th>Module</th><th>Actions</th><th>Percentage</th></tr>
        </thead>
        <tbody>
          ${stats.byModule.map(m => `
            <tr>
              <td><strong>${m.module || 'Unknown'}</strong></td>
              <td>${m.count.toLocaleString()}</td>
              <td>${((m.count / stats.totalLogs) * 100).toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h3>⚡ Activity by Action Type</h3>
      <table>
        <thead>
          <tr><th>Action Type</th><th>Count</th></tr>
        </thead>
        <tbody>
          ${stats.byActionType.slice(0, 10).map(a => `
            <tr>
              <td>${a.actionType}</td>
              <td>${a.count.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h3>🎯 Severity Distribution</h3>
      <table>
        <thead>
          <tr><th>Severity</th><th>Count</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${stats.bySeverity.map(s => `
            <tr>
              <td>${s.severity}</td>
              <td>${s.count.toLocaleString()}</td>
              <td><span class="badge badge-${s.severity === 'ERROR' || s.severity === 'CRITICAL' ? 'error' : s.severity === 'WARNING' ? 'warning' : 'info'}">${s.severity}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h3>[USERS] Most Active Users</h3>
      <table>
        <thead>
          <tr><th>User</th><th>Email</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${stats.topActors.slice(0, 10).map(u => `
            <tr>
              <td><strong>${u.actorName}</strong></td>
              <td>${u.email || 'N/A'}</td>
              <td>${u.count.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>📎 Detailed audit logs are attached as an Excel file.</p>
      <p>This is an automated report generated by ResearchSphere on ${new Date().toLocaleString()}</p>
      <p>For questions, contact the system administrator.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Send notification email
   */
  async sendNotification({ to, subject, message, actionUrl = null, actionText = 'View Details' }) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .container { background: #f8fafc; border-radius: 10px; padding: 30px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header img { max-width: 150px; }
    .content { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 15px; }
    .footer { margin-top: 20px; text-align: center; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>ResearchSphere</h2>
    </div>
    <div class="content">
      <h3>${subject}</h3>
      <p>${message}</p>
      ${actionUrl ? `<a href="${actionUrl}" class="btn">${actionText}</a>` : ''}
    </div>
    <div class="footer">
      <p>This is an automated message from ResearchSphere.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({ to, subject, text: message, html });
  }
}

// Export singleton instance
const emailService = new EmailService();

module.exports = { emailService };
