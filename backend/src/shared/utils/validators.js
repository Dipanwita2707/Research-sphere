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

module.exports = {
  isValidStudentRegNo,
  isValidStaffUID,
  isValidEmail,
  isValidPassword,
  sanitizeInput,
  sanitizeSponsors
};
