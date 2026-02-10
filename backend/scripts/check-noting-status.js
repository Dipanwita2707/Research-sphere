/**
 * Check noting status and club creation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNotingStatus() {
  try {
    console.log('🔍 Checking club noting status...\n');

    // Get the noting
    const noting = await prisma.note.findFirst({
      where: {
        notingId: 'DSW-CLB-2026-00001',
      },
      include: {
        history: {
          include: {
            performedBy: {
              select: {
                email: true,
                employeeDetails: {
                  select: { displayName: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        currentHolder: {
          select: {
            email: true,
            employeeDetails: {
              select: { displayName: true },
            },
          },
        },
      },
    });

    if (!noting) {
      console.log('❌ Noting not found');
      return;
    }

    console.log('📋 Noting:', noting.notingId);
    console.log('   Club Name:', noting.clubName);
    console.log('   Status:', noting.status.toUpperCase());
    console.log('   Category:', noting.category);
    console.log('   Subcategory:', noting.subcategory);
    console.log('   Current Flow Index:', noting.currentFlowIndex);
    console.log('   Current Holder:', noting.currentHolder?.employeeDetails?.displayName || noting.currentHolder?.email || 'None');

    console.log('\n📜 History:');
    noting.history.forEach((h, idx) => {
      console.log(`   ${idx + 1}. ${h.action.toUpperCase()}`);
      console.log(`      By: ${h.performedBy.employeeDetails?.displayName || h.performedBy.email}`);
      console.log(`      Remarks: ${h.remarks || 'None'}`);
      console.log(`      Date: ${h.createdAt.toLocaleString()}`);
      console.log('');
    });

    // Check if club was created
    console.log('🏛️ Checking if club was created...');
    
    const club = await prisma.club.findFirst({
      where: {
        OR: [
          { name: noting.clubName },
          { notingId: noting.id },
        ],
      },
    });

    if (club) {
      console.log('✅ Club found!');
      console.log('   Club ID:', club.clubId);
      console.log('   Name:', club.name);
      console.log('   Status:', club.status);
      console.log('   Created from Noting:', club.notingId || 'No');
    } else {
      console.log('❌ No club found');
      console.log('\n💡 Analysis:');
      
      if (noting.status === 'approved') {
        console.log('   ⚠️ Noting is APPROVED but club was not created!');
        console.log('   This means the auto-creation failed or was skipped.');
        console.log('\n   Possible reasons:');
        console.log('   1. Subcategory mismatch (should be "dsw_club_creation")');
        console.log('   2. Error during club creation');
        console.log('   3. Club data missing in noting');
      } else if (noting.status === 'pending') {
        console.log('   ℹ️ Noting is still PENDING');
        console.log('   HOD should use FORWARD button to send to next approver');
        console.log('   Only the LAST approver should use APPROVE button');
        console.log('\n   Correct workflow:');
        console.log('   - HOD: FORWARD to Dean');
        console.log('   - Dean: FORWARD to DSW');
        console.log('   - DSW: FORWARD to Higher Authority');
        console.log('   - Higher Authority: APPROVE (creates club)');
      }
    }

    // Check all clubs
    console.log('\n📊 All clubs in system:');
    const allClubs = await prisma.club.findMany({
      select: {
        clubId: true,
        name: true,
        status: true,
        notingId: true,
      },
    });
    
    if (allClubs.length === 0) {
      console.log('   No clubs found in database');
    } else {
      allClubs.forEach(c => {
        console.log(`   - ${c.clubId}: ${c.name} (${c.status})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkNotingStatus();
