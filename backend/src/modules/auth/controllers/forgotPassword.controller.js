/**
 * Forgot / Reset Password Controller
 * Handles:
 *   POST /api/auth/forgot-password  – request a reset link
 *   POST /api/auth/reset-password   – set a new password using the token
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { emailService } = require('../../core/services/email.service');

const prisma = new PrismaClient();

const TOKEN_EXPIRY_MINUTES = 30;

/* ---------------------------------------------------------------
   POST /api/auth/forgot-password
   Body: { email }
--------------------------------------------------------------- */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const sanitizedEmail = email.trim().toLowerCase();

    // Find the user (silently succeed even if email not found – avoids enumeration)
    const user = await prisma.userLogin.findFirst({
      where: { email: sanitizedEmail },
      select: { id: true, email: true, uid: true, employeeDetails: { select: { firstName: true } } }
    });

    // Always return success to prevent email enumeration
    if (!user || !user.email) {
      return res.json({
        success: true,
        message: 'If this email is registered you will receive a reset link shortly.'
      });
    }

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Generate a secure random token
    const rawToken = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: rawToken, expiresAt }
    });

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendBase}/reset-password?token=${rawToken}`;
    const userName = user.employeeDetails?.firstName || user.uid || 'User';

    await emailService.sendEmail({
      to: user.email,
      subject: 'Reset Your ResearchSphere Password',
      text: `Hello ${userName},\n\nYou requested a password reset. Use the link below within ${TOKEN_EXPIRY_MINUTES} minutes:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.\n\n– ResearchSphere Team`,
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
      <p>ResearchSphere · University Management System</p>
    </div>
    <div class="body">
      <p>Hello <strong>${userName}</strong>,</p>
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

    return res.json({
      success: true,
      message: 'If this email is registered you will receive a reset link shortly.'
    });
  } catch (error) {
    console.error('[forgotPassword] Error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
  }
};

/* ---------------------------------------------------------------
   POST /api/auth/reset-password
   Body: { token, newPassword, confirmPassword }
--------------------------------------------------------------- */
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset link.' });
    }

    if (record.usedAt) {
      return res.status(400).json({ success: false, message: 'This reset link has already been used.' });
    }

    if (new Date() > record.expiresAt) {
      await prisma.passwordResetToken.delete({ where: { token } });
      return res.status(400).json({ success: false, message: 'This reset link has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 10);

    await prisma.$transaction([
      prisma.userLogin.update({
        where: { id: record.userId },
        data: { passwordHash }
      }),
      prisma.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date() }
      })
    ]);

    return res.json({ success: true, message: 'Password updated successfully. You can now log in.' });
  } catch (error) {
    console.error('[resetPassword] Error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
  }
};
