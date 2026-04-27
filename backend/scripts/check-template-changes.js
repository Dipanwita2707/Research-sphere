/**
 * Check Template Change Records in Database
 * This script will examine the database for template change tracking tables and their data
 */

const prisma = require('../src/shared/config/database');

async function checkTemplateChanges() {
  try {
    console.log('🔍 Checking for template change records in database...\n');

    // First, let's check what tables exist related to templates
    console.log('📋 Checking for template-related tables...');
    
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%template%'
      ORDER BY table_name;
    `;
    
    console.log('Template-related tables found:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    console.log('');

    // Check loan letter template table
    try {
      const loanLetterTemplates = await prisma.loanLetterTemplate.findMany({
        select: {
          id: true,
          templateName: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 5
      });
      
      console.log('📄 Loan Letter Templates:');
      if (loanLetterTemplates.length > 0) {
        loanLetterTemplates.forEach(template => {
          console.log(`  - ID: ${template.id}, Name: ${template.templateName}`);
          console.log(`    Created: ${template.createdAt}, Updated: ${template.updatedAt}`);
        });
      } else {
        console.log('  No loan letter templates found');
      }
      console.log('');
    } catch (error) {
      console.log('❌ Error accessing loan letter templates:', error.message);
    }

    // Check for template change history/audit tables
    console.log('🔍 Checking for template change history tables...');
    
    const historyTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%template%history%' 
           OR table_name LIKE '%template%audit%' 
           OR table_name LIKE '%template%change%'
           OR table_name LIKE '%history%'
           OR table_name LIKE '%audit%')
      ORDER BY table_name;
    `;
    
    console.log('History/Audit tables found:');
    if (historyTables.length > 0) {
      historyTables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    } else {
      console.log('  No template history/audit tables found');
    }
    console.log('');

    // Check audit_log table for template-related entries
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
          performedAt: true,
          performedBy: {
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
        orderBy: { performedAt: 'desc' },
        take: 10
      });

      console.log('📊 Template-related Audit Logs:');
      if (auditLogs.length > 0) {
        auditLogs.forEach(log => {
          const userName = log.performedBy?.employeeDetails?.displayName || log.performedBy?.uid || 'Unknown';
          console.log(`  - ${log.action} on ${log.targetTable} by ${userName} at ${log.performedAt}`);
        });
      } else {
        console.log('  No template-related audit logs found');
      }
      console.log('');
    } catch (error) {
      console.log('❌ Error accessing audit logs:', error.message);
    }

    // Check for any template change tracking in loan letter template table columns
    try {
      const templateColumns = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'loan_letter_template' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;
      
      console.log('📋 Loan Letter Template Table Columns:');
      templateColumns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      console.log('');
    } catch (error) {
      console.log('❌ Error checking template columns:', error.message);
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
          templateName: true,
          updatedAt: true,
          createdAt: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      console.log('📅 Recent Template Changes (Last 30 days):');
      if (recentTemplateChanges.length > 0) {
        recentTemplateChanges.forEach(template => {
          const isNew = template.createdAt.getTime() === template.updatedAt.getTime();
          const changeType = isNew ? 'CREATED' : 'UPDATED';
          console.log(`  - ${changeType}: ${template.templateName} on ${template.updatedAt}`);
        });
      } else {
        console.log('  No recent template changes found');
      }
      console.log('');
    } catch (error) {
      console.log('❌ Error checking recent changes:', error.message);
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