## 🔐 SGT UMS - ACTUAL LOGIN CREDENTIALS

> **Database Status:** ✅ Successfully Seeded
> **Last Updated:** March 2, 2026
> **Total Users:** 19 (1 Admin, 10 Students, 5 Faculty, 3 Staff)
> **Parents/Guardians:** 20 (Father + Mother for each student)

---

### 👑 ADMIN LOGIN
**Primary Admin Account:**
```
Username: admin
Password: admin123
Email: admin@sgtuniversity.edu
```

---

### 👨‍🎓 STUDENT LOGINS
**All students use password:** `student123`

| Username/UID | Email | Name | Semester |
|--------------|-------|------|----------|
| 12201401 | rahul.sharma@sgt.edu | Rahul Sharma | 3 |
| 12201402 | priya.singh@sgt.edu | Priya Singh | 3 |
| 12201403 | amit.kumar@sgt.edu | Amit Kumar | 5 |
| 12201404 | sneha.patel@sgt.edu | Sneha Patel | 5 |
| 12201405 | vikram.verma@sgt.edu | Vikram Verma | 7 |
| 12201406 | anjali.gupta@sgt.edu | Anjali Gupta | 7 |
| 12201407 | rohan.mehta@sgt.edu | Rohan Mehta | 1 |
| 12201408 | neha.joshi@sgt.edu | Neha Joshi | 1 |
| 12201409 | arjun.reddy@sgt.edu | Arjun Reddy | 3 |
| 12201410 | kavya.nair@sgt.edu | Kavya Nair | 5 |

**Quick Test Login:**
```
Username: 12201401
Password: student123
```

---

### 👨‍👩‍👧‍👦 PARENT/GUARDIAN INFORMATION

**Total Parents/Guardians:** 20 (Father + Mother for each student)

**Complete Parent Details:**

| Student | Father | Father Phone | Mother | Mother Phone |
|---------|--------|--------------|--------|--------------|
| Rahul Sharma (12201401) | Rajendra Sharma | 9876543200 | Sunita Sharma | 9876543300 |
| Priya Singh (12201402) | Harinder Singh | 9876543201 | Manjeet Singh | 9876543301 |
| Amit Kumar (12201403) | Suresh Kumar | 9876543202 | Geeta Kumar | 9876543302 |
| Sneha Patel (12201404) | Ramesh Patel | 9876543203 | Kavita Patel | 9876543303 |
| Vikram Verma (12201405) | Anil Verma | 9876543204 | Rekha Verma | 9876543304 |
| Anjali Gupta (12201406) | Rajendra Gupta | 9876543205 | Sunita Gupta | 9876543305 |
| Rohan Mehta (12201407) | Harinder Mehta | 9876543206 | Manjeet Mehta | 9876543306 |
| Neha Joshi (12201408) | Suresh Joshi | 9876543207 | Geeta Joshi | 9876543307 |
| Arjun Reddy (12201409) | Ramesh Reddy | 9876543208 | Kavita Reddy | 9876543308 |
| Kavya Nair (12201410) | Anil Nair | 9876543209 | Rekha Nair | 9876543309 |

**Validation Status:**
- ✅ All phone numbers are exactly 10 digits
- ✅ No duplicate parent records
- ✅ Parent last names match student last names
- ✅ Father marked as primary contact for all students

**Notes:**
- Email format: `firstname.lastname@parent.com`
- Primary contact: Father (for all students)
- Complete guardian information available in database

**View All Parents:**
```bash
node backend/display-parent-info.js
```

---

### 👨‍🏫 FACULTY LOGINS
**All faculty use password:** `password123`

| UID | Email | Name | Designation |
|-----|-------|------|-------------|
| EMP001 | rajesh.sharma@university.edu | Dr. Rajesh Sharma | Professor & HOD |
| EMP002 | priya.verma@university.edu | Dr. Priya Verma | Associate Professor |
| EMP003 | amit.kumar@university.edu | Prof. Amit Kumar | Dean - Academics |
| EMP004 | rahul.patel@university.edu | Dr. Rahul Patel | Assistant Professor |
| EMP005 | anjali.mehta@university.edu | Dr. Anjali Mehta | Professor |

**Quick Test Login:**
```
Username: EMP001
Password: password123
Email: rajesh.sharma@university.edu
```

---

### 👮 SECURITY/GUARD LOGINS
**All staff use password:** `password123`

| UID | Email | Name | Designation |
|-----|-------|------|-------------|
| STAFF001 | vikram.singh@university.edu | Mr. Vikram Singh | Administrative Officer |
| STAFF002 | sneha.gupta@university.edu | Ms. Sneha Gupta | HR Manager |
| STAFF003 | suresh.reddy@university.edu | Mr. Suresh Reddy | Security Officer |

**Quick Test Login:**
```
Username: STAFF001
Password: password123
```

---

### 🏨 GUEST HOUSE SYSTEM

**Available Guest Houses:** 4
- International Guest House (20 rooms)
- Faculty Residence Complex (20 rooms)
- Administrative Guest Lodge (20 rooms)
- University Convention Center (20 rooms)

**Total Rooms:** 80

**Room Types & Pricing:**
- Standard: ₹1,000/night
- Deluxe: ₹1,500/night
- AC: ₹1,800/night
- Suite: ₹2,500/night

**Room Naming Convention:**
- Ground Floor: G01, G02, G03, G04, G05
- 1st Floor: 1F01, 1F02, 1F03, 1F04, 1F05
- 2nd Floor: 2F01, 2F02, 2F03, 2F04, 2F05
- 3rd Floor: 3F01, 3F02, 3F03, 3F04, 3F05

---

### 📝 IMPORTANT NOTES

1. **Login Format:**
   - Use `UID` or `Email` as username
   - Passwords are case-sensitive

2. **Testing Room Booking:**
   - Login as Admin or Faculty
   - Go to Gate Entry → Hostel Booking
   - Book rooms - system will automatically hide booked rooms from availability

3. **Gate Pass Testing:**
   - Students can create passes
   - Guards (STAFF users) can scan QR codes
   - Admin can view all passes

4. **Password Reset:**
   - Default password for all new users: `password123` or `admin123` for admin
   - Change passwords after first login for production

---

### 🔧 TROUBLESHOOTING

**If login fails:**
1. Check if you're using the correct UID (not email if UID login is expected)
2. Verify password is exactly as listed (case-sensitive)
3. Check if backend server is running on port 5001
4. Check if frontend is running on port 3000

**To reseed database:**
```bash
cd backend
node scripts/database/seeds/seed-admin.js
node scripts/database/seeds/seed-employees-for-gate-entry.js
node prisma/seeds/seed-students.js
node prisma/seed-guest-houses.js
```
