/**
 * Screenshot Service Tests
 */

// Mock prisma before requiring the service
jest.mock('../../../shared/config/database', () => ({
  bugReportScreenshot: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

const screenshotService = require('./screenshot.service');
const fs = require('fs');
const path = require('path');

describe('Screenshot Service', () => {
  describe('validateScreenshot', () => {
    it('should validate a valid PNG file', () => {
      const mockFile = {
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(true);
    });

    it('should validate a valid JPEG file', () => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(true);
    });

    it('should reject file with invalid MIME type', () => {
      const mockFile = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024,
        buffer: Buffer.from([0x25, 0x50, 0x44, 0x46]),
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should reject file exceeding size limit', () => {
      const mockFile = {
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 6 * 1024 * 1024, // 6MB
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds 5MB limit');
    });

    it('should reject file with mismatched header', () => {
      const mockFile = {
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 1024 * 1024,
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), // JPEG header
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match declared file type');
    });

    it('should reject when no file provided', () => {
      const result = screenshotService.validateScreenshot(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No file provided');
    });
  });

  describe('ALLOWED_MIME_TYPES', () => {
    it('should export allowed MIME types', () => {
      expect(screenshotService.ALLOWED_MIME_TYPES).toBeDefined();
      expect(Array.isArray(screenshotService.ALLOWED_MIME_TYPES)).toBe(true);
      expect(screenshotService.ALLOWED_MIME_TYPES).toContain('image/png');
      expect(screenshotService.ALLOWED_MIME_TYPES).toContain('image/jpeg');
      expect(screenshotService.ALLOWED_MIME_TYPES).toContain('image/jpg');
      expect(screenshotService.ALLOWED_MIME_TYPES).toContain('image/gif');
      expect(screenshotService.ALLOWED_MIME_TYPES).toContain('image/webp');
    });
  });

  describe('SCREENSHOTS_DIR', () => {
    it('should export screenshots directory path', () => {
      expect(screenshotService.SCREENSHOTS_DIR).toBeDefined();
      expect(typeof screenshotService.SCREENSHOTS_DIR).toBe('string');
      expect(screenshotService.SCREENSHOTS_DIR).toContain('bug-reports');
      expect(screenshotService.SCREENSHOTS_DIR).toContain('screenshots');
    });

    it('should ensure screenshots directory exists', () => {
      expect(fs.existsSync(screenshotService.SCREENSHOTS_DIR)).toBe(true);
    });
  });
});
