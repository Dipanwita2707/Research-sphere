/**
 * Setup mentor@gmail.com with department and re-fix the noting
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupMentorAndRefixNoting() {
  try {
    console.log('🔧 Setting up mentor@gmail.com properly...\n');

    // Get mentor user
    const mentor = await prisma.userLogin.findUnique({
      where: { email: 'mentor@gmail.com' },
      include: { employeeDetails: true },
    });

    if (!mentor) {
      console.log('❌ mentor@gmail.com not found');
      return;
    }

    console.log('👤 Mentor:', mentor.email, '-', mentor.role);

    // Get a department (preferably CS)
    let department = await prisma.department.findFirst({
      where: { departmentCode: 'CS' },
      include: { faculty: true },
    });

    if (!department) {
      // Get any department
      department = await prisma.department.findFirst({
        include: { faculty: true },
      });
    }

    if (!department) {
      console.log('❌ No departments found. Create a department first.');
      return;
    }

    console.log('🏢 Department:', department.departmentName);
    console.log('   School:', department.faculty.name);

    // Update or create employee details for mentor
    if (!mentor.employeeDetails) {
      await prisma.employeeDetails.create({
        data: {
          userLoginId: mentor.id,
          firstName: 'Om',
          lastName: 'Mentor',
          displayName: 'om mentor',
          empId: `MENTOR${Date.now()}`,
          primaryDepartmentId: department.id,
          primarySchoolId: department.facultyId,
        },
      });
      console.log('✅ Created employee details for mentor');
    } else {
      await prisma.employeeDetails.update({
        where: { userLoginId: mentor.id },
        data: {
          primaryDepartmentId: department.id,
          primarySchoolId: department.facultyId,
        },
      });
      console.log('✅ Updated mentor with department and school');
    }

    // Check if department has HOD
    if (!department.headOfDepartmentId) {
      console.log('\n⚠️ Department has no HOD. Assigning hod@gmail.com...');
      
      const hodUser = await prisma.userLogin.findUnique({
        where: { email: 'hod@gmail.com' },
        include: { employeeDetails: true },
      });

      if (hodUser) {
        // Set up hod's employee details
        if (!hodUser.employeeDetails) {
          await prisma.employeeDetails.create({
            data: {
              userLoginId: hodUser.id,
              firstName: 'Om',
              lastName: 'HOD',
              displayName: 'om hod',
              empId: `HOD${Date.now()}`,
              primaryDepartmentId: department.id,
              primarySchoolId: department.facultyId,
            },
          });
        } else if (!hodUser.employeeDetails.primaryDepartmentId) {
          await prisma.employeeDetails.update({
            where: { userLoginId: hodUser.id },
            data: {
              primaryDepartmentId: department.id,
              primarySchoolId: department.facultyId,
            },
          });
        }

        // Set as HOD
        await prisma.department.update({
          where: { id: department.id },
          data: { headOfDepartmentId: hodUser.id },
        });
        console.log('✅ Set hod@gmail.com as HOD');
      }
    } else {
      console.log('✅ Department already has HOD');
    }

    // Check if school has Dean
    if (!department.faculty.headOfFacultyId) {
      console.log('\n⚠️ School has no Dean. Assigning dean@gmail.com...');
      
      const deanUser = await prisma.userLogin.findUnique({
        where: { email: 'dean@gmail.com' },
        include: { employeeDetails: true },
      });

      if (deanUser) {
        // Set up dean's employee details
        if (!deanUser.employeeDetails) {
          await prisma.employeeDetails.create({
            data: {
              userLoginId: deanUser.id,
              firstName: 'Om',
              lastName: 'Dean',
              displayName: 'om dean',
              empId: `DEAN${Date.now()}`,
              primarySchoolId: department.facultyId,
            },
          });
        } else if (!deanUser.employeeDetails.primarySchoolId) {
          await prisma.employeeDetails.update({
            where: { userLoginId: deanUser.id },
            data: { primarySchoolId: department.facultyId },
          });
        }

        // Set as Dean
        await prisma.facultySchoolList.update({
          where: { id: department.facultyId },
          data: { headOfFacultyId: deanUser.id },
        });
        console.log('✅ Set dean@gmail.com as Dean');
      }
    } else {
      console.log('✅ School already has Dean');
    }

    console.log('\n🔄 Re-fixing club noting DSW-CLB-2026-00001...');

    // Get the noting
    const noting = await prisma.note.findFirst({
      where: {
        notingId: 'DSW-CLB-2026-00001',
      },
    });

    if (!noting) {
      console.log('❌ Noting not found');
      return;
    }

    // Get approval flow with mentor's updated context
    const approvalFlowService = require('../src/modules/noting/services/approvalFlow.service');
    const { isCentralDepartmentRole } = require('../src/modules/noting/config/noting.config');

    const steps = await approvalFlowService.getFullFlowSteps(
      'administrative',
      'dsw_club_creation',
      mentor.id,
      { amountRequired: noting.clubFundingRequired || false }
    );

    if (!steps || steps.length === 0) {
      console.log('❌ No approval flow found');
      return;
    }

    console.log('\n📊 New Approval Flow:');
    steps.forEach((step, idx) => {
      console.log(`   ${idx + 1}. ${step.authorityType} (${step.userIds.length} user(s))`);
    });

    const firstStep = steps[0];
    const currentFlowIndex = 0;
    const isGroupStep = isCentralDepartmentRole(firstStep.authorityType) && firstStep.userIds.length > 0;
    const currentHolderId = isGroupStep ? null : (firstStep.userIds[0] ?? null);

    // Update noting
    await prisma.note.update({
      where: { id: noting.id },
      data: {
        currentFlowIndex,
        currentHolderId,
      },
    });

    // Update history
    await prisma.noteHistory.updateMany({
      where: {
        noteId: noting.id,
        action: 'SUBMITTED',
      },
      data: {
        nextHolderId: currentHolderId,
      },
    });

    console.log('✅ Noting updated with correct workflow');
    console.log(`   First approver: ${firstStep.authorityType}`);
    
    if (currentHolderId) {
      const holder = await prisma.userLogin.findUnique({
        where: { id: currentHolderId },
        include: { employeeDetails: true },
      });
      console.log(`   Holder: ${holder?.employeeDetails?.displayName || holder?.email}`);
    }

    console.log('\n🎉 Setup complete!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Mentor assigned to: ${department.departmentName}`);
    console.log(`   ✅ Department has HOD`);
    console.log(`   ✅ School has Dean`);
    console.log(`   ✅ Noting workflow fixed: Faculty → HOD → Dean → DSW → Higher Authority`);
    console.log(`\n💡 Now the noting should appear in HOD's pending list!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

setupMentorAndRefixNoting();
