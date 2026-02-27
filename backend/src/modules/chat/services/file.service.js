/**
 * File Upload Service
 * Handles file storage for chat messages (local storage)
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const UPLOAD_BASE_DIR = path.join(__dirname, '..', '..', '..', '..', 'uploads', 'chat');

// Allowed file types
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  voice: ['audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
};

// File size limits (in bytes)
const SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
  voice: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024, // 50MB
};

/**
 * Ensure upload directory exists
 */
const ensureDir = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

/**
 * Get file type category from mime type
 */
const getFileCategory = (mimeType) => {
  for (const [category, types] of Object.entries(ALLOWED_TYPES)) {
    if (types.includes(mimeType)) {
      return category;
    }
  }
  return null;
};

/**
 * Validate file
 */
const validateFile = (buffer, mimeType, maxSize = null) => {
  const category = getFileCategory(mimeType);
  
  if (!category) {
    throw new Error(`File type not allowed: ${mimeType}`);
  }

  const sizeLimit = maxSize || SIZE_LIMITS[category];
  if (buffer.length > sizeLimit) {
    throw new Error(`File too large. Maximum size is ${Math.round(sizeLimit / 1024 / 1024)}MB`);
  }

  return category;
};

/**
 * Generate unique filename
 */
const generateFileName = (originalName, userId) => {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName).toLowerCase() || '.bin';
  const baseName = path.basename(originalName, ext)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);
  
  return `${timestamp}-${hash}-${baseName}${ext}`;
};

/**
 * Get date-based folder path
 */
const getDateFolder = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * Save file to local storage
 */
const saveFile = async (buffer, originalName, mimeType, contextType, contextId, userId) => {
  // Validate
  const category = validateFile(buffer, mimeType);

  // Build path: uploads/chat/{contextType}/{contextId}/{date}/{userId}/
  const dateFolder = getDateFolder();
  const relativePath = path.join(contextType, contextId, dateFolder, userId);
  const fullDir = path.join(UPLOAD_BASE_DIR, relativePath);

  await ensureDir(fullDir);

  // Generate filename
  const fileName = generateFileName(originalName, userId);
  const fullPath = path.join(fullDir, fileName);
  const relativeFilePath = path.join(relativePath, fileName);

  // Write file
  await fs.writeFile(fullPath, buffer);

  return {
    filePath: relativeFilePath.replace(/\\/g, '/'), // Normalize path separators
    fileName: originalName,
    fileSize: buffer.length,
    mimeType,
    category,
  };
};

/**
 * Save group chat file
 */
const saveGroupFile = async (buffer, originalName, mimeType, groupId, userId) => {
  return saveFile(buffer, originalName, mimeType, 'groups', groupId, userId);
};

/**
 * Save direct message file
 */
const saveDirectFile = async (buffer, originalName, mimeType, senderId, receiverId) => {
  // Use sorted user IDs for consistent folder naming
  const conversationId = [senderId, receiverId].sort().join('-');
  return saveFile(buffer, originalName, mimeType, 'direct', conversationId, senderId);
};

/**
 * Get full file path from relative path
 */
const getFullPath = (relativePath) => {
  return path.join(UPLOAD_BASE_DIR, relativePath);
};

/**
 * Check if file exists
 */
const fileExists = async (relativePath) => {
  try {
    await fs.access(getFullPath(relativePath));
    return true;
  } catch {
    return false;
  }
};

/**
 * Read file
 */
const readFile = async (relativePath) => {
  const fullPath = getFullPath(relativePath);
  return fs.readFile(fullPath);
};

/**
 * Delete file
 */
const deleteFile = async (relativePath) => {
  try {
    const fullPath = getFullPath(relativePath);
    await fs.unlink(fullPath);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error.message);
    return false;
  }
};

/**
 * Get file URL for API
 */
const getFileUrl = (relativePath) => {
  return `/api/v1/chat/files/${encodeURIComponent(relativePath)}`;
};

/**
 * Clean up orphaned files (call periodically)
 */
const cleanupOrphanedFiles = async (prisma, olderThanDays = 7) => {
  // This would need to be implemented based on your cleanup requirements
  console.log('File cleanup not yet implemented');
  return 0;
};

module.exports = {
  ALLOWED_TYPES,
  SIZE_LIMITS,
  validateFile,
  getFileCategory,
  saveFile,
  saveGroupFile,
  saveDirectFile,
  getFullPath,
  fileExists,
  readFile,
  deleteFile,
  getFileUrl,
  cleanupOrphanedFiles,
  ensureDir,
  UPLOAD_BASE_DIR,
};
