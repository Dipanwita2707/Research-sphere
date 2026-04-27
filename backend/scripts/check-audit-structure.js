const prisma = require('../src/shared/config/database');

async function checkAuditStructure() {
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'loan_letter_template_audit' 
      AND table_schema = 'public' 
      ORDER BY ordinal_position;
    `;
    
    console.log('📋 loan_letter_template_audit table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    // Check if there are any records
    const recordCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM loan_letter_template_audit;
    `;
    
    console.log(`\n📊 Total audit records: ${recordCount[0].count}`);
    
    if (recordCount[0].count > 0) {
      const sampleRecords = await prisma.$queryRaw`
        SELECT * FROM loan_letter_template_audit 
        ORDER BY audit_id DESC 
        LIMIT 5;
      `;
      
      console.log('\n📄 Sample audit records:');
      sampleRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. Audit ID: ${record.audit_id}`);
        console.log(`     Template ID: ${record.template_id || 'N/A'}`);
        console.log(`     Action: ${record.action || 'N/A'}`);
        console.log(`     Changed By: ${record.changed_by_id || 'N/A'}`);
        console.log(`     Timestamp: ${record.audit_timestamp || 'N/A'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAuditStructure();