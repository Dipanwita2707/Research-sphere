const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const passes = await prisma.gate_pass.findMany({
    select: {
      pass_id: true,
      pass_status: true,
      visitor_name: true,
      stay_required: true,
      hostel_booking: {
        select: {
          booking_status: true,
          total_price: true
        }
      }
    },
    orderBy: { created_at: 'desc' },
    take: 5
  });
  
  console.log('Recent passes:');
  passes.forEach(p => {
    const hostelInfo = p.hostel_booking 
      ? `Yes (₹${p.hostel_booking.total_price}, ${p.hostel_booking.booking_status})` 
      : 'No';
    console.log(`  ${p.pass_id} - ${p.visitor_name} - Status: ${p.pass_status}, Stay: ${p.stay_required}, Hostel: ${hostelInfo}`);
  });
  
  await prisma.$disconnect();
})();
