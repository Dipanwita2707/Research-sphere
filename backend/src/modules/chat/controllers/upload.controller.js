/**
 * Upload Controller
 * Handles file uploads for chat
 */
const fileService = require('../services/file.service');
const voiceService = require('../services/voice.service');
const { isGroupMember } = require('../utils/permissions');
const path = require('path');

/**
 * Upload file for group chat
 */
const uploadGroupFile = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // Check membership
    const isMember = await isGroupMember(groupId, userId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
      });
    }

    const result = await fileService.saveGroupFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      groupId,
      userId
    );

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        ...result,
        url: fileService.getFileUrl(result.filePath),
      },
    });
  } catch (error) {
    console.error('Upload group file error:', error);
    res.status(error.message.includes('not allowed') || error.message.includes('too large') ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to upload file',
    });
  }
};

/**
 * Upload file for direct message
 */
const uploadDirectFile = async (req, res) => {
  try {
    const { receiverId } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
      });
    }

    const result = await fileService.saveDirectFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      userId,
      receiverId
    );

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        ...result,
        url: fileService.getFileUrl(result.filePath),
      },
    });
  } catch (error) {
    console.error('Upload direct file error:', error);
    res.status(error.message.includes('not allowed') || error.message.includes('too large') ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to upload file',
    });
  }
};

/**
 * Upload voice message for group chat
 */
const uploadGroupVoice = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // Check membership
    const isMember = await isGroupMember(groupId, userId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Voice file is required',
      });
    }

    const result = await voiceService.processGroupVoiceMessage(
      req.file.buffer,
      req.file.mimetype,
      groupId,
      userId
    );

    res.json({
      success: true,
      message: 'Voice message uploaded successfully',
      data: {
        ...result,
        url: fileService.getFileUrl(result.filePath),
      },
    });
  } catch (error) {
    console.error('Upload group voice error:', error);
    res.status(error.message.includes('not allowed') || error.message.includes('too') ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to upload voice message',
    });
  }
};

/**
 * Upload voice message for direct message
 */
const uploadDirectVoice = async (req, res) => {
  try {
    const { receiverId } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Voice file is required',
      });
    }

    const result = await voiceService.processDirectVoiceMessage(
      req.file.buffer,
      req.file.mimetype,
      userId,
      receiverId
    );

    res.json({
      success: true,
      message: 'Voice message uploaded successfully',
      data: {
        ...result,
        url: fileService.getFileUrl(result.filePath),
      },
    });
  } catch (error) {
    console.error('Upload direct voice error:', error);
    res.status(error.message.includes('not allowed') || error.message.includes('too') ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to upload voice message',
    });
  }
};

/**
 * Serve file (with optional auth check)
 */
const serveFile = async (req, res) => {
  try {
    const filePath = decodeURIComponent(req.params[0] || req.params.path);

    // Basic security check - ensure path doesn't escape
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file path',
      });
    }

    // Check if file exists
    const exists = await fileService.fileExists(filePath);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // For media files (images, videos, audio), allow public access
    // since HTML media elements can't send Authorization headers
    const fullPath = fileService.getFullPath(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    // Set content type
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.wav': 'audio/wav',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    res.sendFile(fullPath);
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to serve file',
    });
  }
};

module.exports = {
  uploadGroupFile,
  uploadDirectFile,
  uploadGroupVoice,
  uploadDirectVoice,
  serveFile,
};
