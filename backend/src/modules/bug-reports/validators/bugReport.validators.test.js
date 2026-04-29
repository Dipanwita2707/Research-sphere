/**
 * Bug Report Validators Tests
 * Unit tests for bug report validation functions
 */

const {
  isValidScreenshotType,
  isValidScreenshotSize,
  isValidScreenshotCount,
  MAX_FILE_SIZE,
  MAX_SCREENSHOT_COUNT,
  ALLOWED_MIME_TYPES,
  validateScreenshots,
} = require('./bugReport.validators');

describe('Bug Report Validators', () => {
  describe('Constants', () => {
    test('MAX_FILE_SIZE should be 5MB', () => {
      expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    });

    test('MAX_SCREENSHOT_COUNT should be 5', () => {
      expect(MAX_SCREENSHOT_COUNT).toBe(5);
    });

    test('ALLOWED_MIME_TYPES should include all required image types', () => {
      expect(ALLOWED_MIME_TYPES).toEqual([
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
      ]);
    });
  });

  describe('isValidScreenshotType', () => {
    test('should accept valid image MIME types', () => {
      expect(isValidScreenshotType('image/png')).toBe(true);
      expect(isValidScreenshotType('image/jpeg')).toBe(true);
      expect(isValidScreenshotType('image/jpg')).toBe(true);
      expect(isValidScreenshotType('image/gif')).toBe(true);
      expect(isValidScreenshotType('image/webp')).toBe(true);
    });

    test('should reject invalid MIME types', () => {
      expect(isValidScreenshotType('image/svg+xml')).toBe(false);
      expect(isValidScreenshotType('application/pdf')).toBe(false);
      expect(isValidScreenshotType('text/plain')).toBe(false);
      expect(isValidScreenshotType('video/mp4')).toBe(false);
      expect(isValidScreenshotType('image/bmp')).toBe(false);
    });
  });

  describe('isValidScreenshotSize', () => {
    test('should accept files within size limit', () => {
      expect(isValidScreenshotSize(1024)).toBe(true); // 1KB
      expect(isValidScreenshotSize(1024 * 1024)).toBe(true); // 1MB
      expect(isValidScreenshotSize(5 * 1024 * 1024)).toBe(true); // 5MB (exactly at limit)
    });

    test('should reject files exceeding size limit', () => {
      expect(isValidScreenshotSize(5 * 1024 * 1024 + 1)).toBe(false); // 5MB + 1 byte
      expect(isValidScreenshotSize(10 * 1024 * 1024)).toBe(false); // 10MB
    });
  });

  describe('isValidScreenshotCount', () => {
    test('should accept valid screenshot counts', () => {
      expect(isValidScreenshotCount(0)).toBe(true);
      expect(isValidScreenshotCount(1)).toBe(true);
      expect(isValidScreenshotCount(3)).toBe(true);
      expect(isValidScreenshotCount(5)).toBe(true);
    });

    test('should reject invalid screenshot counts', () => {
      expect(isValidScreenshotCount(-1)).toBe(false);
      expect(isValidScreenshotCount(6)).toBe(false);
      expect(isValidScreenshotCount(10)).toBe(false);
    });
  });

  describe('validateScreenshots middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { files: [] };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    test('should pass when no files are uploaded', () => {
      req.files = [];
      validateScreenshots(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should pass when files is undefined', () => {
      req.files = undefined;
      validateScreenshots(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should pass with valid files', () => {
      req.files = [
        {
          originalname: 'screenshot1.png',
          mimetype: 'image/png',
          size: 1024 * 1024, // 1MB
        },
        {
          originalname: 'screenshot2.jpg',
          mimetype: 'image/jpeg',
          size: 2 * 1024 * 1024, // 2MB
        },
      ];
      validateScreenshots(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should reject when file count exceeds maximum', () => {
      req.files = Array(6).fill({
        originalname: 'screenshot.png',
        mimetype: 'image/png',
        size: 1024,
      });
      validateScreenshots(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'screenshots',
            message: expect.stringContaining('Maximum 5 screenshots allowed'),
          }),
        ]),
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject when file size exceeds maximum', () => {
      req.files = [
        {
          originalname: 'large-screenshot.png',
          mimetype: 'image/png',
          size: 6 * 1024 * 1024, // 6MB
        },
      ];
      validateScreenshots(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'screenshots[0]',
            message: expect.stringContaining('exceeds maximum size of 5MB'),
          }),
        ]),
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject when file type is invalid', () => {
      req.files = [
        {
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          size: 1024,
        },
      ];
      validateScreenshots(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'screenshots[0]',
            message: expect.stringContaining('has invalid type'),
          }),
        ]),
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should report multiple validation errors', () => {
      req.files = [
        {
          originalname: 'large-file.png',
          mimetype: 'image/png',
          size: 6 * 1024 * 1024, // 6MB - too large
        },
        {
          originalname: 'wrong-type.pdf',
          mimetype: 'application/pdf',
          size: 1024, // Invalid type
        },
      ];
      validateScreenshots(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'screenshots[0]',
            message: expect.stringContaining('exceeds maximum size'),
          }),
          expect.objectContaining({
            field: 'screenshots[1]',
            message: expect.stringContaining('has invalid type'),
          }),
        ]),
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should validate all allowed image types', () => {
      req.files = [
        { originalname: 'test.png', mimetype: 'image/png', size: 1024 },
        { originalname: 'test.jpeg', mimetype: 'image/jpeg', size: 1024 },
        { originalname: 'test.jpg', mimetype: 'image/jpg', size: 1024 },
        { originalname: 'test.gif', mimetype: 'image/gif', size: 1024 },
        { originalname: 'test.webp', mimetype: 'image/webp', size: 1024 },
      ];
      validateScreenshots(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
