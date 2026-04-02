const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCheckoutVerificationCode() {
  try {
    console.log('🔍 Testing checkout verification code implementation...\n');
    
    // Test 1: Check if field exists in schema
    console.log('Test 1: Checking database schema...');
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'gate_pass' 
      AND column_name IN ('checkout_unique_id', 'checkout_verification_code')
      ORDER BY column_name;
    `;
    
    if (result.length === 2) {
      console.log('✅ Both fields exist in database:');
      result.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('❌ Missing fields! Found:', result);
    }
    
    // Test 2: Find a checked-in pass to test cancellation flow
    console.log('\n\nTest 2: Finding a test pass...');
    const testPass = await prisma.gate_pass.findFirst({
      where: {
        pass_status: 'checked_in',
        checkout_unique_id: null
      },
      select: {
        pass_id: true,
        visitor_name: true,
        verification_code: true,
        pass_status: true
      }
    });
    
    if (testPass) {
      console.log('✅ Found test pass:');
      console.log(`   Pass ID: ${testPass.pass_id}`);
      console.log(`   Visitor: ${testPass.visitor_name}`);
      console.log(`   Original Verification Code: ${testPass.verification_code}`);
      console.log(`   Status: ${testPass.pass_status}`);
      console.log('\n💡 You can test cancelling this pass to see new checkout credentials generated.');
    } else {
      console.log('ℹ️  No checked-in passes found. Create and check-in a pass first.');
    }
    
    // Test 3: Check any existing cancelled passes
    console.log('\n\nTest 3: Checking existing cancelled passes...');
    const cancelledPasses = await prisma.gate_pass.findMany({
      where: {
        pass_status: 'cancelled',
        checkout_unique_id: { not: null }
      },
      select: {
        pass_id: true,
        visitor_name: true,
        verification_code: true,
        checkout_unique_id: true,
        checkout_verification_code: true,
        checkout_qr_expires_at: true
      },
      take: 3
    });
    
    if (cancelledPasses.length > 0) {
      console.log(`✅ Found ${cancelledPasses.length} cancelled pass(es) with checkout credentials:\n`);
      cancelledPasses.forEach(pass => {
        console.log(`📋 Pass: ${pass.pass_id}`);
        console.log(`   Visitor: ${pass.visitor_name}`);
        console.log(`   ╔═══ CHECK-IN CREDENTIALS ═══╗`);
        console.log(`   ║ Pass ID: ${pass.pass_id}`);
        console.log(`   ║ Verification Code: ${pass.verification_code}`);
        console.log(`   ╚════════════════════════════╝`);
        console.log(`   ╔═══ CHECKOUT CREDENTIALS ═══╗`);
        console.log(`   ║ Checkout ID: ${pass.checkout_unique_id}`);
        console.log(`   ║ Checkout Code: ${pass.checkout_verification_code || 'NOT SET'}`);
        console.log(`   ║ Expires: ${pass.checkout_qr_expires_at ? new Date(pass.checkout_qr_expires_at).toLocaleString() : 'N/A'}`);
        console.log(`   ╚════════════════════════════╝`);
        
        if (pass.verification_code === pass.checkout_verification_code) {
          console.log('   ⚠️  WARNING: Codes are the SAME (should be different!)');
        } else if (pass.checkout_verification_code) {
          console.log('   ✅ Codes are DIFFERENT (correct!)');
        }
        console.log('');
      });
    } else {
      console.log('ℹ️  No cancelled passes found with checkout credentials.');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Database schema test complete!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('\n💡 Tip: Run "npx prisma db push" to update the database schema.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testCheckoutVerificationCode();
