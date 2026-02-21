# 🛡️ Gate Entry Permission Setup Guide - Role Management UI

## ✅ Implementation Complete!

**Gate Entry permissions ab Role Management UI me available hain!**

---

## 📍 Kaha Hai Permission Management UI?

### Step 1: Navigate to Permission Management

**URL Path:**
```
http://localhost:3000/admin/roles
```

**Or Navigation:**
```
Dashboard → 🛡️ User & Role Management
```

---

## 🔧 Gate Entry Permissions Kaise Assign Karein

### Method 1: Individual User Ko Permissions Do

#### Step 1: Department Select Karo
```
1. Department Type: Select "Central Departments"
2. Select Department: "Gate Entry" (dropdown se select karo)
```

#### Step 2: User Select Karo
```
User list me se user select karo (jo Gate Entry access chahiye)
Click "Assign Permissions" button
```

#### Step 3: Permission Modal Me Configure Karo
```
✅ Gate Entry permission categories dikhenge:
   📁 Pass Management
      ✓ gate_entry.create - Create Gate Pass (All roles)
      ✓ gate_entry.view_all - View All Passes (Admin/Guard only)
      ✓ gate_entry.view_own - View Own Passes (Faculty/Student)
   
   📁 Verification  
      ✓ gate_entry.verify - Verify Passes (Admin/Guard only)
   
   📁 Pass Actions
      ✓ gate_entry.cancel - Cancel Pass (Context-dependent)
      ✓ gate_entry.extend - Extend Pass (Creator/Admin only)
   
   📁 Analytics
      ✓ gate_entry.analytics - View Analytics (Admin only)
   
   📁 Administration
      ✓ gate_entry.admin - Full Administration (Superadmin)
```

#### Step 4: Save Permissions
```
Click "Save Permissions" button
```

---

### Method 2: Role Template Se Assign Karo (Recommended)

#### Pre-defined Role Templates (Recommended):

**🔴 Admin Template:**
```
All Gate Entry permissions:
✅ gate_entry.create
✅ gate_entry.view_all
✅ gate_entry.verify
✅ gate_entry.cancel
✅ gate_entry.extend
✅ gate_entry.analytics
✅ gate_entry.admin (if superadmin)
```

**🟢 Guard Template (Staff Role):**
```
Guard-specific permissions:
✅ gate_entry.create
✅ gate_entry.view_all
✅ gate_entry.verify
✅ gate_entry.cancel (context-dependent)
❌ gate_entry.extend (BLOCKED)
❌ gate_entry.analytics (BLOCKED)
```

**🔵 Faculty Template:**
```
Faculty permissions:
✅ gate_entry.create
✅ gate_entry.view_own
✅ gate_entry.cancel (own passes)
✅ gate_entry.extend (own passes)
❌ gate_entry.verify (BLOCKED)
❌ gate_entry.analytics (BLOCKED)
```

**🟡 Student Template:**
```
Same as Faculty (identical permissions)
```

---

## 📊 Available Gate Entry Permissions (Complete List)

### 1. **gate_entry.create** - Create Gate Pass
```
Description: Can create visitor gate passes
Roles: Admin, Superadmin, Staff (Guard), Faculty, Student
Category: Pass Management
UI Impact: Shows "Create New Pass" button
```

### 2. **gate_entry.view_all** - View All Passes
```
Description: Can view all gate passes in the system
Roles: Admin, Superadmin, Staff (Guard) only
Category: Pass Management
UI Impact: 
  - Header shows "Admin View" or "Guard View"
  - Stats show ALL passes count (e.g., 120)
  - Pass list shows everyone's passes
```

### 3. **gate_entry.view_own** - View Own Passes
```
Description: Can view only own created passes
Roles: Faculty, Student
Category: Pass Management
UI Impact:
  - Header shows "My Passes"
  - Stats show ONLY own passes (e.g., 5)
  - Pass list shows only self-created passes
```

### 4. **gate_entry.verify** - Verify Passes (Check-in/Check-out)
```
Description: Can scan QR codes and verify visitor entry/exit
Roles: Admin, Superadmin, Staff (Guard) only
Category: Verification
UI Impact: Shows "Verify" button, QR scanner access
Endpoints: 
  - POST /gate-entry/verify
  - POST /gate-entry/allow-entry
  - POST /gate-entry/deny-entry
  - POST /gate-entry/record-exit
```

### 5. **gate_entry.cancel** - Cancel Pass
```
Description: Cancel gate passes (context-dependent rules)
Rules:
  - Before check-in: Creator OR Admin only
  - After check-in: Creator OR Admin OR Guard
Roles: All (context-dependent)
Category: Pass Actions
UI Impact: Shows/hides "Cancel" button based on pass status
```

### 6. **gate_entry.extend** - Extend Pass Duration
```
Description: Extend pass validity time
Rules: Creator OR Admin only (Guards CANNOT extend)
Roles: Admin, Superadmin, Faculty, Student
Category: Pass Actions
UI Impact: Shows/hides "Extend Pass" button
Key Restriction: ❌ Guards do NOT have this permission
```

### 7. **gate_entry.analytics** - View Analytics Dashboard
```
Description: Access gate entry statistics and reports
Roles: Admin, Superadmin only
Category: Analytics
UI Impact: Shows analytics page, statistics
Endpoint: GET /gate-entry/stats
```

### 8. **gate_entry.admin** - Gate Entry Administration
```
Description: Full administrative access to gate entry system
Roles: Superadmin only
Category: Administration
UI Impact: All admin features unlocked
```

---

## 🎯 Quick Setup for Different Roles

### Setup for Admin:
```
1. Go to /admin/roles
2. Select: Central Departments → Gate Entry
3. Find admin user
4. Click "Apply Role Template" → Select "Admin"
5. Or manually check:
   ✅ All 8 checkboxes
6. Save
```

### Setup for Guard (Staff):
```
1. Go to /admin/roles
2. Select: Central Departments → Gate Entry
3. Find guard user (must have role = 'staff' in database)
4. Click "Apply Role Template" → Select "Guard" or "Security"
5. Or manually check:
   ✅ gate_entry.create
   ✅ gate_entry.view_all
   ✅ gate_entry.verify
   ✅ gate_entry.cancel
   ❌ gate_entry.extend (UNCHECK this!)
   ❌ gate_entry.analytics
6. Save
```

### Setup for Faculty:
```
1. Go to /admin/roles
2. Select: Central Departments → Gate Entry
3. Find faculty user
4. Click "Apply Role Template" → Select "Faculty"
5. Or manually check:
   ✅ gate_entry.create
   ✅ gate_entry.view_own
   ✅ gate_entry.cancel
   ✅ gate_entry.extend
   ❌ gate_entry.verify
   ❌ gate_entry.analytics
6. Save
```

### Setup for Student:
```
Same as Faculty (use "Student" role template)
```

---

## 🔍 How to Test In UI

### Test 1: Verify Guard Cannot Extend
```
1. Login as Admin
2. Go to /admin/roles
3. Find a Guard user
4. Check their Gate Entry permissions
5. Verify: "gate_entry.extend" checkbox is UNCHECKED
6. Try checking it → Save
7. Login as that Guard → Open a pass
8. Expected: "Extend Pass" button should NOT appear
```

### Test 2: Verify Faculty Only Sees Own Passes
```
1. Login as Admin
2. Go to /admin/roles
3. Find a Faculty user
4. Assign permissions:
   ✅ gate_entry.create
   ✅ gate_entry.view_own (CHECK this)
   ❌ gate_entry.view_all (UNCHECK this)
5. Save
6. Login as that Faculty → Go to Gate Entry
7. Expected: Only sees own passes, not all passes
```

---

## 📝 Permission Definitions Backend File

**File Location:**
```
backend/src/modules/core/config/permissionDefinitions.js
```

**Structure:**
```javascript
CENTRAL_DEPARTMENT_PERMISSIONS = {
  ...
  gateEntry: [  // ← Gate Entry section added here!
    { 
      key: 'gate_entry.create', 
      label: 'Create Gate Pass', 
      category: 'Pass Management',
      description: '...',
      roles: ['admin', 'superadmin', 'staff', 'faculty', 'student']
    },
    // ... 7 more permissions
  ]
}
```

---

## 🔄 Backend Restart Needed?

**No restart needed if backend already running!**

Permission definitions are loaded dynamically through API:
```
GET /api/v1/permission-management/definitions
```

But if backend not running, start it:
```bash
cd backend
npm run dev
```

---

## 🎬 Complete Setup Flow

### Scenario: Setup New Guard User

```
Step 1: Database Check
→ Open Prisma Studio or check database
→ Verify user has role = 'staff'
   UPDATE user_login SET role = 'staff' WHERE uid = 'guard123';

Step 2: Assign Permissions (UI)
→ Go to http://localhost:3000/admin/roles
→ Select "Central Departments" → "Gate Entry"
→ Find guard user in list
→ Click "Assign Permissions"
→ Check appropriate boxes:
   ✅ gate_entry.create
   ✅ gate_entry.view_all
   ✅ gate_entry.verify
   ✅ gate_entry.cancel
   ❌ gate_entry.extend (IMPORTANT: Leave UNCHECKED!)
   ❌ gate_entry.analytics
→ Click "Save Permissions"

Step 3: Test
→ Logout
→ Login as guard
→ Go to Gate Entry section
→ Verify:
   ✅ Header: "🛡️ Guard View: Showing all gate passes for verification"
   ✅ Can see all passes
   ✅ Can verify passes
   ❌ "Extend Pass" button NOT visible in modals
   ❌ Analytics page returns 403
```

---

## 🐛 Troubleshooting

### Issue 1: Gate Entry section not showing in dropdown
**Problem:** Permission definitions not loaded
**Solution:**
```bash
# Check backend logs
cd backend
npm run dev
# Visit URL: http://localhost:5001/api/v1/permission-management/definitions
# Should see gateEntry in response
```

### Issue 2: Permissions not saving
**Problem:** User or department not found
**Solution:** Check console for errors, verify user exists

### Issue 3: Guard still sees Extend button
**Problem:** Permission assignment not correct
**Solution:** 
- Check user has `gate_entry.extend` UNCHECKED in UI
- Clear browser cache
- Logout and login again

---

## 📊 Permission Matrix (Quick Reference)

| Permission | Admin | Guard (Staff) | Faculty | Student |
|-----------|-------|---------------|---------|---------|
| **create** | ✅ | ✅ | ✅ | ✅ |
| **view_all** | ✅ | ✅ | ❌ | ❌ |
| **view_own** | ✅ | ✅ | ✅ | ✅ |
| **verify** | ✅ | ✅ | ❌ | ❌ |
| **cancel (before)** | ✅ | ❌ | ✅ (own) | ✅ (own) |
| **cancel (after)** | ✅ | ✅ | ✅ (own) | ✅ (own) |
| **extend** | ✅ | ❌ | ✅ (own) | ✅ (own) |
| **analytics** | ✅ | ❌ | ❌ | ❌ |
| **admin** | ✅ | ❌ | ❌ | ❌ |

---

## ✅ Quick Verification Checklist

After assigning permissions, verify:

- [ ] Backend running (port 5001)
- [ ] Frontend running (port 3000)
- [ ] Gate Entry appears in department dropdown
- [ ] 8 Gate Entry permissions visible in modal
- [ ] Can assign permissions to users
- [ ] Permissions save successfully
- [ ] Login as different roles shows different UI
- [ ] Guard does NOT see Extend button
- [ ] Faculty sees only own passes
- [ ] Admin sees all passes

---

## 🎉 Summary

**Gate Entry permissions ab fully integrated hain Role Management UI me!**

**What's Added:**
- ✅ 8 Gate Entry permissions in `permissionDefinitions.js`
- ✅ "Gate Entry" department automatically available in UI
- ✅ Can assign permissions through UI checkboxes
- ✅ Role templates supported
- ✅ Permission descriptions show which roles allowed

**How to Use:**
```
1. Go to /admin/roles
2. Select: Central Departments → Gate Entry
3. Select user
4. Check appropriate permissions
5. Save
6. Login as that user → Test Gate Entry features
```

**Key Point:**
Guards must have `gate_entry.extend` UNCHECKED to properly restrict functionality! ⚠️
