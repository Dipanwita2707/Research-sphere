const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAndCancelPass() {
  try {
    console.log('🚀 Creating new test pass for Satyam...\n');

    // Delete old passes
    await prisma.gate_pass.deleteMany({
      where: {
        visitor_name: {
          contains: 'Satyam Test',
          mode: 'insensitive'
        }
      }
    });

    const now = new Date();
    const visitDate = new Date(now);
    visitDate.setHours(now.getHours() - 1); // 1 hour ago

    // Create new pass
    const pass = await prisma.gate_pass.create({
      data: {
        pass_id: `TEST-${Date.now()}`,
        visitor_name: 'Satyam Test',
        mobile_number: '7812638125',
        email: 'satyam@test.com',
        purpose: 'Testing checkout system',
        visit_date: visitDate,
        time_from: new Date(visitDate.getTime() - 30 * 60 * 1000),
        time_to: new Date(visitDate.getTime() + 4 * 60 * 60 * 1000),
        status: 'checked_in',
        pass_status: 'checked_in',
        qr_status: 'used',
        verification_code: Math.floor(100000 + Math.random() * 900000).toString(),
        actual_entry_time: new Date(visitDate.getTime() - 15 * 60 * 1000),
        created_by_id: 1,
        number_of_persons: 1
      }
    });

    console.log('✅ Pass created:', pass.pass_id);
    console.log('Status:', pass.pass_status);
    console.log('Checked in at:', pass.actual_entry_time);

    // Now cancel it
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from NOW
    const checkoutCode = Math.floor(100000 + Math.random() * 900000).toString();
    const checkoutId = `CHECKOUT-TEST-${Date.now()}`;

    const updatedPass = await prisma.gate_pass.update({
      where: { id: pass.id },
      data: {
        status: 'cancelled',
        pass_status: 'cancelled',
        qr_status: 'cancelled',
        cancellation_time: new Date(),
        checkout_unique_id: checkoutId,
        checkout_verification_code: checkoutCode,
        checkout_qr_expires_at: expiresAt
      }
    });

    console.log('\n✅ Pass cancelled:');
    console.log('Pass ID:', updatedPass.pass_id);
    console.log('Status:', updatedPass.pass_status);
    console.log('Checkout ID:', updatedPass.checkout_unique_id);
    console.log('Checkout Code:', updatedPass.checkout_verification_code);
    console.log('Expires At:', updatedPass.checkout_qr_expires_at);
    console.log('\n⏰ Time calculation:');
    const diffMs = expiresAt - Date.now();
    const diffMin = Math.floor(diffMs / 60000);
    const diffSec = Math.floor((diffMs % 60000) / 1000);
    console.log(`Remaining: ${diffMin} min ${diffSec} sec`);
    
    console.log('\n📝 Search for this pass:');
    console.log('Pass ID:', updatedPass.pass_id);
    console.log('Mobile:', updatedPass.mobile_number);
    console.log('Name: Satyam Test');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAndCancelPass();
