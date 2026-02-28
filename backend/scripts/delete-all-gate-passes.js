const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllGatePasses() {
  try {
    console.log('🗑️  Deleting all gate pass data...\n');
    
    // Get count before deletion
    const beforeCount = await prisma.gate_pass.count();
    console.log(`📊 Current gate passes in database: ${beforeCount}`);
    
    if (beforeCount === 0) {
      console.log('\n✅ No gate passes to delete. Database is already clean!');
      return;
    }
    
    // List passes that will be deleted
    const passes = await prisma.gate_pass.findMany({
      select: {
        pass_id: true,
        visitor_name: true,
        pass_status: true,
        created_at: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    
    console.log('\n📋 Gate passes that will be deleted:');
    console.log('═══════════════════════════════════════════════════════════');
    passes.forEach((pass, index) => {
      console.log(`${index + 1}. Pass ID: ${pass.pass_id}`);
      console.log(`   Visitor: ${pass.visitor_name}`);
      console.log(`   Status: ${pass.pass_status}`);
      console.log(`   Created: ${new Date(pass.created_at).toLocaleString()}`);
      console.log('-----------------------------------------------------------');
    });
    
    console.log('\n⚠️  WARNING: This will permanently delete all gate pass data!');
    console.log('This includes:');
    console.log('  • Gate passes');
    console.log('  • Gate pass history');
    console.log('  • Gate pass notifications');
    
    // Wait for 3 seconds
    console.log('\n⏳ Starting deletion in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Delete related data first (foreign key constraints)
    console.log('\n🔄 Step 1: Deleting gate pass notifications...');
    const notificationsDeleted = await prisma.gate_pass_notification.deleteMany({});
    console.log(`   ✅ Deleted ${notificationsDeleted.count} notifications`);
    
    console.log('\n🔄 Step 2: Deleting gate pass history...');
    const historyDeleted = await prisma.gate_pass_history.deleteMany({});
    console.log(`   ✅ Deleted ${historyDeleted.count} history records`);
    
    // Delete hostel bookings that reference gate passes
    console.log('\n🔄 Step 3: Deleting related hostel bookings...');
    try {
      const hostelBookingsDeleted = await prisma.$executeRaw`
        DELETE FROM hostel_bookings WHERE linked_pass_id IN (SELECT id FROM gate_pass);
      `;
      console.log(`   ✅ Deleted hostel bookings linked to gate passes`);
    } catch (err) {
      console.log(`   ℹ️  No hostel bookings to delete or table doesn't exist`);
    }
    
    console.log('\n🔄 Step 4: Deleting gate passes...');
    const passesDeleted = await prisma.gate_pass.deleteMany({});
    console.log(`   ✅ Deleted ${passesDeleted.count} gate passes`);
    
    // Verify deletion
    const afterCount = await prisma.gate_pass.count();
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ DELETION COMPLETE!');
    console.log('═'.repeat(60));
    console.log(`Passes before: ${beforeCount}`);
    console.log(`Passes after: ${afterCount}`);
    console.log(`Total deleted: ${beforeCount - afterCount}`);
    console.log('\n🎉 Database is now clean. You can create fresh test passes!\n');
    
  } catch (error) {
    console.error('\n❌ Error deleting gate passes:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllGatePasses();
