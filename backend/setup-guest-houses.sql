-- Complete Guest House System Setup

-- Step 1: Create enums if not exist
DO $$ BEGIN
    CREATE TYPE room_type_enum AS ENUM ('standard', 'deluxe', 'suite', 'presidential', 'ac', 'non_ac');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE booking_status_enum AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Create Hostel table
CREATE TABLE IF NOT EXISTS hostel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS hostel_is_active_idx ON hostel(is_active);

-- Step 3: Create HostelRoom table
CREATE TABLE IF NOT EXISTS hostel_room (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostel_id UUID NOT NULL REFERENCES hostel(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    floor_number INTEGER,
    room_type room_type_enum DEFAULT 'standard',
    max_occupancy INTEGER DEFAULT 2,
    price_per_night DECIMAL(10,2) DEFAULT 1000,
    amenities TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hostel_id, room_number)
);

CREATE INDEX IF NOT EXISTS hostel_room_hostel_id_idx ON hostel_room(hostel_id);
CREATE INDEX IF NOT EXISTS hostel_room_is_available_idx ON hostel_room(is_available);
CREATE INDEX IF NOT EXISTS hostel_room_room_type_idx ON hostel_room(room_type);

-- Step 4: Update hostel_booking table
ALTER TABLE hostel_booking ADD COLUMN IF NOT EXISTS room_id UUID;
ALTER TABLE hostel_booking ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 1;
ALTER TABLE hostel_booking ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2);
ALTER TABLE hostel_booking ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) DEFAULT 'pending';
ALTER TABLE hostel_booking ADD COLUMN IF NOT EXISTS payment_qr_code TEXT;
ALTER TABLE hostel_booking ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);
ALTER TABLE hostel_booking ADD COLUMN IF NOT EXISTS booking_status booking_status_enum DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS hostel_booking_room_id_idx ON hostel_booking(room_id);
CREATE INDEX IF NOT EXISTS hostel_booking_booking_status_idx ON hostel_booking(booking_status);
CREATE INDEX IF NOT EXISTS hostel_booking_check_in_date_idx ON hostel_booking(check_in_date);
CREATE INDEX IF NOT EXISTS hostel_booking_check_out_date_idx ON hostel_booking(check_out_date);

-- Step 5: Add foreign key constraint (will skip if booking_status doesn't have room_id yet)
DO $$ BEGIN
    ALTER TABLE hostel_booking ADD CONSTRAINT hostel_booking_room_id_fkey 
    FOREIGN KEY (room_id) REFERENCES hostel_room(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

\echo '\n✅  Tables created successfully!\n'
\echo 'Now run: node prisma/seed-guest-houses.js'
