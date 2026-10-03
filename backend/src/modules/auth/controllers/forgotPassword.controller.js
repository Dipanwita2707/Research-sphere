/**
 * Forgot / Reset Password Controller
 * Handles:
 *   POST /api/auth/forgot-password  – request a reset link
 *   POST /api/auth/reset-password   – set a new password using the token
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../../../shared/config/database');
const config = require('../../../shared/config/app.config');
const cache = require('../../../shared/config/redis');
const { emailService } = require('../../core/services/email.service');
const { auditService, AuditActionType, AuditSeverity, AuditModule } = require('../../audit/services/audit.service');
const { getClientIp } = require('../../../shared/middleware/audit.middleware');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { checkNewPassword } = require('../utils/passwordPolicy');
const { REVOKE_SESSIONS_DATA } = require('../services/session.service');

const log = createModuleLogger('auth:password-reset');

const TOKEN_EXPIRY_MINUTES = 30;
const GENERIC_FORGOT_RESPONSE = {
  success: true,
  message: 'If this email is registered you will receive a reset link shortly.'
};
const INVALID_LINK = 'This reset link is invalid or has expired. Please request a new one.';

/** Only the SHA-256 of a reset token is stored, so a database leak does not leak usable links. */
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

const hashResetToken = (rawToken) => crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');

/* ---------------------------------------------------------------
   POST /api/auth/forgot-password
   Body: { email }
   Always answers with the same message (no account enumeration). The DB
   work and the email are done after the response so that timing does not
   reveal whether the address exists either.
--------------------------------------------------------------- */
exports.forgotPassword = async (req, res) => {
  const { email } = req.body || {};

  if (!email || typeof email !== 'string' || email.length > 254) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const sanitizedEmail = email.trim().toLowerCase();
  res.json(GENERIC_FORGOT_RESPONSE);

  issueResetLink(sanitizedEmail).catch((error) => {
    log.error('[forgotPassword] Failed to issue reset link:', error.message);
  });
};

const issueResetLink = async (sanitizedEmail) => {
  // Runs outside any tenant context: the lookup is unscoped (email is unique)
  const user = await prisma.userLogin.findFirst({
    where: { email: sanitizedEmail },
    select: {
      id: true,
      email: true,
      uid: true,
      status: true,
      anonymizedAt: true,
      employeeDetails: { select: { firstName: true } },
      university: { select: { name: true, displayName: true } }
    }
  });

  if (!user || !user.email || user.status !== 'active' || user.anonymizedAt) {
    return;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  // Issuing a new link invalidates every older one
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, token: hashResetToken(rawToken), expiresAt }
    })
  ]);

  const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const resetLink = `${frontendBase}/reset-password?token=${rawToken}`;
  const userName = user.employeeDetails?.firstName || user.uid || 'User';
  // Tenant branding: the mail names the user's university (product name stays as the platform)
  const universityName = user.university?.displayName || user.university?.name || null;
  const headerLine = universityName ? `${universityName} · ResearchSphere` : 'ResearchSphere · University Management System';

  await emailService.sendEmail({
    to: user.email,
    subject: 'Reset Your ResearchSphere Password',
    text: `Hello ${userName},\n\nYou requested a password reset. Use the link below within ${TOKEN_EXPIRY_MINUTES} minutes:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.\n\n– ${headerLine}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4ff; margin: 0; padding: 0; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(99,102,241,0.10); }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 36px 40px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px; }
    .body { padding: 36px 40px; }
    .body p { color: #374151; line-height: 1.7; margin: 0 0 16px; font-size: 15px; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff !important;
           text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 16px; font-weight: 600;
           letter-spacing: 0.3px; }
    .note { background: #fefce8; border-left: 4px solid #eab308; padding: 12px 16px; border-radius: 6px;
            color: #713f12; font-size: 13px; margin-top: 8px; }
    .footer { padding: 20px 40px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🔐 Password Reset</h1>
      <p>${escapeHtml(headerLine)}</p>
    </div>
    <div class="body">
      <p>Hello <strong>${escapeHtml(userName)}</strong>,</p>
      <p>We received a request to reset your ResearchSphere password. Click the button below to create a new password. This link expires in <strong>${TOKEN_EXPIRY_MINUTES} minutes</strong>.</p>
      <div class="btn-wrap">
        <a href="${resetLink}" class="btn">Reset My Password</a>
      </div>
      <div class="note">⚠️ If you didn't request a password reset, you can safely ignore this email. Your account is secure.</div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ResearchSphere. This is an automated message, please do not reply.</p>
    </div>
  </div>
</body>
</html>
    `
  });
};

/* ---------------------------------------------------------------
   POST /api/auth/reset-password
   Body: { token, newPassword, confirmPassword }
   Single use, 30-minute expiry. Success revokes all sessions and clears
   any login lockout (the user just proved control of the mailbox).
--------------------------------------------------------------- */
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body || {};

    if (typeof token !== 'string' || !token || typeof newPassword !== 'string' || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const tokenHash = hashResetToken(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { token: tokenHash } });

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      return res.status(400).json({ success: false, code: 'RESET_LINK_INVALID', message: INVALID_LINK });
    }

    const user = await prisma.userLogin.findUnique({
      where: { id: record.userId },
      select: { id: true, uid: true, email: true, passwordHash: true, status: true, anonymizedAt: true, universityId: true }
    });
    if (!user || user.status !== 'active' || user.anonymizedAt) {
      return res.status(400).json({ success: false, code: 'RESET_LINK_INVALID', message: INVALID_LINK });
    }

    const policyError = await checkNewPassword(newPassword, user);
    if (policyError) {
      return res.status(400).json({ success: false, message: policyError });
    }

    const passwordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds);
    const now = new Date();

    const claimed = await prisma.$transaction(async (tx) => {
      // Claim the token atomically so two concurrent requests cannot both use it
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now }
      });
      if (count !== 1) return false;

      await tx.userLogin.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
          ...REVOKE_SESSIONS_DATA
        }
      });
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, id: { not: record.id } } });
      return true;
    });

    if (!claimed) {
      return res.status(400).json({ success: false, code: 'RESET_LINK_INVALID', message: INVALID_LINK });
    }

    await cache.invalidateUser(user.id);

    auditService.log({
      actorId: user.id,
      universityId: user.universityId || null,
      action: 'Password reset via email link',
      actionType: AuditActionType.UPDATE,
      module: AuditModule.AUTH,
      category: 'security',
      severity: AuditSeverity.INFO,
      targetTable: 'user_login',
      targetId: user.id,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      requestPath: req.originalUrl || req.url,
      requestMethod: 'POST',
      responseStatus: 200
    }).catch((e) => log.warn('Audit log (password reset) failed:', e.message));

    return res.json({ success: true, message: 'Password updated successfully. You can now log in.' });
  } catch (error) {
    log.error('[resetPassword] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
  }
};
