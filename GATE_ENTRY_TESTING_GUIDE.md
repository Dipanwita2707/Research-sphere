# Gate Entry Module - Testing Guide
**Created:** February 6, 2026

## 🎯 Overview
Gate Entry module API integration has been completed! This guide will help you test the Create Pass functionality.

---

## ✅ Pre-Testing Checklist

### 1. Backend Server Status
**Port:** 5001  
**Base URL:** http://localhost:5001

#### Check if Backend is Running:
```bash
# Open terminal in backend folder
cd c:/Users/ASUS/Desktop/Sgt-Ums/backend

# Start backend if not running
npm run dev
```

**Expected Output:**
```
✓ Connected to Neon database successfully
✓ Server running on port 5001
✓ API routes mounted at /api/v1
```

#### Test Backend Health:
```bash
# In a new terminal
curl http://localhost:5001/api/v1/health
```

**Expected Response:**
```json
{"success": true, "message": "API is healthy"}
```

---

### 2. Frontend Server Status
**Port:** 3000  
**URL:** http://localhost:3000

#### Start Frontend:
```bash
# Open terminal in frontend folder
cd c:/Users/ASUS/Desktop/Sgt-Ums/frontend

# Install dependencies (if not done)
npm install

# Start frontend
npm run dev
```

**Expected Output:**
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- Local:        http://localhost:3000
```

---

## 🧪 Testing Steps

### Step 1: Login to the System
1. Open browser: http://localhost:3000
2. Login with your credentials
3. Navigate to **Administration** → **Gate Entry** → **Create Pass**

### Step 2: Fill the Create Pass Form

#### **Personal Details (Step 1)**
- **Full Name:** Rajesh Kumar  
- **Mobile Number:** 9876543210  
- **Email:** rajesh.kumar@example.com  
- **ID Proof Type:** Aadhaar Card  
- **ID Proof Number:** 1234 5678 9012  
- **Gender:** Male  
- **Age:** 35  

Click **Next →**

#### **Visit Details (Step 2)**
- **Purpose of Visit:** Meeting  
- **Department to Visit:** Computer Science & Engineering  
- **Person to Meet:** Dr. Rajesh Sharma - HOD CSE  
- **Visit Date:** Select today or tomorrow  
- **Expected Entry Time:** 10:00 AM  
- **Expected Exit Time:** 12:00 PM  

Click **Next →**

#### **Vehicle Details (Step 3)**
- **Bringing Vehicle:** ✓ Yes  
- **Vehicle Type:** Four Wheeler  
- **Vehicle Number:** DL01AB1234  
- **Vehicle Model:** Honda City  

Click **Next →**

#### **Additional Information (Step 4)**
- **Number of Persons:** 2  
- **Items Carrying:** Laptop, Documents  
- **Special Instructions:** Meeting regarding new project  

Click **Review & Submit**

### Step 3: Review and Confirm
1. Review all details in the preview screen
2. Click **"Confirm & Generate Pass"**
3. Wait for the loading spinner (API call in progress)

### Step 4: Verify Success

#### ✅ Expected Success Response:
You should see:
- **Green Success Screen** with checkmark icon
- **Pass ID:** Format `UNI-PASS-20260206-XXX`
- **Pass Details:** Visitor name, mobile, visit date, status
- **Notifications Section:** Showing emails/SMS sent
- **Two Buttons:** "Print Pass" and "Create Another Pass"

#### ❌ If You See Error:
- **Red Error Box** appears below the buttons
- Error message like: "Not authorized to access this route"
- **Solution:** Make sure you're logged in (check if token exists)

---

## 🔍 Verification Points

### 1. Check Backend Logs
Go to the terminal where backend is running and look for:
```
POST /api/v1/gate-entry/create-pass 201
✓ Gate pass created successfully: UNI-PASS-20260206-001
```

### 2. Check Database
```bash
# In backend folder
npx prisma studio
```
- Open **GatePass** table
- You should see your newly created pass
- Verify all fields are saved correctly
- Check **status** field = "pending"

### 3. Check Browser Console
Open Developer Tools (F12) → Console:
- Should not show any red errors
- May show API request logs (normal)

### 4. Check Network Tab
Developer Tools (F12) → Network Tab:
- Look for request: `create-pass`
- **Status:** 201 Created
- **Response:** Should contain `success: true` and `pass` object

---

## 🐛 Common Issues & Solutions

### Issue 1: "Not authorized to access this route"
**Cause:** User not logged in or JWT token expired  
**Solution:**
1. Logout and login again
2. Check if cookies are enabled
3. Verify JWT token in browser cookies (F12 → Application → Cookies)

### Issue 2: "Failed to create pass"
**Cause:** Backend not running or database connection issue  
**Solution:**
- Check if backend server is running on port 5001
- Restart backend: `Ctrl+C` then `npm run dev`
- Check database connection in `.env` file

### Issue 3: Form validation errors
**Cause:** Required fields missing  
**Solution:**
- Fill all required fields (marked with *)
- Mobile: 10 digits
- Email: Valid format
- Times: Entry time must be before exit time

### Issue 4: API connection timeout
**Cause:** Wrong API URL or CORS issue  
**Solution:**
- Check `frontend/.env` file: `NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1`
- Restart frontend after changing `.env`
- Verify backend CORS settings allow `http://localhost:3000`

---

## 📊 Testing Checklist

- [ ] Backend server running (port 5001)
- [ ] Frontend server running (port 3000)
- [ ] Can access Create Pass page
- [ ] All form steps work (1-4)
- [ ] Preview screen shows correct data
- [ ] "Confirm & Generate Pass" button works
- [ ] Loading spinner appears during API call
- [ ] Success screen shows with Pass ID
- [ ] Pass ID format: `UNI-PASS-YYYYMMDD-XXX`
- [ ] Can see pass in Database (Prisma Studio)
- [ ] Backend logs show successful creation
- [ ] No console errors in browser
- [ ] Can create multiple passes
- [ ] "Create Another Pass" button resets form

---

## 📝 Next Steps (After Testing)

Once Create Pass is working:
1. **All Passes Page** - View list of all created passes
2. **Verify Pass Page** - Guard interface for QR scanning
3. **API Integration** - Connect remaining pages
4. **Testing** - End-to-end workflow testing

---

## 📞 Need Help?

If you encounter any issues:
1. Check both terminal outputs (frontend & backend)
2. Check browser console (F12)
3. Verify database connection
4. Share error screenshots/logs

---

## 🎉 Success Criteria

Test is PASSED when:
✅ Pass is created successfully  
✅ Pass ID is generated (UNI-PASS format)  
✅ Success screen appears  
✅ Pass is saved in database  
✅ Backend logs confirm creation  
✅ No errors in browser console  

---

**Happy Testing! 🚀**
