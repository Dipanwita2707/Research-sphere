# Quick Start: S3 Integration

## ✅ What's Done

All code changes are complete! The system now uses AWS S3 for all file uploads and downloads.

## ⚠️ What You Need to Do Now

### Step 1: Create AWS S3 Bucket
1. Go to [AWS Console](https://console.aws.amazon.com/s3/)
2. Click "Create bucket"
3. Name: `sgt-ums`
4. Region: Choose closest to your users (e.g., `us-east-1`)
5. Block all public access: ✅ Keep checked
6. Click "Create bucket"

### Step 2: Create IAM User
1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Users → Add users
3. Name: `sgt-ums-app`
4. Access type: ✅ Programmatic access
5. Permissions: Attach `AmazonS3FullAccess` policy
6. Complete creation
7. **SAVE the Access Key ID and Secret Access Key!**

### Step 3: Update .env File
Open `backend/.env` and update these lines (around line 28):

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE    # Replace with your key
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY    # Replace with your key
S3_BUCKET_NAME=sgt-ums
```

### Step 4: First, Fix Database Connection
The server is currently failing to connect to the database. Update the DATABASE_URL in `.env`:

```env
# For local PostgreSQL (recommended for development):
DATABASE_URL="postgresql://username:password@localhost:5432/sgt_ums?schema=public"

# OR keep your existing Aiven database if it's active
```

### Step 5: Start the Server
```bash
cd backend
npm run dev
```

### Step 6: Test File Upload
Use Postman or your frontend to test:

**POST** `http://localhost:5001/api/v1/file-upload/upload`
- Headers: `Authorization: Bearer YOUR_TOKEN`
- Body: `form-data` with key `file` (select a file)
- Optional: Add `folder` field with value like `test`

Should return:
```json
{
  "success": true,
  "message": "File uploaded successfully to S3",
  "data": {
    "fileName": "example.pdf",
    "s3Key": "documents/123/1234567890-abc123-example.pdf",
    "location": "https://sgt-ums.s3.us-east-1.amazonaws.com/..."
  }
}
```

## 📚 Documentation Files Created

- **[S3_SETUP.md](./S3_SETUP.md)** - Detailed AWS setup guide
- **[S3_MIGRATION_SUMMARY.md](./S3_MIGRATION_SUMMARY.md)** - Complete list of changes

## 🔧 Files Modified

### Routes (Multer Config)
- `src/modules/research/routes/contribution.routes.js`
- `src/modules/grants/routes/grant.routes.js`
- `src/modules/research/routes/progressTracker.routes.js`
- `src/modules/core/routes/fileUpload.routes.js`

### Controllers (S3 Integration)
- `src/modules/research/controllers/contribution.controller.js`
- `src/modules/grants/controllers/grant.controller.js`

### Services (New)
- `src/shared/utils/s3.js` - Core S3 operations
- `src/modules/core/services/s3File.service.js` - File upload/download service

### Server
- `src/server.js` - Removed static file serving

## ❓ FAQ

**Q: Will old files in `uploads/` directory still work?**
A: No, the system now expects files in S3. You'll need to migrate existing files.

**Q: How much will S3 cost?**
A: Approximately $5-20/month for moderate usage. See S3_MIGRATION_SUMMARY.md for details.

**Q: Can I test without AWS credentials?**
A: No, the app will fail when trying to upload files. You need valid AWS credentials.

**Q: What if I want to use local storage again?**
A: See "Rollback Plan" in S3_MIGRATION_SUMMARY.md

## 🚨 Important Security Notes

- ⚠️ Never commit `.env` file with real credentials
- ⚠️ Keep AWS Access Keys secure
- ⚠️ Rotate credentials periodically
- ⚠️ Use IAM policies to limit permissions

## ✉️ Need Help?

Check these files in order:
1. This file (QUICKSTART)
2. S3_SETUP.md (detailed AWS setup)
3. S3_MIGRATION_SUMMARY.md (all technical changes)

## 📊 System Status

| Component | Status |
|-----------|--------|
| Code Migration | ✅ Complete |
| Dependencies | ✅ Installed |
| AWS Setup | ⏳ Pending |
| Credentials | ⏳ Pending |
| Testing | ⏳ Pending |
