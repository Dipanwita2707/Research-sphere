const config = require('../../../shared/config/app.config');
const { safeUploadFolder, authorizeFileKey, canDeleteFile } = require('../utils/uploadPaths');

// Try to load AWS SDK modules, handle gracefully if not installed
let S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, getSignedUrl;
let AWS_SDK_AVAILABLE = false;

try {
  const s3ClientModule = require('@aws-sdk/client-s3');
  const s3PresignerModule = require('@aws-sdk/s3-request-presigner');
  
  S3Client = s3ClientModule.S3Client;
  PutObjectCommand = s3ClientModule.PutObjectCommand;
  GetObjectCommand = s3ClientModule.GetObjectCommand;
  DeleteObjectCommand = s3ClientModule.DeleteObjectCommand;
  getSignedUrl = s3PresignerModule.getSignedUrl;
  
  AWS_SDK_AVAILABLE = true;
} catch (error) {
  console.warn('AWS SDK not installed. File upload functionality will be limited.');
  AWS_SDK_AVAILABLE = false;
}

// Initialize S3 client only if AWS SDK is available
let s3Client = null;
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'sgt-university-files';

if (AWS_SDK_AVAILABLE && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Generate presigned URL for file upload
 * @param {string} key - S3 object key (file path)
 * @param {string} contentType - MIME type of the file
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
 * @returns {Promise<string>} - Presigned URL
 */
const generateUploadUrl = async (key, contentType, expiresIn = 3600) => {
  if (!AWS_SDK_AVAILABLE || !s3Client) {
    throw new Error('AWS S3 service not configured');
  }
  
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return presignedUrl;
  } catch (error) {
    console.error('Error generating upload URL:', error);
    throw new Error('Failed to generate upload URL');
  }
};

/**
 * Generate presigned URL for file download
 * @param {string} key - S3 object key (file path)
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
 * @returns {Promise<string>} - Presigned URL
 */
const generateDownloadUrl = async (key, expiresIn = 3600) => {
  if (!AWS_SDK_AVAILABLE || !s3Client) {
    throw new Error('AWS S3 service not configured');
  }
  
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return presignedUrl;
  } catch (error) {
    console.error('Error generating download URL:', error);
    throw new Error('Failed to generate download URL');
  }
};

/**
 * Delete file from S3
 * @param {string} key - S3 object key (file path)
 * @returns {Promise<boolean>} - Success status
 */
const deleteFile = async (key) => {
  if (!AWS_SDK_AVAILABLE || !s3Client) {
    throw new Error('AWS S3 service not configured');
  }
  
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
};

/**
 * Generate unique S3 key for file upload
 * @param {string} folder - Folder name (e.g., 'ipr', 'research-papers')
 * @param {string} userId - User ID
 * @param {string} filename - Original filename
 * @returns {string} - S3 key
 */
const generateS3Key = (folder, userId, filename) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const ext = filename.split('.').pop();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  return `${folder}/${userId}/${timestamp}-${randomString}-${sanitizedFilename}`;
};

/**
 * Controller: Generate presigned upload URL
 */
const getUploadUrl = async (req, res) => {
  try {
    // Check if AWS SDK is available and credentials are configured
    if (!AWS_SDK_AVAILABLE) {
      return res.json({
        success: false,
        message: 'File upload service requires AWS SDK installation. Run: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner',
        data: {
          uploadUrl: null,
          s3Key: null,
          requiresAwsSDK: true
        }
      });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return res.json({
        success: false,
        message: 'File upload service is not configured. AWS S3 credentials required.',
        data: {
          uploadUrl: null,
          s3Key: null,
          requiresConfiguration: true
        }
      });
    }

    const { filename, contentType } = req.body;
    const userId = req.user.id;

    if (!filename || !contentType) {
      return res.status(400).json({
        success: false,
        message: 'Filename and content type are required',
      });
    }

    const folder = safeUploadFolder(req.body.folder, 'documents');
    if (!folder) {
      return res.status(400).json({ success: false, message: 'Invalid upload folder' });
    }

    // Validate content type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only PDF, Word, Excel, and images are allowed.',
      });
    }

    const s3Key = generateS3Key(folder, userId, filename);
    const uploadUrl = await generateUploadUrl(s3Key, contentType);

    res.json({
      success: true,
      data: {
        uploadUrl,
        s3Key,
        expiresIn: 3600, // 1 hour
      },
    });
  } catch (error) {
    console.error('Get upload URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate upload URL',
    });
  }
};

/**
 * Controller: Generate presigned download URL
 */
const getDownloadUrl = async (req, res) => {
  try {
    // Check if AWS SDK is available and credentials are configured
    if (!AWS_SDK_AVAILABLE) {
      return res.json({
        success: false,
        message: 'File download service requires AWS SDK installation. Run: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner',
        data: {
          downloadUrl: null,
          requiresAwsSDK: true
        }
      });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return res.json({
        success: false,
        message: 'File download service is not configured. AWS S3 credentials required.',
        data: {
          downloadUrl: null,
          requiresConfiguration: true
        }
      });
    }

    const { s3Key } = req.query;

    if (!s3Key) {
      return res.status(400).json({
        success: false,
        message: 'S3 key is required',
      });
    }

    // Only keys whose uploader belongs to the caller's university (404 otherwise)
    const access = await authorizeFileKey(String(s3Key), req);
    if (access.error) {
      return res.status(access.error).json({
        success: false,
        message: access.error === 400 ? 'Invalid S3 key' : 'File not found',
      });
    }

    const downloadUrl = await generateDownloadUrl(access.key);

    res.json({
      success: true,
      data: {
        downloadUrl,
        expiresIn: 3600, // 1 hour
      },
    });
  } catch (error) {
    console.error('Get download URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate download URL',
    });
  }
};

/**
 * Controller: Delete file
 */
const deleteFileController = async (req, res) => {
  try {
    const { s3Key } = req.body;

    if (!s3Key) {
      return res.status(400).json({
        success: false,
        message: 'S3 key is required',
      });
    }

    const access = await authorizeFileKey(String(s3Key), req);
    if (access.error) {
      return res.status(access.error).json({
        success: false,
        message: access.error === 400 ? 'Invalid S3 key' : 'File not found',
      });
    }
    if (!canDeleteFile(access.segments, req.user)) {
      return res.status(403).json({ success: false, message: 'You can only delete files you uploaded' });
    }

    await deleteFile(access.key);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
    });
  }
};

module.exports = {
  generateUploadUrl,
  generateDownloadUrl,
  generateS3Key,
  deleteFile,
  getUploadUrl,
  getDownloadUrl,
  deleteFileController,
};
