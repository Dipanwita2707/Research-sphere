/**
 * AWS S3 Utility Module
 * Handles file uploads, downloads, and deletions from AWS S3
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const crypto = require('crypto');
const path = require('path');

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'sgt-ums';

/**
 * Generate unique S3 key for file
 * @param {string} folder - Folder name (e.g., 'ipr', 'research', 'grants')
 * @param {string} userId - User ID
 * @param {string} originalName - Original filename
 * @returns {string} - S3 key path
 */
const generateS3Key = (folder, userId, originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(6).toString('hex');
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
  
  return `${folder}/${userId}/${timestamp}-${randomString}-${baseName}${ext}`;
};

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer from multer memory storage
 * @param {string} folder - Folder name (e.g., 'ipr', 'research', 'grants')
 * @param {string} userId - User ID
 * @param {string} originalName - Original filename
 * @param {string} mimeType - File MIME type
 * @returns {Promise<Object>} - Upload result with key, location, etc.
 */
const uploadToS3 = async (fileBuffer, folder, userId, originalName, mimeType) => {
  try {
    const key = generateS3Key(folder, userId, originalName);
    
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        ServerSideEncryption: 'AES256',
      },
    });

    const result = await upload.done();
    
    return {
      key: key,
      bucket: BUCKET_NAME,
      location: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`,
      etag: result.ETag,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

/**
 * Download file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} - Object with file stream and metadata
 */
const downloadFromS3 = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    return {
      stream: response.Body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  } catch (error) {
    console.error('S3 download error:', error);
    if (error.name === 'NoSuchKey') {
      throw new Error('File not found in S3');
    }
    throw new Error(`Failed to download file from S3: ${error.message}`);
  }
};

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`File deleted from S3: ${key}`);
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
};

/**
 * Check if file exists in S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>}
 */
const fileExistsInS3 = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
};

/**
 * Get file metadata from S3
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} - File metadata
 */
const getS3FileMetadata = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      etag: response.ETag,
      metadata: response.Metadata,
    };
  } catch (error) {
    console.error('S3 metadata error:', error);
    if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
      throw new Error('File not found in S3');
    }
    throw new Error(`Failed to get file metadata from S3: ${error.message}`);
  }
};

/**
 * Get signed URL for temporary public access (optional - for future use)
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Signed URL
 */
const getSignedUrl = async (key, expiresIn = 3600) => {
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('S3 signed URL error:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

module.exports = {
  s3Client,
  uploadToS3,
  downloadFromS3,
  deleteFromS3,
  fileExistsInS3,
  getS3FileMetadata,
  getSignedUrl,
  generateS3Key,
  BUCKET_NAME,
};
