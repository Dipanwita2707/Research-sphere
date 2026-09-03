const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupStudentWithGuardians() {
  try {
    console.log('\n=== Setting up Student with Guardians ===\n');
    
    // Find student user
    const student = await prisma.userLogin.findFirst({
      where: { uid: 'STU001' }
    });

    if (!student) {
      console.log('❌ Student STU001 not found');
      return;
    }

    console.log('✅ Found Student:', student.uid);
    
    // Check if StudentDetails exists
    let studentDetails = await prisma.studentDetails.findFirst({
      where: { userLoginId: student.id }
    });

    if (!studentDetails) {
      console.log('Creating StudentDetails record...');
      studentDetails = await prisma.studentDetails.create({
        data: {
          studentId: 'STU001', // Unique student ID (required field)
          userLoginId: student.id,
          firstName: 'Test',
          lastName: 'Student',
          rollNumber: 'STU001',
          email: 'student@sgt.edu',
          phone: '9999999999',
        }
      });
      console.log('✅ Created StudentDetails:', studentDetails.id);
    } else {
      console.log('✅ StudentDetails already exists:', studentDetails.id);
    }

    // Check existing guardians
    const existingGuardians = await prisma.parentDetails.findMany({
      where: { studentId: studentDetails.id }
    });

    console.log(`\nCurrent guardians: ${existingGuardians.length}`);

    if (existingGuardians.length === 0) {
      console.log('\nCreating test guardians...');
      
      // Create Father
      const father = await prisma.parentDetails.create({
        data: {
          studentId: studentDetails.id,
          relationship: 'Father',
          firstName: 'Rajesh',
          lastName: 'Kumar',
          phone: '9876543210',
          email: 'rajesh.kumar@gmail.com',
          isPrimaryContact: true,
        }
      });
      console.log('✅ Created Father:', father.firstName, father.lastName);

      // Create Mother
      const mother = await prisma.parentDetails.create({
        data: {
          studentId: studentDetails.id,
          relationship: 'Mother',
          firstName: 'Sunita',
          lastName: 'Kumar',
          phone: '9876543211',
          email: 'sunita.kumar@gmail.com',
          isPrimaryContact: false,
        }
      });
      console.log('✅ Created Mother:', mother.firstName, mother.lastName);
    } else {
      console.log('Guardians already exist:');
      existingGuardians.forEach(g => {
        console.log(`  - ${g.firstName} ${g.lastName || ''} (${g.relationship})`);
      });
    }

    // Verify final setup
    console.log('\n=== Final Verification ===');
    const finalCheck = await prisma.userLogin.findFirst({
      where: { uid: 'STU001' },
      include: {
        studentLogin: {
          include: {
            parents: true
          }
        }
      }
    });

    console.log('\n✅ Setup Complete!');
    console.log(`   Student: ${finalCheck.uid}`);
    console.log(`   Student Details ID: ${finalCheck.studentLogin?.id}`);
    console.log(`   Guardians: ${finalCheck.studentLogin?.parents?.length || 0}`);
    
    if (finalCheck.studentLogin?.parents) {
      finalCheck.studentLogin.parents.forEach((p, idx) => {
        console.log(`     ${idx + 1}. ${p.firstName} ${p.lastName || ''} (${p.relationship}) - ${p.phone}`);
      });
    }

    console.log('\n🎉 Now refresh the frontend and guardian dropdown should appear!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupStudentWithGuardians();
