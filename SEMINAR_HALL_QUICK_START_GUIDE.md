# 🚀 Seminar Hall Booking System - Quick Start Guide

## 📦 What's Been Created

Your complete database schema for the seminar hall booking system is now ready!

### ✅ Completed
1. **Database Schema** (Prisma models)
   - `SeminarHallBlock` - Building/Wing hierarchy
   - `SeminarHallFloor` - Floors within blocks
   - `SeminarHallRoom` - Rooms with type, capacity, facilities
   - `RoomFacility` - Facility reference catalog
   - `RoomFacilityMapping` - Many-to-many room-facility relationship
   - `SeminarHallBookingRequest` - Main booking entity with full audit trail
   - `SeminarHallBookingHistory` - Status change history

2. **Documentation**
   - `SEMINAR_HALL_DATABASE_DESIGN.md` - Complete ER diagram & data model
   - `SEMINAR_HALL_MIGRATION_GUIDE.md` - Setup & migration instructions
   - `SEMINAR_HALL_API_REFERENCE.md` - All 25+ API endpoints
   - `seed-seminar-hall.js` - Sample data seeding script

3. **Enums**
   - `RoomTypeEnum` - 7 room types (seminar_hall, auditorium, classroom, etc.)
   - `BookingRequestStatusEnum` - 7 booking statuses (pending, approved, cancelled, etc.)
   - `BookingRequestKindEnum` - 3 request types (new_booking, cancel_request, reschedule_request)

---

## 🏃 Quick Start (5 Steps)

### Step 1: Generate & Apply Migration (2 min)

```bash
cd backend

# Generate Prisma migration
npx prisma migrate dev --name "add_seminar_hall_booking_system"

# This will:
# ✓ Create migration SQL files
# ✓ Apply to database
# ✓ Update Prisma Client
```

Expected output:
```
✔ Database has been created with this migration.
✔ Generated Prisma Client (v5.22.0)
```

---

### Step 2: Seed Sample Data (1 min)

```bash
# Populate with example data (4 blocks, 12 floors, 36 rooms, sample bookings)
node prisma/seed-seminar-hall.js

# Or register in package.json for auto-seed:
npx prisma db seed
```

Expected output:
```
🌱 Seeding Seminar Hall Booking System...
✅ Created 10 facilities
✅ Created 4 blocks
✅ Created 12 floors
✅ Created 36 rooms with facilities
✅ Created 4 sample booking requests
✨ Database seeding completed successfully!
```

---

### Step 3: Verify Database (1 min)

```bash
# Open Prisma Studio to visualize data
npm run prisma:studio

# Opens http://localhost:5555
# Check all 7 tables with data
```

---

### Step 4: Next Steps for Backend Development

Create API endpoints following [SEMINAR_HALL_API_REFERENCE.md](./SEMINAR_HALL_API_REFERENCE.md):

```
backend/src/
├── routes/
│   └── seminarHall/
│       ├── blocks.routes.js
│       ├── rooms.routes.js
│       ├── bookings.routes.js
│       └── admin.routes.js
├── controllers/
│   └── seminarHall/
│       ├── blockController.js
│       ├── roomController.js
│       ├── bookingController.js
│       └── adminController.js
└── services/
    └── seminarHall/
        ├── blockService.js
        ├── roomService.js
        ├── bookingService.js
        └── adminService.js
```

---

### Step 5: Connect Frontend to Backend API

Update [frontend/src/features/resource-management/seminar-hall-booking/stores/bookingRequestStore.ts](../frontend/src/features/resource-management/seminar-hall-booking/stores/bookingRequestStore.ts) to call real API instead of mock data:

```typescript
// Old: localStorage-based mock
// New: API calls

export const fetchBookingRequests = async () => {
  const response = await fetch('/api/seminar-hall/bookings', {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  return response.json();
};

export const submitBookingRequest = async (booking: BookingRequestItem) => {
  const response = await fetch('/api/seminar-hall/bookings', {
    method: 'POST',
    body: JSON.stringify(booking),
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  return response.json();
};
```

---

## 📋 File Locations

```
d:\Sgt-Ums\
├── backend/
│   └── prisma/
│       ├── schema.prisma (✅ Updated with 7 new models)
│       ├── seed-seminar-hall.js (✅ Created)
│       └── migrations/ (✅ Will be auto-generated)
│
├── SEMINAR_HALL_DATABASE_DESIGN.md (✅ Created)
├── SEMINAR_HALL_MIGRATION_GUIDE.md (✅ Created)
├── SEMINAR_HALL_API_REFERENCE.md (✅ Created)
└── QUICK_START_GUIDE.md (📄 You are here)
```

---

## 🗄️ Database Schema Overview

```
BLOCKS (Building/Wing)
  ├─ FLOORS (under each block)
  │   └─ ROOMS (under each floor)
  │       ├─ room_type: seminar_hall, auditorium, classroom, etc.
  │       ├─ capacity, chairs
  │       └─ FACILITIES (many-to-many)
  │           └─ projector, microphone, whiteboard, WiFi, etc.
  │
  └─ BOOKING REQUESTS (with full lifecycle)
      ├─ status: pending → approved/rejected/cancelled/rescheduled
      ├─ kind: new_booking, cancel_request, reschedule_request
      ├─ requester info: name, email, phone, department
      ├─ booking details: date, time, purpose, requirements
      └─ HISTORY (audit trail of all changes)
```

---

## 🎯 Key Features Supported

✅ **Hierarchical Room Structure**
- Blocks → Floors → Rooms

✅ **Room Types**
- Seminar Hall, Auditorium, Classroom, Conference Room, Meeting Room, Lab, Workshop Space

✅ **Flexible Facilities**
- Projector, Microphone, Whiteboard, AC, WiFi, Speaker System, Video Recording, Wheelchair Access, Parking, Catering

✅ **Booking Lifecycle**
- New Booking: pending → approved/rejected
- Cancel Request: pending approval → cancelled/denied
- Reschedule Request: pending approval → rescheduled/denied

✅ **Audit Trail**
- Complete history of all status changes
- Track who approved/rejected and when

✅ **Department Tracking**
- Every booking tracks requesting department

✅ **Conflict Detection**
- Prevents overlapping bookings on same room

✅ **Admin Approval Workflow**
- Separate admin queue for pending approvals
- Batch actions supported

---

## 🔑 Important Naming Conventions

### Request ID Format
```
REQ-2025-0001
REQ-2025-0002
...
```

### Time Format
```
HH:MM (24-hour format)
09:00, 14:30, 18:00, etc.
```

### Time Slots
```
"AM"        → Morning
"PM"        → Afternoon
"FULL_DAY"  → All day
"9:00-10:30" → Custom time range
```

### Status Values
```
pending              → Awaiting approval
approved             → Approved by admin
rejected             → Rejected by admin
cancel_pending       → Cancellation awaiting approval
cancelled            → Cancellation approved
reschedule_pending   → Reschedule awaiting approval
rescheduled          → Reschedule approved
```

---

## 🧪 Testing

### Test with Postman
1. Import API from [SEMINAR_HALL_API_REFERENCE.md](./SEMINAR_HALL_API_REFERENCE.md)
2. Set base URL: `http://localhost:5000/api/seminar-hall`
3. Test each endpoint with sample data

### Test with cURL
```bash
# Get all blocks
curl "http://localhost:5000/api/seminar-hall/blocks"

# Create booking
curl -X POST "http://localhost:5000/api/seminar-hall/bookings" \
  -H "Content-Type: application/json" \
  -d '{"roomId":"...","bookingDate":"2025-05-15",...}'

# Admin approve
curl -X PATCH "http://localhost:5000/api/seminar-hall/admin/bookings/REQ-2025-0001/approve"
```

---

## 🔄 Frontend Integration

### What's Already Done (Frontend)
✅ RoomBrowserPage - Room browsing with calendar
✅ MyBookingsPage - User's bookings list
✅ AdminRequestsPage - Admin approval queue
✅ Static data store with localStorage
✅ All UI & interactions working

### What's Next (Backend Integration)
1. Create API endpoints (Express)
2. Replace mock store with API calls
3. Add loading states in UI
4. Add error handling
5. Test end-to-end flow

---

## ⚡ Performance Tips

### Indexes Created
All important fields are indexed:
- `room_id`, `booking_date`, `status`, `request_kind`
- `requester_email`, `department`, `created_at`, `approved_at`

### Query Optimization
- Use pagination for large result sets (10-20 records per page)
- Filter by date range for performance
- Cache room/facility data (rarely changes)
- Use database-level constraints to prevent conflicts

---

## 🐛 Troubleshooting

### Migration fails
```bash
# Check migration status
npx prisma migrate status

# Reset database (⚠️ loses data)
npx prisma migrate reset
```

### Seed script fails
```bash
# Check DATABASE_URL in .env
# Verify database connection
psql -U user -d database

# Re-run seed with verbose output
node prisma/seed-seminar-hall.js --verbose
```

### Prisma Client not found
```bash
npm run prisma:generate
# or
npx prisma generate
```

---

## 📞 Support

### Documentation Files
- **Database Design**: [SEMINAR_HALL_DATABASE_DESIGN.md](./SEMINAR_HALL_DATABASE_DESIGN.md)
- **Migration Guide**: [SEMINAR_HALL_MIGRATION_GUIDE.md](./SEMINAR_HALL_MIGRATION_GUIDE.md)
- **API Reference**: [SEMINAR_HALL_API_REFERENCE.md](./SEMINAR_HALL_API_REFERENCE.md)
- **Schema File**: [backend/prisma/schema.prisma](./backend/prisma/schema.prisma)

### Key Points
- **7 Models** with proper relationships
- **3 Enums** for type safety
- **Complete Audit Trail** via history table
- **Many-to-Many Facilities** for flexibility
- **Hierarchical Structure** (Block → Floor → Room)

---

## ✨ What's Next?

1. ✅ **Database Schema** (DONE - You are here)
2. 🔜 **Backend API Endpoints** (Use SEMINAR_HALL_API_REFERENCE.md)
3. 🔜 **Authentication & Validation**
4. 🔜 **Frontend API Integration**
5. 🔜 **Testing & Deployment**

---

**Ready to build the backend API? Start with step 1: Run the migration!** 🚀

```bash
cd backend && npx prisma migrate dev --name "add_seminar_hall_booking_system"
```

