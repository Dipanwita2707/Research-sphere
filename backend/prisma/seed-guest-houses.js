const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedGuestHouses() {
  console.log('🏨 Seeding Guest Houses and Rooms...\n');

  const guestHouses = [
    {
      name: 'International Guest House',
      description: 'Premium accommodation facility for international guests and dignitaries',
      address: 'Block A, SGT University Campus',
      phone: '+91-1234567890',
      email: 'intl.guesthouse@sgtuniversity.ac.in',
      hostel_category: 'international'
    },
    {
      name: 'Faculty Residence Complex',
      description: 'Comfortable stay facility for visiting faculty and academic staff',
      address: 'Block B, SGT University Campus',
      phone: '+91-1234567891',
      email: 'faculty.residence@sgtuniversity.ac.in',
      hostel_category: 'national'
    },
    {
      name: 'Administrative Guest Lodge',
      description: 'Well-appointed rooms for administrative visitors and officials',
      address: 'Block C, SGT University Campus',
      phone: '+91-1234567892',
      email: 'admin.lodge@sgtuniversity.ac.in',
      hostel_category: 'national'
    },
    {
      name: 'University Convention Center',
      description: 'Modern facilities for conference attendees and event participants',
      address: 'Block D, SGT University Campus',
      phone: '+91-1234567893',
      email: 'convention@sgtuniversity.ac.in',
      hostel_category: 'national'
    }
  ];

  // Room types distribution: 40% standard, 30% deluxe, 20% ac, 10% suite
  const roomTypes = ['standard', 'standard', 'deluxe', 'deluxe', 'ac', 'suite'];
  const prices = {
    standard: 1000,
    deluxe: 1500,
    ac: 1800,
    suite: 2500,
    presidential: 5000
  };

  for (const guestHouse of guestHouses) {
    console.log(`Creating ${guestHouse.name}...`);

    const hostel = await prisma.hostel.upsert({
      where: { name: guestHouse.name },
      create: guestHouse,
      update: guestHouse
    });

    // Create 20 rooms per guest house with floor-based naming
    const rooms = [];

    // Ground Floor: G01-G05 (5 rooms)
    for (let i = 1; i <= 5; i++) {
      const roomNumber = `G${String(i).padStart(2, '0')}`;
      const roomType = roomTypes[i % roomTypes.length];
      rooms.push({
        hostel_id: hostel.id,
        room_number: roomNumber,
        floor_number: 0,
        room_type: roomType,
        max_occupancy: roomType === 'suite' ? 4 : 2,
        price_per_night: prices[roomType],
        amenities: `WiFi, TV, ${roomType === 'ac' || roomType === 'suite' ? 'AC, ' : ''}Bathroom`,
        is_available: true
      });
    }

    // First Floor: 1F01-1F05 (5 rooms)
    for (let i = 1; i <= 5; i++) {
      const roomNumber = `1F${String(i).padStart(2, '0')}`;
      const roomType = roomTypes[(i + 1) % roomTypes.length];
      rooms.push({
        hostel_id: hostel.id,
        room_number: roomNumber,
        floor_number: 1,
        room_type: roomType,
        max_occupancy: roomType === 'suite' ? 4 : 2,
        price_per_night: prices[roomType],
        amenities: `WiFi, TV, ${roomType === 'ac' || roomType === 'suite' ? 'AC, ' : ''}Bathroom, Mini Fridge`,
        is_available: true
      });
    }

    // Second Floor: 2F01-2F05 (5 rooms)
    for (let i = 1; i <= 5; i++) {
      const roomNumber = `2F${String(i).padStart(2, '0')}`;
      const roomType = roomTypes[(i + 2) % roomTypes.length];
      rooms.push({
        hostel_id: hostel.id,
        room_number: roomNumber,
        floor_number: 2,
        room_type: roomType,
        max_occupancy: roomType === 'suite' ? 4 : 2,
        price_per_night: prices[roomType],
        amenities: `WiFi, TV, ${roomType === 'ac' || roomType === 'suite' ? 'AC, ' : ''}Bathroom, Mini Fridge, Balcony`,
        is_available: true
      });
    }

    // Third Floor: 3F01-3F05 (5 rooms)
    for (let i = 1; i <= 5; i++) {
      const roomNumber = `3F${String(i).padStart(2, '0')}`;
      const roomType = roomTypes[(i + 3) % roomTypes.length];
      rooms.push({
        hostel_id: hostel.id,
        room_number: roomNumber,
        floor_number: 3,
        room_type: roomType === 'standard' ? 'deluxe' : roomType,
        max_occupancy: roomType === 'suite' || roomType === 'deluxe' ? 4 : 2,
        price_per_night: roomType === 'standard' ? prices.deluxe : prices[roomType],
        amenities: `WiFi, TV, AC, Bathroom, Mini Fridge, Balcony, Work Desk`,
        is_available: true
      });
    }

    // Insert all rooms
    for (const room of rooms) {
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

    console.log(`✅ Created ${rooms.length} rooms for ${guestHouse.name}\n`);
  }

  console.log('🎉 Guest House seeding completed!\n');
  console.log('Summary:');
  console.log(`- Total Guest Houses: ${guestHouses.length}`);
  console.log(`- Total Rooms: ${guestHouses.length * 20}`);
  console.log('- Room Distribution per Guest House:');
  console.log('  • Ground Floor (G01-G05): 5 rooms');
  console.log('  • First Floor (1F01-1F05): 5 rooms');
  console.log('  • Second Floor (2F01-2F05): 5 rooms');
  console.log('  • Third Floor (3F01-3F05): 5 rooms');
}

seedGuestHouses()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
