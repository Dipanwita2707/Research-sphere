const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const { getTemplate, updateTemplate, saveHeaderImage, saveWatermarkImage, getTemplateAuditLog } = require('./loan-letter-template.service');

const uploadsDir = path.join(__dirname, '../../../../uploads/loan-letter-template');

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdir(uploadsDir, { recursive: true }, (err) => cb(err, uploadsDir));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `header-${Date.now()}-${base}${ext}`);
  },
});

// Image-only multer middleware (≤ 10 MB)
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG / PNG / WEBP / GIF images are allowed for the header'));
  },
}).single('headerImage');

exports.uploadMiddleware = (req, res, next) => {
  imageUpload(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'Header image is too large. Please upload an image smaller than 10 MB.',
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to upload header image',
    });
  });
};

/**
 * GET /finance/loan-letters/template
 */
exports.getTemplate = async (req, res) => {
  try {
    const template = await getTemplate();
    res.json({ success: true, data: template });
  } catch (err) {
    console.error('Get loan letter template error:', err);
    res.status(500).json({ success: false, message: 'Failed to load template' });
  }
};

/**
 * PUT /finance/loan-letters/template
 */
exports.updateTemplate = async (req, res) => {
  try {
    const saved = await updateTemplate(req.body, req.user.id);
    res.json({ success: true, message: 'Template saved successfully', data: saved });
  } catch (err) {
    console.error('Update loan letter template error:', err);
    res.status(500).json({ success: false, message: 'Failed to save template' });
  }
};

/**
 * GET /finance/loan-letters/template/audit
 */
exports.getTemplateAuditLog = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const result = await getTemplateAuditLog({ page, limit });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Get template audit log error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch audit log' });
  }
};

/**
 * POST /finance/loan-letters/template/header-image
 */
exports.uploadHeaderImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided' });
  }
  try {
    const url = await saveHeaderImage(`/uploads/loan-letter-template/${req.file.filename}`, req.user.id);
    res.json({ success: true, message: 'Header image uploaded', data: { url } });
  } catch (err) {
    console.error('Upload header image error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload header image' });
  }
};

// In-memory multer for DOCX files (≤ 10 MB, no disk write needed)
const docxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.docx') return cb(null, true);
    cb(new Error('Only .docx files are accepted'));
  },
}).single('docx');

// Watermark image multer middleware (reuses same image storage, ≤ 10 MB)
const watermarkUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG / PNG / WEBP / GIF images are allowed for watermark'));
  },
}).single('watermarkImage');

exports.watermarkUploadMiddleware = (req, res, next) => {
  watermarkUpload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'Watermark image too large (max 10 MB).' });
    }
    return res.status(400).json({ success: false, message: err.message || 'Failed to upload watermark image' });
  });
};

/**
 * POST /finance/loan-letters/template/watermark-image
 */
exports.uploadWatermarkImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided' });
  }
  try {
    const url = await saveWatermarkImage(`/uploads/loan-letter-template/${req.file.filename}`, req.user.id);
    res.json({ success: true, message: 'Watermark image uploaded', data: { url } });
  } catch (err) {
    console.error('Upload watermark image error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload watermark image' });
  }
};

exports.docxUploadMiddleware = (req, res, next) => {
  docxUpload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'DOCX file is too large (max 10 MB).' });
    }
    return res.status(400).json({ success: false, message: err.message || 'Failed to upload DOCX file' });
  });
};

/**
 * POST /finance/loan-letters/template/import-docx
 * Converts an uploaded .docx file to HTML using mammoth (server-side).
 */
exports.importDocx = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No DOCX file provided' });
  }
  try {
    const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
    let html = result.value;

    // Fix malformed placeholder syntax that can appear when DOCX files mix
    // literal values with placeholder tokens, e.g.:
    //   {{₹1,20,000{TRANSPORT_TOTAL}}{GRAND_TOTAL}}
    // Step 1: {{sometext{PLACEHOLDER_NAME}}} → {{PLACEHOLDER_NAME}}
    html = html.replace(/\{\{[^{}]*\{([A-Z_]+)\}\}/g, '{{$1}}');
    // Step 2: {PLACEHOLDER_NAME}} (single open, double close) → {{PLACEHOLDER_NAME}}
    html = html.replace(/(?<!\{)\{([A-Z_]+)\}\}/g, '{{$1}}');
    // Step 3: single-brace {PLACEHOLDER_NAME} that are not already double-braced → {{PLACEHOLDER_NAME}}
    html = html.replace(/(?<!\{)\{([A-Z_]+)\}(?!\})/g, '{{$1}}');

    res.json({ success: true, data: { html } });
  } catch (err) {
    console.error('DOCX import error:', err);
    res.status(500).json({ success: false, message: 'Failed to parse DOCX file: ' + (err.message || 'unknown error') });
  }
};
