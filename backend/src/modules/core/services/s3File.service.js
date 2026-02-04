/**
 * S3 File Service
 * Service for handling file uploads and downloads via AWS S3
 */

const multer = require('multer');
const path = require('path');
const { uploadToS3, downloadFromS3, deleteFromS3, getS3FileMetadata } = require('../../../shared/utils/s3');

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

const uploadPrototype = multer({
  storage: memoryStorage,
  fileFilter: prototypeFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for prototypes
  },
});

/**
 * Controller: Upload file to S3
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
    
    // Upload to S3
    const result = await uploadToS3(
      req.file.buffer,
      folder,
      userId,
      req.file.originalname,
      req.file.mimetype
    );

    res.json({
      success: true,
      message: 'File uploaded successfully to S3',
      data: {
        fileName: path.basename(result.key),
        originalName: req.file.originalname,
        filePath: result.key,
        s3Key: result.key,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        location: result.location,
      },
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file to S3',
      error: error.message,
    });
  }
};

/**
 * Controller: Upload prototype file to S3
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
    
    // Upload to S3
    const result = await uploadToS3(
      req.file.buffer,
      folder,
      userId,
      req.file.originalname,
      req.file.mimetype
    );

    res.json({
      success: true,
      message: 'Prototype file uploaded successfully to S3',
      data: {
        fileName: path.basename(result.key),
        originalName: req.file.originalname,
        filePath: result.key,
        s3Key: result.key,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        location: result.location,
      },
    });
  } catch (error) {
    console.error('Prototype upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload prototype file to S3',
      error: error.message,
    });
  }
};

/**
 * Controller: Download file from S3
 */
const downloadFile = async (req, res) => {
  try {
    // For wildcard routes, the path is in req.params[0]
    const s3Key = req.params[0] || req.params.filePath;
    
    if (!s3Key) {
      return res.status(400).json({
        success: false,
        message: 'File path is required',
      });
    }

    // Download from S3
    const result = await downloadFromS3(s3Key);
    
    // Set headers
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', result.contentLength);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(s3Key)}"`);
    
    // Stream the file
    result.stream.pipe(res);
  } catch (error) {
    console.error('File download error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'File not found in S3',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to download file from S3',
      error: error.message,
    });
  }
};

/**
 * Controller: Get file info from S3
 */
const getFileInfo = async (req, res) => {
  try {
    const s3Key = req.params[0] || req.params.filePath;
    
    if (!s3Key) {
      return res.status(400).json({
        success: false,
        message: 'File path is required',
      });
    }

    const metadata = await getS3FileMetadata(s3Key);
    
    res.json({
      success: true,
      data: {
        s3Key: s3Key,
        fileName: path.basename(s3Key),
        contentType: metadata.contentType,
        size: metadata.contentLength,
        lastModified: metadata.lastModified,
        etag: metadata.etag,
      },
    });
  } catch (error) {
    console.error('Get file info error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'File not found in S3',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to get file info from S3',
      error: error.message,
    });
  }
};

/**
 * Controller: Delete file from S3
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

    await deleteFromS3(filePath);
    
    res.json({
      success: true,
      message: 'File deleted successfully from S3',
    });
  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file from S3',
      error: error.message,
    });
  }
};

module.exports = {
  upload,
  uploadPrototype,
  uploadFile,
  uploadPrototypeFile,
  downloadFile,
  getFileInfo,
  deleteFile,
};
