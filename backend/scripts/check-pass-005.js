// Check pass data in database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const pass = await prisma.gate_pass.findUnique({
      where: { pass_id: 'UNI-PASS-20260227-005' },
      select: {
        pass_id: true,
        visitor_name: true,
        visitor_relation: true,
        expected_entry_time: true,
        expected_exit_time: true,
        visit_date: true,
        pass_status: true,
        qr_status: true
      }
    });
    
    console.log('Pass Data from Database:');
    console.log(JSON.stringify(pass, null, 2));
    
    if (pass) {
      console.log('\n✅ Key Fields:');
      console.log('  Pass ID:', pass.pass_id);
      console.log('  Visitor Name:', pass.visitor_name);
      console.log('  Visitor Relation:', pass.visitor_relation);
      console.log('  Entry Time:', pass.expected_entry_time);
      console.log('  Visit Date:', pass.visit_date);
      console.log('  Pass Status:', pass.pass_status);
      console.log('  QR Status:', pass.qr_status);
    } else {
      console.log('\n❌ Pass not found');
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
  }
})();
