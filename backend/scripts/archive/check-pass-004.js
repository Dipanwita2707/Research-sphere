const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const pass = await prisma.gate_pass.findFirst({ 
    where: { pass_id: 'UNI-PASS-20260303-004' } 
  });
  
  if (pass) {
    console.log('Pass ID:', pass.pass_id);
    console.log('Status:', pass.pass_status);
    console.log('Cancellation Type:', pass.cancellation_type);
    console.log('Entry Time:', pass.actual_entry_time);
    console.log('Checkout QR Expires:', pass.checkout_qr_expires_at);
  } else {
    console.log('Pass not found');
  }
  
  await prisma.$disconnect();
}

check();
