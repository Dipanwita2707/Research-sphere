const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPriyaManager() {
  try {
    // Find Priya Patel (TEACH002)
    const priya = await prisma.userLogin.findFirst({
      where: { uid: 'TEACH002' },
      select: {
        id: true,
        uid: true,
        email: true,
        employeeDetails: {
          select: {
            displayName: true,
            empId: true
          }
        }
      }
    });

    if (!priya) {
      console.log('❌ Priya Patel (TEACH002) not found');
      return;
    }

    console.log('✅ Found Priya Patel:');
    console.log(JSON.stringify(priya, null, 2));

    // Check reporting structure
    const reporting = await prisma.reportingStructure.findUnique({
      where: { userId: priya.id },
      include: {
        manager: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                displayName: true,
                empId: true
              }
            }
          }
        }
      }
    });

    if (!reporting) {
      console.log('\n❌ No reporting structure record found for Priya');
      return;
    }

    console.log('\n📊 Reporting Structure Record:');
    console.log(`  userId: ${reporting.userId}`);
    console.log(`  managerId: ${reporting.managerId || 'NULL'}`);
    console.log(`  hierarchyDepth: ${reporting.hierarchyDepth}`);
    console.log(`  isActive: ${reporting.isActive}`);

    if (reporting.manager) {
      console.log('\n✅ Manager Found:');
      console.log(JSON.stringify(reporting.manager, null, 2));
    } else {
      console.log('\n❌ Manager is NULL in reporting structure');
      console.log('   This is why the noting system says "no reporting manager assigned"');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPriyaManager();
