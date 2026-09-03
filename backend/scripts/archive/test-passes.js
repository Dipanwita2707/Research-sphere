const prisma = require('./src/config/prismaClient');

async function test() {
  try {
    console.log('Connecting to DB...');
    const count = await prisma.gate_pass.count();
    console.log('Total passes:', count);
    
    if (count > 0) {
      const pass = await prisma.gate_pass.findFirst({
        include: {
          user_login_gate_pass_created_by_idTouser_login: {
            select: { id: true, uid: true, employeeDetails: { select: { displayName: true } } }
          }
        }
      });
      console.log('Pass keys:', Object.keys(pass).join(', '));
      console.log('Sample pass (first 500 chars):', JSON.stringify(pass).substring(0, 500));
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

test();
