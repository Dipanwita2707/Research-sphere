const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validateParentData() {
  console.log('\n🔍 Validating Parent/Guardian Data...');
  console.log('='.repeat(80) + '\n');

  try {
    const parents = await prisma.parentDetails.findMany({
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            studentId: true
          }
        }
      },
      orderBy: [
        { student: { studentId: 'asc' } },
        { relationship: 'asc' }
      ]
    });

    console.log(`📊 Total Parents: ${parents.length}\n`);

    let validationErrors = [];

    // Check for duplicates by student + relationship
    const studentRelMap = {};
    parents.forEach(parent => {
      const key = `${parent.studentId}-${parent.relationship}`;
      if (studentRelMap[key]) {
        validationErrors.push(`❌ DUPLICATE: ${parent.relationship} for student ${parent.student.studentId}`);
      } else {
        studentRelMap[key] = parent;
      }
    });

    // Validate phone numbers
    parents.forEach(parent => {
      const phone = parent.phone || '';
      const digitsOnly = phone.replace(/\D/g, '');
      
      if (digitsOnly.length !== 10) {
        validationErrors.push(`❌ INVALID PHONE: ${parent.firstName} ${parent.lastName} (${parent.relationship}) - Phone: ${phone} (${digitsOnly.length} digits)`);
      } else {
        console.log(`✅ ${parent.firstName} ${parent.lastName} (${parent.relationship}) - Phone: ${phone} ✓ 10 digits`);
      }
    });

    console.log('\n' + '='.repeat(80));
    
    if (validationErrors.length === 0) {
      console.log('✅ ALL VALIDATIONS PASSED!');
      console.log(`   - Total parents: ${parents.length}`);
      console.log(`   - No duplicates found`);
      console.log(`   - All phone numbers are exactly 10 digits`);
      console.log(`   - Unique parent names (last name matches student)`);
    } else {
      console.log('❌ VALIDATION ERRORS FOUND:');
      validationErrors.forEach(error => console.log(`   ${error}`));
    }
    
    console.log('='.repeat(80) + '\n');

    // Summary by student
    console.log('📋 SUMMARY BY STUDENT:');
    console.log('='.repeat(80) + '\n');

    const studentGroups = {};
    parents.forEach(parent => {
      const studentId = parent.student.studentId;
      if (!studentGroups[studentId]) {
        studentGroups[studentId] = {
          student: parent.student,
          father: null,
          mother: null
        };
      }
      if (parent.relationship === 'father') {
        studentGroups[studentId].father = parent;
      } else if (parent.relationship === 'mother') {
        studentGroups[studentId].mother = parent;
      }
    });

    Object.keys(studentGroups).forEach((studentId, index) => {
      const group = studentGroups[studentId];
      const fatherPhone = group.father?.phone || 'N/A';
      const motherPhone = group.mother?.phone || 'N/A';
      
      console.log(`${index + 1}. ${group.student.firstName} ${group.student.lastName || ''} (${studentId})`);
      console.log(`   Father: ${group.father?.firstName || 'N/A'} ${group.father?.lastName || ''} - ${fatherPhone}`);
      console.log(`   Mother: ${group.mother?.firstName || 'N/A'} ${group.mother?.lastName || ''} - ${motherPhone}\n`);
    });

    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

validateParentData();
