/**
 * Bulk Email Service (SendGrid)
 *
 * Handles sending bulk / personalised emails to event registrants
 * via the official SendGrid Node.js SDK.
 *
 * Key design decisions:
 *   - Uses @sendgrid/mail for the high-level mail helper.
 *   - Breaks recipient lists into batches of 1 000 (SendGrid API limit
 *     per personalizations array) with built-in rate-limit back-off.
 *   - All operations are async / await, errors are surfaced clearly.
 */

const sgMail = require('@sendgrid/mail');
const sanitizeHtml = require('sanitize-html');

// ── Initialise SendGrid ──────────────────────────────────────────
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('[SendGrid] API key configured ✓');
} else {
  console.warn('[SendGrid] SENDGRID_API_KEY is not set – bulk email will be unavailable.');
}

// ── Constants ────────────────────────────────────────────────────
const MAX_PERSONALIZATIONS = 1000; // SendGrid hard-limit per request
const RATE_LIMIT_DELAY_MS = 1000;  // 1 s pause between batches
const PARALLEL_SEND_SIZE   = 20;   // concurrent sends per wave

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Chunk an array into sub-arrays of `size`.
 */
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Small delay helper (rate-limit safety).
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a clean HTML email body with header banner + editable content.
 * `eventName` and `recipientName` are escaped (plain text).
 * `body` comes from the ReactQuill rich-text editor so it is sanitised
 * with sanitize-html to allow safe formatting tags while blocking XSS.
 */
function buildEmailHtml({ eventName, body, recipientName = 'there', pixelHtml = '' }) {
  const safeEventName    = escapeHtml(eventName);
  const safeRecipientName = escapeHtml(recipientName);
  const safeBody = sanitizeHtml(body, {
    allowedTags: ['p', 'br', 'b', 'i', 'u', 's', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'span', 'h1', 'h2', 'h3', 'h4', 'blockquote'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['style'],
      p: ['style'],
    },
    allowedStyles: {
      '*': { 'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/] },
    },
  });

  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${safeEventName}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light; supported-color-schemes: light; }
    body, .email-body { background-color: #f0f4f8 !important; }
    [data-ogsc] .email-inner, .email-inner { background-color: #ffffff !important; }
    [data-ogsc] .email-header, .email-header { background: linear-gradient(135deg,#0F2573 0%,#266CA9 60%,#4BBAF2 100%) !important; }
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #f0f4f8 !important; }
      .email-inner { background-color: #ffffff !important; }
      .email-text { color: #333333 !important; }
      .email-text-light { color: #666666 !important; }
    }
  </style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${safeEventName} — Important update for you &zwnj;&nbsp;&#847;&#8199;&#65279;&#847;
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-body" style="background-color:#f0f4f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="email-inner" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);max-width:600px;width:100%;">

          <!-- Header Banner -->
          <tr>
            <td class="email-header" style="background:linear-gradient(135deg,#0F2573 0%,#266CA9 60%,#4BBAF2 100%);padding:48px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:.3px;line-height:1.3;">${safeEventName}</h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p class="email-text" style="margin:0;font-size:16px;color:#333333;font-weight:500;">Hi ${safeRecipientName},</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:20px 40px 36px;">
              <div class="email-text-light" style="font-size:15px;line-height:1.8;color:#555555;">
                ${safeBody}
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;"><div style="height:1px;background-color:#e8ecf0;"></div></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 28px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#999999;">Sent via <strong style="color:#666666;">SGT Event Portal</strong></p>
              <p style="margin:0;font-size:11px;color:#bbbbbb;line-height:1.5;">You received this because you registered for ${safeEventName}.</p>
            </td>
          </tr>
        </table>

        <!-- Sub-footer -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#aaaaaa;">&copy; ${new Date().getFullYear()} SGT University. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${pixelHtml}
</body>
</html>`;
}

// ── Main Service ─────────────────────────────────────────────────

class BulkEmailService {
  /**
   * Check whether the service is ready.
   */
  isAvailable() {
    return !!SENDGRID_API_KEY;
  }

  /**
   * Send bulk emails to a set of recipients.
   *
   * @param {Object}   opts
   * @param {string}   opts.eventName     – Name of the event (used in header).
   * @param {string}   opts.subject       – Email subject line.
   * @param {string}   opts.body          – HTML body content (the editable part).
   * @param {Array<{email:string,name:string}>} opts.recipients
   * @param {string}   [opts.replyTo]     – Optional reply-to address.
   * @param {string}   [opts.trackingBaseUrl] – Base URL for open-tracking pixel (e.g. https://host/api/v1/events).
   * @param {Object<string,string>} [opts.recipientTrackingIds] – Map email→recipientLogId for pixel injection.
   *
   * @returns {{ success: boolean, sent: number, failed: number, errors: string[], failedEmails: string[] }}
   */
  async sendBulk({ eventName, subject, body, recipients, replyTo, trackingBaseUrl, recipientTrackingIds }) {
    if (!this.isAvailable()) {
      return { success: false, sent: 0, failed: 0, errors: ['SendGrid API key is not configured.'] };
    }

    if (!recipients || recipients.length === 0) {
      return { success: false, sent: 0, failed: 0, errors: ['No recipients provided.'] };
    }

    if (!subject || !subject.trim()) {
      return { success: false, sent: 0, failed: 0, errors: ['Email subject is required.'] };
    }

    if (!body || !body.trim()) {
      return { success: false, sent: 0, failed: 0, errors: ['Email body is required.'] };
    }

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@sgtresearch.com';
    const fromName = process.env.SENDGRID_FROM_NAME || 'SGT Event Portal';

    // Deduplicate recipients by email
    const seen = new Set();
    const unique = [];
    for (const r of recipients) {
      const key = (r.email || '').toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push({ email: key, name: r.name || '' });
      }
    }

    // ── Send one personalised email per recipient ─────────────────
    // NOTE: SendGrid's personalizations.substitutions only work with templateId.
    // For plain html sends we must inject name/pixel directly into the HTML.

    let totalSent = 0;
    let totalFailed = 0;
    const errors = [];
    const failedEmails = [];

    /**
     * Send a single personalised message to one recipient.
     * Returns true on success, false on failure.
     */
    const sendOne = async (r) => {
      // Build per-recipient tracking pixel
      let pixelHtml = '';
      if (trackingBaseUrl && recipientTrackingIds && recipientTrackingIds[r.email]) {
        const trackId = recipientTrackingIds[r.email];
        pixelHtml = `<img src="${trackingBaseUrl}/emails/track/${trackId}/open.png" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
      }

      const recipientName = r.name || 'there';

      // Build full HTML with name + pixel substituted directly (no SendGrid substitutions)
      const html = buildEmailHtml({ eventName, body, recipientName, pixelHtml });
      const text = `${subject}\n\nHi ${recipientName},\n\n${body.replace(/<[^>]*>/g, '')}\n\nSent via SGT Event Portal`;

      const msg = {
        to:      { email: r.email, name: r.name },
        from:    { email: fromEmail, name: fromName },
        subject,
        html,
        text,
      };
      if (replyTo) msg.replyTo = replyTo;

      try {
        await sgMail.send(msg);
        return { ok: true };
      } catch (err) {
        const errMsg = err?.response?.body?.errors?.map((e) => e.message).join('; ')
          || err.message || 'Unknown SendGrid error';

        // 429 – rate limited: back off 5 s and retry once
        if (err?.code === 429 || err?.response?.statusCode === 429) {
          console.log(`[SendGrid] Rate-limited for ${r.email}, retrying in 5 s…`);
          await sleep(5000);
          try {
            await sgMail.send(msg);
            return { ok: true };
          } catch (retryErr) {
            const retryMsg = retryErr?.response?.body?.errors?.map((e) => e.message).join('; ')
              || retryErr.message || 'Unknown error';
            return { ok: false, err: retryMsg };
          }
        }
        return { ok: false, err: errMsg };
      }
    };

    // Process in parallel waves of PARALLEL_SEND_SIZE to stay under rate limits
    const waves = chunk(unique, PARALLEL_SEND_SIZE);
    for (let wi = 0; wi < waves.length; wi++) {
      const wave = waves[wi];
      const results = await Promise.allSettled(wave.map(sendOne));

      results.forEach((res, idx) => {
        const r = wave[idx];
        const outcome = res.status === 'fulfilled' ? res.value : { ok: false, err: res.reason?.message || 'Promise rejected' };
        if (outcome.ok) {
          totalSent++;
        } else {
          totalFailed++;
          failedEmails.push(r.email);
          errors.push(`${r.email}: ${outcome.err}`);
          console.error(`[SendGrid] Failed ${r.email}: ${outcome.err}`);
        }
      });

      console.log(`[SendGrid] Wave ${wi + 1}/${waves.length} done (sent so far: ${totalSent})`);

      // Short pause between waves
      if (wi < waves.length - 1) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    return {
      success: totalFailed === 0,
      sent: totalSent,
      failed: totalFailed,
      errors,
      failedEmails,
    };
  }

  /**
   * Send a single test email.
   */
  async sendTestEmail({ eventName, subject, body, toEmail, replyTo }) {
    return this.sendBulk({
      eventName,
      subject,
      body,
      recipients: [{ email: toEmail, name: 'Test User' }],
      replyTo,
    });
  }
}

module.exports = new BulkEmailService();
