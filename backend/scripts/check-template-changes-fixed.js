/**
 * Check Template Change Records in Database (Fixed)
 * This script will examine the database for template change tracking tables and their data
 */

const prisma = require('../src/shared/config/database');

async function checkTemplateChanges() {
  try {
    console.log('🔍 Checking for template change records in database...\n');

    // Check loan letter template table with correct field names
    try {
      const loanLetterTemplates = await prisma.loanLetterTemplate.findMany({
        select: {
          id: true,
          universityName: true,
          branchTitle: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 5
      });
      
      console.log('📄 Loan Letter Templates:');
      if (loanLetterTemplates.length > 0) {
        loanLetterTemplates.forEach(template => {
          console.log(`  - ID: ${template.id}`);
          console.log(`    University: ${template.universityName || 'Not set'}`);
          console.log(`    Branch: ${template.branchTitle || 'Not set'}`);
          console.log(`    Last Updated: ${template.updatedAt}`);
          console.log('');
        });
      } else {
        console.log('  No loan letter templates found');
      }
      console.log('');
    } catch (error) {
      console.log('❌ Error accessing loan letter templates:', error.message);
    }

    // Check the loan_letter_template_audit table specifically
    try {
      console.log('📊 Checking loan_letter_template_audit table...');
      
      const auditRecords = await prisma.$queryRaw`
        SELECT * FROM loan_letter_template_audit 
        ORDER BY created_at DESC 
        LIMIT 10;
      `;
      
      console.log('Template Audit Records:');
      if (auditRecords.length > 0) {
        auditRecords.forEach((record, index) => {
          console.log(`  ${index + 1}. Action: ${record.action || 'Unknown'}`);
          console.log(`     Template ID: ${record.template_id || 'N/A'}`);
          console.log(`     Changed By: ${record.changed_by_id || 'N/A'}`);
          console.log(`     Date: ${record.created_at || 'N/A'}`);
          console.log(`     Changes: ${record.changes ? JSON.stringify(record.changes).substring(0, 100) + '...' : 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('  No template audit records found');
      }
      console.log('');
    } catch (error) {
      console.log('❌ Error accessing template audit table:', error.message);
    }

    // Check audit_log table with correct field names
    try {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          OR: [
            { targetTable: { contains: 'template' } },
            { action: { contains: 'template' } },
            { targetTable: 'loan_letter_template' }
          ]
        },
        select: {
          id: true,
          targetTable: true,
          action: true,
          createdAt: true,
          actor: {
            select: {
              uid: true,
              employeeDetails: {
                select: {
                  displayName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      console.log('📊 Template-related Audit Logs:');
      if (auditLogs.length > 0) {
        auditLogs.forEach(log => {
          const userName = log.actor?.employeeDetails?.displayName || log.actor?.uid || 'Unknown';
          console.log(`  - ${log.action} on ${log.targetTable} by ${userName} at ${log.createdAt}`);
        });
      } else {
        console.log('  No template-related audit logs found');
      }
      console.log('');
    } catch (error) {
      console.log('❌ Error accessing audit logs:', error.message);
    }

    // Check if there are any recent changes to templates
    try {
      const recentTemplateChanges = await prisma.loanLetterTemplate.findMany({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        select: {
          id: true,
          universityName: true,
          branchTitle: true,
          updatedAt: true,
          updatedBy: {
            select: {
              uid: true,
              employeeDetails: {
                select: {
                  displayName: true
                }
              }
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      console.log('📅 Recent Template Changes (Last 30 days):');
      if (recentTemplateChanges.length > 0) {
        recentTemplateChanges.forEach(template => {
          const updatedBy = template.updatedBy?.employeeDetails?.displayName || template.updatedBy?.uid || 'Unknown';
          console.log(`  - Template ID: ${template.id}`);
          console.log(`    University: ${template.universityName || 'Not set'}`);
          console.log(`    Updated: ${template.updatedAt} by ${updatedBy}`);
          console.log('');
        });
      } else {
        console.log('  No recent template changes found');
      }
      console.log('');
    } catch (error) {
      console.log('❌ Error checking recent changes:', error.message);
    }

    // Check for any template change history in changes_history table
    try {
      console.log('📊 Checking changes_history table for template changes...');
      
      const changeHistory = await prisma.$queryRaw`
        SELECT * FROM changes_history 
        WHERE table_name LIKE '%template%' 
        ORDER BY changed_at DESC 
        LIMIT 10;
      `;
      
      console.log('Template Change History:');
      if (changeHistory.length > 0) {
        changeHistory.forEach((record, index) => {
          console.log(`  ${index + 1}. Table: ${record.table_name || 'Unknown'}`);
          console.log(`     Action: ${record.action || 'Unknown'}`);
          console.log(`     Record ID: ${record.record_id || 'N/A'}`);
          console.log(`     Changed By: ${record.changed_by_id || 'N/A'}`);
          console.log(`     Date: ${record.changed_at || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('  No template change history found');
      }
      console.log('');
    } catch (error) {
      console.log('❌ Error accessing change history table:', error.message);
    }

    console.log('✅ Template change check completed!');

  } catch (error) {
    console.error('❌ Error checking template changes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkTemplateChanges();