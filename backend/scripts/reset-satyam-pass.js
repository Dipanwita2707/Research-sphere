const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetSatyamPass() {
  try {
    console.log('🔄 Resetting Satyam\'s pass to checked-in status...\n');
    
    const pass = await prisma.gate_pass.findFirst({
      where: {
        visitor_name: { contains: 'Satyam', mode: 'insensitive' },
        pass_status: 'cancelled'
      }
    });
    
    if (!pass) {
      console.log('❌ No cancelled pass found for Satyam');
      return;
    }
    
    // Reset to checked-in status so it can be cancelled again
    await prisma.gate_pass.update({
      where: { id: pass.id },
      data: {
        pass_status: 'checked_in',
        qr_status: 'active',
        cancellation_time: null,
        checkout_unique_id: null,
        checkout_verification_code: null,
        checkout_qr_code: null,
        checkout_qr_expires_at: null
      }
    });
    
    console.log('✅ Pass reset successfully!\n');
    console.log('📋 Pass Details:');
    console.log(`   Pass ID: ${pass.pass_id}`);
    console.log(`   Visitor: ${pass.visitor_name}`);
    console.log(`   New Status: checked_in`);
    console.log('\n📝 Next Steps:');
    console.log('1. Go to UI: http://localhost:3000/admin/gate-entry');
    console.log('2. Find Satyam\'s pass');
    console.log('3. Click "Cancel Pass" button');
    console.log('4. Enter cancellation reason');
    console.log('5. Submit - This will generate NEW checkout credentials!');
    console.log('6. You\'ll see the NEW checkout verification code');
    console.log('7. Use that code to checkout\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetSatyamPass();
