const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { safeUploadFolder, authorizeFileKey, canDeleteFile } = require('../utils/uploadPaths');

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const IPR_UPLOADS_DIR = path.join(UPLOADS_DIR, 'ipr');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(IPR_UPLOADS_DIR)) {
  fs.mkdirSync(IPR_UPLOADS_DIR, { recursive: true });
}

/**
 * Generate unique filename for local storage
 * @param {string} folder - Folder name (e.g., 'ipr', 'research-papers')
 * @param {string} userId - User ID
 * @param {string} originalName - Original filename
 * @returns {string} - Local file path
 */
const generateLocalFileName = (folder, userId, originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(6).toString('hex');
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
  
  return `${folder}/${userId}/${timestamp}-${randomString}-${baseName}${ext}`;
};

/**
 * File filter for multer - allow common document types including ZIP
 */
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check both mime type and extension for better compatibility (especially for ZIP)
  if (allowedMimeTypes.includes(file.mimetype) || ext === '.zip') {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

/**
 * File filter for prototype ZIP uploads - only allow ZIP files
 */
const prototypeFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'application/octet-stream', // Some systems detect ZIP as this
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  
  // Check both mime type and extension for better compatibility
  if (allowedMimeTypes.includes(file.mimetype) || ext === '.zip') {
    cb(null, true);
  } else {
    cb(new Error('Only ZIP files are allowed for prototype uploads'), false);
  }
};

/**
 * Configure multer for file uploads
 * Note: Using memory storage first, then saving to disk to ensure folder is read from body
 */
const memoryStorage = multer.memoryStorage();

const uploadMemory = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * Configure multer for prototype ZIP uploads with 50MB limit
 */
const uploadPrototypeMemory = multer({
  storage: memoryStorage,
  fileFilter: prototypeFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for prototypes
  },
});

/**
 * Controller: Upload file locally
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const folder = safeUploadFolder(req.body.folder, 'documents');
    if (!folder) {
      return res.status(400).json({ success: false, message: 'Invalid upload folder' });
    }
    const userId = req.user.id;
    
    // Create the directory
    const userDir = path.join(UPLOADS_DIR, folder, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(req.file.originalname);
    const baseName = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${randomString}-${baseName}${ext}`;
    
    // Write file to disk
    const filePath = path.join(userDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);
    
    const relativePath = `${folder}/${userId}/${filename}`;

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileName: filename,
        originalName: req.file.originalname,
        filePath: relativePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
    });
  }
};

/**
 * Tenant/ownership check for a stored path (see utils/uploadPaths). Sends the error
 * response itself and returns false when the caller may not access the file.
 */
const checkFileAccess = async (filePath, req, res, { forDelete = false } = {}) => {
  const access = await authorizeFileKey(String(filePath), req);
  if (access.error) {
    res.status(access.error).json({
      success: false,
      message: access.error === 400 ? 'Invalid file path' : 'File not found',
    });
    return false;
  }
  if (forDelete && !canDeleteFile(access.segments, req.user)) {
    res.status(403).json({ success: false, message: 'You can only delete files you uploaded' });
    return false;
  }
  return true;
};

/**
 * Controller: Download file
 */
const downloadFile = async (req, res) => {
  try {
    // For wildcard routes, the path is in req.params[0]
    const filePath = req.params[0] || req.params.filePath;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required',
      });
    }
    
    if (!(await checkFileAccess(filePath, req, res, {}))) return;
    const fullPath = path.join(UPLOADS_DIR, filePath);

    // Security check: ensure the file is within the uploads directory
    const normalizedPath = path.normalize(fullPath);
    const normalizedUploadsDir = path.normalize(UPLOADS_DIR);
    
    if (!normalizedPath.startsWith(normalizedUploadsDir)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // Send file
    res.sendFile(fullPath);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
    });
  }
};

/**
 * Controller: Delete file
 */
const deleteFile = async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required',
      });
    }

    if (!(await checkFileAccess(filePath, req, res, { forDelete: true }))) return;
    const fullPath = path.join(UPLOADS_DIR, filePath);

    // Security check: ensure the file is within the uploads directory
    const normalizedPath = path.normalize(fullPath);
    const normalizedUploadsDir = path.normalize(UPLOADS_DIR);
    
    if (!normalizedPath.startsWith(normalizedUploadsDir)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // Delete file
    fs.unlinkSync(fullPath);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
    });
  }
};

/**
 * Get file info
 */
const getFileInfo = async (req, res) => {
  try {
    const { filePath } = req.params;
    if (!(await checkFileAccess(filePath, req, res, {}))) return;
    const fullPath = path.join(UPLOADS_DIR, filePath);

    // Security check
    const normalizedPath = path.normalize(fullPath);
    const normalizedUploadsDir = path.normalize(UPLOADS_DIR);
    
    if (!normalizedPath.startsWith(normalizedUploadsDir)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    const stats = fs.statSync(fullPath);
    const fileName = path.basename(fullPath);

    res.json({
      success: true,
      data: {
        fileName,
        filePath,
        fileSize: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      },
    });
  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file info',
    });
  }
};

/**
 * Controller: Upload prototype ZIP file for IPR Complete Filing
 * Allows ZIP files up to 50MB
 */
const uploadPrototypeFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload a ZIP file containing your prototype.',
      });
    }

    const userId = req.user.id;
    const folder = 'ipr/prototypes';
    
    // Create the directory
    const userDir = path.join(UPLOADS_DIR, folder, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(req.file.originalname);
    const baseName = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${randomString}-${baseName}${ext}`;
    
    // Write file to disk
    const filePath = path.join(userDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);
    
    const relativePath = `${folder}/${userId}/${filename}`;

    res.json({
      success: true,
      message: 'Prototype file uploaded successfully',
      data: {
        fileName: filename,
        originalName: req.file.originalname,
        filePath: relativePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('Prototype file upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload prototype file',
    });
  }
};

module.exports = {
  upload: uploadMemory,
  uploadPrototype: uploadPrototypeMemory,
  uploadFile,
  uploadPrototypeFile,
  downloadFile,
  deleteFile,
  getFileInfo,
  generateLocalFileName,
};