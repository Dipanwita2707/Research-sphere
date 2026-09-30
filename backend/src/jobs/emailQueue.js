/**
 * Email Queue
 *
 * There is no background (BullMQ) email worker: the BullMQ implementation was
 * removed with the Events module. Nothing in the codebase currently enqueues
 * mail (all senders call emailService directly), but enqueue() must never drop
 * a message silently, so it delivers synchronously through the email service.
 */

let emailService = null;
const getEmailService = () => {
  if (!emailService) {
    ({ emailService } = require('../modules/core/services/email.service'));
  }
  return emailService;
};

async function init() {
  console.log('[EmailQueue] No background worker — emails are sent synchronously via the email service.');
}

/** A background queue is not available; callers get synchronous delivery. */
function isAvailable() {
  return false;
}

/**
 * Send an email now (sync fallback).
 * @param {{to: string|string[], subject: string, text?: string, html?: string, attachments?: any[], cc?: any[], bcc?: any[]}} mailOptions
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function enqueue(mailOptions) {
  if (!mailOptions || !mailOptions.to || !mailOptions.subject) {
    throw new Error('emailQueue.enqueue requires { to, subject }');
  }
  const result = await getEmailService().sendEmail(mailOptions);
  if (result && result.success === false) {
    console.error(`[EmailQueue] Email to ${[].concat(mailOptions.to).length} recipient(s) failed: ${result.error}`);
  }
  return result;
}

async function shutdown() {}

module.exports = { init, isAvailable, enqueue, shutdown };
