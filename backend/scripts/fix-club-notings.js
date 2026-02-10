/**
 * Fix existing club notings - Update subcategory and initialize workflow
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixClubNotings() {
  try {
    console.log('🔍 Searching for club notings with old subcategory...');

    // Find all notings with old subcategory 'DSW'
    const oldNotings = await prisma.note.findMany({
      where: {
        category: 'administrative',
        subcategory: 'DSW',
        clubName: { not: null }, // Only club creation notings
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                primaryDepartmentId: true,
                primarySchoolId: true,
              },
            },
          },
        },
      },
    });

    console.log(`📋 Found ${oldNotings.length} club noting(s) to fix`);

    if (oldNotings.length === 0) {
      console.log('✅ No club notings need fixing');
      return;
    }

    // Import approval flow service
    const approvalFlowService = require('../src/modules/noting/services/approvalFlow.service');
    const { isCentralDepartmentRole } = require('../src/modules/noting/config/noting.config');

    for (const noting of oldNotings) {
      console.log(`\n🔧 Fixing noting: ${noting.notingId} - ${noting.clubName}`);

      // Get approval flow steps
      const noteContext = { amountRequired: noting.clubFundingRequired || false };
      const steps = await approvalFlowService.getFullFlowSteps(
        'administrative',
        'dsw_club_creation',
        noting.createdById,
        noteContext
      );

      if (!steps || steps.length === 0) {
        console.log(`⚠️ No approval flow found for noting ${noting.notingId}`);
        continue;
      }

      const firstStep = steps[0];
      const currentFlowIndex = 0;
      const isGroupStep = isCentralDepartmentRole(firstStep.authorityType) && firstStep.userIds.length > 0;
      const currentHolderId = isGroupStep ? null : (firstStep.userIds[0] ?? null);

      // Update noting with correct subcategory and workflow fields
      await prisma.note.update({
        where: { id: noting.id },
        data: {
          subcategory: 'dsw_club_creation',
          currentFlowIndex,
          currentHolderId,
        },
      });

      console.log(`  ✓ Updated subcategory: 'DSW' → 'dsw_club_creation'`);
      console.log(`  ✓ Set currentFlowIndex: ${currentFlowIndex}`);
      console.log(`  ✓ Set first approver: ${firstStep.authorityType} (${currentHolderId || 'group approval'})`);

      // Check if history entry exists
      const historyExists = await prisma.noteHistory.findFirst({
        where: {
          noteId: noting.id,
          action: 'SUBMITTED',
        },
      });

      if (!historyExists) {
        // Create history entry for submission
        await prisma.noteHistory.create({
          data: {
            noteId: noting.id,
            action: 'SUBMITTED',
            performedById: noting.createdById,
            remarks: 'Club creation noting submitted for approval (auto-fixed)',
            nextHolderId: currentHolderId,
          },
        });
        console.log(`  ✓ Created submission history entry`);
      } else {
        console.log(`  ✓ History entry already exists`);
      }

      console.log(`✅ Fixed noting: ${noting.notingId}`);
    }

    console.log('\n🎉 All club notings fixed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Total notings fixed: ${oldNotings.length}`);
    console.log(`  - Subcategory updated: 'DSW' → 'dsw_club_creation'`);
    console.log(`  - Workflow initialized with HOD as first approver`);
    console.log(`  - These notings should now appear in HOD's pending list`);
  } catch (error) {
    console.error('❌ Error fixing club notings:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixClubNotings();
