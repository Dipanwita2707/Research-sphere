const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function completeSeed() {
  try {
    // Find University Convention Center
    const conventionCenter = await prisma.hostel.findFirst({
      where: { name: 'University Convention Center' },
      include: { rooms: true }
    });
    
    if (!conventionCenter) {
      console.log('❌ University Convention Center not found');
      return;
    }
    
    console.log(`\n🏨 University Convention Center`);
    console.log(`   Current rooms: ${conventionCenter.rooms.length}`);
    console.log(`   Need to add: ${20 - conventionCenter.rooms.length} rooms\n`);
    
    const existingRoomNumbers = conventionCenter.rooms.map(r => r.room_number);
    const roomTypes = ['standard', 'deluxe', 'ac', 'suite'];
    const prices = { standard: 1000, deluxe: 1500, ac: 1800, suite: 2500 };
    
    let roomsAdded = 0;
    
    // Add missing rooms
    for (let floor = 0; floor <= 3; floor++) {
      const floorPrefix = floor === 0 ? 'G' : `${floor}F`;
      
      for (let roomNum = 1; roomNum <= 5; roomNum++) {
        const roomNumber = `${floorPrefix}${String(roomNum).padStart(2, '0')}`;
        
        if (!existingRoomNumbers.includes(roomNumber)) {
          const roomType = roomTypes[roomNum % 4];
          const amenities = roomType === 'suite' 
            ? 'King Bed, Sofa, Mini Bar, Conference Table'
            : roomType === 'deluxe'
            ? 'Queen Bed, Work Desk, Premium Toiletries'
            : roomType === 'ac'
            ? 'Double Bed, AC, TV, Refrigerator'
            : 'Double Bed, Fan, TV, Attached Bathroom';
          
          await prisma.hostelRoom.create({
            data: {
              hostel_id: conventionCenter.id,
              room_number: roomNumber,
              floor_number: floor,
              room_type: roomType,
              max_occupancy: roomType === 'suite' ? 4 : 2,
              price_per_night: prices[roomType],
              amenities: amenities,
              is_available: true
            }
          });
          
          roomsAdded++;
          console.log(`✅ Added room ${roomNumber} (${roomType})`);
        }
      }
    }
    
    console.log(`\n✅ Added ${roomsAdded} rooms to University Convention Center\n`);
    
    // Final count
    const finalCount = await prisma.hostelRoom.count();
    console.log(`📊 Total rooms in database: ${finalCount}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

completeSeed();
