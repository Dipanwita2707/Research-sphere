# 🖥️ Gate Entry Permission System - UI Testing Guide

## ✅ Pre-requisites (Already Done)
- ✅ Backend running on port 5001
- ✅ Database connected (Users with roles exist)
- ✅ Permission utility created: `frontend/src/shared/utils/gateEntryPermissions.ts`

---

## 📋 Step-by-Step UI Testing

### Step 1: Frontend Server Start Karo

```bash
# Terminal me frontend folder me jao
cd frontend

# Install dependencies (agar pehle se nahi kiya)
npm install

# Development server start karo
npm run dev
```

**Expected Output:**
```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

Frontend khul jayega: `http://localhost:3000`

---

### Step 2: Database Me Users Check Karo

Pehle check karo ki sahi roles wale users exist karte hain:

```bash
# Backend folder me jao
cd backend

# Prisma Studio open karo
npx prisma studio
```

**Browser me khulega:** `http://localhost:5555`

**Check karo `user_login` table me:**
- Admin users (role = 'admin') ✅
- Guard users (role = 'staff') ✅  
- Faculty users (role = 'faculty') ✅
- Student users (role = 'student') ✅

**Username aur password note kar lo for testing!**

---

### Step 3: Different Roles Se Login Karo

#### 🔹 Test 1: Admin Login
```
1. Open http://localhost:3000
2. Login with Admin credentials
3. Navigate to: Gate Entry section
```

**Expected UI - Admin View:**
- ✅ **Header**: "👨‍💼 Admin View: Showing all gate passes"
- ✅ **Stats Dashboard**: All 5 cards visible (Total, Active, Pending, Completed, Expired)
- ✅ **Pass List**: ALL passes visible (apne bhi, sabke bhi)
- ✅ **Action Buttons**:
  - ✅ "Create New Pass" button
  - ✅ "Extend Pass" button (on pass details)
  - ✅ "Cancel Pass" button (on all passes)
  - ✅ "Resend Notification" button
  - ✅ "View Details" button

---

#### 🔹 Test 2: Guard Login (Staff Role)
```
1. Logout from Admin
2. Login with Guard credentials (role = 'staff')
3. Navigate to: Gate Entry section
```

**Expected UI - Guard View:**
- ✅ **Header**: "🛡️ Guard View: Showing all gate passes for verification"
- ✅ **Stats Dashboard**: Visible (for monitoring)
- ✅ **Pass List**: ALL passes visible (for verification)
- ✅ **Action Buttons**:
  - ✅ "Create New Pass" button
  - ✅ "View Details" button
  - ✅ "Cancel Pass" button (ONLY after check-in)
  - ❌ "Extend Pass" button (HIDDEN - Guard cannot extend)
  - ❌ "Analytics/Stats" access (403 error if tries)

**Key Difference:**
- Guard can see "Cancel Pass" button ONLY on **checked-in passes**
- Guard CANNOT see "Extend Pass" button at all

---

#### 🔹 Test 3: Faculty Login
```
1. Logout from Guard
2. Login with Faculty credentials (role = 'faculty')
3. Navigate to: Gate Entry section
```

**Expected UI - Faculty View:**
- ✅ **Header**: "📝 My Passes: Showing only passes created by you"
- ✅ **Stats Dashboard**: Only personal stats visible
- ✅ **Pass List**: ONLY own passes visible
- ✅ **Action Buttons** (on OWN passes only):
  - ✅ "Create New Pass" button
  - ✅ "Extend Pass" button (on own passes)
  - ✅ "Cancel Pass" button (on own passes)
  - ✅ "Resend Notification" button
  - ✅ "View Details" button
- ❌ **Hidden**: Other users' passes, Verify button, Analytics

---

#### 🔹 Test 4: Student Login
```
1. Logout from Faculty
2. Login with Student credentials (role = 'student')
3. Navigate to: Gate Entry section
```

**Expected UI - Student View:**
Same as Faculty (exact same permissions):
- ✅ **Header**: "📝 My Passes: Showing only passes created by you"
- ✅ **Pass List**: ONLY own passes
- ✅ Can create, extend, cancel (own passes only)
- ❌ Cannot see others' passes
- ❌ Cannot verify passes
- ❌ Cannot see analytics

---

## 🎯 Detailed Permission Testing Scenarios

### Scenario 1: Cancel Pass (Context-Dependent)

**Test A: Cancel BEFORE Check-in (pass_status = 'created')**

| Role | Expected Result |
|------|----------------|
| Admin | ✅ Can cancel |
| Guard | ❌ Button HIDDEN (or shows 403 error) |
| Faculty (own pass) | ✅ Can cancel |
| Faculty (other's pass) | ❌ Pass NOT visible |
| Student (own pass) | ✅ Can cancel |

**Test B: Cancel AFTER Check-in (pass_status = 'checked_in')**

| Role | Expected Result |
|------|----------------|
| Admin | ✅ Can cancel |
| Guard | ✅ Can cancel (button visible) |
| Faculty (own pass) | ✅ Can cancel |
| Faculty (other's pass) | ❌ Pass NOT visible |
| Student (own pass) | ✅ Can cancel |

---

### Scenario 2: Extend Pass

| Role | Expected Result |
|------|----------------|
| Admin | ✅ Can extend any pass |
| Guard | ❌ "Extend Pass" button HIDDEN |
| Faculty (own pass) | ✅ Can extend |
| Faculty (other's pass) | ❌ Pass NOT visible |
| Student (own pass) | ✅ Can extend |

---

### Scenario 3: View Pass List

| Role | Visible Passes |
|------|---------------|
| Admin | ALL passes visible (100+ passes) |
| Guard | ALL passes visible (for verification) |
| Faculty | ONLY own passes (e.g., 5 passes) |
| Student | ONLY own passes (e.g., 2 passes) |

**Visual Test:**
- Admin/Guard sees: "Total Passes: 120" (example)
- Faculty/Student sees: "Total Passes: 5" (only theirs)

---

### Scenario 4: Analytics Access

**Test Navigation:** Try to visit `/admin/gate-entry/stats` or click Analytics button

| Role | Expected Result |
|------|----------------|
| Admin | ✅ Analytics page loads with graphs |
| Guard | ❌ 403 Forbidden error or button hidden |
| Faculty | ❌ Button not visible / 403 error |
| Student | ❌ Button not visible / 403 error |

---

### Scenario 5: Verify Pass (Check-in/Check-out)

**Test Navigation:** Go to Verify page or scan QR

| Role | Expected Result |
|------|----------------|
| Admin | ✅ Can verify passes |
| Guard | ✅ Can verify passes |
| Faculty | ❌ 403 error or no access |
| Student | ❌ 403 error or no access |

---

## 🔧 Integration Checklist

### Current UI Code Status:

**Already Working (No changes needed):**
- ✅ Role detection: `user?.role?.name`
- ✅ View filtering: Backend already filters based on role
- ✅ Basic role checks in UI

**Needs Integration (Optional Enhancement):**
If you want to add granular permission checks in UI:

1. **Import permission utility in page.tsx:**
```typescript
import { 
  canViewAllPasses, 
  canExtendPass, 
  canCancelPass,
  canVerifyPasses,
  canViewAnalytics 
} from '@/shared/utils/gateEntryPermissions';
```

2. **Use in UI conditionally:**
```typescript
// Example: Hide Extend button for Guard
{canExtendPass(user?.role?.name) && (
  <button onClick={handleExtend}>
    Extend Pass
  </button>
)}

// Example: Hide Cancel button before check-in for Guard
{canCancelPass(
  user?.role?.name, 
  pass.created_by_id === user?.id, 
  pass.pass_status === 'checked_in'
) && (
  <button onClick={handleCancel}>
    Cancel Pass
  </button>
)}
```

**But this is OPTIONAL!** Backend already enforces all permissions. Frontend checks are just for better UX.

---

## 📝 UI Testing Checklist

### ✅ Visual Tests (Browser me dekho):

- [ ] **Admin Login:**
  - [ ] Sees "Admin View" message
  - [ ] Sees ALL passes (100+)
  - [ ] Can see Extend button
  - [ ] Can see Cancel button on all passes
  - [ ] Can access Analytics

- [ ] **Guard Login:**
  - [ ] Sees "Guard View" message
  - [ ] Sees ALL passes
  - [ ] CANNOT see Extend button
  - [ ] Can see Cancel ONLY after check-in
  - [ ] CANNOT access Analytics (403)

- [ ] **Faculty Login:**
  - [ ] Sees "My Passes" message
  - [ ] Sees ONLY own passes (5-10)
  - [ ] Can Extend own passes
  - [ ] Can Cancel own passes
  - [ ] Cannot see Verify button

- [ ] **Student Login:**
  - [ ] Sees "My Passes" message
  - [ ] Sees ONLY own passes
  - [ ] Can Create/Extend/Cancel own
  - [ ] Cannot verify or see analytics

---

### ✅ Functional Tests (Try clicking):

- [ ] **Create Pass:** All roles can create
- [ ] **View Details:** All can view
- [ ] **Extend Pass:** 
  - [ ] Admin can extend any
  - [ ] Guard button hidden
  - [ ] Faculty can extend own
  - [ ] Student can extend own
- [ ] **Cancel Pass:**
  - [ ] Test before check-in (Creator + Admin only)
  - [ ] Test after check-in (Creator + Admin + Guard)
- [ ] **Verify Pass:**
  - [ ] Admin can verify
  - [ ] Guard can verify
  - [ ] Faculty gets 403 error
  - [ ] Student gets 403 error
- [ ] **Analytics:**
  - [ ] Admin can access
  - [ ] Others get 403 error

---

## 🚨 Expected Errors (These are CORRECT behavior):

### ✅ Good Errors (Permission working):
```
403 Forbidden: You do not have permission to perform this action
```
**When:** Guard tries analytics, Faculty tries verify, etc.

### ❌ Bad Errors (Something broken):
```
500 Internal Server Error
Network Error
Undefined role
```
**Action:** Check backend logs, permissions not loaded

---

## 🔍 Debug Tips

### If UI not showing correct view:

1. **Check user role in browser console:**
```javascript
// In browser DevTools console
console.log(user?.role?.name);  // Should show: admin, staff, faculty, student
```

2. **Check backend API response:**
```
Network tab → gate-entry/passes request → Response
```
Should return filtered passes based on role

3. **Check if Stats card shows correct numbers:**
- Admin/Guard: Shows ALL passes count
- Faculty/Student: Shows only OWN passes count

---

## 📊 Visual Comparison Table

| Feature | Admin | Guard | Faculty | Student |
|---------|-------|-------|---------|---------|
| **View ALL passes** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **View OWN passes** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Create Pass** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Verify Pass** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Cancel (before check-in)** | ✅ Any | ❌ No | ✅ Own | ✅ Own |
| **Cancel (after check-in)** | ✅ Any | ✅ Any | ✅ Own | ✅ Own |
| **Extend Pass** | ✅ Any | ❌ No | ✅ Own | ✅ Own |
| **Analytics Dashboard** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Stats Cards** | ✅ All | ✅ All | ✅ Own | ✅ Own |

---

## 🎬 Quick Start Testing

**Sabse fast testing:**

1. **Frontend start karo:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Browser me open:** `http://localhost:3000`

3. **4 roles se login karo aur dekho:**
   - Admin → Should see ALL passes, ALL buttons
   - Guard → Should see ALL passes, NO Extend button
   - Faculty → Should see ONLY own passes
   - Student → Should see ONLY own passes

4. **Try buttons:**
   - Cancel Pass → Check before/after check-in rules
   - Extend Pass → Guard ke liye hidden hona chahiye
   - Analytics → Only Admin access

---

## ✅ Success Criteria

**Testing successful agar:**
- ✅ Admin sees everything
- ✅ Guard sees all but cannot extend
- ✅ Faculty/Student see only own passes
- ✅ Buttons hidden/shown correctly
- ✅ 403 errors on unauthorized actions
- ✅ Backend enforces all permissions (even if UI allows)

---

## 📚 Related Files

- **UI Page:** `frontend/src/app/admin/gate-entry/page.tsx`
- **Permission Utility:** `frontend/src/shared/utils/gateEntryPermissions.ts`
- **Backend Middleware:** `backend/src/shared/middleware/gateEntryAuth.js`
- **API Service:** `frontend/src/shared/services/gateEntry.service.ts`

---

**🎉 Ready for UI Testing! Frontend start karo aur test shuru karo!**
