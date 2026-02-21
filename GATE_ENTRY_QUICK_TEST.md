# Gate Entry Permission System - Quick Testing Guide

## 🧪 How to Test the New Implementation

### Prerequisites
- Backend server running
- Database with test users of different roles
- Postman or similar API testing tool (optional)

---

## 1️⃣ Backend Permission Tests

### Test Setup: Create Test Users (if not exists)

```sql
-- Check existing users and their roles
SELECT id, uid, email, role FROM user_login WHERE role IN ('admin', 'staff', 'faculty', 'student');
```

**Required Test Users:**
- 1 Admin user (`role = 'admin'`)
- 1 Guard user (`role = 'staff'`)
- 1 Faculty user (`role = 'faculty'`)
- 1 Student user (`role = 'student'`)

---

### Test Case 1: Create Pass
**Expected:** All roles can create passes

```bash
# Login as each user and try creating a pass
POST /api/v1/gate-entry/create-pass
```

✅ **Pass:** Admin, Guard, Faculty, Student can all create
❌ **Fail:** Any role gets 403 Forbidden

---

### Test Case 2: View All vs View Own
**Expected:** 
- Admin/Guard see ALL passes
- Faculty/Student see ONLY passes created_by_id = their user id

```bash
# Login as Admin or Guard
GET /api/v1/gate-entry/passes
# Should return ALL passes

# Login as Faculty or Student  
GET /api/v1/gate-entry/passes
# Should return ONLY passes where created_by_id = current user
```

✅ **Pass:** Filtering works correctly
❌ **Fail:** Faculty/Student see passes not created by them

---

### Test Case 3: Analytics Access
**Expected:** Only Admin can access

```bash
# Login as Admin
GET /api/v1/gate-entry/stats
# Status: 200 OK

# Login as Guard/Faculty/Student
GET /api/v1/gate-entry/stats
# Status: 403 Forbidden
```

✅ **Pass:** Only Admin gets 200, others get 403
❌ **Fail:** Non-admin can access analytics

---

### Test Case 4: Verify Pass
**Expected:** Only Admin/Guard can verify

```bash
# Login as Admin or Guard
POST /api/v1/gate-entry/verify
POST /api/v1/gate-entry/allow-entry/:passId
# Status: 200 OK

# Login as Faculty or Student
POST /api/v1/gate-entry/verify
# Status: 403 Forbidden
```

✅ **Pass:** Only Admin/Guard can verify
❌ **Fail:** Faculty/Student can verify passes

---

### Test Case 5: Cancel Pass (Before Check-in)
**Expected:** Only creator or admin can cancel

```bash
# Create a pass as Faculty user (ID: faculty-1)
# Pass created with pass_status = 'created'

# Login as Faculty (creator)
POST /api/v1/gate-entry/cancel/:passId
# Status: 200 OK ✅

# Login as Admin
POST /api/v1/gate-entry/cancel/:passId  
# Status: 200 OK ✅

# Login as Guard (NOT creator)
POST /api/v1/gate-entry/cancel/:passId
# Status: 403 Forbidden (Guard cannot cancel before check-in) ✅

# Login as different Faculty (NOT creator)
POST /api/v1/gate-entry/cancel/:passId
# Status: 403 Forbidden ✅
```

---

### Test Case 6: Cancel Pass (After Check-in)
**Expected:** Creator, admin, OR guard can cancel

```bash
# First check-in the pass (as Guard/Admin)
POST /api/v1/gate-entry/allow-entry/:passId
# Pass now has pass_status = 'checked_in'

# Login as Creator (Faculty who created it)
POST /api/v1/gate-entry/cancel/:passId
# Status: 200 OK ✅

# Login as Admin
POST /api/v1/gate-entry/cancel/:passId
# Status: 200 OK ✅

# Login as Guard
POST /api/v1/gate-entry/cancel/:passId
# Status: 200 OK ✅ (NOW Guard can cancel after check-in)

# Login as different Faculty (NOT creator)
POST /api/v1/gate-entry/cancel/:passId
# Status: 403 Forbidden ✅
```

---

### Test Case 7: Extend Pass
**Expected:** Only creator or admin can extend

```bash
# Pass created by Faculty user

# Login as Faculty (creator)
POST /api/v1/gate-entry/extend-pass/:passId
Body: { "newEndDate": "2026-02-25", "extensionReason": "Family emergency" }
# Status: 200 OK ✅

# Login as Admin
POST /api/v1/gate-entry/extend-pass/:passId
# Status: 200 OK ✅

# Login as Guard
POST /api/v1/gate-entry/extend-pass/:passId
# Status: 403 Forbidden (Guard CANNOT extend) ✅

# Login as different Faculty (NOT creator)
POST /api/v1/gate-entry/extend-pass/:passId
# Status: 403 Forbidden ✅
```

---

## 2️⃣ Quick Backend Test Script

Run this to verify all imports work:

```bash
cd backend
node test-gate-entry-imports.js
```

**Expected Output:**
```
🧪 Testing Backend Gate Entry Permissions Integration...

1. Testing constants import...
   ✅ Constants loaded
   - Permissions: 7
   - Roles: 5

2. Testing middleware import...
   ✅ Middleware loaded
   - Functions: 7

...

🎉 All Backend Imports Successful!
```

---

## ✅ Success Criteria

Your implementation is working correctly if:

1. ✅ All 7 test cases pass
2. ✅ Backend import test succeeds
3. ✅ Role-based filtering works (VIEW_ALL vs VIEW_OWN)
4. ✅ Context-dependent cancellation works (before/after check-in)
5. ✅ Extension blocked for Guards
6. ✅ Analytics blocked for non-Admin users
7. ✅ No TypeScript/JavaScript errors in console

---

## 📋 Test Result Checklist

### Backend Tests
- [ ] Test Case 1: Create Pass (All roles)
- [ ] Test Case 2: View filtering (ALL vs OWN)
- [ ] Test Case 3: Analytics (Admin only)
- [ ] Test Case 4: Verify (Admin/Guard only)
- [ ] Test Case 5: Cancel before check-in (Creator/Admin only)
- [ ] Test Case 6: Cancel after check-in (Creator/Admin/Guard)
- [ ] Test Case 7: Extend (Creator/Admin only, NOT Guard)

---

**Ready to test? Start with Backend Test Case 1!** 🚀
