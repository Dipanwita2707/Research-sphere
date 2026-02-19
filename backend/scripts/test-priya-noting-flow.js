const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPriyaNotingFlow() {
  try {
    // Find Priya Patel (TEACH002)
    const priya = await prisma.userLogin.findFirst({
      where: { uid: 'TEACH002' },
      include: {
        employeeDetails: true
      }
    });

    if (!priya) {
      console.log('❌ Priya Patel (TEACH002) not found');
      return;
    }

    console.log('✅ Found Priya Patel:');
    console.log(`  ID: ${priya.id}`);
    console.log(`  UID: ${priya.uid}`);
    console.log(`  Email: ${priya.email}`);

    // Simulate what the noting controller does - get direct manager
    const reportingService = require('../src/modules/core/services/reportingStructure.service');
    
    console.log('\n🔍 Calling getDirectManager(priya.id)...');
    const manager = await reportingService.getDirectManager(priya.id);

    if (!manager) {
      console.log('\n❌ getDirectManager returned NULL!');
      console.log('   This is the problem! The function is not finding the manager.');
      
      // Let's check the raw query
      console.log('\n🔍 Checking raw reportingStructure record...');
      const rawReporting = await prisma.reportingStructure.findUnique({
        where: { userId: priya.id }
      });
      console.log('Raw reporting:', rawReporting);
      
    } else {
      console.log('\n✅ Manager Found:');
      console.log(`  ID: ${manager.id}`);
      console.log(`  UID: ${manager.uid}`);
      console.log(`  Email: ${manager.email}`);
      console.log(`  Name: ${manager.employeeDetails?.displayName || 'N/A'}`);
      
      // Now test the full determineNextApproverByReporting function
      console.log('\n🔍 Testing determineNextApproverByReporting...');
      const approvalFlowService = require('../src/modules/noting/services/approvalFlow.service');
      
      // Create mock note
      const mockNote = {
        id: 'test-note-id',
        createdById: priya.id,
        subcategory: 'general'
      };
      
      const result = await approvalFlowService.determineNextApproverByReporting(mockNote, 'noting_approve');
      
      console.log('\n📊 Result from determineNextApproverByReporting:');
      console.log(JSON.stringify(result, null, 2));
      
      if (!result.nextApproverId) {
        console.log('\n❌ nextApproverId is NULL! This triggers the error.');
      } else {
        console.log('\n✅ nextApproverId found! No error should occur.');
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testPriyaNotingFlow();
