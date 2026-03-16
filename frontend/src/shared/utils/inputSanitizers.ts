const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export function normalizeInput(value: string): string {
  return value.replace(CONTROL_CHAR_REGEX, "").trimStart();
}

export function sanitizePlainTextInput(
  value: string,
  options: { maxLength?: number } = {},
): string {
  const sanitized = normalizeInput(value).replace(/[<>]/g, "");
  return typeof options.maxLength === "number"
    ? sanitized.slice(0, options.maxLength)
    : sanitized;
}

export function sanitizeRichTextInput(value: string): string {
  return value.replace(CONTROL_CHAR_REGEX, "");
}

export function sanitizeDigitsInput(
  value: string,
  options: { maxLength?: number } = {},
): string {
  const digits = value.replace(/\D/g, "");
  return typeof options.maxLength === "number"
    ? digits.slice(0, options.maxLength)
    : digits;
}

export function sanitizeEmailInput(value: string): string {
  return normalizeInput(value)
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9._%+\-@]/g, "")
    .toLowerCase();
}

export function sanitizeSessionInput(value: string): string {
  return normalizeInput(value).replace(/[^0-9\-]/g, "").slice(0, 9);
}

export function sanitizeSocialHandleInput(value: string): string {
  return normalizeInput(value)
    .replace(/[^a-zA-Z0-9._\-@/:?=&]/g, "")
    .slice(0, 100);
}

export function sanitizeUrlInput(value: string): string {
  return normalizeInput(value).replace(/[<>\s]/g, "");
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
