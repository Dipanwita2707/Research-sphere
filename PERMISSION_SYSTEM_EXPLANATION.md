# Permission System - Complete Implementation Guide

## 📋 Overview

Pehle aapka system **3-layer hybrid architecture** use kar raha tha:
1. **Simple Role Checks** - Basic role-based (ADMIN, FACULTY, STUDENT)
2. **Department-Scoped Permissions** - centralDeptPermissions/schoolDeptPermissions JSON fields
3. **Context-Aware RBAC** - DSW module ka hardcoded role arrays

**Problem**: DSW, Noting, Events modules ke permissions hardcoded the aur admin UI se manage nahi ho paate the.

**Solution**: Sabhi modules ke permissions ko **centralized permission system** me migrate kiya gaya taaki admin `/admin/roles` page se sab manage kar sake.

---

## 🗂️ Modified Files Summary

| File | Purpose | Changes |
|------|---------|---------|
| `permissions.config.js` | Central permission registry | DSW, Noting, Events permissions added |
| `auth.js` | Authentication middleware | 6 new middleware functions added |
| `rbac.js` (DSW) | DSW authorization | Migrated to centralized hasPermission() |
| `noting.routes.js` | Noting API routes | Permission middleware added |
| `event.routes.js` | Event API routes | Permission middleware added |
| `designation.controller.js` | Role templates | DSW, Noting, Events categories added |
| `constants/index.js` (DSW) | DSW constants | Marked as deprecated |
| `permissionDefinitions.js` | UI permission definitions | DSW, Noting, Events for admin UI |

---

## 📁 File-wise Detailed Explanation

### 1. `backend/src/shared/config/permissions.config.js`

**Location**: `backend/src/shared/config/permissions.config.js`

**Purpose**: Ye file **central registry** hai jahan sabhi modules ke permissions define hote hain.

**Changes Made**:

```javascript
// DSW Module Permissions (9 permissions)
const DSW_PERMISSIONS = {
  VIEW_CLUBS: 'dsw_view_clubs',           // Sabhi clubs dekh sakta hai
  CREATE_CLUB: 'dsw_create_club',         // Naya club bana sakta hai
  EDIT_CLUB: 'dsw_edit_club',             // Club edit kar sakta hai
  DELETE_CLUB: 'dsw_delete_club',         // Club delete kar sakta hai
  MANAGE_MEMBERS: 'dsw_manage_members',   // Members add/remove kar sakta hai
  APPROVE_CLUB: 'dsw_approve_club',       // Club creation approve kar sakta hai
  CREATE_NOTING: 'dsw_create_noting',     // Noting workflow start kar sakta hai
  APPROVE_NOTING: 'dsw_approve_noting',   // Noting approve/forward kar sakta hai
  ADMIN: 'dsw_admin',                     // Full DSW admin access
};

// Noting Module Permissions (8 permissions)
const NOTING_PERMISSIONS = {
  CREATE: 'noting_create',           // Naya noting bana sakta hai
  VIEW_OWN: 'noting_view_own',       // Apne notings dekh sakta hai
  VIEW_PENDING: 'noting_view_pending', // Pending notings dekh sakta hai
  VIEW_ALL: 'noting_view_all',       // Sabhi notings dekh sakta hai
  APPROVE: 'noting_approve',         // Noting approve kar sakta hai
  FORWARD: 'noting_forward',         // Agle approver ko forward kar sakta hai
  REJECT: 'noting_reject',           // Noting reject kar sakta hai
  ADMIN: 'noting_admin',             // Full noting admin access
};

// Event Module Permissions (9 permissions)
const EVENT_PERMISSIONS = {
  CREATE: 'event_create',                    // Event bana sakta hai
  EDIT_OWN: 'event_edit_own',               // Apne events edit kar sakta hai
  EDIT_ALL: 'event_edit_all',               // Koi bhi event edit kar sakta hai
  DELETE: 'event_delete',                    // Event delete kar sakta hai
  VIEW_ALL: 'event_view_all',               // Sabhi events (drafts bhi) dekh sakta hai
  APPROVE: 'event_approve',                  // Event approve kar sakta hai
  PUBLISH: 'event_publish',                  // Event publish kar sakta hai
  MANAGE_REGISTRATIONS: 'event_manage_registrations', // Registrations manage kar sakta hai
  ADMIN: 'event_admin',                      // Full event admin access
};
```

**Key Functions Added**:
- `hasPermission(user, permissionKey)` - Check karta hai user ke paas permission hai ya nahi
- `hasAnyPermission(user, permissionKeys)` - Multiple permissions me se koi ek check karta hai
- `getDefaultPermissions(role, departmentType)` - Role ke basis par default permissions deta hai
- `getPermissionsForUI()` - Admin UI ke liye formatted permissions

**Total Permissions**: 43 (26 existing + 9 DSW + 8 Noting + 9 Events)

---

### 2. `backend/src/shared/middleware/auth.js`

**Location**: `backend/src/shared/middleware/auth.js`

**Purpose**: Authentication aur authorization middleware jo sabhi routes protect karta hai.

**New Middleware Functions Added**:

```javascript
// 1. Generic Permission Check
const checkPermission = (permissionKey) => {
  return (req, res, next) => {
    // User ke permissions check karta hai
    // 403 return karta hai agar permission nahi hai
  };
};

// 2. Multiple Permissions me se koi ek
const checkAnyPermission = (permissionKeys) => {
  return (req, res, next) => {
    // Agar koi ek permission hai to allow
  };
};

// 3. DSW Module ke liye
const requireDSWPermission = (permission) => {
  // DSW specific permission check
};

// 4. Noting Module ke liye
const requireNotingPermission = (permission) => {
  // Noting specific permission check
};

// 5. Event Module ke liye
const requireEventPermission = (permission) => {
  // Event specific permission check
};

// 6. Ownership ya Permission check
const requireOwnershipOrPermission = (ownerField, permission) => {
  // Ya to owner ho ya permission ho
};
```

**Usage Example**:
```javascript
// Route protection
router.post('/clubs', authenticate, checkPermission('dsw_create_club'), createClub);
router.get('/events', authenticate, checkAnyPermission(['event_view_all', 'event_admin']), getEvents);
```

---

### 3. `backend/src/modules/dsw/middleware/rbac.js`

**Location**: `backend/src/modules/dsw/middleware/rbac.js`

**Purpose**: DSW module ka Role-Based Access Control middleware.

**Before (Hardcoded)**:
```javascript
// Purana code - hardcoded roles
const CLUB_MANAGEMENT_ROLES = ['ADMIN', 'STAFF', 'DSW_HEAD', 'DSW_OFFICER'];
const NOTING_ROLES = ['ADMIN', 'DSW_HEAD', 'HOD', 'DEAN', 'REGISTRAR', 'VICE_CHANCELLOR'];

canCreateClubNoting: (req, res, next) => {
  if (!NOTING_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}
```

**After (Centralized)**:
```javascript
// Naya code - centralized permission system use karta hai
const { hasPermission, DSW_PERMISSIONS } = require('../../../shared/config/permissions.config');

canCreateClubNoting: (req, res, next) => {
  // Pehle explicit permission check
  if (hasPermission(req.user, DSW_PERMISSIONS.CREATE_NOTING)) {
    return next();
  }
  // Backward compatibility ke liye role-based fallback
  const authorizedRoles = ['ADMIN', 'DSW_HEAD', 'HOD', 'DEAN', 'REGISTRAR', 'VICE_CHANCELLOR'];
  if (authorizedRoles.includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied' });
}
```

**Key Change**: Ab permissions database se aati hain, admin UI se manage ho sakti hain.

---

### 4. `backend/src/modules/noting/routes/noting.routes.js`

**Location**: `backend/src/modules/noting/routes/noting.routes.js`

**Purpose**: Noting module ke API routes.

**Changes Made**:

```javascript
const { checkPermission, checkAnyPermission } = require('../../../shared/middleware/auth');

// Create noting - permission required
router.post('/', authenticate, checkPermission('noting_create'), createNoting);

// View all notings - admin permission required
router.get('/all', authenticate, checkPermission('noting_view_all'), getAllNotings);

// Approve noting
router.post('/:id/approve', authenticate, checkPermission('noting_approve'), approveNoting);

// Forward noting
router.post('/:id/forward', authenticate, checkPermission('noting_forward'), forwardNoting);

// Reject noting
router.post('/:id/reject', authenticate, checkPermission('noting_reject'), rejectNoting);
```

**Important**: Pehle students noting routes se completely blocked the. Ab permission-based hai - agar admin student ko `noting_create` permission de de to woh bhi noting bana sakta hai.

---

### 5. `backend/src/modules/events/routes/event.routes.js`

**Location**: `backend/src/modules/events/routes/event.routes.js`

**Purpose**: Event module ke API routes.

**Changes Made**:

```javascript
const { checkPermission, checkAnyPermission } = require('../../../shared/middleware/auth');

// Create event
router.post('/', authenticate, checkPermission('event_create'), createEvent);

// Edit any event
router.put('/:id', authenticate, checkAnyPermission(['event_edit_all', 'event_admin']), updateEvent);

// Delete event
router.delete('/:id', authenticate, checkPermission('event_delete'), deleteEvent);

// Approve event
router.post('/:id/approve', authenticate, checkPermission('event_approve'), approveEvent);

// Publish event
router.post('/:id/publish', authenticate, checkPermission('event_publish'), publishEvent);

// Manage registrations
router.get('/:id/registrations', authenticate, checkPermission('event_manage_registrations'), getRegistrations);
```

---

### 6. `backend/src/modules/core/controllers/designation.controller.js`

**Location**: `backend/src/modules/core/controllers/designation.controller.js`

**Purpose**: Designation templates manage karta hai jo admin UI me show hote hain.

**Changes Made**:

**A. New Permission Categories Added**:
```javascript
const PERMISSION_CATEGORIES = {
  // Existing categories...
  'HR': { /* ... */ },
  'ERP': { /* ... */ },
  'DRD': { /* ... */ },
  
  // NEW CATEGORIES ADDED
  'DSW': {
    name: 'DSW Permissions',
    description: 'Dean Student Welfare - Club and Student Activities',
    permissions: [
      'dsw_view_clubs', 'dsw_create_club', 'dsw_edit_club', 'dsw_delete_club',
      'dsw_manage_members', 'dsw_approve_club', 'dsw_create_noting', 
      'dsw_approve_noting', 'dsw_admin'
    ]
  },
  'Noting': {
    name: 'Noting Permissions',
    description: 'Document Approval Workflow System',
    permissions: [
      'noting_create', 'noting_view_own', 'noting_view_pending', 'noting_view_all',
      'noting_approve', 'noting_forward', 'noting_reject', 'noting_admin'
    ]
  },
  'Events': {
    name: 'Event Permissions',
    description: 'University Event Management System',
    permissions: [
      'event_create', 'event_edit_own', 'event_edit_all', 'event_delete',
      'event_view_all', 'event_approve', 'event_publish', 
      'event_manage_registrations', 'event_admin'
    ]
  }
};
```

**B. New Designation Templates Added**:
```javascript
// DSW Officer Template
{
  name: 'DSW Officer',
  code: 'DSW_OFFICER',
  description: 'Dean Student Welfare Office Staff',
  permissions: {
    dsw_view_clubs: true,
    dsw_create_club: true,
    dsw_edit_club: true,
    dsw_manage_members: true,
    dsw_create_noting: true,
    noting_create: true,
    noting_view_pending: true,
    noting_forward: true,
    event_create: true,
    event_edit_own: true,
  }
}

// DSW Assistant Template
{
  name: 'DSW Assistant',
  code: 'DSW_ASSISTANT',
  description: 'DSW Office Assistant',
  permissions: {
    dsw_view_clubs: true,
    dsw_manage_members: true,
    noting_view_own: true,
    noting_view_pending: true,
    event_create: true,
  }
}

// Faculty Facilitator Template
{
  name: 'Faculty Facilitator',
  code: 'FACULTY_FACILITATOR', 
  description: 'Faculty Club/Event Facilitator',
  permissions: {
    dsw_view_clubs: true,
    dsw_create_noting: true,
    noting_create: true,
    noting_view_own: true,
    event_create: true,
    event_edit_own: true,
  }
}
```

---

### 7. `backend/src/modules/dsw/constants/index.js`

**Location**: `backend/src/modules/dsw/constants/index.js`

**Purpose**: DSW module ke purane constants.

**Changes Made**: Deprecated mark kiya with migration guide:

```javascript
/**
 * @deprecated Use centralized permissions from permissions.config.js instead
 * 
 * MIGRATION GUIDE:
 * ================
 * Old: const { DSWPermissions } = require('./constants');
 *      if (DSWPermissions.CLUB_MANAGEMENT.includes(user.role)) { ... }
 * 
 * New: const { hasPermission, DSW_PERMISSIONS } = require('../../../shared/config/permissions.config');
 *      if (hasPermission(user, DSW_PERMISSIONS.VIEW_CLUBS)) { ... }
 * 
 * This file is kept for backward compatibility.
 * All new code should use permissions.config.js
 */
const DSWPermissions = {
  // Legacy role arrays - DO NOT USE IN NEW CODE
  CLUB_MANAGEMENT: ['ADMIN', 'STAFF', 'DSW_HEAD', 'DSW_OFFICER'],
  // ...
};
```

---

### 8. `backend/src/modules/core/config/permissionDefinitions.js`

**Location**: `backend/src/modules/core/config/permissionDefinitions.js`

**Purpose**: Admin UI (`/admin/roles`) ko permissions provide karta hai.

**Changes Made**: Added DSW, Noting, Events sections:

```javascript
const CENTRAL_DEPARTMENT_PERMISSIONS = {
  // Existing departments...
  hr: [...],
  erp: [...],
  drd: [...],
  finance: [...],
  
  // NEW DEPARTMENTS ADDED
  
  // DSW - Dean Student Welfare
  dsw: [
    { key: 'dsw_view_clubs', label: 'View All Clubs', category: 'Club Management' },
    { key: 'dsw_create_club', label: 'Create Club', category: 'Club Management' },
    { key: 'dsw_edit_club', label: 'Edit Club', category: 'Club Management' },
    { key: 'dsw_delete_club', label: 'Delete Club', category: 'Club Management' },
    { key: 'dsw_manage_members', label: 'Manage Club Members', category: 'Club Management' },
    { key: 'dsw_approve_club', label: 'Approve Club Creation', category: 'Club Approval' },
    { key: 'dsw_create_noting', label: 'Create Club Noting', category: 'Noting Flow' },
    { key: 'dsw_approve_noting', label: 'Approve/Forward Noting', category: 'Noting Flow' },
    { key: 'dsw_admin', label: 'DSW Administration', category: 'Administration' },
  ],
  
  // Noting System
  noting: [
    { key: 'noting_create', label: 'Create Noting', category: 'Core Actions' },
    { key: 'noting_view_own', label: 'View Own Notings', category: 'Core Actions' },
    { key: 'noting_view_pending', label: 'View Pending Notings', category: 'Core Actions' },
    { key: 'noting_view_all', label: 'View All Notings', category: 'Core Actions' },
    { key: 'noting_approve', label: 'Approve Noting', category: 'Approval Actions' },
    { key: 'noting_forward', label: 'Forward Noting', category: 'Approval Actions' },
    { key: 'noting_reject', label: 'Reject Noting', category: 'Approval Actions' },
    { key: 'noting_admin', label: 'Noting Administration', category: 'Administration' },
  ],
  
  // Events
  events: [
    { key: 'event_create', label: 'Create Events', category: 'Event Management' },
    { key: 'event_edit_own', label: 'Edit Own Events', category: 'Event Management' },
    { key: 'event_edit_all', label: 'Edit All Events', category: 'Event Management' },
    { key: 'event_delete', label: 'Delete Events', category: 'Event Management' },
    { key: 'event_view_all', label: 'View All Events', category: 'Event Management' },
    { key: 'event_approve', label: 'Approve Events', category: 'Event Approval' },
    { key: 'event_publish', label: 'Publish Events', category: 'Event Approval' },
    { key: 'event_manage_registrations', label: 'Manage Registrations', category: 'Registrations' },
    { key: 'event_admin', label: 'Event Administration', category: 'Administration' },
  ],
};
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN UI                                  │
│                   /admin/roles page                              │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │    DSW      │    │   Noting    │    │   Events    │          │
│  │ Permissions │    │ Permissions │    │ Permissions │          │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              GET /api/v1/roles/definitions/all                   │
│                                                                  │
│         roleManagement.controller.js                             │
│              ↓                                                   │
│         permissionDefinitions.js                                 │
│         (CENTRAL_DEPARTMENT_PERMISSIONS)                         │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE                                      │
│                                                                  │
│  User Table                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ centralDeptPermissions: {                                   │ │
│  │   "dsw_view_clubs": true,                                   │ │
│  │   "dsw_create_club": true,                                  │ │
│  │   "noting_create": true,                                    │ │
│  │   "event_admin": true                                       │ │
│  │ }                                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE                                    │
│                                                                  │
│  auth.js → checkPermission('dsw_create_club')                   │
│         → hasPermission(user, permissionKey)                    │
│         → Check user.centralDeptPermissions[key]                │
│         → Allow/Deny                                            │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ROUTE HANDLERS                                │
│                                                                  │
│  DSW Routes      Noting Routes      Event Routes                │
│  /clubs/*        /notings/*         /events/*                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 How to Use New Permissions

### Admin UI se Permission Assign karna:

1. Go to `/admin/roles`
2. Click "Create Role Template" ya existing role edit karo
3. Scroll down to find:
   - **DSW** section - Club management permissions
   - **Noting** section - Document workflow permissions  
   - **Events** section - Event management permissions
4. Check boxes for required permissions
5. Save role template
6. Assign role template to users

### Code me Permission Check karna:

```javascript
// Method 1: Middleware (Route level)
const { checkPermission } = require('../../../shared/middleware/auth');
router.post('/clubs', authenticate, checkPermission('dsw_create_club'), createClub);

// Method 2: Direct check (Controller level)
const { hasPermission, DSW_PERMISSIONS } = require('../../../shared/config/permissions.config');

async function createClub(req, res) {
  if (!hasPermission(req.user, DSW_PERMISSIONS.CREATE_CLUB)) {
    return res.status(403).json({ message: 'Permission denied' });
  }
  // Create club logic...
}

// Method 3: Any of multiple permissions
const { checkAnyPermission } = require('../../../shared/middleware/auth');
router.get('/clubs', authenticate, checkAnyPermission(['dsw_view_clubs', 'dsw_admin']), getClubs);
```

---

## 📊 Permission Matrix

| Permission Key | Who Gets by Default | Can be Assigned To |
|---------------|--------------------|--------------------|
| `dsw_view_clubs` | DSW Staff | Anyone |
| `dsw_create_club` | Faculty, DSW Staff | Faculty, Staff |
| `dsw_approve_club` | DSW Head, Admin | DSW Officers |
| `dsw_admin` | Admin only | Trusted Staff |
| `noting_create` | Faculty, Staff | Anyone |
| `noting_approve` | Senior roles | HODs, Deans |
| `noting_admin` | Admin only | Registrar office |
| `event_create` | Faculty, Club members | Anyone |
| `event_approve` | DSW, Admin | Event coordinators |
| `event_admin` | Admin only | Event managers |

---

## ✅ Benefits of New System

1. **Centralized Management** - Sabhi permissions ek jagah se manage
2. **UI-Based Control** - Admin techie hone ki zaroorat nahi
3. **Granular Access** - Module level nahi, action level permissions
4. **Audit Trail** - Kon permission kab diya track ho sakta hai
5. **Flexibility** - Naye permissions add karna easy
6. **Backward Compatible** - Purana code bhi kaam karega

---

## 🚨 Important Notes

1. **Restart Required**: Backend changes ke baad server restart karo
2. **Cache Clear**: Browser cache clear karo agar UI me changes na dikhe
3. **Existing Users**: Existing users ko manually permissions assign karni padegi
4. **Role Fallback**: Kuch functions me role-based fallback hai for backward compatibility

---

## 📁 Quick Reference - File Locations

```
backend/
├── src/
│   ├── shared/
│   │   ├── config/
│   │   │   └── permissions.config.js    ← Central permission registry
│   │   └── middleware/
│   │       └── auth.js                  ← Permission middleware
│   └── modules/
│       ├── core/
│       │   ├── config/
│       │   │   └── permissionDefinitions.js  ← UI permission definitions
│       │   └── controllers/
│       │       └── designation.controller.js ← Role templates
│       ├── dsw/
│       │   ├── middleware/
│       │   │   └── rbac.js              ← DSW authorization (migrated)
│       │   └── constants/
│       │       └── index.js             ← Deprecated DSW constants
│       ├── noting/
│       │   └── routes/
│       │       └── noting.routes.js     ← Noting route permissions
│       └── events/
│           └── routes/
│               └── event.routes.js      ← Event route permissions
```

---

*Document Created: February 11, 2026*
*Last Updated: February 11, 2026*
