# Profile Photo Upload Implementation

## Overview
Complete implementation of profile photo upload functionality with admin permission control. Admins can decide which users have permission to upload profile photos, and users can only upload if they have the necessary permissions.

## Features

### 1. **Permission-Based Upload**
- Admin can control who can upload profile photos via group permissions
- Permission check happens on both frontend and backend
- Users see clear messages when they don't have permission

### 2. **Admin Control**
- Set permissions at group level in "Create Group" modal
- Modify permissions in "Group Settings" for existing groups
- Set individual member permissions in "Member Permissions" modal
- Permission: `canUploadProfilePhoto`

### 3. **User Experience**
- Upload profile photos from Settings → Profile tab
- Preview photo before upload
- Delete existing photos
- Clear error messages and success feedback
- Automatic permission checking

## Implementation Files

### Backend Files

#### 1. **Middleware** - `backend/src/modules/auth/middleware/profilePhoto.middleware.js`
- Checks if user has permission to upload profile photos
- Queries user's groups and checks permissions
- Admins/Owners always have permission
- Users need permission in at least one group

#### 2. **Controller** - `backend/src/modules/auth/controllers/auth.controller.js`
Added two new functions:
- `uploadProfilePhoto`: Handles photo upload with validation
- `deleteProfilePhoto`: Handles photo deletion

#### 3. **Routes** - `backend/src/modules/auth/routes/auth.routes.js`
Added two new routes:
- `POST /api/auth/profile/photo` - Upload photo (with permission check)
- `DELETE /api/auth/profile/photo` - Delete photo

### Frontend Files

#### 1. **Component** - `frontend/src/shared/components/ProfilePhotoUpload.tsx`
- Complete UI for profile photo management
- Permission checking on mount
- Upload with preview
- Delete functionality
- Error handling and feedback

#### 2.  **Service** - `frontend/src/shared/services/profile.service.ts`
Added two new methods:
- `uploadProfilePhoto(file: File)`: Upload photo to backend
- `deleteProfilePhoto()`: Delete photo from backend

#### 3. **Settings Page** - `frontend/src/app/settings/page.tsx`
- Added "Profile" tab (now first tab)
- Integrated ProfilePhotoUpload component
- User education section

## Permission Flow

### Admin Side
1. **Create Group**:
   - Navigate to Chat → Create Group
   - Go to "3. Permissions" tab
   - Under "Profile & Media" section
   - Toggle "Upload Profile Photo" permission

2. **Group Settings**:
   - Open any group
   - Click Settings icon
   - Go to "Permissions" tab
   - Under "Profile & Media" section
   - Toggle "Upload Profile Photo" permission

3. **Individual Member**:
   - Open group member list
   - Click on a member
   - Go to "Permissions" tab
   - Under "Profile & Media" section
   - Toggle "Upload Profile Photo" permission

### User Side
1. **Access Upload**:
   - Navigate to Settings (gear icon in header)
   - Click "Profile" tab (first tab)
   - See ProfilePhotoUpload component

2. **Check Permission**:
   - Component automatically checks permission on load
   - If no permission: Shows yellow warning message
   - If has permission: Shows upload interface

3. **Upload Photo**:
   - Click "Upload Photo" button
   - Select image file (JPEG, PNG, GIF, WebP)
   - Max size: 5MB
   - Photo automatically uploads and shows preview

4. **Delete Photo**:
   - Click "Delete Photo" button (if photo exists)
   - Confirm deletion
   - Photo removed from profile

## Permission Logic

### Backend Permission Check
```javascript
// User CAN upload if:
1. Not in any group (default: allowed)
2. Admin/Owner in any group (always allowed)
3. Has canUploadProfilePhoto = true in at least one group
```

### Frontend Permission Check
```typescript
// Checks user's groups:
- If no groups: Allowed
- If admin/owner in any group: Allowed
- If canUploadProfilePhoto in any group: Allowed
- Otherwise: Not Allowed (shows warning)
```

## API Endpoints

### Upload Profile Photo
```http
POST /api/auth/profile/photo
Authorization: Required
Content-Type: multipart/form-data

Body:
- photo: File (JPEG, PNG, GIF, WebP, max 5MB)

Response:
{
  "success": true,
  "message": "Profile photo uploaded successfully",
  "data": {
    "profileImage": "filename.jpg",
    "profileImagePath": "/uploads/profiles/filename.jpg",
    "profileImageUrl": "/uploads/profiles/filename.jpg"
  }
}
```

### Delete Profile Photo
```http
DELETE /api/auth/profile/photo
Authorization: Required

Response:
{
  "success": true,
  "message": "Profile photo deleted successfully"
}
```

## File Storage

### Location
```
backend/uploads/profiles/
```

### Filename Format
```
{userId}-{timestamp}-{randomString}.{extension}
Example: uuid-1707123456789-a1b2c3d4e5f6g7h8.jpg
```

### File Serving
Profile photos are served via Express static middleware:
```javascript
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
```

Accessible at: `http://localhost:5000/uploads/profiles/{filename}`

## Validation

### File Type
- Allowed: JPEG, JPG, PNG, GIF, WebP
- Backend validation: Checks MIME type
- Frontend validation: Accept attribute + manual check

### File Size
- Maximum: 5MB
- Backend validation: Multer limit
- Frontend validation: Manual check before upload

## Security

### Permission Enforcement
- **Backend**: Middleware checks permission before processing upload
- **Frontend**: Component checks permission and disables UI
- **Database**: Permissions stored in `chat_group_permission` table

### File Validation
- MIME type checking
- File size limits
- Unique filename generation (prevents overwrites)
- User ID in filename (easy identification)

### Access Control
- Upload requires authentication (`protect` middleware)
- Permission check middleware (`checkProfilePhotoPermission`)
- Fail-safe: On error, allows upload (prevents lockout)

## User Flow Example

### Scenario 1: User with Permission
1. User navigates to Settings → Profile
2. Component checks permissions (user is in group with permission)
3. Upload interface is shown
4. User clicks "Upload Photo"
5. Selects image file
6. Frontend validates file
7. Uploads to backend
8. Backend checks permission
9. Saves file to disk
10. Updates database
11. Returns success
12. Frontend shows preview and success message

### Scenario 2: User without Permission
1. User navigates to Settings → Profile
2. Component checks permissions (no groups have permission)
3. Yellow warning box is shown
4. Message: "You don't have permission to upload a profile photo. Contact your group administrator to request access."
5. Upload button is disabled

### Scenario 3: Admin Grants Permission
1. Admin opens Group Settings
2. Goes to Permissions tab
3. Enables "Upload Profile Photo" under "Profile & Media"
4. Clicks "Save Permissions"
5. User refreshes Settings page
6. Permission check now passes
7. Upload interface is shown

## Testing Checklist

### Backend
- [ ] Upload endpoint accepts valid image files
- [ ] Upload endpoint rejects invalid file types
- [ ] Upload endpoint rejects files over 5MB
- [ ] Upload endpoint checks permissions correctly
- [ ] Delete endpoint removes file and updates database
- [ ] Files are saved to correct directory
- [ ] Filenames are unique and properly formatted

### Frontend
- [ ] Component checks permissions on mount
- [ ] Shows warning when no permission
- [ ] Shows upload interface when has permission
- [ ] File validation works correctly
- [ ] Upload progress is shown
- [ ] Success message appears after upload
- [ ] Preview updates after upload
- [ ] Delete confirmation works
- [ ] Error messages display correctly

### Permissions
- [ ] Users without groups can upload (default)
- [ ] Admins can always upload
- [ ] Permission works at group level
- [ ]  Permission works for individual members
- [ ] Disabling permission blocks upload
- [ ] Enabling permission allows upload

### Integration
- [ ] Settings page shows Profile tab
- [ ] ProfilePhotoUpload component renders
- [ ] Photos display in chat interface
- [ ] Photos display in member lists
- [ ] Photos display in message headers
- [ ] Photos are accessible via URL

## Troubleshooting

### Issue: "You don't have permission to upload"
**Solution**: Ask your group administrator to enable "Upload Profile Photo" in group permissions.

### Issue: Upload fails with 403 error
**Check**:
1. Are you a member of any groups?
2. Do you have `canUploadProfilePhoto` permission in at least one group?
3. Are you trying to upload as a regular member without permission?

### Issue: File not found after upload
**Check**:
1. Is `backend/uploads/profiles/` directory writable?
2. Is Express static middleware configured?
3. Is the file path correct in database?

### Issue: Permission check takes too long
**Reason**: Checking multiple groups and permissions
**Solution**: This is cached on backend, should be fast after first check

## Future Enhancements

### Recommended Improvements
1. **Image Optimization**:
   - Resize images on upload
   - Generate thumbnails
   - Optimize file size

2. **Cloud Storage**:
   - Upload to S3/Azure/Cloudinary
   - CDN for faster delivery
   - Better scalability

3. **Image Editing**:
   - Crop/rotate before upload
   - Filters and adjustments
   - Preview editing

4. **Privacy Controls**:
   - Who can see profile photo
   - Hide from certain users
   - Public/Private toggle

5. **Admin Dashboard**:
   - View all user photos
   - Moderate inappropriate images
   - Bulk permission management

## Notes

- Profile photo permission integrates with existing chat group permission system
- Uses the same permission checking logic as other chat features
- Fail-safe: If permission check fails, defaults to allowing upload
- All uploaded photos are stored locally (can be migrated to cloud storage)
- Filenames include user ID for easy identification and cleanup

## Support

For issues or questions:
1. Check backend console for error details
2. Check browser console for frontend errors  
3. Verify permissions in Group Settings
4. Check file permissions on uploads directory
5. Verify database schema includes new permission fields
