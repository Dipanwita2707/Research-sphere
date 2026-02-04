# S3 Integration Migration Summary

## What Was Changed

This document summarizes all changes made to migrate from local file storage to AWS S3 storage.

### 1. Dependencies Added

- `@aws-sdk/client-s3` - AWS SDK for S3 operations
- `@aws-sdk/lib-storage` - For multipart uploads
- `@aws-sdk/s3-request-presigner` - For generating signed URLs
- `multer-s3` - Multer storage engine for S3

### 2. Configuration Files

#### `.env` Updated
Added AWS configuration:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
S3_BUCKET_NAME=sgt-ums
```

**ACTION REQUIRED**: Replace placeholders with your actual AWS credentials.

### 3. New Files Created

#### `backend/src/shared/utils/s3.js`
Core S3 utility module with functions:
- `uploadToS3()` - Upload files to S3
- `downloadFromS3()` - Download files from S3
- `deleteFromS3()` - Delete files from S3
- `fileExistsInS3()` - Check if file exists
- `getS3FileMetadata()` - Get file information
- `getSignedUrl()` - Generate temporary signed URLs

#### `backend/src/modules/core/services/s3File.service.js`
S3 file service with Express controllers:
- File upload handler with S3 integration
- File download handler streaming from S3
- File deletion handler
- Prototype file upload (50MB limit)

#### `backend/S3_SETUP.md`
Comprehensive setup guide for AWS S3 configuration.

### 4. Modified Files

#### Routes Updated (Multer Configuration Changed)
All these files now use `multer.memoryStorage()` instead of `multer.diskStorage()`:

1. **`backend/src/modules/research/routes/contribution.routes.js`**
   - Changed from disk storage to memory storage
   - Files temporarily stored in memory before S3 upload

2. **`backend/src/modules/grants/routes/grant.routes.js`**
   - Changed from disk storage to memory storage
   - Updated for S3 uploads

3. **`backend/src/modules/research/routes/progressTracker.routes.js`**
   - Changed from disk storage to memory storage
   - Removed file system operations

4. **`backend/src/modules/core/routes/fileUpload.routes.js`**
   - Updated to use new `s3File.service` instead of `localFile.service`
   - All file operations now go through S3

#### Controllers Updated

1. **`backend/src/modules/research/controllers/contribution.controller.js`**
   - Added `uploadToS3` import
   - Updated file upload handling to use S3
   - Files stored with S3 keys instead of local paths
   - Supporting documents uploaded to S3

2. **`backend/src/modules/grants/controllers/grant.controller.js`**
   - Added `uploadToS3` import
   - Grant proposal files uploaded to S3
   - File paths stored as S3 keys

#### Server Configuration

1. **`backend/src/server.js`**
   - Removed static file serving (`app.use('/uploads', ...)`)
   - Added comment explaining S3-based file serving
   - Files now downloaded via API endpoints that fetch from S3

### 5. File Path Migration

#### Old Format (Local):
```
/uploads/research/filename.pdf
/uploads/research/grants/filename.pdf
/uploads/ipr/filename.pdf
```

#### New Format (S3 Keys):
```
research/{userId}/{timestamp}-{random}-{filename}.pdf
research/grants/{userId}/{timestamp}-{random}-{filename}.pdf
ipr/{userId}/{timestamp}-{random}-{filename}.pdf
```

### 6. API Endpoints Behavior

#### File Upload
- **Endpoint**: `POST /api/v1/file-upload/upload`
- **Before**: Saved to `backend/uploads/` directory
- **After**: Uploaded to S3 bucket `sgt-ums`
- **Response**: Now includes `s3Key` and `location` fields

#### File Download
- **Endpoint**: `GET /api/v1/file-upload/download/{path}`
- **Before**: Served from local filesystem
- **After**: Streamed from S3
- **Path**: Now expects S3 key instead of local path

#### File Delete
- **Endpoint**: `DELETE /api/v1/file-upload/file`
- **Before**: Deleted from local filesystem
- **After**: Deleted from S3 bucket

### 7. Security Enhancements

- Files encrypted at rest in S3 (AES256)
- AWS credentials stored in environment variables only
- IAM-based access control
- No public access to files
- All transfers over HTTPS

## What You Need to Do

### 1. Set Up AWS S3
Follow the guide in `backend/S3_SETUP.md`:
- Create S3 bucket named `sgt-ums`
- Create IAM user with S3 permissions
- Get Access Key ID and Secret Access Key

### 2. Update Environment Variables
Edit `backend/.env` and replace:
```env
AWS_ACCESS_KEY_ID=your-actual-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-actual-secret-access-key-here
```

Optional: Change region or bucket name if desired:
```env
AWS_REGION=your-preferred-region
S3_BUCKET_NAME=your-bucket-name
```

### 3. Test the Integration

Start the backend server:
```bash
cd backend
npm run dev
```

The server should start successfully. Test file uploads through the API or frontend.

### 4. Migrate Existing Files (If Any)

If you have existing files in `backend/uploads/`, you can:

1. **Upload to S3 using AWS CLI**:
   ```bash
   aws s3 sync ./backend/uploads/ s3://sgt-ums/
   ```

2. **Update database records** to change file paths from local paths to S3 keys

3. **Or**: Keep local files and let new uploads go to S3 (dual system temporarily)

## Frontend Considerations

The frontend should continue to work without changes because:

1. Upload API endpoint remains the same
2. Download API endpoint remains the same
3. Response structure is similar (with added S3 metadata)

However, you may want to update the frontend to:
- Display S3 location/key information
- Handle S3-specific error messages
- Show upload progress differently

## Database Considerations

File paths stored in database will change format:
- **Old**: `/uploads/research/file.pdf`
- **New**: `research/{userId}/{timestamp}-{random}-file.pdf`

Existing records with old paths will need migration if you have existing data.

## Rollback Plan

If you need to rollback to local storage:

1. Restore old service files from git history
2. Revert route configurations to use `diskStorage`
3. Revert controllers to save local paths
4. Re-enable static file serving in `server.js`
5. Uninstall AWS packages (optional)

## Benefits of S3 Integration

✅ Scalable storage - no disk space limitations
✅ High availability and durability (99.999999999%)
✅ Better performance with CDN integration potential
✅ Encryption at rest
✅ Versioning and lifecycle policies available
✅ Cost-effective for large file storage
✅ No backup management needed (AWS handles it)
✅ Global accessibility

## Next Steps

1. ✅ Set up AWS S3 bucket
2. ✅ Configure AWS credentials
3. ⏳ Test file upload
4. ⏳ Test file download
5. ⏳ Migrate existing files (if any)
6. ⏳ Update database file paths (if needed)
7. ⏳ Monitor costs and usage

## Support & Documentation

- Full setup guide: `backend/S3_SETUP.md`
- AWS S3 Documentation: https://docs.aws.amazon.com/s3/
- AWS SDK for JavaScript: https://docs.aws.amazon.com/sdk-for-javascript/

## Cost Estimate

For reference (as of 2024):
- Storage: ~$0.023 per GB/month (Standard)
- PUT requests: ~$0.005 per 1,000 requests
- GET requests: ~$0.0004 per 1,000 requests
- Data transfer: First 100GB/month free

Estimated monthly cost for moderate usage: $5-$20/month
