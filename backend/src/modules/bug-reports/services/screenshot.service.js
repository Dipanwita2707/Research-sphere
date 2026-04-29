/**
 * Screenshot Service
 * Handles screenshot file upload, storage, and retrieval
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const prisma = require('../../../shared/config/database');
const { logScreenshotUpload } = require('../utils/securityLogger');

// Define upload directory for bug report screenshots
// SECURITY: Files are stored outside the web server document root
// to prevent direct execution of uploaded files
const UPLOADS_BASE_DIR = path.join(__dirname, '../../../../uploads');
const SCREENSHOTS_DIR = path.join(UPLOADS_BASE_DIR, 'bug-reports', 'screenshots');
const THUMBNAILS_DIR = path.join(UPLOADS_BASE_DIR, 'bug-reports', 'thumbnails');

// Ensure screenshots and thumbnails directories exist
if (!fsSync.existsSync(SCREENSHOTS_DIR)) {
  fsSync.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}
if (!fsSync.existsSync(THUMBNAILS_DIR)) {
  fsSync.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

// Allowed MIME types for screenshots
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

// File signature (magic numbers) for validation
const FILE_SIGNATURES = {
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/jpg': [0xff, 0xd8, 0xff],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
};

/**
 * Validate file header matches declared MIME type
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - Declared MIME type
 * @returns {boolean} - True if valid
 */
const validateFileHeader = (buffer, mimeType) => {
  const signature = FILE_SIGNATURES[mimeType];
  if (!signature) {
    return false;
  }

  // Check if buffer starts with the expected signature
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }

  // Additional check for WebP (needs WEBP string at offset 8)
  if (mimeType === 'image/webp') {
    const webpMarker = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
    for (let i = 0; i < webpMarker.length; i++) {
      if (buffer[8 + i] !== webpMarker[i]) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Check if filename has executable or suspicious extensions
 * @param {string} filename - Original filename
 * @returns {boolean} - True if suspicious
 */
const hasSuspiciousExtension = (filename) => {
  const suspiciousExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.app', '.deb', '.rpm', '.dmg', '.pkg', '.sh', '.bash', '.ps1', '.psm1',
    '.msi', '.dll', '.so', '.dylib', '.bin', '.run', '.out', '.elf',
  ];

  const lowerFilename = filename.toLowerCase();
  return suspiciousExtensions.some(ext => lowerFilename.endsWith(ext));
};

/**
 * Sanitize filename to prevent path traversal attacks
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFilename = (filename) => {
  // Remove any path components (../, ./, /, \)
  let sanitized = filename.replace(/^.*[\\\/]/, '');
  
  // Remove any null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove any control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  
  // Remove leading dots to prevent hidden files
  sanitized = sanitized.replace(/^\.+/, '');
  
  // If filename is empty after sanitization, use a default
  if (!sanitized || sanitized.trim() === '') {
    sanitized = 'unnamed.jpg';
  }
  
  return sanitized;
};

/**
 * Validate screenshot file
 * @param {Object} file - Multer file object
 * @returns {Object} - { valid: boolean, error: string }
 */
const validateScreenshot = (file) => {
  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Sanitize filename to prevent path traversal
  const sanitizedFilename = sanitizeFilename(file.originalname);
  file.originalname = sanitizedFilename;

  // Check for suspicious/executable extensions
  if (hasSuspiciousExtension(file.originalname)) {
    return {
      valid: false,
      error: 'File has a suspicious or executable extension and cannot be uploaded',
    };
  }

  // Check MIME type (server-side validation, don't trust client)
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  // Check file size (5MB limit)
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit',
    };
  }

  // Validate file header matches MIME type (scan file headers)
  if (file.buffer) {
    const headerValid = validateFileHeader(file.buffer, file.mimetype);
    if (!headerValid) {
      return {
        valid: false,
        error: 'File header does not match declared file type. This may indicate a malicious file.',
      };
    }
  }

  return { valid: true };
};

/**
 * Generate unique filename with UUID
 * SECURITY: Uses UUID to generate non-guessable filenames
 * to prevent enumeration attacks
 * @param {string} originalFilename - Original filename
 * @returns {string} - Unique filename
 */
const generateUniqueFilename = (originalFilename) => {
  const ext = path.extname(originalFilename);
  const uuid = uuidv4();
  return `${uuid}${ext}`;
};

/**
 * Generate thumbnail from image buffer
 * @param {Buffer} buffer - Original image buffer
 * @param {number} size - Thumbnail size (width/height in pixels)
 * @returns {Promise<Buffer>} - Thumbnail buffer
 */
const generateThumbnail = async (buffer, size = 200) => {
  try {
    const thumbnail = await sharp(buffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({
        quality: 80,
        progressive: true,
      })
      .toBuffer();
    
    return thumbnail;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  }
};

/**
 * Organize files in structured directory hierarchy (YYYY/MM/DD)
 * @returns {string} - Directory path relative to SCREENSHOTS_DIR
 */
const getDateBasedDirectory = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return path.join(String(year), month, day);
};

/**
 * Save screenshot files and create database records
 * @param {Array} files - Array of multer file objects
 * @param {string} bugReportId - Bug report ID
 * @param {string} userId - User ID for logging
 * @param {string} userIdentifier - User identifier for logging
 * @returns {Promise<Array>} - Array of created screenshot records
 */
const saveScreenshots = async (files, bugReportId, userId = null, userIdentifier = null) => {
  if (!files || files.length === 0) {
    return [];
  }

  // Validate all files first
  for (const file of files) {
    const validation = validateScreenshot(file);
    if (!validation.valid) {
      // Log failed upload attempt
      logScreenshotUpload({
        userId: userId || 'unknown',
        userIdentifier: userIdentifier || 'unknown',
        filename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        success: false,
        error: validation.error,
      });
      
      throw new Error(`File validation failed for ${file.originalname}: ${validation.error}`);
    }
  }

  const savedScreenshots = [];

  try {
    for (const file of files) {
      // Generate unique filename
      const storedFilename = generateUniqueFilename(file.originalname);
      const thumbnailFilename = `thumb_${storedFilename.replace(path.extname(storedFilename), '.jpg')}`;

      // Get date-based directory
      const dateDir = getDateBasedDirectory();
      const fullDir = path.join(SCREENSHOTS_DIR, dateDir);
      const fullThumbnailDir = path.join(THUMBNAILS_DIR, dateDir);

      // Ensure directories exist
      if (!fsSync.existsSync(fullDir)) {
        fsSync.mkdirSync(fullDir, { recursive: true });
      }
      if (!fsSync.existsSync(fullThumbnailDir)) {
        fsSync.mkdirSync(fullThumbnailDir, { recursive: true });
      }

      // Full file paths
      const filePath = path.join(fullDir, storedFilename);
      const thumbnailPath = path.join(fullThumbnailDir, thumbnailFilename);

      // Write original file to disk
      await fs.writeFile(filePath, file.buffer);

      // Generate and save thumbnail
      const thumbnailBuffer = await generateThumbnail(file.buffer, 200);
      await fs.writeFile(thumbnailPath, thumbnailBuffer);

      // Storage paths relative to uploads directory
      const storagePath = path.join('bug-reports', 'screenshots', dateDir, storedFilename);
      const thumbnailStoragePath = path.join('bug-reports', 'thumbnails', dateDir, thumbnailFilename);

      // Create database record with thumbnail info
      const screenshot = await prisma.bugReportScreenshot.create({
        data: {
          bugReportId,
          originalFilename: file.originalname,
          storedFilename,
          fileSize: file.size,
          mimeType: file.mimetype,
          storagePath,
          thumbnailFilename,
          thumbnailPath: thumbnailStoragePath,
        },
      });

      savedScreenshots.push(screenshot);

      // Log successful upload
      logScreenshotUpload({
        userId: userId || 'unknown',
        userIdentifier: userIdentifier || 'unknown',
        filename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        success: true,
      });
    }

    return savedScreenshots;
  } catch (error) {
    // Cleanup: Delete any files that were saved before the error
    for (const screenshot of savedScreenshots) {
      try {
        const filePath = path.join(UPLOADS_BASE_DIR, screenshot.storagePath);
        if (fsSync.existsSync(filePath)) {
          await fs.unlink(filePath);
        }
        // Also cleanup thumbnail
        if (screenshot.thumbnailPath) {
          const thumbPath = path.join(UPLOADS_BASE_DIR, screenshot.thumbnailPath);
          if (fsSync.existsSync(thumbPath)) {
            await fs.unlink(thumbPath);
          }
        }
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    // Log failed upload
    if (files && files.length > 0) {
      for (const file of files) {
        logScreenshotUpload({
          userId: userId || 'unknown',
          userIdentifier: userIdentifier || 'unknown',
          filename: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          success: false,
          error: error.message,
        });
      }
    }

    throw new Error(`Failed to save screenshots: ${error.message}`);
  }
};

/**
 * Get screenshot by ID
 * @param {string} screenshotId - Screenshot ID
 * @returns {Promise<Object>} - Screenshot record with file path
 */
const getScreenshotById = async (screenshotId) => {
  const screenshot = await prisma.bugReportScreenshot.findUnique({
    where: { id: screenshotId },
    include: {
      bugReport: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  if (!screenshot) {
    throw new Error('Screenshot not found');
  }

  // Get full file path
  const filePath = path.join(UPLOADS_BASE_DIR, screenshot.storagePath);

  // Check if file exists
  if (!fsSync.existsSync(filePath)) {
    throw new Error('Screenshot file not found on disk');
  }

  return {
    ...screenshot,
    filePath,
  };
};

/**
 * Get all screenshots for a bug report
 * @param {string} bugReportId - Bug report ID
 * @returns {Promise<Array>} - Array of screenshot records
 */
const getScreenshotsByBugReportId = async (bugReportId) => {
  const screenshots = await prisma.bugReportScreenshot.findMany({
    where: { bugReportId },
    orderBy: { uploadedAt: 'asc' },
  });

  return screenshots;
};

/**
 * Delete screenshot files and database records
 * @param {string} bugReportId - Bug report ID
 * @returns {Promise<number>} - Number of screenshots deleted
 */
const deleteScreenshots = async (bugReportId) => {
  // Get all screenshots for the bug report
  const screenshots = await prisma.bugReportScreenshot.findMany({
    where: { bugReportId },
  });

  if (screenshots.length === 0) {
    return 0;
  }

  // Delete files from disk
  for (const screenshot of screenshots) {
    try {
      // Delete original file
      const filePath = path.join(UPLOADS_BASE_DIR, screenshot.storagePath);
      if (fsSync.existsSync(filePath)) {
        await fs.unlink(filePath);
      }
      
      // Delete thumbnail file
      if (screenshot.thumbnailPath) {
        const thumbPath = path.join(UPLOADS_BASE_DIR, screenshot.thumbnailPath);
        if (fsSync.existsSync(thumbPath)) {
          await fs.unlink(thumbPath);
        }
      }
    } catch (error) {
      console.error(`Error deleting file ${screenshot.storagePath}:`, error);
      // Continue with other deletions even if one fails
    }
  }

  // Delete database records (cascade will handle this if bug report is deleted)
  const result = await prisma.bugReportScreenshot.deleteMany({
    where: { bugReportId },
  });

  return result.count;
};

/**
 * Delete a single screenshot by ID
 * @param {string} screenshotId - Screenshot ID
 * @returns {Promise<void>}
 */
const deleteScreenshotById = async (screenshotId) => {
  const screenshot = await prisma.bugReportScreenshot.findUnique({
    where: { id: screenshotId },
  });

  if (!screenshot) {
    throw new Error('Screenshot not found');
  }

  // Delete files from disk
  try {
    // Delete original file
    const filePath = path.join(UPLOADS_BASE_DIR, screenshot.storagePath);
    if (fsSync.existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    
    // Delete thumbnail file
    if (screenshot.thumbnailPath) {
      const thumbPath = path.join(UPLOADS_BASE_DIR, screenshot.thumbnailPath);
      if (fsSync.existsSync(thumbPath)) {
        await fs.unlink(thumbPath);
      }
    }
  } catch (error) {
    console.error(`Error deleting file ${screenshot.storagePath}:`, error);
  }

  // Delete database record
  await prisma.bugReportScreenshot.delete({
    where: { id: screenshotId },
  });
};

/**
 * Get screenshot file buffer
 * @param {string} storagePath - Storage path relative to uploads directory
 * @returns {Promise<Buffer>} - File buffer
 */
const getScreenshotFile = async (storagePath) => {
  const filePath = path.join(UPLOADS_BASE_DIR, storagePath);

  // Check if file exists
  if (!fsSync.existsSync(filePath)) {
    throw new Error('File not found in storage');
  }

  // Read file and return buffer
  const fileBuffer = await fs.readFile(filePath);
  return fileBuffer;
};

/**
 * Get thumbnail file buffer
 * @param {string} thumbnailPath - Thumbnail path relative to uploads directory
 * @returns {Promise<Buffer>} - Thumbnail buffer
 */
const getThumbnailFile = async (thumbnailPath) => {
  const filePath = path.join(UPLOADS_BASE_DIR, thumbnailPath);

  // Check if file exists
  if (!fsSync.existsSync(filePath)) {
    throw new Error('Thumbnail not found in storage');
  }

  // Read file and return buffer
  const fileBuffer = await fs.readFile(filePath);
  return fileBuffer;
};

module.exports = {
  saveScreenshots,
  getScreenshotById,
  getScreenshotsByBugReportId,
  getScreenshotFile,
  getThumbnailFile,
  deleteScreenshots,
  deleteScreenshotById,
  validateScreenshot,
  ALLOWED_MIME_TYPES,
  SCREENSHOTS_DIR,
};
