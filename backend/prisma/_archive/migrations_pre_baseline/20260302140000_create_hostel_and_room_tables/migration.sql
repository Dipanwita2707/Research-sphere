-- CreateEnum RoomType
DO $$ BEGIN
    CREATE TYPE "room_type_enum" AS ENUM ('standard', 'deluxe', 'suite', 'presidential', 'ac', 'non_ac');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum BookingStatus (if not exists)
DO $$ BEGIN
    CREATE TYPE "booking_status_enum" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable Hostel
CREATE TABLE IF NOT EXISTS "hostel" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "phone" VARCHAR(20),
    "email" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hostel_pkey" PRIMARY KEY ("id")
);

-- CreateTable HostelRoom
CREATE TABLE IF NOT EXISTS "hostel_room" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
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
);

-- AlterTable hostel_booking - Add new columns
ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "room_id" UUID;
ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "guest_count" INTEGER DEFAULT 1;
ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "total_price" DECIMAL(10,2);
ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "payment_status" VARCHAR(32) DEFAULT 'pending';
ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "payment_qr_code" TEXT;
ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "payment_reference" VARCHAR(100);
ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "booking_status" "booking_status_enum" DEFAULT 'pending';

-- CreateIndex Hostel
CREATE UNIQUE INDEX IF NOT EXISTS "hostel_name_key" ON "hostel"("name");
CREATE INDEX IF NOT EXISTS "hostel_is_active_idx" ON "hostel"("is_active");

-- CreateIndex HostelRoom
CREATE UNIQUE INDEX IF NOT EXISTS "hostel_room_hostel_id_room_number_key" ON "hostel_room"("hostel_id", "room_number");
CREATE INDEX IF NOT EXISTS "hostel_room_hostel_id_idx" ON "hostel_room"("hostel_id");
CREATE INDEX IF NOT EXISTS "hostel_room_is_available_idx" ON "hostel_room"("is_available");
CREATE INDEX IF NOT EXISTS "hostel_room_room_type_idx" ON "hostel_room"("room_type");

-- CreateIndex HostelBooking
CREATE INDEX IF NOT EXISTS "hostel_booking_room_id_idx" ON "hostel_booking"("room_id");
CREATE INDEX IF NOT EXISTS "hostel_booking_booking_status_idx" ON "hostel_booking"("booking_status");
CREATE INDEX IF NOT EXISTS "hostel_booking_check_in_date_idx" ON "hostel_booking"("check_in_date");
CREATE INDEX IF NOT EXISTS "hostel_booking_check_out_date_idx" ON "hostel_booking"("check_out_date");

-- AddForeignKey
ALTER TABLE "hostel_room" DROP CONSTRAINT IF EXISTS "hostel_room_hostel_id_fkey";
ALTER TABLE "hostel_room" ADD CONSTRAINT "hostel_room_hostel_id_fkey" 
    FOREIGN KEY ("hostel_id") REFERENCES "hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for room_id (only if all bookings have room_id set, otherwise skip for now)
-- Will be added manually after data migration
-- ALTER TABLE "hostel_booking" ADD CONSTRAINT "hostel_booking_room_id_fkey" 
--     FOREIGN KEY ("room_id") REFERENCES "hostel_room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
