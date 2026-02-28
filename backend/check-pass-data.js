const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPassData() {
  try {
    const pass = await prisma.gate_pass.findFirst({
      where: {
        pass_id: 'UNI-PASS-20260218-001'
      },
      include: {
        hostel_booking: true
      }
    });

    console.log('\n=== GATE PASS DATA ===');
    console.log('Pass ID:', pass.pass_id);
    console.log('Visit Date:', pass.visit_date);
    console.log('Visit End Date:', pass.visit_end_date);
    console.log('Extension Count:', pass.extension_count);
    console.log('Extension Reason:', pass.extension_reason);
    console.log('Stay Required:', pass.stay_required);
    
    if (pass.hostel_booking) {
      console.log('\n=== HOSTEL BOOKING DATA ===');
      console.log('Check-in Date:', pass.hostel_booking.check_in_date);
      console.log('Check-out Date:', pass.hostel_booking.check_out_date);
      console.log('Booking Status:', pass.hostel_booking.booking_status);
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkPassData();
