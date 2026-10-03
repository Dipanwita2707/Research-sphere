/**
 * Upload/download file-type policy: the uploader's MIME type is never trusted, magic
 * bytes must match the extension, and S3 downloads get the same safe headers as local files.
 */
jest.mock('../../../shared/config/database', () => ({}));
const mockS3 = {
  uploadToS3: jest.fn(async (_buf, folder, userId, name) => ({ key: `${folder}/${userId}/${name}`, location: 'https://bucket/x' })),
  downloadFromS3: jest.fn(),
  deleteFromS3: jest.fn(),
  getS3FileMetadata: jest.fn(),
};
jest.mock('../../../shared/utils/s3', () => mockS3);
jest.mock('../../../modules/core/utils/uploadPaths', () => ({
  safeUploadFolder: (f, d) => f || d,
  authorizeFileKey: jest.fn(async (key) => ({ key, segments: key.split('/') })),
  canDeleteFile: () => true,
}));

const { checkUploadMetadata, contentMatchesExtension, contentTypeFor } = require('../../../shared/utils/fileTypes');
const s3File = require('../../../modules/core/services/s3File.service');

const PDF = Buffer.from('%PDF-1.7\n...');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
const HTML = Buffer.from('<html><script>alert(document.cookie)</script></html>');

describe('checkUploadMetadata', () => {
  it.each([
    ['report.pdf', 'application/pdf'],
    ['photo.JPG', 'image/jpeg'],
    ['proto.zip', 'application/x-zip-compressed'],
    ['proto.zip', 'application/octet-stream'],
    ['thesis.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['notes.txt', 'text/plain'],
  ])('accepts %s (%s)', (originalname, mimetype) => {
    expect(checkUploadMetadata({ originalname, mimetype })).toBeNull();
  });

  it.each([
    ['evil.html', 'text/html'],
    ['evil.html', 'application/pdf'], // allowlisted MIME, forbidden extension
    ['evil.svg', 'image/png'],
    ['evil.zip', 'text/html'],        // .zip used to pass regardless of MIME type
    ['report.pdf', 'text/html'],
    ['noext', 'application/pdf'],
  ])('rejects %s (%s)', (originalname, mimetype) => {
    expect(checkUploadMetadata({ originalname, mimetype })).not.toBeNull();
  });

  it('restricts prototype uploads to .zip', () => {
    expect(checkUploadMetadata({ originalname: 'a.pdf', mimetype: 'application/pdf' }, ['.zip'])).not.toBeNull();
    expect(checkUploadMetadata({ originalname: 'a.zip', mimetype: 'application/zip' }, ['.zip'])).toBeNull();
  });
});

describe('contentMatchesExtension', () => {
  it('checks magic bytes against the extension', () => {
    expect(contentMatchesExtension({ originalname: 'a.pdf', buffer: PDF })).toBe(true);
    expect(contentMatchesExtension({ originalname: 'a.png', buffer: PNG })).toBe(true);
    expect(contentMatchesExtension({ originalname: 'a.zip', buffer: ZIP })).toBe(true);
    expect(contentMatchesExtension({ originalname: 'a.pdf', buffer: HTML })).toBe(false);
    expect(contentMatchesExtension({ originalname: 'a.png', buffer: HTML })).toBe(false);
    expect(contentMatchesExtension({ originalname: 'a.zip', buffer: HTML })).toBe(false);
    expect(contentMatchesExtension({ originalname: 'a.txt', buffer: Buffer.from([0x41, 0x00]) })).toBe(false);
  });
});

describe('contentTypeFor', () => {
  it('derives the type from the extension only', () => {
    expect(contentTypeFor('x/y/a.pdf')).toBe('application/pdf');
    expect(contentTypeFor('a.html')).toBe('application/octet-stream');
    expect(contentTypeFor('a.svg')).toBe('application/octet-stream');
  });
});

const makeRes = () => {
  const headers = {};
  const res = {
    headers,
    setHeader: jest.fn((k, v) => { headers[k.toLowerCase()] = v; }),
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };
  return res;
};

describe('s3File upload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a file whose bytes do not match its extension', async () => {
    const res = makeRes();
    await s3File.uploadFile({ file: { originalname: 'cv.pdf', mimetype: 'application/pdf', buffer: HTML, size: HTML.length }, body: {}, user: { id: 'u1' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockS3.uploadToS3).not.toHaveBeenCalled();
  });

  it('stores the extension-derived type, not the client-declared one', async () => {
    const res = makeRes();
    await s3File.uploadFile({ file: { originalname: 'cv.pdf', mimetype: 'application/pdf', buffer: PDF, size: PDF.length }, body: {}, user: { id: 'u1' } }, res);
    expect(mockS3.uploadToS3).toHaveBeenCalledWith(PDF, 'documents', 'u1', 'cv.pdf', 'application/pdf');
    expect(res.json.mock.calls[0][0].data.mimeType).toBe('application/pdf');
  });
});

describe('s3File download headers', () => {
  const stream = { pipe: jest.fn() };

  it('serves an S3 object with a stored text/html type as a sandboxed attachment', async () => {
    mockS3.downloadFromS3.mockResolvedValue({ stream, contentType: 'text/html', contentLength: 10 });
    const res = makeRes();
    await s3File.downloadFile({ params: { 0: 'documents/u1/evil.html' }, path: '' }, res, jest.fn());
    expect(res.headers['content-type']).toBe('application/octet-stream');
    expect(res.headers['content-disposition']).toMatch(/^attachment;/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toMatch(/sandbox/);
  });

  it('keeps PDFs inline but with the extension type and sandbox CSP', async () => {
    mockS3.downloadFromS3.mockResolvedValue({ stream, contentType: 'text/html', contentLength: 10 });
    const res = makeRes();
    await s3File.downloadFile({ params: { 0: 'documents/u1/a.pdf' }, path: '' }, res, jest.fn());
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
    expect(res.headers['content-security-policy']).toMatch(/sandbox/);
  });
});
