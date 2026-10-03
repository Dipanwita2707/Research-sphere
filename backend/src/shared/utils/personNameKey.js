/**
 * One key per person across the name forms bibliographic sources use:
 * "Vishu Madaan", "Madaan, V.", "V. Madaan", "Dr. Vishu Madaan" → "madaan|v".
 * Surname plus first initial: good enough to merge a co-author's entries on one researcher's
 * own papers; it is not an identity match across a whole university.
 * @param {string} name
 * @returns {string|null}
 */
function personNameKey(name) {
  const raw = String(name || '').replace(/\b(dr|prof|mr|mrs|ms)\.?\s+/gi, '').trim();
  if (!raw) return null;
  let surname;
  let given;
  if (raw.includes(',')) {
    [surname, given] = raw.split(',').map((x) => x.trim());
  } else {
    const parts = raw.split(/\s+/);
    surname = parts.pop();
    given = parts.join(' ');
  }
  const initial = String(given || '').replace(/[^A-Za-z]/g, '').charAt(0).toLowerCase();
  const sur = String(surname || '').toLowerCase().replace(/[^a-zÀ-ɏ-]/g, '');
  return sur ? `${sur}|${initial}` : null;
}

/** Of several written forms of one name, the fullest ("Vishu Madaan" over "Madaan, V."). */
function fullestName(names) {
  return [...names].sort((a, b) => String(b).replace(/[^A-Za-z]/g, '').length - String(a).replace(/[^A-Za-z]/g, '').length)[0];
}

module.exports = { personNameKey, fullestName };
