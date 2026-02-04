const express = require('express');
const router = express.Router();
const s3FileService = require('../services/s3File.service');
const { protect } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

// Upload file to S3
router.post('/upload', s3FileService.upload.single('file'), s3FileService.uploadFile);

// Upload prototype ZIP file (up to 50MB) for IPR Complete Filing
router.post('/upload-prototype', s3FileService.uploadPrototype.single('file'), s3FileService.uploadPrototypeFile);

// Download file from S3
router.get('/download/*', s3FileService.downloadFile);

// Get file info
router.get('/info/*', s3FileService.getFileInfo);

// Delete file
router.delete('/file', s3FileService.deleteFile);

module.exports = router;
