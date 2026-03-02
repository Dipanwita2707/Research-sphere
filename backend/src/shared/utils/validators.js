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
 * Sanitize HTML to prevent XSS - strips script, iframe, object, embed, and event handlers
 */
const sanitizeHtml = (html) => {
  if (typeof html !== 'string') return html;
  let out = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
  return out;
};

/**
 * Sanitize sponsors array (used by Noting and Event)
 * Cash: name + amount (₹). In-kind: name + notes (description)
 */
const sanitizeSponsors = (sponsors) => {
  if (!Array.isArray(sponsors)) return [];
  return sponsors
    .filter((s) => s && typeof s === 'object')
    .map((s) => {
      const name = String(s.name || '').trim();
      const type = s.type === 'in_kind' ? 'in_kind' : 'cash';
      const notes = s.notes != null ? String(s.notes).trim() : '';
      if (!name) return null;
      if (type === 'cash') {
        const amount = Number(s.amount);
        return { name, amount: !Number.isNaN(amount) && amount >= 0 ? amount : 0, type: 'cash', notes: notes || undefined };
      }
      return { name, amount: 0, type: 'in_kind', notes: notes || undefined };
    })
    .filter(Boolean);
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
