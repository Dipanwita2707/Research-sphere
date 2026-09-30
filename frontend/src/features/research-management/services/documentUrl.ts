import api, { getFileUrl } from '@/shared/api/api';

/**
 * URL for a research / IPR / grant document from the path stored on the record.
 *
 * - Absolute URLs are returned unchanged.
 * - Legacy paths that already point into `/uploads/...` are served by the
 *   authenticated uploads route on the backend host.
 * - Everything else is a storage key (`<folder>/<userId>/<file>`, S3 or local
 *   fallback) and is streamed by `GET /file-upload/download/<key>`, which checks
 *   the caller's access.
 *
 * The session cookie authenticates these requests, so the URL can be used in
 * `<a href>`, `<iframe>` and `<img>` directly.
 */
export const getDocumentUrl = (filePath?: string | null): string => {
  if (!filePath) return '';
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const clean = filePath.replace(/^\/+/, '');
  if (clean.startsWith('uploads/')) return getFileUrl(`/${clean}`);
  const encodedKey = clean.split('/').map(encodeURIComponent).join('/');
  return `${api.defaults.baseURL}/file-upload/download/${encodedKey}`;
};

export default getDocumentUrl;
