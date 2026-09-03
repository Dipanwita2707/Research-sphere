const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function displayParentInfo() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('👨‍👩‍👧‍👦 PARENT/GUARDIAN DATABASE INFORMATION');
    console.log('='.repeat(80) + '\n');

    const parents = await prisma.parentDetails.findMany({
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            studentId: true,
            email: true
          }
        }
      },
      orderBy: [
        { student: { studentId: 'asc' } },
        { relationship: 'asc' }
      ]
    });

    console.log(`📊 Total Parents/Guardians: ${parents.length}\n`);

    // Group by student
    const studentGroups = {};
    parents.forEach(parent => {
      const studentId = parent.student.studentId;
      if (!studentGroups[studentId]) {
        studentGroups[studentId] = {
          student: parent.student,
          parents: []
        };
      }
      studentGroups[studentId].parents.push(parent);
    });

    console.log('📋 PARENT DETAILS BY STUDENT:');
    console.log('='.repeat(80) + '\n');

    Object.keys(studentGroups).forEach((studentId, index) => {
      const group = studentGroups[studentId];
      console.log(`${index + 1}. STUDENT: ${group.student.firstName} ${group.student.lastName || ''} (${studentId})`);
      console.log(`   Email: ${group.student.email || 'N/A'}\n`);
      
      group.parents.forEach(parent => {
        console.log(`   ${parent.relationship.toUpperCase()}: ${parent.firstName} ${parent.lastName || ''}`);
        console.log(`      Phone: ${parent.phone || 'N/A'}`);
        console.log(`      Email: ${parent.email || 'N/A'}`);
        console.log(`      Occupation: ${parent.occupation || 'N/A'}`);
        console.log(`      Organization: ${parent.organization || 'N/A'}`);
        console.log(`      Primary Contact: ${parent.isPrimaryContact ? 'Yes' : 'No'}\n`);
      });
    });

    console.log('='.repeat(80));
    console.log('✅ Parent information displayed successfully!');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

displayParentInfo();
