const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  console.log('🔧 Creating hostel tables...\n');

  try {
    // Step 1: Create room_type_enum
    console.log('1️⃣  Creating room_type_enum...');
    await prisma.$executeRaw`
      DO $$ BEGIN
        CREATE TYPE "room_type_enum" AS ENUM ('standard', 'deluxe', 'suite', 'presidential', 'ac', 'non_ac');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    // Step 2: Create booking_status_enum
    console.log('2️⃣  Creating booking_status_enum...');
    await prisma.$executeRaw`
      DO $$ BEGIN
        CREATE TYPE "booking_status_enum" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    // Step 3: Create hostel table
    console.log('3️⃣  Creating hostel table...');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "hostel" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "name" VARCHAR(200) NOT NULL,
        "description" TEXT,
        "address" TEXT,
        "phone" VARCHAR(20),
        "email" VARCHAR(100),
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "hostel_pkey" PRIMARY KEY ("id")
      )
    `;

    // Step 4: Create hostel_room table
    console.log('4️⃣  Creating hostel_room table...');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "hostel_room" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "hostel_id" UUID NOT NULL,
        "room_number" VARCHAR(50) NOT NULL,
        "floor_number" INTEGER,
        "room_type" "room_type_enum" NOT NULL DEFAULT 'standard',
        "max_occupancy" INTEGER NOT NULL DEFAULT 2,
        "price_per_night" DECIMAL(10,2) NOT NULL DEFAULT 1000,
        "amenities" TEXT,
        "is_available" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "hostel_room_pkey" PRIMARY KEY ("id")
      )
    `;

    // Step 5: Update hostel_booking table
    console.log('5️⃣  Updating hostel_booking table...');
    await prisma.$executeRaw`ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "room_id" UUID`;
    await prisma.$executeRaw`ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "guest_count" INTEGER DEFAULT 1`;
    await prisma.$executeRaw`ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "total_price" DECIMAL(10,2)`;
    await prisma.$executeRaw`ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "payment_status" VARCHAR(32) DEFAULT 'pending'`;
    await prisma.$executeRaw`ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "payment_qr_code" TEXT`;
    await prisma.$executeRaw`ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "payment_reference" VARCHAR(100)`;
    await prisma.$executeRaw`ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "booking_status" "booking_status_enum" DEFAULT 'pending'`;

    // Step 6: Create indexes
    console.log('6️⃣  Creating indexes...');
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "hostel_name_key" ON "hostel"("name")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "hostel_is_active_idx" ON "hostel"("is_active")`;
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "hostel_room_hostel_id_room_number_key" ON "hostel_room"("hostel_id", "room_number")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "hostel_room_hostel_id_idx" ON "hostel_room"("hostel_id")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "hostel_room_is_available_idx" ON "hostel_room"("is_available")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "hostel_room_room_type_idx" ON "hostel_room"("room_type")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "hostel_booking_room_id_idx" ON "hostel_booking"("room_id")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "hostel_booking_booking_status_idx" ON "hostel_booking"("booking_status")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "hostel_booking_check_in_date_idx" ON "hostel_booking"("check_in_date")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "hostel_booking_check_out_date_idx" ON "hostel_booking"("check_out_date")`;

    // Step 7: Add foreign keys
    console.log('7️⃣  Adding foreign keys...');
    await prisma.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "hostel_room" ADD CONSTRAINT "hostel_room_hostel_id_fkey" 
          FOREIGN KEY ("hostel_id") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    console.log('\n✅ Migration completed successfully!\n');
    console.log('Now run: node prisma/seed-guest-houses.js\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.code) console.error('Error code:', error.code);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
