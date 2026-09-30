# Manual Migrations Directory

This directory contains SQL scripts for manual database operations when Prisma migrations are not working.

## 📁 Directory Structure

```
manual-migrations/
├── README.md                                    # This file
├── event-management-module.sql                  # Main migration script (execute this)
├── rollback-event-management-module.sql         # Undo migration (use carefully!)
└── quick-reference-queries.sql                  # Useful queries for testing
```

---

## 🚀 Quick Start

### 1. Execute Main Migration

**Option A: Using psql (Command Line)**
```bash
cd backend
psql -U your_username -d your_database_name -f prisma/manual-migrations/event-management-module.sql
```

**Option B: Using pgAdmin**
1. Open pgAdmin
2. Connect to your database
3. Open Query Tool (Tools → Query Tool)
4. Load file: `event-management-module.sql`
5. Execute (F5 or ▶️ button)

**Option C: Using DBeaver**
1. Open DBeaver
2. Connect to your database
3. Open SQL Editor (SQL Editor → New SQL Editor)
4. Load file: `event-management-module.sql`
5. Execute (Ctrl+Enter or ▶️ button)

**Option D: Using TablePlus**
1. Open TablePlus
2. Connect to your database
3. Open SQL tab
4. Paste content of `event-management-module.sql`
5. Run (Cmd+Return or Ctrl+Enter)

### 2. Verify Migration

After execution, check the output for:
```
✓ Event Management Module tables created successfully!
✓ Tables: Event, EventRegistration, EventVolunteer, EventEntry
✓ Enums: EventType, EventPaymentType, EventStatus, RegistrationStatus, PaymentStatus, EntryType
✓ Note table updated with event fields
✓ All indexes and foreign keys configured
```

Run verification queries (included at bottom of migration file):
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('Event', 'EventRegistration', 'EventVolunteer', 'EventEntry');
```

### 3. Regenerate Prisma Client

```bash
cd backend
npx prisma generate
```

### 4. Verify Backend Works

```bash
npm run dev
```

Visit: `http://localhost:5000/api/v1/events`

---

## 📄 File Descriptions

### `event-management-module.sql`

**Purpose:** Main migration script to create all Event Management tables and relationships.

**What it does:**
- ✅ Creates 6 enums (EventType, EventPaymentType, EventStatus, etc.)
- ✅ Adds 5 event fields to Note table
- ✅ Creates 4 new tables (Event, EventRegistration, EventVolunteer, EventEntry)
- ✅ Sets up all foreign keys and relationships
- ✅ Creates indexes for performance
- ✅ Uses IF NOT EXISTS for safe re-execution

**Safe to run multiple times:** Yes (idempotent)

**Estimated execution time:** 1-3 seconds

**Output:** Success messages and verification queries

---

### `rollback-event-management-module.sql`

**Purpose:** Complete rollback of Event Management module.

**⚠️ WARNING:** This script will **permanently delete**:
- All events
- All registrations
- All volunteers
- All entry/exit records
- Event fields from Note table
- All event-related enums

**When to use:**
- Testing migration in development
- Removing module completely
- Fixing broken migration

**NOT for production use!**

**How to use:**
```bash
# Review script first!
psql -U your_username -d your_database_name -f prisma/manual-migrations/rollback-event-management-module.sql
```

**Post-rollback steps:**
1. Remove event models from `schema.prisma`
2. Run `npx prisma generate`
3. Remove backend event modules
4. Remove frontend event components

---

### `quick-reference-queries.sql`

**Purpose:** Collection of useful SQL queries for development and testing.

**Categories:**
1. **Verification & Status** - Check tables, enums, foreign keys
2. **Event Queries** - List events, get details, filter by status
3. **Registration Queries** - View registrations, check capacity
4. **Volunteer Queries** - Manage volunteers, check permissions
5. **Entry/Exit Queries** - Track attendance, scan history
6. **Analytics** - Revenue, trends, attendance rates
7. **Cleanup Queries** - Delete old data (commented out for safety)
8. **Helper Queries** - Find issues, duplicates, conflicts

**How to use:**
- Copy individual queries as needed
- Modify `WHERE` clauses for your data
- Great for debugging and testing

**Not executable as a whole script** - pick and choose queries

---

## 🔧 Common Operations

### Check Migration Status

```sql
-- Check if tables exist
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('Event', 'EventRegistration', 'EventVolunteer', 'EventEntry');
-- Should return: 4
```

### Verify Enums

```sql
SELECT typname FROM pg_type 
WHERE typname IN ('EventType', 'EventPaymentType', 'EventStatus', 
                  'RegistrationStatus', 'PaymentStatus', 'EntryType');
-- Should return: 6 rows
```

### Test Event Creation

```sql
-- Simple test insert (change UUIDs to actual IDs from your database)
INSERT INTO "Event" (
    "id", "eventId", "notingId", "name", "eventType",
    "startDate", "endDate", "paymentType", "status",
    "createdById", "createdAt", "updatedAt"
) VALUES (
    gen_random_uuid()::text,
    'EVT-TEST-001',
    'your-noting-id',
    'Test Event',
    'workshop',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '7 days' + INTERVAL '4 hours',
    'free',
    'draft',
    'your-user-id',
    NOW(),
    NOW()
);
```

---

## 🐛 Troubleshooting

### Error: "type already exists"

**Problem:** Enum was partially created

**Solution:**
```sql
-- Check which enums exist
SELECT typname FROM pg_type WHERE typname LIKE '%Event%';

-- Drop specific enum if needed (be careful with CASCADE!)
DROP TYPE "EventType" CASCADE;

-- Re-run migration
```

### Error: "table already exists"

**Problem:** Table was partially created

**Solution:**
```sql
-- Check which tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE '%Event%';

-- Drop specific table if needed
DROP TABLE IF EXISTS "Event" CASCADE;

-- Re-run migration
```

### Error: "column already exists"

**Problem:** Note table was partially modified

**Solution:**
```sql
-- Check which columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'Note' AND column_name LIKE 'event%';

-- Migration script handles this automatically with IF NOT EXISTS
-- Just re-run the migration
```

### Error: Foreign key constraint violation

**Problem:** Trying to reference non-existent records

**Solution:**
1. Ensure Note table exists and has data
2. Ensure UserLogin table exists and has users
3. Use valid IDs when inserting test data

---

## 📊 Migration Checklist

After running migration, verify:

- [ ] All 4 tables created (Event, EventRegistration, EventVolunteer, EventEntry)
- [ ] All 6 enums created
- [ ] Note table has 5 event-related columns
- [ ] Foreign keys correctly linked (run verification query from migration file)
- [ ] Indexes created (check with `\di` in psql)
- [ ] Prisma client regenerated (`npx prisma generate`)
- [ ] Backend starts without errors
- [ ] Event API endpoints accessible
- [ ] Frontend can fetch events

---

## 🔐 Security Notes

1. **Backup First:** Always backup before running migrations in production
2. **Test in Dev:** Test all scripts in development environment first
3. **Review Scripts:** Read and understand scripts before execution
4. **Rollback Plan:** Have rollback script ready if needed
5. **Access Control:** Ensure database user has appropriate permissions

---

## 📞 Support

If you encounter issues:

1. Check PostgreSQL logs: `tail -f /var/log/postgresql/postgresql.log`
2. Verify Prisma schema matches: `npx prisma db pull`
3. Check migration status: `npx prisma migrate status`
4. Review detailed guide: `../migrations/EVENT_MANAGEMENT_MIGRATION_GUIDE.md`

---

## 🔄 Migration to Prisma

Once Prisma migrations work again:

```bash
# Mark this migration as applied
npx prisma migrate resolve --applied 20260207000000_add_event_management_module

# Verify status
npx prisma migrate status

# Future migrations will work normally
npx prisma migrate dev --name your_migration_name
```

---

**Last Updated:** February 7, 2026  
**Compatible with:** PostgreSQL 12+  
**Prisma Version:** 5.x  
**Module Version:** 1.0.0
