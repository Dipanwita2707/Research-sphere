# Seminar Hall Booking - Database Setup Guide

## 🚀 Getting Started

### Step 1: Generate Prisma Migration

After updating the schema, generate and apply the migration:

```bash
cd backend

# Create a new migration with a descriptive name
npx prisma migrate dev --name "add_seminar_hall_booking_system"

# This will:
# 1. Detect schema changes
# 2. Generate SQL migration file
# 3. Apply migration to database
# 4. Regenerate Prisma Client
```

**Expected output:**
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database

✔ Enter a name for the new migration: › add_seminar_hall_booking_system
✔ Created prisma/migrations/[timestamp]_add_seminar_hall_booking_system/migration.sql

✔ Database has been created with this migration.

✔ Generated Prisma Client (v5.22.0) in node_modules/@prisma/client
```

---

### Step 2: Regenerate Prisma Client

```bash
npm run prisma:generate

# Or manually:
npx prisma generate
```

---

### Step 3: Verify Database Connection

```bash
# View database schema in visual UI
npm run prisma:studio

# This opens: http://localhost:5555
# You should see all 7 new tables with no data yet
```

---

### Step 4: Seed Initial Data

```bash
# Run the seed script to populate with sample data
node backend/prisma/seed-seminar-hall.js

# Or register seed script in package.json for automated seeding:
# Add to package.json "seed" script:
# "seed": "prisma db seed"

# Then run:
npx prisma db seed
```

**Expected seed output:**
```
🌱 Seeding Seminar Hall Booking System...

📝 Creating Facilities...
✅ Created 10 facilities

🏢 Creating Blocks...
✅ Created 4 blocks

📍 Creating Floors...
✅ Created 12 floors

🚪 Creating Rooms...
✅ Created 36 rooms with facilities

📅 Creating Sample Booking Requests...
✅ Created 4 sample booking requests

📜 Creating Booking History...
✅ Created booking history entries

✨ Database seeding completed successfully!

Summary:
  ✓ Facilities: 10
  ✓ Blocks: 4
  ✓ Floors: 12
  ✓ Rooms: 36
  ✓ Booking Requests: 4
```

---

### Step 5: Update package.json

Ensure your `backend/package.json` includes the seed script:

```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "postinstall": "prisma generate",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "seed": "node prisma/seed-seminar-hall.js",
    "seed:prisma": "prisma db seed",
    "test": "jest"
  }
}
```

---

## 📋 Database Schema SQL (Auto-Generated)

When you run `prisma migrate dev`, Prisma generates SQL like:

```sql
-- CreateEnum
CREATE TYPE "room_type_enum" AS ENUM ('seminar_hall', 'auditorium', 'classroom', 'conference_room', 'meeting_room', 'lab', 'workshop_space');
CREATE TYPE "booking_request_status_enum" AS ENUM ('pending', 'approved', 'rejected', 'cancel_pending', 'cancelled', 'reschedule_pending', 'rescheduled');
CREATE TYPE "booking_request_kind_enum" AS ENUM ('new_booking', 'cancel_request', 'reschedule_request');

-- CreateTable seminar_hall_block
CREATE TABLE "seminar_hall_block" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "block_number" VARCHAR(20),
    "location" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seminar_hall_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable seminar_hall_floor
CREATE TABLE "seminar_hall_floor" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "block_id" UUID NOT NULL,
    "floor_number" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seminar_hall_floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable seminar_hall_room
CREATE TABLE "seminar_hall_room" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "block_id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "room_number" VARCHAR(20),
    "room_type" "room_type_enum" NOT NULL DEFAULT 'seminar_hall',
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "chairs" INTEGER NOT NULL DEFAULT 30,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seminar_hall_room_pkey" PRIMARY KEY ("id")
);

-- CreateTable room_facility
CREATE TABLE "room_facility" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable room_facility_mapping
CREATE TABLE "room_facility_mapping" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "room_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_facility_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable seminar_hall_booking_request
CREATE TABLE "seminar_hall_booking_request" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "request_id" VARCHAR(20) NOT NULL,
    "room_id" UUID NOT NULL,
    "requester_name" VARCHAR(100) NOT NULL,
    "requester_email" CITEXT NOT NULL,
    "requester_phone" VARCHAR(20),
    "department" VARCHAR(100) NOT NULL,
    "booking_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "time_slot" VARCHAR(20) NOT NULL,
    "purpose" VARCHAR(255) NOT NULL,
    "additional_requirements" TEXT,
    "request_kind" "booking_request_kind_enum" NOT NULL DEFAULT 'new_booking',
    "status" "booking_request_status_enum" NOT NULL DEFAULT 'pending',
    "original_booking_date" DATE,
    "original_time_slot" VARCHAR(20),
    "original_start_time" VARCHAR(5),
    "original_end_time" VARCHAR(5),
    "requested_booking_date" DATE,
    "requested_time_slot" VARCHAR(20),
    "requested_start_time" VARCHAR(5),
    "requested_end_time" VARCHAR(5),
    "admin_remark" TEXT,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "rejected_by" UUID,
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seminar_hall_booking_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable seminar_hall_booking_history
CREATE TABLE "seminar_hall_booking_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "booking_request_id" UUID NOT NULL,
    "old_status" VARCHAR(50),
    "new_status" VARCHAR(50) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "action_details" TEXT,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seminar_hall_booking_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seminar_hall_block_name_key" ON "seminar_hall_block"("name");
CREATE UNIQUE INDEX "seminar_hall_floor_block_id_floor_number_key" ON "seminar_hall_floor"("block_id", "floor_number");
CREATE UNIQUE INDEX "seminar_hall_floor_block_id_name_key" ON "seminar_hall_floor"("block_id", "name");
CREATE UNIQUE INDEX "seminar_hall_room_floor_id_name_key" ON "seminar_hall_room"("floor_id", "name");
CREATE UNIQUE INDEX "seminar_hall_room_floor_id_room_number_key" ON "seminar_hall_room"("floor_id", "room_number");
CREATE UNIQUE INDEX "room_facility_name_key" ON "room_facility"("name");
CREATE UNIQUE INDEX "room_facility_mapping_room_id_facility_id_key" ON "room_facility_mapping"("room_id", "facility_id");
CREATE UNIQUE INDEX "seminar_hall_booking_request_request_id_key" ON "seminar_hall_booking_request"("request_id");

-- CreateIndex (for performance)
CREATE INDEX "seminar_hall_block_is_active_idx" ON "seminar_hall_block"("is_active");
CREATE INDEX "seminar_hall_floor_block_id_idx" ON "seminar_hall_floor"("block_id");
CREATE INDEX "seminar_hall_floor_is_active_idx" ON "seminar_hall_floor"("is_active");
CREATE INDEX "seminar_hall_room_block_id_idx" ON "seminar_hall_room"("block_id");
CREATE INDEX "seminar_hall_room_floor_id_idx" ON "seminar_hall_room"("floor_id");
CREATE INDEX "seminar_hall_room_type_idx" ON "seminar_hall_room"("room_type");
CREATE INDEX "seminar_hall_room_is_active_idx" ON "seminar_hall_room"("is_active");
CREATE INDEX "room_facility_mapping_room_id_idx" ON "room_facility_mapping"("room_id");
CREATE INDEX "room_facility_mapping_facility_id_idx" ON "room_facility_mapping"("facility_id");
CREATE INDEX "seminar_hall_booking_request_room_id_idx" ON "seminar_hall_booking_request"("room_id");
CREATE INDEX "seminar_hall_booking_request_booking_date_idx" ON "seminar_hall_booking_request"("booking_date");
CREATE INDEX "seminar_hall_booking_request_status_idx" ON "seminar_hall_booking_request"("status");
CREATE INDEX "seminar_hall_booking_request_request_kind_idx" ON "seminar_hall_booking_request"("request_kind");
CREATE INDEX "seminar_hall_booking_request_requester_email_idx" ON "seminar_hall_booking_request"("requester_email");
CREATE INDEX "seminar_hall_booking_request_department_idx" ON "seminar_hall_booking_request"("department");
CREATE INDEX "seminar_hall_booking_request_created_at_idx" ON "seminar_hall_booking_request"("created_at");
CREATE INDEX "seminar_hall_booking_request_approved_at_idx" ON "seminar_hall_booking_request"("approved_at");
CREATE INDEX "seminar_hall_booking_history_booking_request_id_idx" ON "seminar_hall_booking_history"("booking_request_id");
CREATE INDEX "seminar_hall_booking_history_changed_at_idx" ON "seminar_hall_booking_history"("changed_at");

-- AddForeignKey
ALTER TABLE "seminar_hall_floor" ADD CONSTRAINT "seminar_hall_floor_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "seminar_hall_block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seminar_hall_room" ADD CONSTRAINT "seminar_hall_room_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "seminar_hall_block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seminar_hall_room" ADD CONSTRAINT "seminar_hall_room_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "seminar_hall_floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_facility_mapping" ADD CONSTRAINT "room_facility_mapping_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "seminar_hall_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_facility_mapping" ADD CONSTRAINT "room_facility_mapping_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "room_facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seminar_hall_booking_request" ADD CONSTRAINT "seminar_hall_booking_request_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "seminar_hall_room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seminar_hall_booking_history" ADD CONSTRAINT "seminar_hall_booking_history_booking_request_id_fkey" FOREIGN KEY ("booking_request_id") REFERENCES "seminar_hall_booking_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## 🔍 Verifying the Migration

After running the migration, verify it worked:

### Option 1: Using Prisma Studio
```bash
npm run prisma:studio
# Opens http://localhost:5555
# Check all 7 tables are created
```

### Option 2: Using psql (PostgreSQL CLI)
```bash
# Connect to your database
psql -U your_user -d your_database

# List all tables
\dt seminar_hall_*

# Describe a specific table
\d seminar_hall_block

# Count records
SELECT COUNT(*) FROM seminar_hall_block;
```

### Option 3: Check Prisma migrations
```bash
# View applied migrations
ls -la backend/prisma/migrations/

# View migration history
cat backend/prisma/migrations/_migration_lock.toml
```

---

## 🌱 Seeding Data

### Automated Seeding (Recommended)

Update `backend/prisma/package.json` to auto-seed:

```json
{
  "prisma": {
    "seed": "node prisma/seed-seminar-hall.js"
  }
}
```

Then run:
```bash
cd backend
npx prisma db seed
```

### Manual Seeding

```bash
cd backend
node prisma/seed-seminar-hall.js
```

### Verify Seeded Data

```bash
# Using Prisma Studio
npm run prisma:studio
# Navigate to each table to see data

# Or with raw SQL
psql -U your_user -d your_database

# Count records in each table
SELECT 'Blocks' as table_name, COUNT(*) as count FROM seminar_hall_block
UNION ALL
SELECT 'Floors', COUNT(*) FROM seminar_hall_floor
UNION ALL
SELECT 'Rooms', COUNT(*) FROM seminar_hall_room
UNION ALL
SELECT 'Facilities', COUNT(*) FROM room_facility
UNION ALL
SELECT 'Booking Requests', COUNT(*) FROM seminar_hall_booking_request;
```

---

## 🛠️ Troubleshooting

### Issue: Migration fails with "relation already exists"
**Solution:** The tables might already exist. Check migration history:
```bash
npx prisma migrate status
```

If you need to reset:
```bash
npx prisma migrate reset  # ⚠️ WARNING: Deletes all data!
```

### Issue: Prisma Client not generated
**Solution:** Regenerate Prisma Client:
```bash
npm run prisma:generate
```

### Issue: Foreign key constraint violated
**Solution:** Check that all related records exist before creating dependent records.

### Issue: Seed script fails
**Solution:** Ensure:
1. Database connection is working
2. Prisma Client is generated
3. All required environment variables are set (DATABASE_URL)

---

## 📈 Next Steps

1. ✅ **Database Schema Created** (You are here)
2. **Create Backend API Endpoints** (Next)
   - GET /api/seminar-hall/blocks
   - GET /api/seminar-hall/blocks/:id/floors
   - GET /api/seminar-hall/floors/:id/rooms
   - POST /api/seminar-hall/bookings (create new booking)
   - GET /api/seminar-hall/bookings (user's bookings)
   - GET /api/seminar-hall/admin/bookings (admin queue)
   - PATCH /api/seminar-hall/bookings/:id (approve/reject)
3. **Create Validation & Business Logic**
   - Check room availability
   - Validate time slots
   - Enforce booking rules
4. **Connect Frontend to Backend API**
   - Replace static store with API calls
   - Add loading states
   - Error handling

---

## 📚 Reference

- **Prisma Docs:** https://www.prisma.io/docs/
- **PostgreSQL ENUM:** https://www.postgresql.org/docs/current/datatype-enum.html
- **UUID in PostgreSQL:** https://www.postgresql.org/docs/current/uuid-ossp.html
- **Prisma Relations:** https://www.prisma.io/docs/concepts/components/prisma-schema/relations
- **Seed Script Guide:** https://www.prisma.io/docs/guides/database/seed-database

