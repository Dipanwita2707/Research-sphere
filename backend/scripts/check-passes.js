const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPasses() {
  try {
    const passes = await prisma.gate_pass.findMany({
      include: {
        hostel_booking: true
      }
    });
    
    console.log(`\n📊 Total gate passes: ${passes.length}\n`);
    
    passes.forEach((pass, i) => {
      console.log(`${i + 1}. ${pass.pass_id} - ${pass.visitor_name}`);
      console.log(`   Status: ${pass.pass_status}`);
      console.log(`   Hostel Booking: ${pass.hostel_booking ? 'Yes' : 'No'}`);
      if (pass.hostel_booking) {
        console.log(`   Room: ${pass.hostel_booking.room_id}`);
        console.log(`   Booking Status: ${pass.hostel_booking.booking_status}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPasses();
