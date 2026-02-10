/**
 * Check creator context and approval flow for club noting
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCreatorContext() {
  try {
    const noting = await prisma.note.findFirst({
      where: {
        subcategory: 'dsw_club_creation',
        clubName: { not: null },
      },
      include: {
        createdBy: {
          include: {
            employeeDetails: {
              include: {
                primaryDepartment: {
                  include: {
                    headOfDepartment: {
                      include: {
                        employeeDetails: true,
                      },
                    },
                    faculty: true,
                  },
                },
                primarySchool: {
                  include: {
                    dean: {
                      include: {
                        employeeDetails: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!noting) {
      console.log('No club noting found');
      return;
    }

    console.log('\n📋 Club Noting:', noting.notingId, '-', noting.clubName);
    console.log('\n👤 Creator Details:');
    console.log('  Email:', noting.createdBy.email);
    console.log('  Role:', noting.createdBy.role);

    if (noting.createdBy.employeeDetails) {
      const emp = noting.createdBy.employeeDetails;
      console.log('  Name:', emp.displayName || `${emp.firstName} ${emp.lastName}`);
      console.log('\n🏢 Department:', emp.primaryDepartment?.departmentName || 'Not set');
      console.log('  HOD:', emp.primaryDepartment?.headOfDepartment?.employeeDetails?.displayName || 'Not assigned');
      console.log('\n🎓 School:', emp.primarySchool?.name || 'Not set');
      console.log('  Dean:', emp.primarySchool?.dean?.employeeDetails?.displayName || 'Not assigned');
    } else {
      console.log('  ⚠️ No employee details found');
    }

    console.log('\n🔄 Current Workflow Status:');
    console.log('  Status:', noting.status);
    console.log('  Flow Index:', noting.currentFlowIndex);
    console.log('  Current Holder ID:', noting.currentHolderId);

    // Get holder details
    if (noting.currentHolderId) {
      const holder = await prisma.userLogin.findUnique({
        where: { id: noting.currentHolderId },
        include: {
          employeeDetails: true,
        },
      });
      console.log('  Current Holder:', holder?.employeeDetails?.displayName || holder?.email);
    }

    // Get approval flow
    const approvalFlowService = require('../src/modules/noting/services/approvalFlow.service');
    const steps = await approvalFlowService.getFullFlowSteps(
      'administrative',
      'dsw_club_creation',
      noting.createdById,
      { amountRequired: noting.clubFundingRequired || false }
    );

    console.log('\n📊 Approval Flow:');
    steps.forEach((step, idx) => {
      console.log(`  ${idx + 1}. ${step.authorityType} (${step.userIds.length} user(s))`);
    });

    console.log('\n💡 Why is HOD missing?');
    if (!noting.createdBy.employeeDetails?.primaryDepartment) {
      console.log('  ❌ Creator has no primary department assigned');
    } else if (!noting.createdBy.employeeDetails?.primaryDepartment?.headOfDepartment) {
      console.log('  ❌ Department has no HOD assigned');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCreatorContext();
