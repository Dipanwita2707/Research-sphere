# Chat Permissions Update - February 12, 2026

## Overview
This document outlines the new chat permissions that have been added to the group chat system, along with the bug fix for date display.

## Bug Fixes

### 1. Date Display Issue
**Problem**: Messages were showing incorrect dates (e.g., "Friday, Oct 2" instead of "Yesterday")

**Solution**: Fixed the date grouping logic in `MessageList.tsx` to use `toDateString()` consistently instead of `toLocaleDateString()`, which was causing locale-dependent parsing issues.

**Changed Files**:
- `frontend/src/features/chat/components/MessageList.tsx`

## New Permissions

### 1. Profile & Media Permissions
- **canUploadProfilePhoto**: Allow members to upload their profile photo

### 2. Privacy Permissions
- **canSetLastSeen**: Control last seen visibility
- **canSetOnlineStatus**: Control online status visibility
- **canSetProfilePrivacy**: Control who can see profile picture
- **canSetAboutPrivacy**: Control who can see about information
- **canSetStatusPrivacy**: Control who can see status updates
- **canSetReadReceipts**: Toggle read receipts on/off
- **canSetMessageTimer**: Set disappearing message timers
- **canSetGroupsPrivacy**: Control who can add user to groups
- **canBlockContacts**: Block other users from contacting them

### 3. Customization Permissions
- **canChangeTheme**: Customize chat theme
- **canChangeWallpaper**: Set custom chat wallpaper

### 4. Notification Permissions
- **canToggleNotifications**: Turn notifications on/off for the group

## Implementation Details

### Database Schema Changes
Added 13 new columns to the `chat_group_permission` table:
- `can_upload_profile_photo`
- `can_set_last_seen`
- `can_set_online_status`
- `can_set_profile_privacy`
- `can_set_about_privacy`
- `can_set_status_privacy`
- `can_set_read_receipts`
- `can_set_message_timer`
- `can_set_groups_privacy`
- `can_block_contacts`
- `can_change_theme`<br>`can_change_wallpaper`
- `can_toggle_notifications`

All new permissions default to `true` for maximum flexibility.

### Backend Changes
**File**: `backend/src/modules/chat/utils/permissions.js`
- Updated `DEFAULT_PERMISSIONS` object to include all new permissions

### Frontend Changes

#### 1. Type Definitions
**File**: `frontend/src/features/chat/types/index.ts`
- Updated `ChatGroupPermission` interface
- Updated `EffectivePermissions` interface
- Updated `GroupPermissions` interface

#### 2. Create Group Modal
**File**: `frontend/src/features/chat/components/CreateGroupModal.tsx`
- Added new permission groups:
  - Profile & Media
  - Privacy Settings (9 options)
  - Customization (2 options)
  - Notifications (1 option)
- Updated default permissions to include all new fields

#### 3. Group Settings
**File**: `frontend/src/features/chat/components/GroupSettings.tsx`
- Added organized sections for new permissions:
  - Profile & Media section
  - Privacy Settings section
  - Customization section
  - Notifications section
- Each permission includes a toggle switch and description

## Migration Instructions

### Step 1: Run Prisma Migration
```bash
cd backend
npx prisma migrate dev --name add-new-chat-permissions
```

Or manually run the migration:
```bash
psql -U your_user -d your_database -f backend/prisma/manual-migrations/add-new-chat-permissions.sql
```

### Step 2: Restart Backend Server
```bash
cd backend
npm run dev
# or
npm start
```

### Step 3: Clear Cache (if using Redis)
The permission system uses caching. Clear the cache to ensure new permissions are picked up:
```bash
redis-cli FLUSHDB
```

Or programmatically:
```javascript
const redis = require('./backend/src/shared/config/redis');
redis.flushdb();
```

### Step 4: Test the Changes
1. Navigate to the chat section
2. Create a new group and check the "3. Permissions" tab
3. Verify all new permission sections are visible:
   - Profile & Media
   - Privacy Settings
   - Customization
   - Notifications
4. Create a group and verify permissions are saved correctly
5. Go to an existing group's settings
6. Verify you can modify the new permissions
7. Test that yesterday's messages show "Yesterday" instead of the date

## Permission Logic

### Default Behavior
- All new permissions are enabled by default (`true`)
- Admins and owners always have all permissions
- Regular members' permissions are controlled by group settings
- Individual member permissions can override group defaults

### Permission Hierarchy
1. **Owner/Admin**: All permissions enabled (bypasses group settings)
2. **Moderator**: Specific permissions based on role
3. **Member**: Group default permissions apply
4. **Custom Override**: Individual permissions can override group defaults

## Testing Checklist

- [ ] Date display shows "Today" for today's messages
- [ ] Date display shows "Yesterday" for yesterday's messages
- [ ] Create new group shows all new permission categories
- [ ] Group settings shows all new permission toggles
- [ ] Permissions are saved correctly to database
- [ ] Existing groups retain their old permissions
- [ ] New permissions default to `true` for new groups
- [ ] Admin/Owner can modify all permissions
- [ ] Member permissions are correctly enforced

## API Endpoints (No Changes Required)

The existing endpoints already support custom permissions:
- `PUT /api/chat/groups/:id/permissions` - Update group permissions
- `PUT /api/chat/groups/:id/members/:userId/permissions` - Update member permissions
- `GET /api/chat/groups/:id` - Get group with permissions

## Future Enhancements

### Recommended Next Steps
1. **Implement Permission Enforcement**:
   - Add client-side checks for profile photo upload
   - Implement privacy setting controls
   - Add theme customization UI
   - Create wallpaper picker component
   - Build notification preference UI

2. **User Settings Interface**:
   - Create a user settings page for privacy controls
   - Add profile photo upload functionality
   - Implement theme switcher
   - Build wallpaper gallery

3. **Backend Enforcement**:
   - Add permission checks in relevant API endpoints
   - Implement privacy filters for profile data
   - Add notification preference handling

## Notes

- All permissions are **opt-in** by default (enabled)
- Admins can restrict permissions by toggling them off
- The permission system is flexible and extensible
- Cache invalidation happens automatically when permissions change
- Existing groups will have all new permissions enabled automatically

## Support

For issues or questions:
1. Check the console for error messages
2. Verify database migration was successful
3. Ensure Redis cache is cleared
4. Check that Prisma types are regenerated: `npx prisma generate`

## Rollback Instructions

If you need to rollback these changes:

```sql
-- Remove new columns
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_upload_profile_photo;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_set_last_seen;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_set_online_status;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_set_profile_privacy;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_set_about_privacy;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_set_status_privacy;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_set_read_receipts;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_set_message_timer;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_set_groups_privacy;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_block_contacts;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_change_theme;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_change_wallpaper;
ALTER TABLE chat_group_permission DROP COLUMN IF EXISTS can_toggle_notifications;
```

Then revert the code changes using git:
```bash
git checkout HEAD~1 -- backend/src/modules/chat/utils/permissions.js
git checkout HEAD~1 -- frontend/src/features/chat/types/index.ts
git checkout HEAD~1 -- frontend/src/features/chat/components/CreateGroupModal.tsx
git checkout HEAD~1 -- frontend/src/features/chat/components/GroupSettings.tsx
git checkout HEAD~1 -- backend/prisma/schema.prisma
```
