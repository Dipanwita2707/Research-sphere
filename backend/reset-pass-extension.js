const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetPassExtension() {
  try {
    const passId = 'UNI-PASS-20260218-001';
    
    // Get the pass with hostel booking
    const pass = await prisma.gate_pass.findUnique({
      where: { pass_id: passId },
      include: { hostel_booking: true }
    });
    
    if (!pass) {
      console.log('Pass not found');
      return;
    }
    
    console.log('\n=== BEFORE RESET ===');
    console.log('Visit End Date:', pass.visit_end_date);
    console.log('Extension Count:', pass.extension_count);
    console.log('Extension Reason:', pass.extension_reason);
    console.log('Hostel Check-out Date:', pass.hostel_booking?.check_out_date);
    
    // Reset gate pass to original state
    await prisma.gate_pass.update({
      where: { pass_id: passId },
      data: {
        visit_end_date: new Date('2026-02-19'),
        extension_count: 0,
        extension_reason: null
      }
    });
    
    // Reset hostel booking check_out_date
    if (pass.hostel_booking) {
      await prisma.hostelBooking.update({
        where: { id: pass.hostel_booking.id },
        data: {
          check_out_date: new Date('2026-02-19')
        }
      });
    }
    
    // Verify reset
    const resetPass = await prisma.gate_pass.findUnique({
      where: { pass_id: passId },
      include: { hostel_booking: true }
    });
    
    console.log('\n=== AFTER RESET ===');
    console.log('Visit End Date:', resetPass.visit_end_date);
    console.log('Extension Count:', resetPass.extension_count);
    console.log('Extension Reason:', resetPass.extension_reason);
    console.log('Hostel Check-out Date:', resetPass.hostel_booking?.check_out_date);
    
    console.log('\n✅ Pass reset successfully. Ready for testing extension.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassExtension();
