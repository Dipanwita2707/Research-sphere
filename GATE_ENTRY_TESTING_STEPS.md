# 🧪 Gate Entry Permission System - Testing Steps

## ✅ System Status (Verified)
- **Backend Server**: Running on `http://localhost:5001`
- **Database**: Connected (PostgreSQL/Neon)
- **Users Available**:
  - Admin: 2 users ✅
  - Guard (staff): 2 users ✅
  - Faculty: 1 user ✅
  - Student: 1 user ✅
- **Gate Passes**: 3 passes available for testing

---

## 📋 Quick Test Checklist

### Step 1: Login as Different Roles
Use Postman or Thunder Client to test:

```http
POST http://localhost:5001/api/v1/auth/login
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

**Copy the token from response for next steps**

---

### Step 2: Test Permission-Based Endpoints

#### 🔹 Test 1: View Analytics (Admin Only)
```http
GET http://localhost:5001/api/v1/gate-entry/stats
Authorization: Bearer <admin_token>
```
- ✅ **Admin**: Should return analytics
- ❌ **Guard/Faculty/Student**: Should return 403 Forbidden

---

#### 🔹 Test 2: Verify Pass (Admin + Guard Only)
```http
POST http://localhost:5001/api/v1/gate-entry/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "passId": "existing_pass_id",
  "action": "check-in"
}
```
- ✅ **Admin/Guard**: Should verify successfully
- ❌ **Faculty/Student**: Should return 403 Forbidden

---

#### 🔹 Test 3: View All Passes (Admin + Guard)
```http
GET http://localhost:5001/api/v1/gate-entry/passes
Authorization: Bearer <token>
```
- ✅ **Admin/Guard**: Should see ALL passes
- ✅ **Faculty/Student**: Should see ONLY their own passes

---

#### 🔹 Test 4: Cancel Pass (Context-Dependent)

**Before Check-in** (pass_status = 'created'):
```http
PATCH http://localhost:5001/api/v1/gate-entry/cancel/:passId
Authorization: Bearer <token>
```
- ✅ **Creator OR Admin**: Can cancel
- ❌ **Guard/Others**: Cannot cancel (403)

**After Check-in** (pass_status = 'checked_in'):
- ✅ **Creator OR Admin OR Guard**: Can cancel
- ❌ **Others**: Cannot cancel (403)

---

#### 🔹 Test 5: Extend Pass (Creator + Admin Only)
```http
PATCH http://localhost:5001/api/v1/gate-entry/extend-pass/:passId
Authorization: Bearer <token>
Content-Type: application/json

{
  "newExitTime": "2026-02-21T18:00:00Z"
}
```
- ✅ **Creator OR Admin**: Can extend
- ❌ **Guard/Others**: Cannot extend (403)

---

#### 🔹 Test 6: Create Pass (All Roles)
```http
POST http://localhost:5001/api/v1/gate-entry/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "visitor_name": "Test Visitor",
  "visitor_phone": "9876543210",
  "purpose_of_visit": "Meeting",
  "entry_time": "2026-02-21T10:00:00Z",
  "exit_time": "2026-02-21T12:00:00Z"
}
```
- ✅ **All roles**: Should create successfully

---

## 🎯 Permission Matrix Summary

| Permission | Admin | Guard (staff) | Faculty | Student |
|-----------|-------|---------------|---------|---------|
| CREATE | ✅ | ✅ | ✅ | ✅ |
| VIEW_ALL | ✅ | ✅ | ❌ | ❌ |
| VIEW_OWN | ✅ | ✅ | ✅ | ✅ |
| VERIFY | ✅ | ✅ | ❌ | ❌ |
| ANALYTICS | ✅ | ❌ | ❌ | ❌ |
| CANCEL (before check-in) | ✅ | ❌ | ✅ (own) | ✅ (own) |
| CANCEL (after check-in) | ✅ | ✅ | ✅ (own) | ✅ (own) |
| EXTEND | ✅ | ❌ | ✅ (own) | ✅ (own) |

---

## 🔍 How to Verify Implementation

### Backend Verification:
1. ✅ Server running - `http://localhost:5001`
2. ✅ Database connected - Check terminal logs
3. ✅ Middleware loaded - No startup errors
4. ✅ Routes configured - Check console output

### Integration Test Results:
- ✅ Database: 3 gate passes, 7 users
- ✅ Middleware: 7 functions working
- ✅ Routes: Properly configured
- ✅ Controllers: All functions available
- ✅ User Roles: Admin, Guard, Faculty, Student exist

### Manual Testing Checklist:
- [ ] Admin can view analytics
- [ ] Guard cannot view analytics
- [ ] Admin can verify passes
- [ ] Guard can verify passes
- [ ] Faculty cannot verify passes
- [ ] Admin sees all passes
- [ ] Guard sees all passes
- [ ] Faculty sees only own passes
- [ ] Student sees only own passes
- [ ] Creator can cancel before check-in
- [ ] Guard cannot cancel before check-in
- [ ] Guard can cancel after check-in
- [ ] Creator can extend pass
- [ ] Guard cannot extend pass
- [ ] All roles can create passes

---

## 📝 Expected API Responses

### Success Response:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Permission Denied Response:
```json
{
  "success": false,
  "message": "You do not have permission to perform this action",
  "code": "FORBIDDEN"
}
```

---

## 🚀 Quick Start Commands

1. **Start Backend** (if not running):
   ```bash
   cd backend
   npm run dev
   ```

2. **Run Integration Test**:
   ```bash
   cd backend
   node test-complete-integration.js
   ```

3. **Check Database Users**:
   ```bash
   cd backend
   npx prisma studio
   # Opens database viewer at http://localhost:5555
   ```

---

## ⚠️ Important Notes

1. **Guards must have `role = 'staff'`** in database
2. **Frontend checks are UX only** - backend enforces security
3. **Context-dependent rules** check pass status automatically
4. **All endpoints require authentication** (Bearer token)
5. **Test with real user tokens** from login endpoint

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| 403 Forbidden | Check user role in database |
| 401 Unauthorized | Login again, get fresh token |
| Guard cannot verify | Ensure `role = 'staff'` in DB |
| Pass not found | Create test pass first |
| Database error | Check DATABASE_URL in .env |

---

## 📚 Detailed Documentation

For complete implementation details, see:
- [GATE_ENTRY_PERMISSIONS_IMPLEMENTATION.md](./GATE_ENTRY_PERMISSIONS_IMPLEMENTATION.md)
- [GATE_ENTRY_QUICK_TEST.md](./GATE_ENTRY_QUICK_TEST.md)

---

**✅ System Ready for Testing!**
Backend running, all permissions configured, database connected.
