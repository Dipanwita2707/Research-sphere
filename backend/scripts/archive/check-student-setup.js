const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStudentSetup() {
  try {
    console.log('\n=== Checking Student Setup ===\n');
    
    // Find student user
    const student = await prisma.userLogin.findFirst({
      where: { uid: 'STU001' },
      include: {
        studentLogin: {
          include: {
            parents: true
          }
        },
        centralDeptPermissions: {
          include: {
            centralDept: true
          }
        }
      }
    });

    if (!student) {
      console.log('❌ Student STU001 not found');
      return;
    }

    console.log('✅ Student Found');
    console.log('   UID:', student.uid);
    console.log('   Role:', student.role);
    console.log('   Email:', student.email);
    console.log('   Active:', student.isActive);
    
    console.log('\n--- Student Details ---');
    if (student.studentLogin) {
      console.log('✅ StudentDetails record exists');
      console.log('   ID:', student.studentLogin.id);
      console.log('   First Name:', student.studentLogin.firstName);
      console.log('   Last Name:', student.studentLogin.lastName);
      
      console.log('\n--- Guardians/Parents ---');
      const parents = student.studentLogin.parents || [];
      if (parents.length === 0) {
        console.log('⚠️  No guardians found in database');
        console.log('   This is why guardian dropdown is not showing!');
      } else {
        console.log(`✅ Found ${parents.length} guardian(s):`);
        parents.forEach((parent, idx) => {
          console.log(`\n   Guardian ${idx + 1}:`);
          console.log('     Name:', `${parent.firstName} ${parent.lastName || ''}`);
          console.log('     Relationship:', parent.relationship);
          console.log('     Phone:', parent.phone);
          console.log('     Email:', parent.email);
          console.log('     Primary Contact:', parent.isPrimaryContact);
        });
      }
    } else {
      console.log('❌ No StudentDetails record found');
    }

    console.log('\n--- Permissions ---');
    const permissions = student.centralDeptPermissions || [];
    if (permissions.length === 0) {
      console.log('⚠️  No permissions assigned');
    } else {
      permissions.forEach(perm => {
        console.log(`✅ Department: ${perm.centralDept.departmentName}`);
        console.log('   Permissions:', perm.permissions);
      });
    }

    console.log('\n=== Recommendation ===');
    if (!student.studentLogin?.parents || student.studentLogin.parents.length === 0) {
      console.log('\n⚠️  To add a test guardian, run this SQL:\n');
      console.log(`
INSERT INTO parent_details (
  id, student_id, relationship, first_name, last_name, 
  phone, email, is_primary_contact, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '${student.studentLogin?.id}',
  'Father',
  'Test',
  'Parent',
  '9876543210',
  'parent@test.com',
  true,
  NOW(),
  NOW()
);
      `);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStudentSetup();
