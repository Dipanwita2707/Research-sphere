/**
 * Gate Pass Email Service - SendGrid via Nodemailer
 * Sends transactional emails for gate pass lifecycle events
 */

const nodemailer = require('nodemailer');

// ─── Transporter (SendGrid SMTP) ────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY,
  },
});

const FROM_EMAIL  = process.env.EMAIL_FROM  || 'gatepass@sattu.me';
const FROM_NAME   = process.env.EMAIL_FROM_NAME || 'SGT Gate Pass System';
const COLLEGE_NAME = 'SGT University';

// ─── Brand colours ───────────────────────────────────────────────────────────
const BRAND = {
  primary : '#1e40af',   // deep blue
  success : '#16a34a',   // green
  danger  : '#dc2626',   // red
  warning : '#d97706',   // amber
  light   : '#f1f5f9',   // slate-100
  border  : '#e2e8f0',   // slate-200
};

// ─── Shared HTML shell ───────────────────────────────────────────────────────
function shell(title, body, accentColor = BRAND.primary) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background:${accentColor};border-radius:12px 12px 0 0;padding:24px 32px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:1.5px">${COLLEGE_NAME}</p>
                  <h1 style="margin:4px 0 0;font-size:22px;font-weight:700;color:#fff">${title}</h1>
                </td>
                <td align="right">
                  <span style="display:inline-block;background:rgba(255,255,255,.15);color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:100px;letter-spacing:1px">GATE PASS</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:32px;border:1px solid ${BRAND.border};border-top:0">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${BRAND.light};border:1px solid ${BRAND.border};border-top:0;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center">
            <p style="margin:0;font-size:11px;color:#64748b">This is an automated notification from the <strong>${COLLEGE_NAME} Gate Management System</strong>.</p>
            <p style="margin:4px 0 0;font-size:11px;color:#94a3b8">© ${new Date().getFullYear()} ${COLLEGE_NAME}. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Reusable UI blocks ───────────────────────────────────────────────────────
function infoTable(rows) {
  const cells = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#64748b;white-space:nowrap;width:160px;border-bottom:1px solid #f1f5f9">${label}</td>
      <td style="padding:8px 12px;font-size:13px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9">${value || '—'}</td>
    </tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;margin:16px 0"><tbody>${cells}</tbody></table>`;
}

function badge(text, color = BRAND.primary) {
  return `<span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px">${text}</span>`;
}

function alertBox(icon, text, bg, border) {
  return `<div style="background:${bg};border-left:4px solid ${border};border-radius:6px;padding:14px 16px;margin:16px 0"><span style="font-size:18px">${icon}</span>&nbsp;<span style="font-size:13px;color:#1e293b;line-height:1.5">${text}</span></div>`;
}

/**
 * Inline QR image block + 6-digit code
 * @param {string} qrDataUrl  - "data:image/png;base64,..."
 * @param {string} code       - 6-digit code string
 * @param {string} cid        - attachment content-id, e.g. 'mainqr'
 * @param {string} title      - display label above QR
 */
function qrBlock(qrDataUrl, code, cid, title = 'Scan QR Code at Gate') {
  const imgTag = qrDataUrl
    ? `<img src="cid:${cid}" width="180" height="180" alt="QR Code" style="display:block;border-radius:8px;border:1px solid ${BRAND.border}" />`
    : `<p style="color:#94a3b8;font-size:12px">QR code not available</p>`;
  const codeHtml = code ? `
    <div style="margin-top:16px">
      <p style="margin:0 0 6px;font-size:12px;color:#64748b">OR enter this 6-digit code at the gate</p>
      <div style="display:inline-block;background:#1e40af;border-radius:10px;padding:10px 28px">
        <span style="letter-spacing:10px;font-size:28px;font-weight:900;color:#fff;font-family:monospace">${code}</span>
      </div>
    </div>` : '';
  return `
    <div style="margin:20px 0;text-align:center">
      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:1px">${title}</p>
      <div style="display:inline-block;background:#f8fafc;border:1px solid ${BRAND.border};border-radius:12px;padding:16px">
        ${imgTag}
      </div>
      ${codeHtml}
    </div>`;
}

/** Extract base64 from data-URL and return nodemailer attachment object */
function makeQRAttachment(dataUrl, cid) {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  return { filename: `${cid}.png`, content: match[2], encoding: 'base64', cid, contentDisposition: 'inline' };
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
}
function formatDateOnly(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'long' });
}

// ─── SEND helper (fire-and-forget, never crashes the main flow) ──────────────
async function send({ to, subject, html, attachments = [] }) {
  if (!to) {
    console.log('[EMAIL] Skipped – no recipient email address');
    return;
  }
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[EMAIL] SENDGRID_API_KEY not set – email skipped');
    return;
  }
  try {
    const info = await transporter.sendMail({
      from       : `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      attachments: attachments.filter(Boolean),
    });
    console.log(`[EMAIL] ✅ Sent "${subject}" → ${to} | msgId: ${info.messageId}`);
  } catch (err) {
    console.error(`[EMAIL] ❌ Failed "${subject}" → ${to}:`, err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC EMAIL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 1. Pass Created — with QR code + 6-digit verification code
 */
async function sendPassCreated(pass) {
  const attachment = makeQRAttachment(pass.qr_code, 'mainqr');

  const html = shell('Gate Pass Created ✅', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">Hello <strong>${pass.visitor_name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      Your gate pass has been created successfully. Use the QR code or the 6-digit code below to check in at the gate.
    </p>
    ${infoTable([
      ['Pass ID',    pass.pass_id],
      ['Status',     badge('CREATED', BRAND.primary)],
      ['Visit Date', formatDateOnly(pass.visit_date)],
      ['Entry Time', pass.entry_time || pass.expected_entry_time || '—'],
      ['Purpose',    pass.purpose_of_visit],
      ['Mobile',     pass.mobile_number],
    ])}
    ${qrBlock(pass.qr_code, pass.verification_code, 'mainqr', 'Scan QR Code at the Gate')}
    ${alertBox('ℹ️', 'Show this QR code or tell the guard your 6-digit code on your visit date.', '#eff6ff', BRAND.primary)}
  `, BRAND.success);

  await send({
    to         : pass.email,
    subject    : `[Gate Pass] ${pass.pass_id} – Your gate pass is ready`,
    html,
    attachments: [attachment],
  });
}

/**
 * 2. Pass Cancelled (before check-in)
 */
async function sendPassCancelledBeforeEntry(pass, reason) {
  const hr = pass.hostel_refund;

  // Build hostel refund block only when guest house was booked
  const hostelSection = hr ? `
    <p style="margin:24px 0 6px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">🏨 Guest House Booking – Cancelled</p>
    ${infoTable([
      ['Hostel / Block',   hr.hostel_name || '—'],
      ['Room Number',      hr.room_number  || '—'],
      ['Original Amount',  `₹${Number(hr.original_amount).toLocaleString('en-IN')}`],
      ['Cancellation Fee', `<span style="color:${BRAND.danger};font-weight:700">${hr.cancellation_fee_percent}% = ₹${Number(hr.cancellation_fee_amount).toLocaleString('en-IN')}</span>`],
      ['Refund Amount',    `<span style="color:${BRAND.success};font-size:16px;font-weight:900">₹${Number(hr.refund_amount).toLocaleString('en-IN')} (${hr.refund_percent}%)</span>`],
      ['Refund Policy',    hr.applied_slab],
      ['Refund Status',    badge('REFUND PENDING', '#d97706')],
    ])}
    ${hr.refund_amount > 0
      ? alertBox('💰', `A refund of <strong>₹${Number(hr.refund_amount).toLocaleString('en-IN')}</strong> (${hr.refund_percent}%) will be processed. Cancellation fee of <strong>${hr.cancellation_fee_percent}%</strong> (₹${Number(hr.cancellation_fee_amount).toLocaleString('en-IN')}) applies as you cancelled <strong>${hr.applied_slab}</strong>.`, '#f0fdf4', BRAND.success)
      : alertBox('⚠️', `No refund will be issued. 100% cancellation fee applies as you cancelled <strong>${hr.applied_slab}</strong>.`, '#fef2f2', BRAND.danger)
    }
  ` : '';

  const html = shell('Pass Cancelled ❌', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">
      Hello <strong>${pass.visitor_name}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      Your gate pass has been <strong>cancelled</strong>. You will not be able to use this pass for entry.
    </p>
    ${infoTable([
      ['Pass ID',           pass.pass_id],
      ['Status',            badge('CANCELLED', BRAND.danger)],
      ['Cancellation Time', formatDate(pass.cancellation_time || new Date())],
      ['Reason',            reason || 'Not specified'],
    ])}
    ${hostelSection}
    ${alertBox('🚫', 'This pass is no longer valid. Please contact the administration if you believe this is an error.', '#fef2f2', BRAND.danger)}
  `, BRAND.danger);

  await send({
    to: pass.email,
    subject: `[Gate Pass] ${pass.pass_id} – Your pass has been cancelled${hr ? ' (Guest House Refund Details Inside)' : ''}`,
    html,
  });
}

/**
 * 3. Pass Cancelled After Check-In — Checkout QR + checkout verification code
 */
async function sendPassCancelledAfterEntry(pass, reason) {
  const expiresAt  = pass.checkout_qr_expires_at ? formatDate(pass.checkout_qr_expires_at) : 'within 1 hour';
  const attachment = makeQRAttachment(pass.checkout_qr_code, 'checkoutqr');

  const html = shell('Pass Cancelled – Checkout Required ⚠️', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">Hello <strong>${pass.visitor_name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      Your gate pass has been cancelled while you are still inside the premises.
      <strong>Please proceed to the exit gate immediately</strong> and show the Checkout QR or 6-digit code below.
    </p>
    ${infoTable([
      ['Pass ID',           pass.pass_id],
      ['Status',            badge('CANCELLED – EXIT REQUIRED', BRAND.warning)],
      ['Cancellation Time', formatDate(pass.cancellation_time || new Date())],
      ['Checkout Deadline', expiresAt],
      ['Reason',            reason || 'Not specified'],
    ])}
    ${qrBlock(pass.checkout_qr_code, pass.checkout_verification_code, 'checkoutqr', 'Show this Checkout QR at the Exit Gate')}
    ${alertBox('⚠️', `Your checkout window expires at <strong>${expiresAt}</strong>. Please exit before this time.`, '#fffbeb', BRAND.warning)}
  `, BRAND.warning);

  await send({
    to         : pass.email,
    subject    : `[Gate Pass] ${pass.pass_id} – Urgent: Checkout required`,
    html,
    attachments: [attachment],
  });
}

/**
 * 4. Entry Allowed (Check-in recorded)
 */
async function sendEntryAllowed(pass) {
  const html = shell('Entry Recorded 🟢', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">
      Hello <strong>${pass.visitor_name}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      Your entry has been recorded. Welcome to <strong>${COLLEGE_NAME}</strong>!
    </p>
    ${infoTable([
      ['Pass ID',       pass.pass_id],
      ['Status',        badge('CHECKED IN', BRAND.success)],
      ['Entry Time',    formatDate(pass.actual_entry_time || new Date())],
      ['Purpose',       pass.purpose_of_visit],
      ['Mobile',        pass.mobile_number],
    ])}
    ${alertBox('✅', 'Please ensure you exit through the designated gate and get your exit recorded.', '#f0fdf4', BRAND.success)}
  `, BRAND.success);

  await send({
    to: pass.email,
    subject: `[Gate Pass] ${pass.pass_id} – Entry recorded`,
    html,
  });
}

/**
 * 5. Entry Denied
 */
async function sendEntryDenied(pass, reason) {
  const html = shell('Entry Denied 🚫', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">
      Hello <strong>${pass.visitor_name}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      Unfortunately, your entry has been <strong>denied</strong> at the gate.
    </p>
    ${infoTable([
      ['Pass ID',     pass.pass_id],
      ['Status',      badge('DENIED', BRAND.danger)],
      ['Denied At',   formatDate(new Date())],
      ['Reason',      reason || 'Not specified'],
    ])}
    ${alertBox('🚫', 'If you believe this was a mistake, please contact the administration office.', '#fef2f2', BRAND.danger)}
  `, BRAND.danger);

  await send({
    to: pass.email,
    subject: `[Gate Pass] ${pass.pass_id} – Entry denied`,
    html,
  });
}

/**
 * 6. Exit Recorded (Check-out)
 */
async function sendExitRecorded(pass) {
  const html = shell('Exit Recorded 👋', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">
      Hello <strong>${pass.visitor_name}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      Your exit has been recorded. Thank you for visiting <strong>${COLLEGE_NAME}</strong>.
    </p>
    ${infoTable([
      ['Pass ID',       pass.pass_id],
      ['Status',        badge('CHECKED OUT', '#6d28d9')],
      ['Entry Time',    formatDate(pass.actual_entry_time)],
      ['Exit Time',     formatDate(pass.actual_exit_time || new Date())],
      ['Duration',      getDuration(pass.actual_entry_time, pass.actual_exit_time)],
    ])}
  `, '#6d28d9');

  await send({
    to: pass.email,
    subject: `[Gate Pass] ${pass.pass_id} – Exit recorded, visit complete`,
    html,
  });
}

/**
 * 7. Pass Extended
 *    - with hostel booking  → mentions guest house stay (inside campus)
 *    - without hostel booking → simple extension for outside visitor
 */
async function sendPassExtended(pass, newEndDate, reason) {
  const hasHostel      = !!(pass.hostel_booking || pass.hostel_name);
  const hostelName     = pass.hostel_booking?.hostelName || pass.hostel_booking?.room?.hostel?.name || pass.hostel_name || 'Guest House';
  const roomNumber     = pass.hostel_booking?.roomNumber || pass.hostel_booking?.room?.room_number  || pass.room_number || '—';
  const newCheckout    = pass.hostel_booking?.check_out_datetime || pass.hostel_booking?.checkOutDate || newEndDate;
  const extensionCount = pass.extension_count || 1;

  let extraSection = '';
  if (hasHostel) {
    extraSection = `
      ${infoTable([
        ['Hostel / Block', hostelName],
        ['Room Number',    roomNumber],
        ['New Checkout',   formatDateOnly(newCheckout)],
      ])}
      ${alertBox('🏨', `Your guest house booking has also been extended. You may continue your stay inside the campus until <strong>${formatDateOnly(newCheckout)}</strong>.`, '#eff6ff', BRAND.primary)}`;
  } else {
    extraSection = alertBox('📅', `Your pass is now valid until <strong>${formatDateOnly(newEndDate)}</strong>. Please exit through the main gate before this date.`, '#eff6ff', BRAND.primary);
  }

  const html = shell('Pass Extended 📅', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">Hello <strong>${pass.visitor_name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      Your gate pass validity has been <strong>extended</strong>${hasHostel ? ' along with your guest house booking' : ''}.
    </p>
    ${infoTable([
      ['Pass ID',       pass.pass_id],
      ['Status',        badge('EXTENDED', BRAND.primary)],
      ['New End Date',  formatDateOnly(newEndDate)],
      ['Extension No.', `#${extensionCount}`],
      ['Reason',        reason || 'Not specified'],
    ])}
    ${extraSection}
  `, BRAND.primary);

  await send({
    to     : pass.email,
    subject: `[Gate Pass] ${pass.pass_id} – Pass extended to ${formatDateOnly(newEndDate)}`,
    html,
  });
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function getDuration(start, end) {
  if (!start) return '—';
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const minutes = Math.floor((e - s) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

/**
 * 8. Hostel Booking Created — sent when room is reserved (payment pending)
 * @param {Object} booking  - hostelBooking with room.hostel and gate_pass included
 */
async function sendHostelBookingCreated(booking) {
  const pass        = booking.gate_pass;
  const room        = booking.room;
  const hostelName  = room?.hostel?.name || 'Guest House';
  const roomNumber  = room?.room_number  || '—';
  const roomType    = room?.room_type    || room?.type || '';
  const nights      = booking.billable_days || Math.ceil(
    (new Date(booking.check_out_datetime) - new Date(booking.check_in_datetime)) / (1000 * 60 * 60 * 24)
  );
  const pricePerNight = booking.price_per_day || room?.price_per_night
    ? `₹${Number(booking.price_per_day || room?.price_per_night).toLocaleString('en-IN')}`
    : '—';
  const totalPrice    = booking.total_price
    ? `₹${Number(booking.total_price).toLocaleString('en-IN')}`
    : '—';
  const paymentRef  = booking.payment_reference || '—';

  const html = shell('Guest House Room Reserved 🏨', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">Hello <strong>${pass.visitor_name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      Your guest house room has been <strong>reserved</strong> at ${COLLEGE_NAME}. Please complete the payment to confirm your booking.
    </p>

    <!-- Booking Details -->
    <p style="margin:16px 0 6px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">📋 Room Details</p>
    ${infoTable([
      ['Pass ID',        pass.pass_id],
      ['Hostel / Block', hostelName],
      ['Room Number',    roomNumber],
      ['Room Type',      roomType || '—'],
      ['Check-In',       formatDateOnly(booking.check_in_datetime)],
      ['Check-Out',      formatDateOnly(booking.check_out_datetime)],
      ['Duration',       `${nights} day${nights !== 1 ? 's' : ''}`],
    ])}

    <!-- Payment Details -->
    <p style="margin:16px 0 6px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">💳 Payment Details</p>
    ${infoTable([
      ['Price / Day',    pricePerNight],
      ['Total Amount',   `<span style="font-size:16px;font-weight:900;color:#1e40af">${totalPrice}</span>`],
      ['Status',         badge('PAYMENT PENDING', '#d97706')],
      ['Reference',      paymentRef],
    ])}

    ${alertBox('⚠️', `Your room <strong>${roomNumber}</strong> at <strong>${hostelName}</strong> is reserved but <strong>not confirmed yet</strong>. Please complete the payment of <strong>${totalPrice}</strong> using reference <strong>${paymentRef}</strong> to secure your stay from <strong>${formatDateOnly(booking.check_in_datetime)}</strong> to <strong>${formatDateOnly(booking.check_out_datetime)}</strong>.`, '#fffbeb', BRAND.warning)}
  `, BRAND.warning);

  await send({
    to     : pass.email,
    subject: `[Gate Pass] ${pass.pass_id} – Guest House Room Reserved at ${hostelName} (Payment Pending)`,
    html,
  });
}

/**
 * 9. Hostel Booking Confirmed — sent when payment is verified
 * @param {Object} booking  - hostelBooking with room.hostel and gate_pass included
 */
async function sendHostelBookingConfirmed(booking) {
  const pass        = booking.gate_pass;
  const room        = booking.room;
  const hostelName  = room?.hostel?.name || 'Guest House';
  const roomNumber  = room?.room_number  || '—';
  const roomType    = room?.room_type    || room?.type || '';
  const nights      = booking.billable_days || Math.ceil(
    (new Date(booking.check_out_datetime) - new Date(booking.check_in_datetime)) / (1000 * 60 * 60 * 24)
  );
  const pricePerNight = booking.price_per_day || room?.price_per_night
    ? `₹${Number(room.price_per_night).toLocaleString('en-IN')}`
    : '—';
  const totalPrice    = booking.total_price
    ? `₹${Number(booking.total_price).toLocaleString('en-IN')}`
    : '—';

  const html = shell('Guest House Booking Confirmed 🏨', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">Hello <strong>${pass.visitor_name}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      Your guest house room has been <strong>confirmed and payment received</strong>. You may stay inside the campus during your visit.
    </p>

    <!-- Booking Details -->
    <p style="margin:16px 0 6px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">📋 Booking Details</p>
    ${infoTable([
      ['Pass ID',      pass.pass_id],
      ['Hostel / Block', hostelName],
      ['Room Number',  roomNumber],
      ['Room Type',    roomType || '—'],
      ['Check-In',     formatDateOnly(booking.check_in_datetime)],
      ['Check-Out',    formatDateOnly(booking.check_out_datetime)],
      ['Duration',     `${nights} day${nights !== 1 ? 's' : ''}`],
    ])}

    <!-- Payment Details -->
    <p style="margin:16px 0 6px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">💳 Payment Details</p>
    ${infoTable([
      ['Price / Night', pricePerNight],
      ['Total Amount',  `<span style="font-size:16px;font-weight:900;color:#16a34a">${totalPrice}</span>`],
      ['Payment',       badge('PAID ✓', '#16a34a')],
      ['Reference',     booking.payment_reference || '—'],
    ])}

    ${alertBox('🏨', `Your room <strong>${roomNumber}</strong> at <strong>${hostelName}</strong> is reserved for you from <strong>${formatDateOnly(booking.check_in_datetime)}</strong> to <strong>${formatDateOnly(booking.check_out_datetime)}</strong>.`, '#eff6ff', BRAND.primary)}
  `, BRAND.primary);

  await send({
    to     : pass.email,
    subject: `[Gate Pass] ${pass.pass_id} – Guest House Booking Confirmed at ${hostelName}`,
    html,
  });
}

/**
 * 10. Checkout Reminder — sent to parent at 4 PM (1 hour before 5 PM grace deadline)
 */
async function sendCheckoutReminder({ parentEmail, parentName, visitorName, passId, roomNumber, hostelName, checkOutDatetime }) {
  const html = shell('Checkout Reminder ⏰', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">Dear <strong>${parentName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      This is a reminder that the guest house checkout for <strong>${visitorName}</strong> is scheduled for <strong>5:00 PM today</strong>.
      Checkout after 5:00 PM will result in an additional day's charge.
    </p>

    ${infoTable([
      ['Pass ID',     passId],
      ['Guest House', hostelName],
      ['Room',        roomNumber],
      ['Checkout By', '5:00 PM today'],
      ['Scheduled',   formatDate(checkOutDatetime)],
    ])}

    ${alertBox('⏰', `Please ensure <strong>${visitorName}</strong> checks out of room <strong>${roomNumber}</strong> at <strong>${hostelName}</strong> before <strong>5:00 PM</strong> to avoid extra charges.`, '#fffbeb', BRAND.warning)}
  `, BRAND.warning);

  await send({
    to: parentEmail,
    subject: `[Gate Pass] ${passId} – Guest House Checkout Reminder (5 PM Deadline)`,
    html,
  });
}

/**
 * 11. Early Check-in Request Approved — sent to parent
 */
async function sendCheckinRequestApproved({ parentEmail, parentName, visitorName, passId, roomNumber, hostelName, requestedTime }) {
  const html = shell('Early Check-in Approved ✅', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">Dear <strong>${parentName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      The early check-in request for <strong>${visitorName}</strong> has been <strong>approved</strong>.
    </p>

    ${infoTable([
      ['Pass ID',        passId],
      ['Guest House',    hostelName],
      ['Room',           roomNumber],
      ['Approved Time',  formatDate(requestedTime)],
    ])}

    ${alertBox('✅', `<strong>${visitorName}</strong> can check in at <strong>${formatDate(requestedTime)}</strong> to room <strong>${roomNumber}</strong> at <strong>${hostelName}</strong>.`, '#f0fdf4', BRAND.success)}
  `, BRAND.success);

  await send({
    to: parentEmail,
    subject: `[Gate Pass] ${passId} – Early Check-in Request Approved`,
    html,
  });
}

/**
 * 12. Early Check-in Request Rejected — sent to parent
 */
async function sendCheckinRequestRejected({ parentEmail, parentName, visitorName, passId, roomNumber, hostelName, requestedTime, reason }) {
  const html = shell('Early Check-in Request Declined', `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b">Dear <strong>${parentName}</strong>,</p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569">
      The early check-in request for <strong>${visitorName}</strong> has been <strong>declined</strong>.
    </p>

    ${infoTable([
      ['Pass ID',          passId],
      ['Guest House',      hostelName],
      ['Room',             roomNumber],
      ['Requested Time',   formatDate(requestedTime)],
      ['Reason',           reason || '—'],
    ])}

    ${alertBox('❌', `The early check-in request was declined. Standard check-in time is <strong>10:00 AM</strong>. Reason: <strong>${reason || 'Not specified'}</strong>.`, '#fef2f2', BRAND.danger)}
  `, BRAND.danger);

  await send({
    to: parentEmail,
    subject: `[Gate Pass] ${passId} – Early Check-in Request Declined`,
    html,
  });
}

module.exports = {
  send,
  sendPassCreated,
  sendPassCancelledBeforeEntry,
  sendPassCancelledAfterEntry,
  sendEntryAllowed,
  sendEntryDenied,
  sendExitRecorded,
  sendPassExtended,
  sendHostelBookingCreated,
  sendHostelBookingConfirmed,
  sendCheckoutReminder,
  sendCheckinRequestApproved,
  sendCheckinRequestRejected,
};
