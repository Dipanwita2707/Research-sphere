const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hostels = await prisma.hostel.findMany({
    include: {
      rooms: true
    }
  });
  console.log('Total hostels:', hostels.length);
  
  if (hostels.length === 0) {
    console.log('\nNo hostels found. Creating sample hostels...');
    
    // Create sample hostels with rooms (without new fields for now)
    const hostel1 = await prisma.hostel.create({
      data: {
        name: 'SGT Guest House - Block A',
        hostel_type: 'coed',
        total_rooms: 20,
        address: 'SGT University Campus, Gurugram',
        facilities: JSON.stringify(['WiFi', 'AC', 'Hot Water', 'Room Service', 'Cafeteria']),
        is_active: true,
        rooms: {
          create: [
            { room_number: 'A101', room_type: 'single', price_per_night: 800, max_occupancy: 1, is_available: true },
            { room_number: 'A102', room_type: 'double', price_per_night: 1200, max_occupancy: 2, is_available: true },
            { room_number: 'A103', room_type: 'double', price_per_night: 1000, max_occupancy: 2, is_available: true },
            { room_number: 'A104', room_type: 'triple', price_per_night: 1500, max_occupancy: 3, is_available: true },
          ]
        }
      }
    });
    
    const hostel2 = await prisma.hostel.create({
      data: {
        name: 'SGT Guest House - Block B',
        hostel_type: 'coed',
        total_rooms: 15,
        address: 'SGT University Campus, Gurugram',
        facilities: JSON.stringify(['WiFi', 'Hot Water', 'Cafeteria']),
        is_active: true,
        rooms: {
          create: [
            { room_number: 'B101', room_type: 'single', price_per_night: 500, max_occupancy: 1, is_available: true },
            { room_number: 'B102', room_type: 'double', price_per_night: 700, max_occupancy: 2, is_available: true },
            { room_number: 'B103', room_type: 'triple', price_per_night: 900, max_occupancy: 3, is_available: true },
          ]
        }
      }
    });
    
    console.log('Created hostel 1:', hostel1.name);
    console.log('Created hostel 2:', hostel2.name);
    console.log('\nSample hostels with rooms created successfully!');
  } else {
    console.log('Hostels already exist:');
    hostels.forEach(h => console.log(' -', h.name, '| Rooms:', h.rooms.length));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
