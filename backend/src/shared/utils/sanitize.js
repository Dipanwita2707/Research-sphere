const createSanitizeHtml = require("sanitize-html");

const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

const RICH_TEXT_OPTIONS = {
  allowedTags: createSanitizeHtml.defaults.allowedTags.concat([
    "img",
    "h1",
    "h2",
    "span",
  ]),
  allowedAttributes: {
    ...createSanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "title", "width", "height"],
    a: ["href", "name", "target", "rel"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  disallowedTagsMode: "discard",
};

const PLAIN_TEXT_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: "discard",
};

function normalizeLooseText(value) {
  if (value == null) return "";
  return String(value)
    .replace(CONTROL_CHAR_REGEX, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function limitLength(value, maxLength) {
  if (!maxLength || maxLength < 1) return value;
  return value.slice(0, maxLength);
}

function sanitizePlainText(value, options = {}) {
  const normalized = normalizeLooseText(value);
  const sanitized = createSanitizeHtml(normalized, PLAIN_TEXT_OPTIONS).trim();
  return limitLength(sanitized, options.maxLength);
}

function sanitizeRichText(value, options = {}) {
  const normalized = normalizeLooseText(value);
  const sanitized = createSanitizeHtml(normalized, RICH_TEXT_OPTIONS).trim();
  return limitLength(sanitized, options.maxLength);
}

function sanitizeEmail(value, options = {}) {
  const email = sanitizePlainText(value, { maxLength: options.maxLength || 320 });
  return options.lowercase === false ? email : email.toLowerCase();
}

function sanitizeUrl(value, options = {}) {
  return sanitizePlainText(value, { maxLength: options.maxLength || 2048 });
}

function sanitizeDigits(value, options = {}) {
  const digits = normalizeLooseText(value).replace(/\D/g, "");
  return limitLength(digits, options.maxLength);
}

function sanitizeNullablePlainText(value, options = {}) {
  const sanitized = sanitizePlainText(value, options);
  return sanitized || null;
}

function sanitizeStringArray(values, options = {}) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const sanitized = [];

  for (const value of values) {
    const normalized = sanitizePlainText(value, options);
    if (!normalized) continue;
    if (options.dedupe !== false && seen.has(normalized)) continue;
    seen.add(normalized);
    sanitized.push(normalized);
  }

  return sanitized;
}

function deepNormalizeStrings(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deepNormalizeStrings(item));
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        deepNormalizeStrings(entryValue),
      ]),
    );
  }

  if (typeof value === "string") {
    return normalizeLooseText(value);
  }

  return value;
}

module.exports = {
  deepNormalizeStrings,
  normalizeLooseText,
  sanitizeDigits,
  sanitizeEmail,
  sanitizeNullablePlainText,
  sanitizePlainText,
  sanitizeRichText,
  sanitizeStringArray,
  sanitizeUrl,
};
