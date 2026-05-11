# Seminar Hall Booking System - Database Design

## 📊 Architecture Overview

### Hierarchical Structure
```
Block (Building/Wing)
  ├─ Floor (Multiple floors per block)
  │   ├─ Room (Multiple rooms per floor)
  │   │   ├─ Capacity, Type, Features
  │   │   └─ Facilities (Many-to-Many relationship)
```

### Booking Lifecycle
```
New Booking:
  new_booking (pending) → approved/rejected

Cancel Request:
  new_booking (approved) → cancel_pending → cancelled/approved (rejected)

Reschedule Request:
  new_booking (approved) → reschedule_pending → rescheduled/approved (rejected)
```

---

## 🗄️ Database Tables (7 Models)

### 1. **SeminarHallBlock** (Building/Wing level)
Top-level container for organizing spaces
```sql
-- Key fields:
- id (UUID, Primary Key)
- name (VARCHAR 100, UNIQUE) — "Block A", "Block B", etc.
- blockNumber (VARCHAR 20) — "A1", "B2", etc.
- description (TEXT)
- location (VARCHAR 255)
- isActive (BOOLEAN, default: true)
- createdAt, updatedAt (TIMESTAMPTZ)

-- Relationships:
- Has many: Floors
- Has many: Rooms
```

---

### 2. **SeminarHallFloor** (Floor level)
Logical grouping within a block
```sql
-- Key fields:
- id (UUID, Primary Key)
- blockId (UUID, Foreign Key → SeminarHallBlock)
- floorNumber (INT) — 1, 2, 3, etc.
- name (VARCHAR 100) — "First Floor", "Ground Floor", etc.
- description (TEXT)
- isActive (BOOLEAN, default: true)
- createdAt, updatedAt (TIMESTAMPTZ)

-- Constraints:
- UNIQUE(blockId, floorNumber)
- UNIQUE(blockId, name)

-- Relationships:
- Belongs to: Block (cascade delete)
- Has many: Rooms
```

---

### 3. **SeminarHallRoom** (Room level)
Physical spaces available for booking
```sql
-- Key fields:
- id (UUID, Primary Key)
- blockId (UUID, Foreign Key → SeminarHallBlock)
- floorId (UUID, Foreign Key → SeminarHallFloor)
- name (VARCHAR 100) — "201", "Seminar Hall A", etc.
- roomNumber (VARCHAR 20)
- type (ENUM: seminar_hall, auditorium, classroom, conference_room, meeting_room, lab, workshop_space)
- capacity (INT) — max people
- chairs (INT) — number of chairs
- description (TEXT)
- isActive (BOOLEAN, default: true)
- createdAt, updatedAt (TIMESTAMPTZ)

-- Constraints:
- UNIQUE(floorId, name)
- UNIQUE(floorId, roomNumber)

-- Relationships:
- Belongs to: Block (cascade delete)
- Belongs to: Floor (cascade delete)
- Has many: Facilities (via RoomFacilityMapping)
- Has many: Booking Requests
```

---

### 4. **RoomFacility** (Reference table)
Catalog of all available facilities/features
```sql
-- Key fields:
- id (UUID, Primary Key)
- name (VARCHAR 100, UNIQUE) — "Projector", "Microphone", "Whiteboard", etc.
- description (TEXT)
- category (VARCHAR 50) — "audio", "visual", "seating", "accessibility"
- isActive (BOOLEAN, default: true)
- createdAt, updatedAt (TIMESTAMPTZ)

-- Relationships:
- Has many: RoomFacilityMappings
```

---

### 5. **RoomFacilityMapping** (Junction table - Many-to-Many)
Links rooms to their available facilities
```sql
-- Key fields:
- id (UUID, Primary Key)
- roomId (UUID, Foreign Key → SeminarHallRoom)
- facilityId (UUID, Foreign Key → RoomFacility)
- quantity (INT) — e.g., "3 projectors"
- notes (TEXT) — e.g., "Wall-mounted, not portable"
- createdAt (TIMESTAMPTZ)

-- Constraints:
- UNIQUE(roomId, facilityId)

-- Relationships:
- Belongs to: Room (cascade delete)
- Belongs to: Facility (cascade delete)
```

---

### 6. **SeminarHallBookingRequest** (Main booking entity)
Tracks all booking-related requests (new, cancel, reschedule)

```sql
-- Unique identification:
- id (UUID, Primary Key)
- requestId (VARCHAR 20, UNIQUE) — "REQ-2025-0001", "REQ-2025-0002", etc.

-- Room information:
- roomId (UUID, Foreign Key → SeminarHallRoom) [RESTRICT on delete]

-- Requester information:
- requesterName (VARCHAR 100) — e.g., "Dr. John Smith"
- requesterEmail (CITEXT, indexed)
- requesterPhone (VARCHAR 20)
- department (VARCHAR 100) — e.g., "Computer Science"

-- Booking details:
- bookingDate (DATE) — the date of the booking
- startTime (VARCHAR 5, HH:MM format) — "09:00", "14:30"
- endTime (VARCHAR 5, HH:MM format)
- timeSlot (VARCHAR 20) — "AM", "PM", "FULL_DAY", or time range "9:00-10:30"
- purpose (VARCHAR 255) — "Class Lecture", "Workshop", etc.
- additionalRequirements (TEXT)

-- Request metadata:
- requestKind (ENUM: new_booking, cancel_request, reschedule_request)
- status (ENUM: pending, approved, rejected, cancel_pending, cancelled, reschedule_pending, rescheduled)

-- For cancel/reschedule requests:
- originalBookingDate (DATE) — when the original booking was
- originalTimeSlot (VARCHAR 20)
- originalStartTime (VARCHAR 5)
- originalEndTime (VARCHAR 5)
- requestedBookingDate (DATE) — what date is being requested (for reschedule)
- requestedTimeSlot (VARCHAR 20)
- requestedStartTime (VARCHAR 5)
- requestedEndTime (VARCHAR 5)

-- Admin approval:
- adminRemark (TEXT)
- approvedBy (UUID) — user who approved
- approvedAt (TIMESTAMPTZ)
- rejectedBy (UUID) — user who rejected
- rejectedAt (TIMESTAMPTZ)
- rejectionReason (TEXT)

-- Audit trail:
- createdAt (TIMESTAMPTZ)
- updatedAt (TIMESTAMPTZ)

-- Constraints:
- UNIQUE(requestId)

-- Relationships:
- Belongs to: Room (RESTRICT — can't delete room while it has active bookings)
- Has many: BookingHistory (cascade delete)

-- Indexes:
- roomId, bookingDate, status, requestKind, requesterEmail, department, createdAt, approvedAt
```

---

### 7. **SeminarHallBookingHistory** (Audit trail)
Tracks all status changes and actions
```sql
-- Key fields:
- id (UUID, Primary Key)
- bookingRequestId (UUID, Foreign Key → SeminarHallBookingRequest)
- oldStatus (VARCHAR 50) — previous status
- newStatus (VARCHAR 50) — new status
- action (VARCHAR 100) — "created", "approved", "rejected", "cancelled", "rescheduled"
- actionDetails (TEXT) — additional context
- changedBy (UUID) — user who made the change
- changedAt (TIMESTAMPTZ)

-- Constraints:
- Cascade delete with booking request

-- Relationships:
- Belongs to: BookingRequest (cascade delete)
```

---

## 🔗 Entity Relationship Diagram

```
┌─────────────────────────────────────┐
│     SeminarHallBlock                │
│  (Building/Wing)                    │
├─────────────────────────────────────┤
│ id (PK)                             │
│ name (UNIQUE)                       │
│ blockNumber                         │
│ description                         │
│ location                            │
│ isActive                            │
│ createdAt, updatedAt                │
└──────────────┬──────────────────────┘
               │ 1:N
               ├─────────────────────────────────────┐
               │                                     │
    ┌──────────▼───────────────────┐    ┌──────────▼──────────────────────┐
    │   SeminarHallFloor           │    │   SeminarHallRoom               │
    │   (Floor per Block)          │    │   (Room per Floor)              │
    ├──────────────────────────────┤    ├─────────────────────────────────┤
    │ id (PK)                      │    │ id (PK)                         │
    │ blockId (FK)                 │    │ blockId (FK)                    │
    │ floorNumber                  │    │ floorId (FK)                    │
    │ name                         │    │ name, roomNumber                │
    │ description                  │    │ type (enum RoomType)           │
    │ isActive                     │    │ capacity, chairs                │
    │ createdAt, updatedAt         │    │ description                     │
    │ UNIQUE(blockId, floorNumber) │    │ isActive                        │
    │ UNIQUE(blockId, name)        │    │ createdAt, updatedAt            │
    └──────────────┬───────────────┘    │ UNIQUE(floorId, name)           │
                   │ 1:N                │ UNIQUE(floorId, roomNumber)     │
                   │                    └──────────┬──────────────────────┘
                   │                               │ 1:N (has many)
                   └───────────────────────────────┤
                                                   │
                                    ┌──────────────▼─────────────┐
                                    │ SeminarHallBookingRequest  │
                                    │ (Booking with full audit)  │
                                    ├────────────────────────────┤
                                    │ id, requestId (UNIQUE)     │
                                    │ roomId (FK, RESTRICT)      │
                                    │ requesterName, Email, Phone│
                                    │ department                 │
                                    │ bookingDate, startTime,    │
                                    │ endTime, timeSlot          │
                                    │ purpose                    │
                                    │ additionalRequirements     │
                                    │ requestKind (enum)         │
                                    │ status (enum)              │
                                    │ original* (cancel/reschedule)
                                    │ requested* (reschedule)    │
                                    │ adminRemark, approvedBy    │
                                    │ createdAt, updatedAt       │
                                    └──────────────┬─────────────┘
                                                   │ 1:N (has many)
                                                   │
                                    ┌──────────────▼──────────────────┐
                                    │ SeminarHallBookingHistory       │
                                    │ (Audit trail)                  │
                                    ├───────────────────────────────┤
                                    │ id (PK)                       │
                                    │ bookingRequestId (FK, CASCADE)│
                                    │ oldStatus, newStatus          │
                                    │ action (enum)                 │
                                    │ actionDetails                 │
                                    │ changedBy, changedAt          │
                                    └───────────────────────────────┘

┌──────────────────────────┐
│    RoomFacility          │         ┌─────────────────────────────┐
│  (Features catalog)      │         │  RoomFacilityMapping        │
├──────────────────────────┤    ◄────┤  (Junction table)           │
│ id (PK)                  │─────────┤  Many-to-Many relationship  │
│ name (UNIQUE)            │         │                             │
│ description              │         ├─────────────────────────────┤
│ category                 │         │ id (PK)                     │
│ isActive                 │         │ roomId (FK, CASCADE)        │
│ createdAt, updatedAt     │         │ facilityId (FK, CASCADE)    │
└──────────────────────────┘         │ quantity                    │
                                     │ notes                       │
                                     │ UNIQUE(roomId, facilityId)  │
                                     └─────────────────────────────┘
                                                  ▲
                                                  │
                                                  │
                                     ◄────────────┘
                                     (points back to SeminarHallRoom)
```

---

## 📋 Enums

### RoomTypeEnum
```
- seminar_hall
- auditorium
- classroom
- conference_room
- meeting_room
- lab
- workshop_space
```

### BookingRequestStatusEnum
```
- pending          (newly created, awaiting approval)
- approved         (approved by admin)
- rejected         (rejected by admin)
- cancel_pending   (cancellation request, awaiting approval)
- cancelled        (cancellation approved)
- reschedule_pending (reschedule request, awaiting approval)
- rescheduled      (reschedule approved)
```

### BookingRequestKindEnum
```
- new_booking      (initial booking request)
- cancel_request   (cancellation request for existing booking)
- reschedule_request (request to change date/time of existing booking)
```

---

## 🔑 Key Constraints & Relationships

| From | To | Type | OnDelete | Notes |
|------|-----|------|----------|-------|
| SeminarHallFloor | SeminarHallBlock | N:1 | CASCADE | Delete block → delete all floors |
| SeminarHallRoom | SeminarHallBlock | N:1 | CASCADE | Delete block → delete all rooms |
| SeminarHallRoom | SeminarHallFloor | N:1 | CASCADE | Delete floor → delete all rooms |
| RoomFacilityMapping | SeminarHallRoom | N:1 | CASCADE | Delete room → delete mappings |
| RoomFacilityMapping | RoomFacility | N:1 | CASCADE | Delete facility → delete mappings |
| SeminarHallBookingRequest | SeminarHallRoom | N:1 | RESTRICT | Can't delete room with active bookings |
| SeminarHallBookingHistory | SeminarHallBookingRequest | N:1 | CASCADE | Delete booking → delete history |

---

## 📊 Sample Data Structure

### Block
```json
{
  "id": "uuid-123",
  "name": "Block A",
  "blockNumber": "A1",
  "location": "North Campus",
  "description": "Academic Block - Houses CS and IT departments"
}
```

### Floor (under Block A)
```json
{
  "id": "uuid-456",
  "blockId": "uuid-123",
  "floorNumber": 2,
  "name": "Second Floor",
  "description": "CS Department classrooms and seminar halls"
}
```

### Room (Seminar Hall, under Floor 2)
```json
{
  "id": "uuid-789",
  "blockId": "uuid-123",
  "floorId": "uuid-456",
  "name": "SH-201",
  "roomNumber": "201",
  "type": "seminar_hall",
  "capacity": 60,
  "chairs": 60,
  "description": "Large seminar hall with AV setup"
}
```

### Room Facilities (for SH-201)
```json
[
  { "name": "Projector", "quantity": 2 },
  { "name": "Microphone", "quantity": 3 },
  { "name": "Whiteboard", "quantity": 2 },
  { "name": "Air Conditioning", "quantity": 1 },
  { "name": "WiFi", "quantity": 1 }
]
```

### Booking Request (new_booking)
```json
{
  "requestId": "REQ-2025-0001",
  "roomId": "uuid-789",
  "requesterName": "Dr. John Smith",
  "requesterEmail": "john.smith@university.edu",
  "requesterPhone": "+91-9876543210",
  "department": "Computer Science",
  "bookingDate": "2025-05-15",
  "startTime": "09:00",
  "endTime": "11:00",
  "timeSlot": "AM",
  "purpose": "Python Workshop - Advanced OOP Concepts",
  "additionalRequirements": "Please ensure WiFi is working. Need 2 extra chairs.",
  "requestKind": "new_booking",
  "status": "pending",
  "createdAt": "2025-04-28T10:30:00Z"
}
```

### Booking Request (cancel_request)
```json
{
  "requestId": "REQ-2025-0002",
  "roomId": "uuid-789",
  "requesterName": "Dr. John Smith",
  "requesterEmail": "john.smith@university.edu",
  "department": "Computer Science",
  "bookingDate": "2025-05-15",
  "startTime": "09:00",
  "endTime": "11:00",
  "timeSlot": "AM",
  "requestKind": "cancel_request",
  "status": "cancel_pending",
  "originalBookingDate": "2025-05-15",
  "originalTimeSlot": "AM",
  "originalStartTime": "09:00",
  "originalEndTime": "11:00",
  "adminRemark": "Awaiting approval for cancellation"
}
```

### Booking Request (reschedule_request)
```json
{
  "requestId": "REQ-2025-0003",
  "roomId": "uuid-789",
  "requesterName": "Dr. John Smith",
  "requesterEmail": "john.smith@university.edu",
  "department": "Computer Science",
  "bookingDate": "2025-05-15",
  "startTime": "09:00",
  "endTime": "11:00",
  "timeSlot": "AM",
  "requestKind": "reschedule_request",
  "status": "reschedule_pending",
  "originalBookingDate": "2025-05-15",
  "originalTimeSlot": "AM",
  "originalStartTime": "09:00",
  "originalEndTime": "11:00",
  "requestedBookingDate": "2025-05-20",
  "requestedTimeSlot": "PM",
  "requestedStartTime": "14:00",
  "requestedEndTime": "16:00",
  "adminRemark": "Approving reschedule to 20th May PM slot"
}
```

---

## 🚀 Next Steps

1. **Generate Prisma Migration**
   ```bash
   cd backend
   npx prisma migrate dev --name "add_seminar_hall_booking_system"
   ```

2. **Generate Prisma Client**
   ```bash
   npm run prisma:generate
   ```

3. **Seed Initial Data** (optional)
   - Create blocks, floors, rooms, and facilities
   - See [SEMINAR_HALL_SEEDING.md](./SEMINAR_HALL_SEEDING.md) for seed script

4. **View Database**
   ```bash
   npm run prisma:studio
   ```

---

## 📝 Notes

- **Request ID Format**: `REQ-YYYY-NNNN` (e.g., REQ-2025-0001)
- **Time Format**: 24-hour format (HH:MM)
- **Date Format**: ISO 8601 (YYYY-MM-DD)
- **All timestamps**: UTC timezone (TIMESTAMPTZ)
- **Email field**: Uses CITEXT (case-insensitive) for PostgreSQL
- **Cascade deletes**: Rooms/Floors/Blocks cascade to maintain integrity
- **Restrict delete**: Can't delete a room while it has active booking requests
- **Email & Phone**: Case-insensitive email field for flexibility

