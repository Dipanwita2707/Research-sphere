# Seminar Hall Booking - Backend API Reference

## 🔗 API Base URL
```
http://localhost:5000/api/seminar-hall
```

---

## 📋 API Endpoints Overview

### Resource Management
- `GET /blocks` - List all blocks
- `GET /blocks/:blockId` - Get single block with floors and rooms
- `GET /blocks/:blockId/floors` - List floors in a block
- `GET /floors/:floorId` - Get single floor with rooms
- `GET /floors/:floorId/rooms` - List rooms on a floor
- `GET /rooms/:roomId` - Get room details with facilities
- `GET /facilities` - List all facilities

### Booking Management
- `POST /bookings` - Create new booking request
- `GET /bookings` - List user's bookings (requires auth)
- `GET /bookings/:requestId` - Get booking details
- `PATCH /bookings/:requestId` - Update booking status/details
- `POST /bookings/:requestId/cancel` - Request cancellation
- `POST /bookings/:requestId/reschedule` - Request reschedule
- `DELETE /bookings/:requestId` - Cancel booking request (admin only)

### Admin Management
- `GET /admin/bookings` - List pending requests for admin
- `GET /admin/bookings/status/:status` - Filter by status
- `PATCH /admin/bookings/:requestId/approve` - Approve request
- `PATCH /admin/bookings/:requestId/reject` - Reject request
- `GET /admin/bookings/room/:roomId` - Get bookings for a room

### Analytics
- `GET /analytics/rooms/availability` - Room availability report
- `GET /analytics/bookings/by-department` - Bookings by department
- `GET /analytics/bookings/by-date` - Bookings by date range

---

## 📌 Detailed Endpoint Reference

### 🏢 BLOCKS ENDPOINTS

#### GET /blocks
**List all blocks with pagination**

```http
GET /api/seminar-hall/blocks?page=1&limit=10&isActive=true
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Records per page (default: 10) |
| isActive | boolean | Filter by active status |
| search | string | Search by name or location |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-123",
      "name": "Block A",
      "blockNumber": "A1",
      "location": "North Campus",
      "description": "Computer Science Block",
      "isActive": true,
      "floorCount": 3,
      "roomCount": 9,
      "createdAt": "2025-04-28T10:00:00Z",
      "updatedAt": "2025-04-28T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 4,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

---

#### GET /blocks/:blockId
**Get single block with all nested data**

```http
GET /api/seminar-hall/blocks/uuid-123
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "name": "Block A",
    "blockNumber": "A1",
    "location": "North Campus",
    "description": "Computer Science Block",
    "isActive": true,
    "createdAt": "2025-04-28T10:00:00Z",
    "updatedAt": "2025-04-28T10:00:00Z",
    "floors": [
      {
        "id": "uuid-456",
        "blockId": "uuid-123",
        "floorNumber": 1,
        "name": "Ground Floor",
        "description": "Level 0",
        "isActive": true,
        "rooms": [
          {
            "id": "uuid-789",
            "floorId": "uuid-456",
            "name": "SH-101",
            "roomNumber": "101",
            "type": "seminar_hall",
            "capacity": 60,
            "chairs": 60,
            "isActive": true,
            "facilities": [
              {
                "id": "uuid-fac1",
                "name": "Projector",
                "quantity": 1
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

#### GET /blocks/:blockId/floors
**List all floors in a block**

```http
GET /api/seminar-hall/blocks/uuid-123/floors?page=1&limit=20
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-456",
      "blockId": "uuid-123",
      "blockName": "Block A",
      "floorNumber": 1,
      "name": "Ground Floor",
      "description": "Level 0",
      "isActive": true,
      "roomCount": 3,
      "createdAt": "2025-04-28T10:00:00Z"
    }
  ],
  "pagination": { "total": 3, "page": 1, "limit": 20, "pages": 1 }
}
```

---

### 🚪 ROOMS ENDPOINTS

#### GET /floors/:floorId/rooms
**List all rooms on a floor**

```http
GET /api/seminar-hall/floors/uuid-456/rooms?type=seminar_hall&available=true
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| type | enum | Filter by room type |
| minCapacity | number | Minimum capacity |
| maxCapacity | number | Maximum capacity |
| available | boolean | Only show available rooms |
| date | date | Check availability for specific date |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-789",
      "floorId": "uuid-456",
      "floorName": "Ground Floor",
      "blockName": "Block A",
      "name": "SH-101",
      "roomNumber": "101",
      "type": "seminar_hall",
      "capacity": 60,
      "chairs": 60,
      "description": "Large seminar hall",
      "isActive": true,
      "facilities": [
        {
          "id": "uuid-fac1",
          "name": "Projector",
          "category": "visual",
          "quantity": 1
        },
        {
          "id": "uuid-fac2",
          "name": "Microphone",
          "category": "audio",
          "quantity": 3
        }
      ],
      "availability": {
        "date": "2025-05-15",
        "slots": {
          "AM": true,
          "PM": false,
          "times": [
            { "time": "09:00-10:00", "available": true },
            { "time": "10:00-11:00", "available": true },
            { "time": "14:00-15:00", "available": false }
          ]
        }
      },
      "createdAt": "2025-04-28T10:00:00Z"
    }
  ]
}
```

---

#### GET /rooms/:roomId
**Get detailed room information**

```http
GET /api/seminar-hall/rooms/uuid-789
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-789",
    "blockId": "uuid-123",
    "blockName": "Block A",
    "floorId": "uuid-456",
    "floorName": "Ground Floor",
    "name": "SH-101",
    "roomNumber": "101",
    "type": "seminar_hall",
    "capacity": 60,
    "chairs": 60,
    "description": "Large seminar hall with AV setup",
    "isActive": true,
    "facilities": [
      {
        "id": "uuid-fac1",
        "facilityId": "uuid-fac-001",
        "name": "Projector",
        "category": "visual",
        "quantity": 1,
        "notes": "Wall-mounted, HD resolution"
      },
      {
        "id": "uuid-fac2",
        "facilityId": "uuid-fac-002",
        "name": "Microphone",
        "category": "audio",
        "quantity": 3,
        "notes": "Wireless microphones available"
      },
      {
        "id": "uuid-fac3",
        "facilityId": "uuid-fac-003",
        "name": "WiFi",
        "category": "tech",
        "quantity": 1
      }
    ],
    "upcomingBookings": [
      {
        "requestId": "REQ-2025-0001",
        "date": "2025-05-15",
        "startTime": "09:00",
        "endTime": "11:00",
        "timeSlot": "AM",
        "requesterName": "Dr. John Smith",
        "status": "approved"
      }
    ],
    "createdAt": "2025-04-28T10:00:00Z"
  }
}
```

---

### 📅 BOOKING ENDPOINTS

#### POST /bookings
**Create a new booking request**

```http
POST /api/seminar-hall/bookings
Content-Type: application/json
Authorization: Bearer <token>

{
  "roomId": "uuid-789",
  "bookingDate": "2025-05-15",
  "startTime": "09:00",
  "endTime": "11:00",
  "timeSlot": "AM",
  "purpose": "Python Workshop - Advanced OOP",
  "requesterName": "Dr. John Smith",
  "requesterEmail": "john.smith@university.edu",
  "requesterPhone": "+91-9876543210",
  "department": "Computer Science",
  "additionalRequirements": "Please enable WiFi and projector"
}
```

**Validation Rules:**
- `roomId`: Must exist and be active
- `bookingDate`: Cannot be in the past
- `startTime` & `endTime`: Valid HH:MM format, must be different
- `timeSlot`: "AM", "PM", "FULL_DAY", or time range like "9:00-11:00"
- `requesterEmail`: Valid email format, unique per booking
- `department`: Non-empty string
- No overlapping bookings for same room

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-req1",
    "requestId": "REQ-2025-0001",
    "roomId": "uuid-789",
    "roomName": "SH-101",
    "blockName": "Block A",
    "floorName": "Ground Floor",
    "requesterName": "Dr. John Smith",
    "requesterEmail": "john.smith@university.edu",
    "requesterPhone": "+91-9876543210",
    "department": "Computer Science",
    "bookingDate": "2025-05-15",
    "startTime": "09:00",
    "endTime": "11:00",
    "timeSlot": "AM",
    "purpose": "Python Workshop - Advanced OOP",
    "additionalRequirements": "Please enable WiFi and projector",
    "requestKind": "new_booking",
    "status": "pending",
    "createdAt": "2025-04-28T10:30:00Z"
  },
  "message": "Booking request created successfully. Request ID: REQ-2025-0001"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Room not available for selected date/time",
  "code": "ROOM_NOT_AVAILABLE",
  "details": {
    "conflicts": [
      {
        "requestId": "REQ-2025-0002",
        "date": "2025-05-15",
        "startTime": "09:30",
        "endTime": "10:30",
        "status": "approved"
      }
    ]
  }
}
```

---

#### GET /bookings
**List user's booking requests**

```http
GET /api/seminar-hall/bookings?status=pending&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | enum | Filter by status (pending, approved, etc.) |
| requestKind | enum | Filter by request kind |
| page | number | Page number |
| limit | number | Records per page |
| dateFrom | date | Start date for range |
| dateTo | date | End date for range |
| department | string | Filter by department |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-req1",
      "requestId": "REQ-2025-0001",
      "roomId": "uuid-789",
      "roomName": "SH-101",
      "roomType": "seminar_hall",
      "blockName": "Block A",
      "floorName": "Ground Floor",
      "requesterName": "Dr. John Smith",
      "department": "Computer Science",
      "bookingDate": "2025-05-15",
      "startTime": "09:00",
      "endTime": "11:00",
      "timeSlot": "AM",
      "purpose": "Python Workshop",
      "requestKind": "new_booking",
      "status": "pending",
      "createdAt": "2025-04-28T10:30:00Z"
    }
  ],
  "pagination": { "total": 5, "page": 1, "limit": 10, "pages": 1 }
}
```

---

#### GET /bookings/:requestId
**Get booking details**

```http
GET /api/seminar-hall/bookings/REQ-2025-0001
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-req1",
    "requestId": "REQ-2025-0001",
    "roomId": "uuid-789",
    "roomName": "SH-101",
    "roomType": "seminar_hall",
    "roomCapacity": 60,
    "blockName": "Block A",
    "floorName": "Ground Floor",
    "requesterName": "Dr. John Smith",
    "requesterEmail": "john.smith@university.edu",
    "requesterPhone": "+91-9876543210",
    "department": "Computer Science",
    "bookingDate": "2025-05-15",
    "startTime": "09:00",
    "endTime": "11:00",
    "timeSlot": "AM",
    "purpose": "Python Workshop - Advanced OOP",
    "additionalRequirements": "WiFi and projector required",
    "requestKind": "new_booking",
    "status": "pending",
    "roomFacilities": [
      { "name": "Projector", "quantity": 1 },
      { "name": "Microphone", "quantity": 3 },
      { "name": "WiFi", "quantity": 1 }
    ],
    "history": [
      {
        "action": "created",
        "oldStatus": null,
        "newStatus": "pending",
        "actionDetails": "Booking request submitted",
        "changedAt": "2025-04-28T10:30:00Z"
      }
    ],
    "createdAt": "2025-04-28T10:30:00Z",
    "updatedAt": "2025-04-28T10:30:00Z"
  }
}
```

---

#### POST /bookings/:requestId/cancel
**Request booking cancellation**

```http
POST /api/seminar-hall/bookings/REQ-2025-0001/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Schedule conflict"
}
```

**Behavior:**
- Only allowed if status is "approved"
- Creates a new "cancel_pending" request
- Original booking status remains "approved" until admin approval

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-req2",
    "requestId": "REQ-2025-0002",
    "originalRequestId": "REQ-2025-0001",
    "roomId": "uuid-789",
    "roomName": "SH-101",
    "bookingDate": "2025-05-15",
    "timeSlot": "AM",
    "requestKind": "cancel_request",
    "status": "cancel_pending",
    "originalBookingDate": "2025-05-15",
    "originalTimeSlot": "AM",
    "reason": "Schedule conflict",
    "createdAt": "2025-04-28T11:00:00Z"
  },
  "message": "Cancellation request created. Request ID: REQ-2025-0002"
}
```

---

#### POST /bookings/:requestId/reschedule
**Request booking reschedule**

```http
POST /api/seminar-hall/bookings/REQ-2025-0001/reschedule
Authorization: Bearer <token>
Content-Type: application/json

{
  "newBookingDate": "2025-05-20",
  "newStartTime": "14:00",
  "newEndTime": "16:00",
  "newTimeSlot": "PM",
  "reason": "Shifted to afternoon slot"
}
```

**Validation:**
- Original booking must be approved
- New date/time must be available
- Cannot reschedule to past dates

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-req3",
    "requestId": "REQ-2025-0003",
    "originalRequestId": "REQ-2025-0001",
    "roomId": "uuid-789",
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
    "reason": "Shifted to afternoon slot",
    "createdAt": "2025-04-28T11:00:00Z"
  }
}
```

---

### 👨‍💼 ADMIN ENDPOINTS

#### GET /admin/bookings
**List all pending requests for admin approval**

```http
GET /api/seminar-hall/admin/bookings?status=pending&kind=new_booking&page=1&limit=20
Authorization: Bearer <admin-token>
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | enum | pending, cancel_pending, reschedule_pending |
| kind | enum | new_booking, cancel_request, reschedule_request |
| page | number | Page number |
| limit | number | Records per page |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-req1",
      "requestId": "REQ-2025-0001",
      "roomId": "uuid-789",
      "roomName": "SH-101",
      "blockName": "Block A",
      "floorName": "Ground Floor",
      "requesterName": "Dr. John Smith",
      "requesterEmail": "john.smith@university.edu",
      "department": "Computer Science",
      "bookingDate": "2025-05-15",
      "startTime": "09:00",
      "endTime": "11:00",
      "purpose": "Python Workshop",
      "requestKind": "new_booking",
      "status": "pending",
      "additionalRequirements": "WiFi and projector required",
      "createdAt": "2025-04-28T10:30:00Z",
      "daysUntilBooking": 17
    }
  ],
  "pagination": { "total": 3, "page": 1, "limit": 20, "pages": 1 }
}
```

---

#### PATCH /admin/bookings/:requestId/approve
**Approve a booking request**

```http
PATCH /api/seminar-hall/admin/bookings/REQ-2025-0001/approve
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "remarks": "Approved. Ensure WiFi is working."
}
```

**Behavior by request kind:**
- `new_booking`: Status → "approved"
- `cancel_request`: Status → "cancelled" (original booking is cancelled)
- `reschedule_request`: Status → "rescheduled" (original booking changed to new date/time)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-req1",
    "requestId": "REQ-2025-0001",
    "status": "approved",
    "adminRemark": "Approved. Ensure WiFi is working.",
    "approvedBy": "admin-uuid",
    "approvedAt": "2025-04-28T15:30:00Z",
    "updatedAt": "2025-04-28T15:30:00Z"
  },
  "message": "Booking request approved successfully"
}
```

---

#### PATCH /admin/bookings/:requestId/reject
**Reject a booking request**

```http
PATCH /api/seminar-hall/admin/bookings/REQ-2025-0001/reject
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "rejectionReason": "Room not available for the requested time"
}
```

**Behavior by request kind:**
- `new_booking`: Status → "rejected"
- `cancel_request`: Status → "approved" (cancellation is rejected, booking remains approved)
- `reschedule_request`: Status → "approved" (reschedule is rejected, original booking remains approved)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-req1",
    "requestId": "REQ-2025-0001",
    "status": "rejected",
    "rejectionReason": "Room not available for the requested time",
    "rejectedBy": "admin-uuid",
    "rejectedAt": "2025-04-28T15:30:00Z",
    "updatedAt": "2025-04-28T15:30:00Z"
  },
  "message": "Booking request rejected successfully"
}
```

---

### 📊 ANALYTICS ENDPOINTS

#### GET /analytics/rooms/availability
**Get availability report for all rooms**

```http
GET /api/seminar-hall/analytics/rooms/availability?dateFrom=2025-05-01&dateTo=2025-05-31
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "reportDate": "2025-04-28",
    "dateRange": {
      "from": "2025-05-01",
      "to": "2025-05-31"
    },
    "rooms": [
      {
        "roomId": "uuid-789",
        "roomName": "SH-101",
        "blockName": "Block A",
        "roomType": "seminar_hall",
        "capacity": 60,
        "totalSlots": 62, // May-31 days × 2 (AM/PM)
        "bookedSlots": 8,
        "availableSlots": 54,
        "occupancyRate": 12.9,
        "bookings": [
          {
            "date": "2025-05-15",
            "timeSlot": "AM",
            "requesterName": "Dr. John Smith",
            "department": "Computer Science"
          }
        ]
      }
    ],
    "summary": {
      "totalRooms": 36,
      "totalSlots": 2232,
      "totalBooked": 156,
      "totalAvailable": 2076,
      "overallOccupancy": 6.99
    }
  }
}
```

---

#### GET /analytics/bookings/by-department
**Bookings breakdown by department**

```http
GET /api/seminar-hall/analytics/bookings/by-department?dateFrom=2025-01-01&dateTo=2025-12-31
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "department": "Computer Science",
      "totalBookings": 24,
      "approvedBookings": 20,
      "pendingBookings": 3,
      "rejectedBookings": 1,
      "cancelledBookings": 0,
      "bookingPercentage": 28.5
    },
    {
      "department": "Mechanical Engineering",
      "totalBookings": 18,
      "approvedBookings": 16,
      "pendingBookings": 2,
      "rejectedBookings": 0,
      "cancelledBookings": 0,
      "bookingPercentage": 21.4
    }
  ],
  "summary": {
    "totalBookings": 84,
    "totalApproved": 72,
    "totalPending": 8,
    "totalRejected": 4,
    "uniqueDepartments": 6
  }
}
```

---

## 🔐 Authentication & Authorization

All protected endpoints require:
```http
Authorization: Bearer <JWT_TOKEN>
```

**User Types:**
- `student` - Can create bookings, view own bookings
- `faculty` - Can create multiple bookings, view own bookings
- `admin` - Full access to all admin endpoints
- `superadmin` - System-wide access

---

## ❌ Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400,
  "details": {
    "field": "fieldName",
    "reason": "Detailed reason"
  }
}
```

### Common Error Codes
| Code | Status | Description |
|------|--------|-------------|
| ROOM_NOT_FOUND | 404 | Room doesn't exist |
| ROOM_NOT_AVAILABLE | 400 | Room is booked for requested time |
| INVALID_BOOKING_DATE | 400 | Past date or invalid format |
| BOOKING_NOT_FOUND | 404 | Booking request doesn't exist |
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Not allowed to access resource |
| VALIDATION_ERROR | 400 | Request validation failed |
| CONFLICT | 409 | Duplicate booking or conflict |

---

## 📝 Request/Response Examples

### Example: Complete Booking Flow

**Step 1: Browse rooms**
```bash
curl "http://localhost:5000/api/seminar-hall/blocks/uuid-123/floors" \
  -H "Authorization: Bearer token"
```

**Step 2: Check room availability**
```bash
curl "http://localhost:5000/api/seminar-hall/rooms/uuid-789?date=2025-05-15" \
  -H "Authorization: Bearer token"
```

**Step 3: Create booking**
```bash
curl -X POST "http://localhost:5000/api/seminar-hall/bookings" \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "uuid-789",
    "bookingDate": "2025-05-15",
    "startTime": "09:00",
    "endTime": "11:00",
    "timeSlot": "AM",
    "purpose": "Workshop",
    "requesterName": "Dr. John Smith",
    "requesterEmail": "john.smith@university.edu",
    "department": "Computer Science"
  }'
```

**Step 4: Check booking status (as user)**
```bash
curl "http://localhost:5000/api/seminar-hall/bookings?status=pending" \
  -H "Authorization: Bearer user-token"
```

**Step 5: Admin approves booking**
```bash
curl -X PATCH "http://localhost:5000/api/seminar-hall/admin/bookings/REQ-2025-0001/approve" \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{"remarks": "Approved"}'
```

---

## 🛠️ Implementation Checklist

- [ ] Set up Express routes in `backend/src/routes/seminarHall/`
- [ ] Create controllers in `backend/src/controllers/seminarHall/`
- [ ] Create services for business logic in `backend/src/services/seminarHall/`
- [ ] Add request validation middleware
- [ ] Add authentication middleware
- [ ] Add error handling middleware
- [ ] Create unit tests for each endpoint
- [ ] Create integration tests
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Test all endpoints with Postman
- [ ] Load test with sample data
- [ ] Deploy to staging

---

## 📚 Next Steps

1. Create Express route files
2. Implement controller methods
3. Add Prisma queries
4. Add validation & error handling
5. Test with Postman/curl
6. Connect frontend to API

