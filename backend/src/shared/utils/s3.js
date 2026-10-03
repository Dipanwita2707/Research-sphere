/**
 * File storage module (local disk by default, AWS S3 when STORAGE_DRIVER=s3)
 * Handles file uploads, downloads, and deletions
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const crypto = require('crypto');
const path = require('path');
const { contentTypeFor } = require('./fileTypes');

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
 * Storage driver. `local` (the default) keeps every file on this server's disk under
 * backend/src/uploads/<key>; `s3` uses the bucket above. Keys have the same shape either way
 * (`folder/userId/timestamp-rand-name.ext`), so callers never need to know which is in use.
 */
const fs = require('fs');

const storageDriver = () => (String(process.env.STORAGE_DRIVER || 'local').toLowerCase() === 's3' ? 's3' : 'local');
const isLocalStorage = () => storageDriver() === 'local';

const BACKEND_ROOT = path.join(__dirname, '..', '..', '..');
const LOCAL_ROOT = path.join(BACKEND_ROOT, 'src', 'uploads');
// Older uploads were written to these folders too; reads look in all of them.
const LOCAL_READ_ROOTS = [LOCAL_ROOT, path.join(BACKEND_ROOT, 'uploads'), path.join(BACKEND_ROOT, 'src', 'modules', 'uploads')];

/** Absolute path for a key inside `root`, or null when the key would escape it. */
const localPathFor = (key, root = LOCAL_ROOT) => {
  const segments = String(key || '').split(/[\/]+/).filter(Boolean);
  if (!segments.length || segments.some((s) => s === '..')) return null;
  const full = path.resolve(root, ...segments);
  return full.startsWith(root + path.sep) ? full : null;
};

const findLocalFile = (key) => {
  for (const root of LOCAL_READ_ROOTS) {
    const full = localPathFor(key, root);
    if (!full) return null;
    try { if (fs.statSync(full).isFile()) return full; } catch (_) { /* not in this root */ }
  }
  return null;
};

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
 * @param {string} [_mimeType] - ignored: the client-declared type is never stored (see below)
 * @returns {Promise<Object>} - Upload result with key, location, etc.
 */
const uploadToS3 = async (fileBuffer, folder, userId, originalName, _mimeType) => {
  if (isLocalStorage()) {
    const key = generateS3Key(folder, userId, originalName);
    const full = localPathFor(key);
    if (!full) throw new Error('Invalid storage path');
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, fileBuffer);
    return { key, bucket: null, location: null, etag: null, storage: 'local' };
  }
  try {
    const key = generateS3Key(folder, userId, originalName);
    
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        // Derived from the extension, never the uploader's claim: a stored "image/png"
        // that is really HTML must not be served as HTML anywhere (bucket URL included).
        ContentType: contentTypeFor(key),
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
  if (isLocalStorage()) {
    const full = findLocalFile(key);
    if (!full) throw new Error('File not found in S3');
    const stat = await fs.promises.stat(full);
    return {
      stream: fs.createReadStream(full),
      contentType: contentTypeFor(full),
      contentLength: stat.size,
      lastModified: stat.mtime,
      metadata: {},
    };
  }
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
  if (isLocalStorage()) {
    const full = findLocalFile(key);
    if (full) await fs.promises.unlink(full);
    return;
  }
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
  if (isLocalStorage()) return Boolean(findLocalFile(key));
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
  if (isLocalStorage()) {
    const full = findLocalFile(key);
    if (!full) throw new Error('File not found in S3');
    const stat = await fs.promises.stat(full);
    return { contentType: contentTypeFor(full), contentLength: stat.size, lastModified: stat.mtime, etag: null, metadata: {} };
  }
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
    // HEAD on a missing key returns 404, or 403 when the credentials lack s3:ListBucket
    // (the SDK then reports a bodiless "UnknownError"). Either way the file is not available.
    const httpStatus = error.$metadata?.httpStatusCode;
    if (error.name === 'NoSuchKey' || error.name === 'NotFound' || httpStatus === 404 || httpStatus === 403) {
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
  if (isLocalStorage()) throw new Error('Signed URLs are not available with local file storage');
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
  storageDriver,
  isLocalStorage,
  LOCAL_ROOT,
};
