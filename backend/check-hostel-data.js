const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const hostels = await prisma.hostel.findMany({
      include: {
        rooms: {
          select: {
            id: true,
            room_number: true,
            room_type: true
          }
        }
      }
    });
    
    console.log(`\n🏨 Total Guest Houses: ${hostels.length}\n`);
    
    hostels.forEach(hostel => {
      console.log(`📍 ${hostel.name}`);
      console.log(`   Address: ${hostel.address}`);
      console.log(`   Rooms: ${hostel.rooms.length}`);
      console.log(`   Phone: ${hostel.phone}\n`);
    });
    
    const totalRooms = hostels.reduce((sum, h) => sum + h.rooms.length, 0);
    console.log(`\n✅ Total Rooms: ${totalRooms}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
