# AWS S3 File Storage Setup

This application uses AWS S3 for file storage instead of local filesystem storage. All file uploads (research papers, IPR documents, grants, etc.) are stored in and retrieved from an S3 bucket.

## Prerequisites

1. **AWS Account**: You need an active AWS account
2. **S3 Bucket**: Create an S3 bucket named `sgt-ums` (or your preferred name)
3. **IAM User**: Create an IAM user with S3 access permissions

## AWS Configuration Steps

### 1. Create S3 Bucket

1. Log in to AWS Console
2. Navigate to S3 service
3. Click "Create bucket"
4. Bucket name: `sgt-ums`
5. Region: Choose your preferred region (e.g., `us-east-1`)
6. Keep other settings as default or adjust based on your needs
7. Click "Create bucket"

### 2. Configure Bucket Permissions (Optional but Recommended)

For better security, configure bucket policy and CORS if needed:

#### Bucket Policy Example (Adjust as needed):
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowPrivateAccess",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/YOUR_IAM_USER"
            },
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::sgt-ums/*"
        }
    ]
}
```

#### CORS Configuration (if accessing from frontend):
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
        "ExposeHeaders": ["ETag"]
    }
]
```

### 3. Create IAM User with S3 Access

1. Navigate to IAM service in AWS Console
2. Click "Users" → "Add users"
3. User name: `sgt-ums-app` (or your preferred name)
4. Select "Access key - Programmatic access"
5. Click "Next: Permissions"
6. Select "Attach existing policies directly"
7. Search and select `AmazonS3FullAccess` (or create a custom policy for specific bucket access)
8. Click through to create the user
9. **Important**: Save the Access Key ID and Secret Access Key shown on the final screen

#### Custom IAM Policy (More Secure):
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::sgt-ums",
                "arn:aws:s3:::sgt-ums/*"
            ]
        }
    ]
}
```

## Application Configuration

Update your `.env` file in the `backend` directory with the following:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key-here
S3_BUCKET_NAME=sgt-ums
```

**Security Note**: 
- Never commit your `.env` file to version control
- Keep your AWS credentials secure
- Rotate credentials periodically

## File Structure in S3

Files are organized in the S3 bucket as follows:

```
sgt-ums/
├── research/
│   ├── {userId}/
│   │   └── {timestamp}-{random}-{filename}.pdf
│   └── supporting/
│       └── {userId}/
│           └── {timestamp}-{random}-{filename}.pdf
├── research/grants/
│   └── {userId}/
│       └── {timestamp}-{random}-{filename}.pdf
├── ipr/
│   └── {userId}/
│       └── {timestamp}-{random}-{filename}.pdf
├── ipr/prototypes/
│   └── {userId}/
│       └── {timestamp}-{random}-{filename}.zip
└── documents/
    └── {userId}/
        └── {timestamp}-{random}-{filename}.pdf
```

## API Endpoints

### File Upload
- **POST** `/api/v1/file-upload/upload`
  - Body: `multipart/form-data` with `file` field and optional `folder` field
  - Returns: S3 key, location URL, file metadata

### File Download
- **GET** `/api/v1/file-upload/download/{s3-key-path}`
  - Returns: File stream with appropriate headers

### File Info
- **GET** `/api/v1/file-upload/info/{s3-key-path}`
  - Returns: File metadata (size, type, last modified)

### File Delete
- **DELETE** `/api/v1/file-upload/file`
  - Body: `{ "filePath": "s3-key-path" }`
  - Returns: Success message

## Migration from Local Storage

If you're migrating from local storage to S3:

1. **Backup existing files**: Copy all files from `backend/uploads/` directory
2. **Upload to S3**: Use AWS CLI or S3 console to upload existing files
3. **Update database**: Update file paths in database from local paths to S3 keys
4. **Test thoroughly**: Verify file uploads and downloads work correctly

### AWS CLI Upload Example:
```bash
# Install AWS CLI first
aws configure  # Enter your credentials

# Upload files maintaining structure
aws s3 sync ./backend/uploads/ s3://sgt-ums/ --exclude "*" --include "*.pdf" --include "*.zip" --include "*.doc*"
```

## Testing

1. Start the backend server: `npm run dev`
2. Test file upload via API or frontend
3. Verify files appear in S3 bucket
4. Test file download
5. Check S3 console for uploaded files

## Troubleshooting

### Connection Issues
- Verify AWS credentials are correct
- Check IAM user has necessary S3 permissions
- Ensure bucket name matches configuration
- Check region setting matches bucket region

### Upload Failures
- Check file size limits (10MB default, 50MB for prototypes)
- Verify file type is allowed
- Check S3 bucket storage quota
- Review AWS IAM permissions

### Download Issues
- Verify S3 key exists in database
- Check file exists in S3 bucket
- Ensure proper permissions for GetObject

## Cost Considerations

- **Storage**: S3 Standard storage pricing applies
- **Requests**: PUT, GET, DELETE requests are billed
- **Data Transfer**: Outbound data transfer may incur costs
- **Monitoring**: Use AWS Cost Explorer to monitor S3 costs

For estimated costs, visit: [AWS S3 Pricing Calculator](https://calculator.aws/)

## Security Best Practices

1. **Encryption**: Files are encrypted at rest using AES256
2. **Credentials**: Store AWS credentials in environment variables only
3. **Access Control**: Use IAM policies to limit S3 access
4. **Bucket Policy**: Restrict public access to the bucket
5. **HTTPS**: All S3 API calls use HTTPS
6. **Audit**: Enable S3 access logging for security audits

## Support

For issues or questions:
1. Check AWS CloudWatch logs
2. Review application logs
3. Verify AWS Service Health Dashboard
4. Contact AWS Support if needed
