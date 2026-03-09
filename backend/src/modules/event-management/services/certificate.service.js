/**
 * Certificate Service
 *
 * Handles certificate PDF generation, S3 storage, and email delivery.
 * Uses PDFKit to composite an uploaded template image with dynamic text overlays.
 */

const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const { uploadToS3, downloadFromS3 } = require('../../../shared/utils/s3');
const sgMail = require('@sendgrid/mail');
const prisma = require('../../../shared/config/database');

// Use the same SendGrid config as the bulk email service
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ── Constants ────────────────────────────────────────────────────
const PARALLEL_SEND_SIZE = 10;  // concurrent certificate generations + sends per wave
const RATE_LIMIT_DELAY_MS = 500;

// ── Helpers ──────────────────────────────────────────────────────

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
 * Resolve placeholder tokens in certificate content text.
 *
 * @param {string} content  - Template text with [Placeholder] tokens
 * @param {Object} data     - Values to inject
 * @param {string} data.candidateName
 * @param {string} data.eventName
 * @param {string} data.organizer
 * @param {string} data.teamName
 * @param {string} data.organisationName
 * @returns {string}
 */
function resolvePlaceholders(content, data) {
  return content
    .replace(/\[Candidate Name\]/gi, data.candidateName || 'Participant')
    .replace(/\[Event Name\]/gi, data.eventName || '')
    .replace(/\[Organizer\]/gi, data.organizer || 'SGT University')
    .replace(/\[Team Name\]/gi, data.teamName || '')
    .replace(/\[Candidate's Organisation Name\]/gi, data.organisationName || 'SGT University')
    .replace(/\[Date\]/gi, new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }));
}

// ── Shared browser instance (launched once, reused) ──────────────
let _browser = null;
async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    _browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
  }
  return _browser;
}

// ── PDF Generation (Puppeteer — pixel-perfect) ──────────────────

/**
 * Generate a certificate PDF by rendering the exact same HTML/CSS as
 * the editor canvas and printing it to PDF via headless Chrome.
 *
 * @param {Object} opts
 * @param {Buffer|null} opts.templateImageBuffer  - Background image (PNG/JPG)
 * @param {Array} opts.textFields                 - Array of { text, x, y, fontSize, color, fontWeight, textAlign }
 * @param {Array} [opts.imageOverlays]            - Array of { buffer: Buffer, x, y, width } (x/y/width in %)
 * @param {number} [opts.canvasWidth]             - Editor canvas width in px
 * @param {string} opts.recipientName
 * @param {string} opts.eventName
 * @param {Object} [opts.placeholderData]
 * @param {string} [opts.verifyUrl]               - Verification URL to render on the certificate
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateCertificatePDF({ templateImageBuffer, textFields, imageOverlays, canvasWidth, recipientName, eventName, placeholderData, verifyUrl }) {
  const resolveData = {
    candidateName: recipientName || 'Participant',
    eventName: eventName || '',
    organizer: placeholderData?.organizer || 'SGT University',
    teamName: placeholderData?.teamName || '',
    organisationName: placeholderData?.organisationName || 'SGT University',
  };

  // A4 landscape dimensions in CSS px at 96dpi
  const pageWidthPx = 1122.52;
  const pageHeightPx = 793.7;

  // Scale factor: editor canvas → PDF page (both use %)
  // Font sizes need scaling because they are in CSS px relative to the editor canvas size
  const editorWidth = canvasWidth || 600;
  const fontScale = pageWidthPx / editorWidth;

  // Convert background image to base64 data URI
  let bgDataUri = '';
  if (templateImageBuffer) {
    bgDataUri = `data:image/png;base64,${templateImageBuffer.toString('base64')}`;
  }

  // Convert overlay image buffers to base64 data URIs
  const overlayDataUris = (imageOverlays || []).map((ov) => ({
    dataUri: ov.buffer ? `data:image/png;base64,${ov.buffer.toString('base64')}` : '',
    x: ov.x,
    y: ov.y,
    width: ov.width,
  }));

  // Build text field HTML — exactly mirrors the frontend canvas CSS
  const textFieldsHtml = (textFields || []).map((field) => {
    const resolvedText = escapeHtml(resolvePlaceholders(field.text || '', resolveData));
    if (!resolvedText.trim()) return '';

    const align = field.textAlign || 'center';
    let transform;
    if (align === 'center') transform = 'translate(-50%, -50%)';
    else if (align === 'right') transform = 'translate(-100%, -50%)';
    else transform = 'translate(0, -50%)';

    // Scale font size from editor canvas px to PDF page px
    const scaledFontSize = (field.fontSize || 14) * fontScale;

    return `<div style="
      position: absolute;
      left: ${field.x}%;
      top: ${field.y}%;
      transform: ${transform};
      font-size: ${scaledFontSize}px;
      color: ${field.color || '#1c4980'};
      font-weight: ${field.fontWeight || 'normal'};
      text-align: ${align};
      max-width: 90%;
      line-height: 1.4;
      word-break: break-word;
    ">${resolvedText}</div>`;
  }).join('\n');

  // Build overlay image HTML — exactly mirrors the frontend canvas CSS
  const overlayImagesHtml = overlayDataUris.map((ov) => {
    if (!ov.dataUri) return '';
    return `<div style="
      position: absolute;
      left: ${ov.x}%;
      top: ${ov.y}%;
      width: ${ov.width}%;
      transform: translate(-50%, -50%);
    "><img src="${ov.dataUri}" style="width:100%;height:auto;" /></div>`;
  }).join('\n');

  // Build verification link HTML (positioned at bottom-center of the certificate)
  let verifyLinkHtml = '';
  if (verifyUrl) {
    const scaledVerifyFontSize = 8 * fontScale;
    verifyLinkHtml = `<div style="
      position: absolute;
      left: 50%;
      bottom: ${2 * fontScale}px;
      transform: translateX(-50%);
      font-size: ${scaledVerifyFontSize}px;
      color: #888;
      text-align: center;
      white-space: nowrap;
    ">Verify: ${escapeHtml(verifyUrl)}</div>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 11.69in 8.27in; margin: 0; }
  body { width: ${pageWidthPx}px; height: ${pageHeightPx}px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  .canvas {
    position: relative;
    width: ${pageWidthPx}px;
    height: ${pageHeightPx}px;
    overflow: hidden;
    ${bgDataUri ? '' : 'background: linear-gradient(135deg, #eff6ff, #eef2ff);'}
  }
  .canvas > .bg {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
</head>
<body>
  <div class="canvas">
    ${bgDataUri ? `<img class="bg" src="${bgDataUri}" />` : ''}
    ${textFieldsHtml}
    ${overlayImagesHtml}
    ${verifyLinkHtml}
  </div>
</body>
</html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      width: '11.69in',
      height: '8.27in',
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

// ── Email HTML for certificate delivery ──────────────────────────

function buildCertificateEmailHtml({ eventName, recipientName, title, verifyUrl }) {
  const safeEventName = escapeHtml(eventName);
  const safeName = escapeHtml(recipientName);
  const safeTitle = escapeHtml(title);
  const safeVerifyUrl = verifyUrl ? escapeHtml(verifyUrl) : '';

  const verifySection = safeVerifyUrl ? `
          <!-- Verify Button -->
          <tr>
            <td style="padding:8px 40px 24px;text-align:center;">
              <a href="${safeVerifyUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#0F2573 0%,#266CA9 100%);color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:.3px;">&#x2713; Verify Certificate</a>
              <p style="margin:12px 0 0;font-size:12px;color:#999999;">Share this link to let anyone verify your certificate</p>
            </td>
          </tr>` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f0f4f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);max-width:600px;width:100%;">

          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#0F2573 0%,#266CA9 60%,#4BBAF2 100%);padding:48px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:.3px;line-height:1.3;">🎓 ${safeTitle}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px;">${safeEventName}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="margin:0;font-size:16px;color:#333333;font-weight:500;">Hi ${safeName},</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px 40px 36px;">
              <div style="font-size:15px;line-height:1.8;color:#555555;">
                <p style="margin:0 0 16px;">Congratulations! 🎉</p>
                <p style="margin:0 0 16px;">Please find your <strong>${safeTitle}</strong> for <strong>${safeEventName}</strong> attached to this email as a PDF.</p>
                <p style="margin:0;">Thank you for your participation. We hope to see you at future events!</p>
              </div>
            </td>
          </tr>

          ${verifySection}

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
</body>
</html>`;
}

// ── Main Service ─────────────────────────────────────────────────

class CertificateService {
  /**
   * Generate certificate PDFs and send them via email to a list of recipients.
   *
   * @param {Object} opts
   * @param {string}   opts.eventName
   * @param {string}   opts.eventId         - Internal event UUID (for S3 path)
   * @param {string}   opts.title           - Certificate title
   * @param {string}   opts.content         - Content template with [Placeholder] tokens
   * @param {string}   opts.textColor
   * @param {string|null} opts.templateS3Key - S3 key for the background template image (null = use default)
   * @param {Array<{email:string, name:string, teamName?:string, organisationName?:string}>} opts.recipients
   * @returns {{ success:boolean, sent:number, failed:number, errors:string[], failedEmails:string[] }}
   */
  async sendCertificates({
    eventName, eventId, textFields, imageFields,
    canvasWidth, templateS3Key, recipients, verificationMap,
  }) {
    if (!recipients || recipients.length === 0) {
      return { success: false, sent: 0, failed: 0, errors: ['No recipients provided.'], failedEmails: [] };
    }

    // Download template image once (shared across all recipients)
    let templateImageBuffer = null;
    if (templateS3Key) {
      try {
        const { stream } = await downloadFromS3(templateS3Key);
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        templateImageBuffer = Buffer.concat(chunks);
      } catch (err) {
        console.error('[Certificate] Failed to download template image:', err.message);
      }
    }

    // Download overlay images (logos, etc.) once — shared across all recipients
    const resolvedOverlays = [];
    if (Array.isArray(imageFields) && imageFields.length > 0) {
      for (const imgField of imageFields) {
        try {
          // s3Key is the template ID — look up actual S3 key
          const overlayTemplate = await prisma.eventCertificateTemplate.findUnique({
            where: { id: imgField.s3Key },
            select: { templateS3Key: true },
          });
          if (overlayTemplate && overlayTemplate.templateS3Key) {
            const { stream } = await downloadFromS3(overlayTemplate.templateS3Key);
            const chunks = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            resolvedOverlays.push({
              buffer: Buffer.concat(chunks),
              x: imgField.x,
              y: imgField.y,
              width: imgField.width,
            });
          }
        } catch (err) {
          console.warn('[Certificate] Failed to download overlay image:', err.message);
        }
      }
    }

    // Derive a title from the first text field (for email subject)
    const titleField = (textFields || []).find((f) => f.fontSize >= 18 && f.fontWeight === 'bold');
    const certTitle = titleField ? titleField.text : 'Certificate';

    let totalSent = 0;
    let totalFailed = 0;
    const errors = [];
    const failedEmails = [];
    const s3Keys = {}; // email -> s3Key mapping

    // Build frontend base URL for verification links
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const processOne = async (recipient) => {
      const recipientName = recipient.name || 'Participant';
      const verificationCode = verificationMap?.[recipient.email.toLowerCase()];
      const verifyUrl = verificationCode
        ? `${frontendBaseUrl}/verify/certificate/${verificationCode}`
        : null;

      try {
        // Generate PDF with positioned text fields and image overlays
        const pdfBuffer = await generateCertificatePDF({
          templateImageBuffer,
          textFields: textFields || [],
          imageOverlays: resolvedOverlays,
          canvasWidth: canvasWidth || 600,
          recipientName,
          eventName,
          placeholderData: {
            organizer: 'SGT University',
            teamName: recipient.teamName || '',
            organisationName: recipient.organisationName || 'SGT University',
          },
          verifyUrl,
        });

        // Upload to S3
        let s3Key = null;
        try {
          const uploadResult = await uploadToS3(
            pdfBuffer,
            'certificates',
            eventId,
            `${recipientName.replace(/[^a-zA-Z0-9]/g, '_')}_certificate.pdf`,
            'application/pdf'
          );
          s3Key = uploadResult.key;
        } catch (s3Err) {
          console.warn(`[Certificate] S3 upload failed for ${recipient.email}, sending without storage:`, s3Err.message);
        }

        // Build email HTML
        const emailTitle = resolvePlaceholders(certTitle, {
          candidateName: recipientName,
          eventName,
          organizer: 'SGT University',
          teamName: recipient.teamName || '',
          organisationName: recipient.organisationName || 'SGT University',
        });

        const html = buildCertificateEmailHtml({
          eventName,
          recipientName,
          title: emailTitle,
          verifyUrl,
        });

        // Send email with PDF attachment via SendGrid (same sender as bulk email)
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@sgtresearch.com';
        const fromName = process.env.SENDGRID_FROM_NAME || 'SGT Event Portal';
        await sgMail.send({
          to: { email: recipient.email, name: recipientName },
          from: { email: fromEmail, name: fromName },
          subject: `${emailTitle} - ${eventName}`,
          html,
          attachments: [{
            filename: `${emailTitle.replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`,
            content: pdfBuffer.toString('base64'),
            type: 'application/pdf',
            disposition: 'attachment',
          }],
        });

        return { ok: true, s3Key };
      } catch (err) {
        return { ok: false, err: err.message || 'Unknown error' };
      }
    };

    // Process in parallel waves
    const waves = chunk(recipients, PARALLEL_SEND_SIZE);
    for (let wi = 0; wi < waves.length; wi++) {
      const wave = waves[wi];
      const results = await Promise.allSettled(wave.map(processOne));

      results.forEach((res, idx) => {
        const r = wave[idx];
        const outcome = res.status === 'fulfilled'
          ? res.value
          : { ok: false, err: res.reason?.message || 'Promise rejected' };

        if (outcome.ok) {
          totalSent++;
          if (outcome.s3Key) {
            s3Keys[r.email] = outcome.s3Key;
          }
        } else {
          totalFailed++;
          failedEmails.push(r.email);
          errors.push(`${r.email}: ${outcome.err}`);
          console.error(`[Certificate] Failed ${r.email}: ${outcome.err}`);
        }
      });

      console.log(`[Certificate] Wave ${wi + 1}/${waves.length} done (sent so far: ${totalSent})`);

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
      s3Keys,
    };
  }
}

module.exports = new CertificateService();
