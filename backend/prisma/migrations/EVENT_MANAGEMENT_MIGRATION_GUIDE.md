# Event Management Module - Database Migration Guide

## Overview

This guide provides instructions for setting up the Event Management module database schema. Due to current migration issues, we provide both **manual SQL scripts** for immediate use and **proper Prisma migrations** for future use.

---

## 📋 Module Structure

The Event Management module includes:

### **Database Tables**
1. **Event** - Core event details (linked to Noting via `notingId`)
2. **EventRegistration** - User registrations with QR codes
3. **EventVolunteer** - Volunteer assignments with permissions
4. **EventEntry** - Entry/exit audit trail

### **Enums**
- `EventType` - workshop, seminar, conference, competition, cultural, sports, tech_fest, hackathon, webinar, other
- `EventPaymentType` - free, paid
- `EventStatus` - draft, published, ongoing, completed, cancelled
- `RegistrationStatus` - pending, confirmed, cancelled, waitlisted
- `PaymentStatus` - pending, completed, failed, refunded
- `EntryType` - entry, exit

### **Note Table Extensions**
Added fields to enable event creation from noting:
- `eventName` (TEXT)
- `eventType` (EventType)
- `eventStartDate` (TIMESTAMP)
- `eventEndDate` (TIMESTAMP)
- `eventPaymentType` (EventPaymentType)

---

## 🚀 Quick Start (Manual Execution)

### Step 1: Execute Manual SQL

```bash
# Navigate to backend directory
cd backend

# Connect to your PostgreSQL database using psql
psql -U your_username -d your_database_name -f prisma/manual-migrations/event-management-module.sql

# OR using GUI tools like pgAdmin, DBeaver, or TablePlus:
# 1. Open the SQL file: backend/prisma/manual-migrations/event-management-module.sql
# 2. Execute the entire script
```

### Step 2: Verify Tables Created

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('Event', 'EventRegistration', 'EventVolunteer', 'EventEntry');

-- Should return 4 rows
```

### Step 3: Regenerate Prisma Client

```bash
# Generate Prisma Client with new models
npx prisma generate

# Verify schema is in sync (should show no changes needed)
npx prisma db pull
```

### Step 4: Test Backend Endpoints

```bash
# Start backend server
npm run dev

# Test event endpoints
curl http://localhost:5000/api/v1/events
```

---

## 📁 Migration Files Structure

```
backend/prisma/
├── migrations/
│   ├── 20260207000000_add_event_management_module/
│   │   └── migration.sql                    # Standard Prisma migration format
│   └── migration_lock.toml
├── manual-migrations/
│   └── event-management-module.sql          # Manual execution script
└── schema.prisma                            # Source of truth
```

### Migration File Locations

1. **Manual Execution (Use Now)**
   - Path: `backend/prisma/manual-migrations/event-management-module.sql`
   - Purpose: Direct database execution for immediate setup
   - Format: PostgreSQL with safety checks (IF NOT EXISTS)

2. **Prisma Migration (Use Later)**
   - Path: `backend/prisma/migrations/20260207000000_add_event_management_module/migration.sql`
   - Purpose: Standard Prisma migration for version control
   - Format: Standard Prisma migration syntax

---

## 🔄 When Migrations Work Again

Once Prisma migrations are fixed, use this workflow:

```bash
# Mark manual migration as applied (so Prisma knows it exists)
npx prisma migrate resolve --applied 20260207000000_add_event_management_module

# Verify migration status
npx prisma migrate status

# Future migrations
npx prisma migrate dev --name your_migration_name
```

---

## 🗂️ Schema Relationships

```
Note (existing)
  └─ eventName, eventType, eventStartDate, eventEndDate, eventPaymentType

Event
  ├─ notingId → Note.id (UNIQUE, one event per noting)
  ├─ createdById → UserLogin.id
  └─ EventRegistrations[]
      └─ EventEntry[]

EventVolunteer
  ├─ userId → UserLogin.id
  ├─ eventId → Event.id
  └─ EventEntry[] (as volunteer)

EventRegistration
  ├─ userId → UserLogin.id
  ├─ eventId → Event.id
  └─ EventEntry[]
```

---

## ⚠️ Important Notes

### Foreign Key Constraints

- **Event.notingId** → `ON DELETE RESTRICT` (cannot delete noting if event exists)
- **Event.createdById** → `ON DELETE RESTRICT` (cannot delete user if they created events)
- **EventRegistration** → `ON DELETE CASCADE` (deletes registrations when event deleted)
- **EventVolunteer** → `ON DELETE CASCADE` (removes volunteers when event deleted)
- **EventEntry** → `ON DELETE CASCADE` (removes entry logs when registration/volunteer deleted)

### Unique Constraints

- `Event.eventId` - Unique event identifier (format: EVT-2026-001)
- `Event.notingId` - One event per noting
- `EventRegistration.registrationId` - Unique registration ID (format: REG-{eventId}-001)
- `EventRegistration.qrCode` - Unique QR code for each registration
- `EventRegistration(eventId, userId)` - One registration per user per event
- `EventVolunteer(eventId, userId)` - One volunteer assignment per user per event

### Indexes

All foreign keys, unique fields, and frequently queried fields are indexed for performance:
- Event: `eventId`, `notingId`, `status`, `eventType`, `createdById`, `startDate`
- EventRegistration: `registrationId`, `eventId`, `userId`, `qrCode`, `status`
- EventVolunteer: `eventId`, `userId`, `canScanQr`
- EventEntry: `eventId`, `registrationId`, `volunteerId`, `entryType`, `scannedAt`

---

## 🧪 Testing Queries

### Create Test Event

```sql
-- 1. First create a noting with event fields (via API or manual)
UPDATE "Note" 
SET 
  "eventName" = 'Tech Workshop 2026',
  "eventType" = 'workshop',
  "eventStartDate" = '2026-03-01 10:00:00',
  "eventEndDate" = '2026-03-01 16:00:00',
  "eventPaymentType" = 'free'
WHERE "id" = 'your-noting-id';

-- 2. Create event (normally done via backend auto-creation on noting approval)
INSERT INTO "Event" (
  "id", "eventId", "notingId", "name", "eventType", 
  "startDate", "endDate", "paymentType", "status", 
  "createdById", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  'EVT-2026-001',
  'your-noting-id',
  'Tech Workshop 2026',
  'workshop',
  '2026-03-01 10:00:00',
  '2026-03-01 16:00:00',
  'free',
  'draft',
  'your-user-id',
  NOW(),
  NOW()
);
```

### Query Event Statistics

```sql
SELECT 
  e."name",
  e."status",
  COUNT(DISTINCT er."id") as total_registrations,
  COUNT(DISTINCT CASE WHEN er."status" = 'confirmed' THEN er."id" END) as confirmed,
  COUNT(DISTINCT CASE WHEN er."hasEntered" = true THEN er."id" END) as attended,
  COUNT(DISTINCT ev."id") as total_volunteers
FROM "Event" e
LEFT JOIN "EventRegistration" er ON e."id" = er."eventId"
LEFT JOIN "EventVolunteer" ev ON e."id" = ev."eventId"
WHERE e."eventId" = 'EVT-2026-001'
GROUP BY e."id", e."name", e."status";
```

---

## 🐛 Troubleshooting

### Issue: "Type already exists" error

```sql
-- Check if enum exists before creating
SELECT typname FROM pg_type WHERE typname = 'EventType';

-- If exists, skip creation or drop and recreate
DROP TYPE IF EXISTS "EventType" CASCADE;
```

### Issue: Foreign key constraint fails

```bash
# Ensure parent tables exist
psql -d your_database -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('Note', 'UserLogin');"
```

### Issue: Prisma Client out of sync

```bash
# Regenerate Prisma Client
npx prisma generate

# Force regenerate
rm -rf node_modules/.prisma
npx prisma generate
```

---

## ✅ Verification Checklist

After running migrations, verify:

- [ ] All 4 tables created (Event, EventRegistration, EventVolunteer, EventEntry)
- [ ] All 6 enums created (EventType, EventPaymentType, EventStatus, etc.)
- [ ] Note table has 5 new event fields
- [ ] All foreign keys properly linked
- [ ] All unique constraints in place
- [ ] Indexes created (check with `\di` in psql)
- [ ] Prisma Client regenerated successfully
- [ ] Backend server starts without errors
- [ ] Event endpoints accessible

---

## 📚 Additional Resources

- [Prisma Schema File](../schema.prisma) - Source of truth for schema
- [Event Backend Module](../../src/modules/event-management/) - Backend implementation
- [Event Management API Docs](../../src/modules/event-management/README.md) - API endpoints
- [Frontend Event Components](../../../frontend/src/features/event-management/) - UI implementation

---

## 🔐 Security Considerations

1. **QR Codes** - Use cryptographic hashing for QR code generation
2. **Payment IDs** - Encrypt payment-related data
3. **Volunteer Permissions** - Validate `canScanQr` before scanning
4. **Event Creator** - Verify creator permissions before modifications
5. **Cascade Deletes** - Be cautious with event deletions (affects all registrations)

---

## 📞 Support

If you encounter issues:

1. Check the verification queries in the manual SQL file
2. Review Prisma migration status: `npx prisma migrate status`
3. Check database logs for constraint violations
4. Verify schema.prisma matches database structure: `npx prisma db pull`

---

**Last Updated:** February 7, 2026  
**Module Version:** 1.0.0  
**Migration ID:** 20260207000000
