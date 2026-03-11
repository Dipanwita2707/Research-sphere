// Validation utilities

const isValidStudentRegNo = (regNo) => {
  return /^\d{9}$/.test(regNo);
};

const isValidStaffUID = (uid) => {
  return /^\d{5}$/.test(uid);
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPassword = (password) => {
  // Minimum 8 characters, at least one letter and one number
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim();
};

/**
 * Sanitize HTML to prevent XSS — uses sanitize-html library for robust protection
 * (Regex-based sanitization is easily bypassable via encoding tricks)
 */
const createSanitizeHtml = require('sanitize-html');

const sanitizeHtml = (html) => {
  if (typeof html !== 'string') return html;
  return createSanitizeHtml(html, {
    allowedTags: createSanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'span']),
    allowedAttributes: {
      ...createSanitizeHtml.defaults.allowedAttributes,
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'a': ['href', 'name', 'target', 'rel'],
      '*': ['class'],  // 'style' removed — CSS injection vector
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
  });
};

/**
 * Sanitize sponsors array (used by Noting and Event)
 * Supports both old format { name, amount, type, notes } and new advanced format
 */
const sanitizeSponsors = (sponsors) => {
  if (!Array.isArray(sponsors)) return [];
  const result = sponsors
    .filter((s) => s && typeof s === 'object')
    .map((s) => {
      const name = String(s.name || '').trim();
      if (!name) return null;

      // New advanced format (has contributionType field)
      if (s.contributionType) {
        const contributionType = ['cash', 'in_kind', 'both'].includes(s.contributionType) ? s.contributionType : 'cash';
        const sponsorType = ['corporate', 'individual', 'organization', 'other'].includes(s.sponsorType) ? s.sponsorType : 'corporate';
        const originSource = ['noting', 'event'].includes(s.originSource) ? s.originSource : undefined;

        const result = {
          name,
          sponsorType,
          contactPerson: String(s.contactPerson || '').trim(),
          designation: String(s.designation || '').trim(),
          phone: String(s.phone || '').trim(),
          email: String(s.email || '').trim(),
          notes: String(s.notes || '').trim() || undefined,
          contributionType,
        };

        // Preserve stable id, origin, and save/lock state
        if (s.id && typeof s.id === 'string') result.id = s.id;
        if (originSource) result.originSource = originSource;
        if (s.savedAt) result.savedAt = s.savedAt;
        if (s.originalSnapshot && typeof s.originalSnapshot === 'object') result.originalSnapshot = s.originalSnapshot;

        // Cash fields
        if (contributionType === 'cash' || contributionType === 'both') {
          const cashAmount = Number(s.cashAmount);
          result.cashAmount = !Number.isNaN(cashAmount) && cashAmount >= 0 ? cashAmount : 0;
          result.paymentStatus = ['received', 'pending', 'partial', 'not_received'].includes(s.paymentStatus) ? s.paymentStatus : 'pending';

          // Clear payment details when status is pending or not_received
          if (result.paymentStatus === 'pending' || result.paymentStatus === 'not_received') {
            result.paymentMethod = undefined;
            result.paymentMethodOtherLabel = undefined;
            result.transactionId = undefined;
            result.receipt = null;
          } else {
            result.paymentMethod = ['cash', 'upi', 'card', 'net_banking', 'other'].includes(s.paymentMethod) ? s.paymentMethod : undefined;
            result.paymentMethodOtherLabel = result.paymentMethod === 'other' ? String(s.paymentMethodOtherLabel || '').trim() : undefined;
            result.transactionId = String(s.transactionId || '').trim() || undefined;

            // Receipt metadata (stored as { filePath, fileName })
            if (s.receipt && typeof s.receipt === 'object' && typeof s.receipt.filePath === 'string' && s.receipt.filePath.trim()) {
              result.receipt = {
                filePath: s.receipt.filePath.trim(),
                fileName: String(s.receipt.fileName || 'receipt').trim(),
              };
            } else {
              result.receipt = null;
            }
          }

          // Cash assignment
          if (s.cashAssignedTo && typeof s.cashAssignedTo === 'object' && s.cashAssignedTo.id) {
            result.cashAssignedTo = {
              id: String(s.cashAssignedTo.id),
              uid: String(s.cashAssignedTo.uid || ''),
              displayName: String(s.cashAssignedTo.displayName || ''),
              department: s.cashAssignedTo.department ? String(s.cashAssignedTo.department) : undefined,
            };
          } else {
            result.cashAssignedTo = null;
          }
        }

        // In-kind items
        if (contributionType === 'in_kind' || contributionType === 'both') {
          result.inKindItems = Array.isArray(s.inKindItems)
            ? s.inKindItems
                .filter((item) => item && typeof item === 'object' && String(item.itemName || '').trim())
                .map((item) => {
                  const qty = Number(item.quantity);
                  const val = Number(item.estimatedValue);
                  const deliveryStatus = ['pending', 'received', 'not_received'].includes(item.deliveryStatus) ? item.deliveryStatus : 'pending';
                  const sanitizedItem = {
                    itemName: String(item.itemName || '').trim(),
                    category: String(item.category || '').trim() || undefined,
                    quantity: !Number.isNaN(qty) && qty >= 0 ? qty : 0,
                    estimatedValue: !Number.isNaN(val) && val >= 0 ? val : 0,
                    description: String(item.description || '').trim() || undefined,
                    deliveryStatus,
                  };
                  // Per-item assignment
                  if (item.assignedTo && typeof item.assignedTo === 'object' && item.assignedTo.id) {
                    sanitizedItem.assignedTo = {
                      id: String(item.assignedTo.id),
                      uid: String(item.assignedTo.uid || ''),
                      displayName: String(item.assignedTo.displayName || ''),
                      department: item.assignedTo.department ? String(item.assignedTo.department) : undefined,
                    };
                  } else {
                    sanitizedItem.assignedTo = null;
                  }
                  return sanitizedItem;
                })
            : [];
        }

        return result;
      }

      // Old format fallback: { name, amount, type: 'cash'|'in_kind', notes }
      const type = s.type === 'in_kind' ? 'in_kind' : 'cash';
      const notes = s.notes != null ? String(s.notes).trim() : '';
      if (type === 'cash') {
        const amount = Number(s.amount);
        return { name, amount: !Number.isNaN(amount) && amount >= 0 ? amount : 0, type: 'cash', notes: notes || undefined };
      }
      return { name, amount: 0, type: 'in_kind', notes: notes || undefined };
    })
    .filter(Boolean);
  return result;
};

/** Mobile: exactly 10 digits (strips spaces/dashes before check) */
const isValidMobile = (mobile) => {
  if (!mobile || !String(mobile).trim()) return true;
  const digits = String(mobile).replace(/\D/g, '');
  return digits.length === 10;
};

/** Basic URL validation */
const isValidUrl = (url) => {
  if (!url || !String(url).trim()) return true;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
};

module.exports = {
  isValidStudentRegNo,
  isValidStaffUID,
  isValidEmail,
  isValidPassword,
  sanitizeInput,
  sanitizeHtml,
  sanitizeSponsors,
  isValidMobile,
  isValidUrl,
};
