/**
 * Attachment Controller
 * Handles file upload for mail attachments
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure multer for mail attachments
const uploadDir = path.join(__dirname, '..', '..', '..', '..', 'uploads', 'mail-attachments');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `mail-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5, // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      'application/zip', 'application/x-rar-compressed',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  },
});

/**
 * POST /api/v1/mail/attachments/upload
 * Upload file(s) for mail attachment
 */
exports.uploadMiddleware = upload.array('files', 5);

exports.uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploaded = req.files.map((file) => ({
      fileName: file.originalname,
      filePath: `/uploads/mail-attachments/${file.filename}`,
      fileSize: file.size,
      mimeType: file.mimetype,
    }));

    res.json({
      success: true,
      message: `${uploaded.length} file(s) uploaded`,
      data: uploaded,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'File upload failed',
    });
  }
};
