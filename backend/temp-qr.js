const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pass = await prisma.gate_pass.findFirst({
    where: { visitor_name: 'outsider' },
    select: { pass_id: true, verification_code: true, qr_code: true }
  });
  
  console.log('Pass ID:', pass.pass_id);
  console.log('Verification Code:', pass.verification_code);
  console.log('\nQR Code (copy this entire data URL):');
  console.log(pass.qr_code);
}

main().finally(() => prisma.$disconnect());
