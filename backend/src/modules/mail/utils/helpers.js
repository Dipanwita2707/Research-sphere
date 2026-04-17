/**
 * Mail Utility Helpers
 */

/**
 * Generate a plain text snippet from HTML body
 * @param {string} html - HTML body content
 * @param {number} maxLength - Maximum snippet length
 * @returns {string}
 */
const generateSnippet = (html, maxLength = 150) => {
  if (!html) return '';
  // Strip HTML tags
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

/**
 * Generate plain text from HTML
 * @param {string} html
 * @returns {string}
 */
const htmlToPlainText = (html) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Format UID as email-like display
 * @param {string} uid
 * @returns {string}
 */
const formatUidAsEmail = (uid) => {
  return `${uid}@ums.sgtu`;
};

/**
 * Parse uid from email-like format
 * @param {string} email - e.g., "admin@ums.sgtu"
 * @returns {string} - e.g., "admin"
 */
const parseUidFromEmail = (email) => {
  if (!email) return '';
  if (email.includes('@ums.sgtu')) {
    return email.split('@')[0];
  }
  return email;
};

/**
 * Deduplicate recipients across TO/CC/BCC lists
 * Priority: TO > CC > BCC (if a user is in TO, remove from CC/BCC)
 * Also removes sender from all lists
 * @param {string[]} to
 * @param {string[]} cc
 * @param {string[]} bcc
 * @param {string} senderId
 * @returns {{ to: string[], cc: string[], bcc: string[] }}
 */
const deduplicateRecipients = (to = [], cc = [], bcc = [], senderId = null) => {
  const toSet = new Set(to);
  const ccSet = new Set(cc);
  const bccSet = new Set(bcc);

  // Remove sender from all lists
  if (senderId) {
    toSet.delete(senderId);
    ccSet.delete(senderId);
    bccSet.delete(senderId);
  }

  // Remove TO users from CC and BCC
  for (const uid of toSet) {
    ccSet.delete(uid);
    bccSet.delete(uid);
  }

  // Remove CC users from BCC
  for (const uid of ccSet) {
    bccSet.delete(uid);
  }

  return {
    to: Array.from(toSet),
    cc: Array.from(ccSet),
    bcc: Array.from(bccSet),
  };
};

/**
 * Build quoted reply body
 * @param {object} originalMessage - { sender, sentAt, body }
 * @param {string} senderDisplayName
 * @returns {string}
 */
const buildQuotedReply = (originalMessage, senderDisplayName) => {
  const date = new Date(originalMessage.sentAt).toLocaleString();
  return `<br/><br/><div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 4px; color: #666;">
    <p style="font-size: 12px; color: #999;">On ${date}, ${senderDisplayName} &lt;${formatUidAsEmail(originalMessage.senderUid)}&gt; wrote:</p>
    ${originalMessage.body}
  </div>`;
};

/**
 * Build forwarded message body
 * @param {object} originalMessage
 * @param {string} senderDisplayName
 * @returns {string}
 */
const buildForwardedBody = (originalMessage, senderDisplayName) => {
  const date = new Date(originalMessage.sentAt).toLocaleString();
  return `<br/><br/><div style="border-top: 1px solid #ccc; padding-top: 12px; margin-top: 12px;">
    <p style="font-size: 12px; color: #999;">---------- Forwarded message ----------</p>
    <p style="font-size: 12px; color: #999;">From: ${senderDisplayName} &lt;${formatUidAsEmail(originalMessage.senderUid)}&gt;</p>
    <p style="font-size: 12px; color: #999;">Date: ${date}</p>
    <p style="font-size: 12px; color: #999;">Subject: ${originalMessage.subject}</p>
    <br/>
    ${originalMessage.body}
  </div>`;
};

module.exports = {
  generateSnippet,
  htmlToPlainText,
  formatUidAsEmail,
  parseUidFromEmail,
  deduplicateRecipients,
  buildQuotedReply,
  buildForwardedBody,
};
