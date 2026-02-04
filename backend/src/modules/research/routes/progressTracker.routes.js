/**
 * Research Progress Tracker Routes
 * Handles all routes for tracking research progress from writing to publication
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../../../shared/config/database');
const researchProgressTrackerController = require('../controllers/progressTracker.controller');
const { protect } = require('../../../shared/middleware/auth');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../../uploads/research/tracker');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer with disk storage for local file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-compressed',
    'multipart/x-zip',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for ZIP files
  }
});

// All routes require authentication
router.use(protect);

// ===== TRACKER CRUD ROUTES =====

// Create a new tracker
router.post('/', researchProgressTrackerController.createTracker);

// Get all trackers for the current user
router.get('/my', researchProgressTrackerController.getMyTrackers);

// Get tracker statistics for the current user
router.get('/stats', researchProgressTrackerController.getTrackerStats);

// Get a single tracker by ID
router.get('/:id', researchProgressTrackerController.getTrackerById);

// Update tracker details (not status)
router.put('/:id', researchProgressTrackerController.updateTracker);

// Delete a tracker
router.delete('/:id', researchProgressTrackerController.deleteTracker);

// ===== STATUS UPDATE ROUTES =====

// Update tracker status with status-specific data
router.post('/:id/status', researchProgressTrackerController.updateTrackerStatus);

// ===== INCENTIVE SUBMISSION ROUTES =====

// Get tracker data formatted for incentive submission pre-fill
router.get('/:id/for-submission', researchProgressTrackerController.getTrackerForSubmission);

// Link tracker to a research contribution after submission
router.post('/:id/link-contribution', researchProgressTrackerController.linkToContribution);

// ===== DRD REVIEWER ROUTES =====

// Get tracker history for a contribution (used by DRD reviewers)
router.get('/contribution/:contributionId/history', researchProgressTrackerController.getTrackerHistoryForContribution);

// ===== FILE UPLOAD ROUTE =====

// Upload attachments for status updates - saves to latest status history entry
router.post('/:id/upload', upload.array('files', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Verify tracker ownership
    const tracker = await prisma.researchProgressTracker.findUnique({
      where: { id },
      include: {
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 1
        }
      }
    });

    if (!tracker) {
      return res.status(404).json({
        success: false,
        message: 'Tracker not found'
      });
    }

    if (tracker.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only upload to your own trackers'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: `/uploads/research/tracker/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date().toISOString()
    }));

    // If there's a status history entry, update it with the attachments
    if (tracker.statusHistory && tracker.statusHistory.length > 0) {
      const latestHistory = tracker.statusHistory[0];
      const existingAttachments = latestHistory.attachments || [];
      
      await prisma.researchProgressStatusHistory.update({
        where: { id: latestHistory.id },
        data: {
          attachments: [...existingAttachments, ...uploadedFiles],
          notes: latestHistory.notes ? 
            `${latestHistory.notes} (${uploadedFiles.length} document${uploadedFiles.length > 1 ? 's' : ''} attached)` :
            `${uploadedFiles.length} document${uploadedFiles.length > 1 ? 's' : ''} uploaded`
        }
      });
    } else {
      // Create a new status history entry for the documents
      await prisma.researchProgressStatusHistory.create({
        data: {
          trackerId: id,
          fromStatus: tracker.currentStatus,
          toStatus: tracker.currentStatus,
          reportedDate: new Date(),
          notes: `📎 ${uploadedFiles.length} document${uploadedFiles.length > 1 ? 's' : ''} uploaded`,
          statusData: {},
          attachments: uploadedFiles
        }
      });
    }

    return res.json({
      success: true,
      message: 'Files uploaded and saved successfully',
      data: uploadedFiles
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
});

module.exports = router;
