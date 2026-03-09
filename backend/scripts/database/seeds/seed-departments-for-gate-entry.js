const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedDepartmentsForGateEntry() {
  console.log('🌱 Starting department seeding for Gate Entry...');

  try {
    // First check if we have any faculties
    const faculties = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      take: 5
    });

    console.log(`Found ${faculties.length} active faculties`);

    // Seed Central Departments (admin departments)
    const centralDepartments = [
      {
        departmentCode: 'ADMIN',
        departmentName: 'Administration',
        shortName: 'Admin',
        departmentType: 'administrative',
        contactEmail: 'admin@university.edu',
        contactPhone: '+91-11-12345678',
        officeLocation: 'Main Building, Ground Floor'
      },
      {
        departmentCode: 'HR',
        departmentName: 'Human Resources',
        shortName: 'HR',
        departmentType: 'administrative',
        contactEmail: 'hr@university.edu',
        contactPhone: '+91-11-12345679',
        officeLocation: 'Main Building, 1st Floor'
      },
      {
        departmentCode: 'FIN',
        departmentName: 'Finance',
        shortName: 'Finance',
        departmentType: 'administrative',
        contactEmail: 'finance@university.edu',
        contactPhone: '+91-11-12345680',
        officeLocation: 'Main Building, 2nd Floor'
      },
      {
        departmentCode: 'LIB',
        departmentName: 'Library',
        shortName: 'Library',
        departmentType: 'academic_support',
        contactEmail: 'library@university.edu',
        contactPhone: '+91-11-12345681',
        officeLocation: 'Library Building'
      },
      {
        departmentCode: 'REG',
        departmentName: 'Registrar Office',
        shortName: 'Registrar',
        departmentType: 'administrative',
        contactEmail: 'registrar@university.edu',
        contactPhone: '+91-11-12345682',
        officeLocation: 'Main Building, 1st Floor'
      }
    ];

    console.log('\n📌 Creating Central Departments...');
    for (const dept of centralDepartments) {
      const existing = await prisma.centralDepartment.findUnique({
        where: { departmentCode: dept.departmentCode }
      });

      if (existing) {
        console.log(`  ⚠️  Already exists: ${dept.departmentName}`);
        continue;
      }

      await prisma.centralDepartment.create({
        data: {
          ...dept,
          isActive: true,
          metadata: {}
        }
      });

      console.log(`  ✅ Created: ${dept.departmentName}`);
    }

    // Seed Academic Departments (if faculties exist)
    if (faculties.length > 0) {
      const academicDepartments = [
        {
          departmentCode: 'CSE',
          departmentName: 'Computer Science & Engineering',
          shortName: 'CSE',
          contactEmail: 'cse@university.edu',
          contactPhone: '+91-11-12345700',
          officeLocation: 'Engineering Block A'
        },
        {
          departmentCode: 'ECE',
          departmentName: 'Electronics & Communication Engineering',
          shortName: 'ECE',
          contactEmail: 'ece@university.edu',
          contactPhone: '+91-11-12345701',
          officeLocation: 'Engineering Block B'
        },
        {
          departmentCode: 'ME',
          departmentName: 'Mechanical Engineering',
          shortName: 'ME',
          contactEmail: 'me@university.edu',
          contactPhone: '+91-11-12345702',
          officeLocation: 'Engineering Block C'
        },
        {
          departmentCode: 'CIVIL',
          departmentName: 'Civil Engineering',
          shortName: 'Civil',
          contactEmail: 'civil@university.edu',
          contactPhone: '+91-11-12345703',
          officeLocation: 'Engineering Block D'
        }
      ];

      console.log('\n📌 Creating Academic Departments...');
      for (const dept of academicDepartments) {
        const existing = await prisma.department.findUnique({
          where: { departmentCode: dept.departmentCode }
        });

        if (existing) {
          console.log(`  ⚠️  Already exists: ${dept.departmentName}`);
          continue;
        }

        // Use first available faculty
        await prisma.department.create({
          data: {
            ...dept,
            facultyId: faculties[0].id,
            isActive: true,
            metadata: {}
          }
        });

        console.log(`  ✅ Created: ${dept.departmentName}`);
      }
    } else {
      console.log('\n⚠️  No faculties found, skipping academic departments');
      console.log('   Create faculties first, then run this script again');
    }

    console.log('\n✅ Department seeding completed!');

  } catch (error) {
    console.error('❌ Error seeding departments:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
seedDepartmentsForGateEntry()
  .then(() => {
    console.log('\n🎉 Seeding successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });
