const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seed hostels and rooms for gate entry module
 */
async function seedHostels() {
  try {
    console.log('🏨 Starting hostel seed...');

    // Create hostels (idempotent)
    const hostel1 = await prisma.hostel.upsert({
      where: { name: 'University Boys Hostel - A Block' },
      update: {
        description: 'Guest stay hostel facility near A Block',
        address: 'A Block, University Campus',
        hostel_category: 'national',
        is_active: true
      },
      create: {
        name: 'University Boys Hostel - A Block',
        description: 'Guest stay hostel facility near A Block',
        address: 'A Block, University Campus',
        hostel_category: 'national',
        is_active: true
      }
    });

    const hostel2 = await prisma.hostel.upsert({
      where: { name: 'University Girls Hostel - B Block' },
      update: {
        description: 'Guest stay hostel facility near B Block',
        address: 'B Block, University Campus',
        hostel_category: 'national',
        is_active: true
      },
      create: {
        name: 'University Girls Hostel - B Block',
        description: 'Guest stay hostel facility near B Block',
        address: 'B Block, University Campus',
        hostel_category: 'national',
        is_active: true
      }
    });

    const hostel3 = await prisma.hostel.upsert({
      where: { name: 'Guest House - Co-ed' },
      update: {
        description: 'Co-ed guest house for visitors',
        address: 'Near Main Gate, University Campus',
        hostel_category: 'international',
        is_active: true
      },
      create: {
        name: 'Guest House - Co-ed',
        description: 'Co-ed guest house for visitors',
        address: 'Near Main Gate, University Campus',
        hostel_category: 'international',
        is_active: true
      }
    });

    console.log('✅ Created 3 hostels');

   // Create Rooms for Hostel 1 (Boys - A Block)
    const hostel1Rooms = [];
    const roomTypes1 = ['standard', 'deluxe', 'ac'];
    const prices1 = { standard: 800, deluxe: 1200, ac: 1400 };
    const occupancy1 = { standard: 1, deluxe: 2, ac: 2 };

    for (let i = 1; i <= 15; i++) {
      const roomType = roomTypes1[i % roomTypes1.length];
      hostel1Rooms.push({
        hostel_id: hostel1.id,
        room_number: `A${i.toString().padStart(3, '0')}`,
        room_type: roomType,
        price_per_night: prices1[roomType],
        max_occupancy: occupancy1[roomType],
        is_available: true
      });
    }

    for (const room of hostel1Rooms) {
      await prisma.hostelRoom.upsert({
        where: {
          hostel_id_room_number: {
            hostel_id: room.hostel_id,
            room_number: room.room_number
          }
        },
        create: room,
        update: room
      });
    }
    console.log('✅ Created 15 rooms for Boys Hostel - A Block');

    // Create Rooms for Hostel 2 (Girls - B Block)
    const hostel2Rooms = [];
    const roomTypes2 = ['standard', 'deluxe', 'suite'];
    const prices2 = { standard: 900, deluxe: 1300, suite: 1800 };
    const occupancy2 = { standard: 1, deluxe: 2, suite: 3 };

    for (let i = 1; i <= 12; i++) {
      const roomType = roomTypes2[i % roomTypes2.length];
      hostel2Rooms.push({
        hostel_id: hostel2.id,
        room_number: `B${i.toString().padStart(3, '0')}`,
        room_type: roomType,
        price_per_night: prices2[roomType],
        max_occupancy: occupancy2[roomType],
        is_available: true
      });
    }

    for (const room of hostel2Rooms) {
      await prisma.hostelRoom.upsert({
        where: {
          hostel_id_room_number: {
            hostel_id: room.hostel_id,
            room_number: room.room_number
          }
        },
        create: room,
        update: room
      });
    }
    console.log('✅ Created 12 rooms for Girls Hostel - B Block');

    // Create Rooms for Hostel 3 (Guest House - Co-ed)
    const hostel3Rooms = [];
    const prices3 = { suite: 2200, deluxe: 1500 };
    const occupancy3 = { suite: 3, deluxe: 2 };

    for (let i = 1; i <= 10; i++) {
      const roomType = i % 2 === 0 ? 'suite' : 'deluxe';
      hostel3Rooms.push({
        hostel_id: hostel3.id,
        room_number: `GH${i.toString().padStart(2, '0')}`,
        room_type: roomType,
        price_per_night: prices3[roomType],
        max_occupancy: occupancy3[roomType],
        is_available: true
      });
    }

    for (const room of hostel3Rooms) {
      await prisma.hostelRoom.upsert({
        where: {
          hostel_id_room_number: {
            hostel_id: room.hostel_id,
            room_number: room.room_number
          }
        },
        create: room,
        update: room
      });
    }
    console.log('✅ Created 10 rooms for Guest House - Co-ed');

    console.log('');
    console.log('🎉 Hostel seed completed successfully!');
    console.log('📊 Summary:');
    console.log('  - 3 Hostels created');
    console.log('  - 37 Rooms created');
    console.log('');

  } catch (error) {
    console.error('❌ Error seeding hostels:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seedHostels()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
