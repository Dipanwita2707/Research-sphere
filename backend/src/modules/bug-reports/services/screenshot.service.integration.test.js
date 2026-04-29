/**
 * Screenshot Service Integration Tests
 * Tests file system operations and database interactions
 */

const screenshotService = require('./screenshot.service');
const fs = require('fs');
const path = require('path');

describe('Screenshot Service Integration', () => {
  describe('File System Operations', () => {
    it('should create screenshots directory on initialization', () => {
      expect(fs.existsSync(screenshotService.SCREENSHOTS_DIR)).toBe(true);
    });

    it('should have correct directory structure', () => {
      const expectedPath = path.join('uploads', 'bug-reports', 'screenshots');
      expect(screenshotService.SCREENSHOTS_DIR).toContain(expectedPath);
    });
  });

  describe('File Validation', () => {
    it('should validate PNG file with correct header', () => {
      // PNG file signature: 89 50 4E 47 0D 0A 1A 0A
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        // Add some dummy data
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      ]);

      const mockFile = {
        originalname: 'test-image.png',
        mimetype: 'image/png',
        size: pngBuffer.length,
        buffer: pngBuffer,
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(true);
    });

    it('should validate JPEG file with correct header', () => {
      // JPEG file signature: FF D8 FF
      const jpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      ]);

      const mockFile = {
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        size: jpegBuffer.length,
        buffer: jpegBuffer,
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(true);
    });

    it('should validate GIF file with correct header', () => {
      // GIF file signature: 47 49 46 (GIF)
      const gifBuffer = Buffer.from([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
        0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
      ]);

      const mockFile = {
        originalname: 'test-image.gif',
        mimetype: 'image/gif',
        size: gifBuffer.length,
        buffer: gifBuffer,
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(true);
    });

    it('should validate WebP file with correct header', () => {
      // WebP file signature: RIFF....WEBP
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // File size (placeholder)
        0x57, 0x45, 0x42, 0x50, // WEBP
        0x56, 0x50, 0x38, 0x20, // VP8
      ]);

      const mockFile = {
        originalname: 'test-image.webp',
        mimetype: 'image/webp',
        size: webpBuffer.length,
        buffer: webpBuffer,
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(true);
    });

    it('should reject file with wrong header for declared type', () => {
      // PNG header but declared as JPEG
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      const mockFile = {
        originalname: 'fake.jpg',
        mimetype: 'image/jpeg',
        size: pngBuffer.length,
        buffer: pngBuffer,
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match declared file type');
    });

    it('should reject executable file disguised as image', () => {
      // EXE header (MZ)
      const exeBuffer = Buffer.from([
        0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
      ]);

      const mockFile = {
        originalname: 'malicious.png',
        mimetype: 'image/png',
        size: exeBuffer.length,
        buffer: exeBuffer,
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match declared file type');
    });
  });

  describe('Security Validations', () => {
    it('should enforce 5MB file size limit', () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      // Set PNG header
      largeBuffer[0] = 0x89;
      largeBuffer[1] = 0x50;
      largeBuffer[2] = 0x4e;
      largeBuffer[3] = 0x47;

      const mockFile = {
        originalname: 'large-image.png',
        mimetype: 'image/png',
        size: largeBuffer.length,
        buffer: largeBuffer,
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds 5MB limit');
    });

    it('should only allow image MIME types', () => {
      const allowedTypes = screenshotService.ALLOWED_MIME_TYPES;
      
      expect(allowedTypes).toContain('image/png');
      expect(allowedTypes).toContain('image/jpeg');
      expect(allowedTypes).toContain('image/jpg');
      expect(allowedTypes).toContain('image/gif');
      expect(allowedTypes).toContain('image/webp');
      
      // Should not contain non-image types
      expect(allowedTypes).not.toContain('application/pdf');
      expect(allowedTypes).not.toContain('text/html');
      expect(allowedTypes).not.toContain('application/javascript');
    });

    it('should reject non-image MIME types', () => {
      const mockFile = {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from([0x25, 0x50, 0x44, 0x46]),
      };

      const result = screenshotService.validateScreenshot(mockFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });
  });

  describe('Exported Functions', () => {
    it('should export all required functions', () => {
      expect(typeof screenshotService.saveScreenshots).toBe('function');
      expect(typeof screenshotService.getScreenshotById).toBe('function');
      expect(typeof screenshotService.getScreenshotsByBugReportId).toBe('function');
      expect(typeof screenshotService.deleteScreenshots).toBe('function');
      expect(typeof screenshotService.deleteScreenshotById).toBe('function');
      expect(typeof screenshotService.validateScreenshot).toBe('function');
    });

    it('should export configuration constants', () => {
      expect(Array.isArray(screenshotService.ALLOWED_MIME_TYPES)).toBe(true);
      expect(typeof screenshotService.SCREENSHOTS_DIR).toBe('string');
    });
  });
});
