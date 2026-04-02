/**
 * S3 File Service
 * Service for handling file uploads and downloads via AWS S3.
 * Falls back to local disk when S3 credentials are missing or invalid.
 */

const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const { uploadToS3, downloadFromS3, deleteFromS3, getS3FileMetadata } = require('../../../shared/utils/s3');

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

function isS3CredentialError(err) {
  const msg = (err && err.message) ? err.message : '';
  return !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY ||
    /credential|not valid|InvalidCredential|Missing credentials/i.test(msg);
}

function saveToLocal(fileBuffer, folder, userId, originalName) {
  const userDir = path.join(UPLOADS_DIR, folder, userId);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(6).toString('hex');
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${timestamp}-${randomString}-${baseName}${ext}`;
  const fullPath = path.join(userDir, filename);
  fs.writeFileSync(fullPath, fileBuffer);
  const relativeKey = `${folder}/${userId}/${filename}`;
  return { key: relativeKey };
}

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
    'application/octet-stream',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) || ext === '.zip') {
    cb(null, true);
  } else {
    cb(new Error('Only ZIP files are allowed for prototype uploads'), false);
  }
};

/**
 * Configure multer with memory storage (files stored in memory before uploading to S3)
 */
const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/** Noting attachments: 5MB per file */
const NOTING_FILE_MAX_BYTES = 5 * 1024 * 1024;
const uploadNoting = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: NOTING_FILE_MAX_BYTES,
  },
});

const uploadPrototype = multer({
  storage: memoryStorage,
  fileFilter: prototypeFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for prototypes
  },
});

/**
 * Controller: Upload file to S3 (or local disk if S3 not configured)
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const folder = req.body.folder || 'documents';
    const userId = req.user.id;
    let result;

    try {
      result = await uploadToS3(
        req.file.buffer,
        folder,
        userId,
        req.file.originalname,
        req.file.mimetype
      );
    } catch (s3Error) {
      if (isS3CredentialError(s3Error)) {
        console.warn('S3 not configured or credentials invalid, using local storage:', s3Error.message);
        result = saveToLocal(req.file.buffer, folder, userId, req.file.originalname);
      } else {
        throw s3Error;
      }
    }

    const key = result.key;
    res.json({
      success: true,
      message: result.location ? 'File uploaded successfully to S3' : 'File uploaded successfully',
      data: {
        fileName: path.basename(key),
        originalName: req.file.originalname,
        filePath: key,
        s3Key: key,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        location: result.location || null,
      },
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file',
      error: error.message,
    });
  }
};

/**
 * Controller: Upload prototype file to S3 (or local disk if S3 not configured)
 */
const uploadPrototypeFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const folder = req.body.folder || 'ipr/prototypes';
    const userId = req.user.id;
    let result;

    try {
      result = await uploadToS3(
        req.file.buffer,
        folder,
        userId,
        req.file.originalname,
        req.file.mimetype
      );
    } catch (s3Error) {
      if (isS3CredentialError(s3Error)) {
        console.warn('S3 not configured, using local storage for prototype');
        result = saveToLocal(req.file.buffer, folder, userId, req.file.originalname);
      } else {
        throw s3Error;
      }
    }

    const key = result.key;
    res.json({
      success: true,
      message: result.location ? 'Prototype file uploaded successfully to S3' : 'Prototype file uploaded successfully',
      data: {
        fileName: path.basename(key),
        originalName: req.file.originalname,
        filePath: key,
        s3Key: key,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        location: result.location || null,
      },
    });
  } catch (error) {
    console.error('Prototype upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload prototype file',
      error: error.message,
    });
  }
};

/**
 * Controller: Download file (local disk first, then S3)
 */
const downloadFile = async (req, res) => {
  try {
    let filePath = req.params[0] || req.params.filePath;
    if (!filePath && req.path && req.path.startsWith('/download/')) {
      filePath = req.path.replace(/^\/download\/?/, '');
    }
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required',
      });
    }

    const localPath = path.join(UPLOADS_DIR, filePath);
    if (fs.existsSync(localPath)) {
      const stat = fs.statSync(localPath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
      fs.createReadStream(localPath).pipe(res);
      return;
    }

    const result = await downloadFromS3(filePath);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', result.contentLength);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300'); // Cache 5 min for repeat loads (e.g. sponsor logos)
    result.stream.pipe(res);
  } catch (error) {
    console.error('File download error:', error);
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to download file',
      error: error.message,
    });
  }
};

/**
 * Controller: Get file info (local first, then S3)
 */
const getFileInfo = async (req, res) => {
  try {
    const filePath = req.params[0] || req.params.filePath;
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required',
      });
    }

    const localPath = path.join(UPLOADS_DIR, filePath);
    if (fs.existsSync(localPath)) {
      const stat = fs.statSync(localPath);
      return res.json({
        success: true,
        data: {
          s3Key: filePath,
          fileName: path.basename(filePath),
          contentType: 'application/octet-stream',
          size: stat.size,
          lastModified: stat.mtime,
          etag: null,
        },
      });
    }

    const metadata = await getS3FileMetadata(filePath);
    res.json({
      success: true,
      data: {
        s3Key: filePath,
        fileName: path.basename(filePath),
        contentType: metadata.contentType,
        size: metadata.contentLength,
        lastModified: metadata.lastModified,
        etag: metadata.etag,
      },
    });
  } catch (error) {
    console.error('Get file info error:', error);
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get file info',
      error: error.message,
    });
  }
};

/**
 * Controller: Delete file (local first, then S3)
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

    const localPath = path.join(UPLOADS_DIR, filePath);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      return res.json({
        success: true,
        message: 'File deleted successfully',
      });
    }

    await deleteFromS3(filePath);
    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete file',
      error: error.message,
    });
  }
};

module.exports = {
  upload,
  uploadNoting,
  uploadPrototype,
  uploadFile,
  uploadPrototypeFile,
  downloadFile,
  getFileInfo,
  deleteFile,
};
