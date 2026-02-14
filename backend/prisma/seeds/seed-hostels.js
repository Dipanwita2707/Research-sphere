const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seed hostels and rooms for gate entry module
 */
async function seedHostels() {
  try {
    console.log('🏨 Starting hostel seed...');

    // Create Hostels
    const hostel1 = await prisma.hostel.create({
      data: {
        name: 'University Boys Hostel - A Block',
        hostel_type: 'boys',
        total_rooms: 50,
        address: 'A Block, University Campus',
        facilities: JSON.stringify(['wifi', 'laundry', 'parking', 'gym', 'cafeteria']),
        is_active: true
      }
    });

    const hostel2 = await prisma.hostel.create({
      data: {
        name: 'University Girls Hostel - B Block',
        hostel_type: 'girls',
        total_rooms: 40,
        address: 'B Block, University Campus',
        facilities: JSON.stringify(['wifi', 'laundry', 'parking', 'reading_room', 'cafeteria']),
        is_active: true
      }
    });

    const hostel3 = await prisma.hostel.create({
      data: {
        name: 'Guest House - Co-ed',
        hostel_type: 'coed',
        total_rooms: 20,
        address: 'Near Main Gate, University Campus',
        facilities: JSON.stringify(['wifi', 'parking', 'restaurant', 'room_service']),
        is_active: true
      }
    });

    console.log('✅ Created 3 hostels');

   // Create Rooms for Hostel 1 (Boys - A Block)
    const hostel1Rooms = [];
    const roomTypes1 = ['single', 'double', 'triple'];
    const prices1 = { single: 800, double: 500, triple: 350 };
    const occupancy1 = { single: 1, double: 2, triple: 3 };

    for (let i = 1; i <= 15; i++) {
      const roomType = roomTypes1[i % 3];
      hostel1Rooms.push({
        hostel_id: hostel1.id,
        room_number: `A${i.toString().padStart(3, '0')}`,
        room_type: roomType,
        price_per_night: prices1[roomType],
        max_occupancy: occupancy1[roomType],
        is_available: true
      });
    }

    await prisma.hostelRoom.createMany({ data: hostel1Rooms });
    console.log('✅ Created 15 rooms for Boys Hostel - A Block');

    // Create Rooms for Hostel 2 (Girls - B Block)
    const hostel2Rooms = [];
    const roomTypes2 = ['single', 'double', 'suite'];
    const prices2 = { single: 800, double: 500, suite: 1200 };
    const occupancy2 = { single: 1, double: 2, suite: 2 };

    for (let i = 1; i <= 12; i++) {
      const roomType = roomTypes2[i % 3];
      hostel2Rooms.push({
        hostel_id: hostel2.id,
        room_number: `B${i.toString().padStart(3, '0')}`,
        room_type: roomType,
        price_per_night: prices2[roomType],
        max_occupancy: occupancy2[roomType],
        is_available: true
      });
    }

    await prisma.hostelRoom.createMany({ data: hostel2Rooms });
    console.log('✅ Created 12 rooms for Girls Hostel - B Block');

    // Create Rooms for Hostel 3 (Guest House - Co-ed)
    const hostel3Rooms = [];
    const roomTypes3 = ['suite', 'double'];
    const prices3 = { suite: 1500, double: 1000 };
    const occupancy3 = { suite: 2, double: 2 };

    for (let i = 1; i <= 10; i++) {
      const roomType = i % 2 === 0 ? 'suite' : 'double';
      hostel3Rooms.push({
        hostel_id: hostel3.id,
        room_number: `GH${i.toString().padStart(2, '0')}`,
        room_type: roomType,
        price_per_night: prices3[roomType],
        max_occupancy: occupancy3[roomType],
        is_available: true
      });
    }

    await prisma.hostelRoom.createMany({ data: hostel3Rooms });
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
