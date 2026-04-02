const axios = require('axios');

async function testPassAPI() {
  try {
    const response = await axios.get('http://localhost:5001/api/v1/gate-entry/passes', {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    const pass = response.data?.data?.passes?.find(p => p.passId === 'UNI-PASS-20260218-001');
    
    if (pass) {
      console.log('\n=== API RESPONSE FOR PASS ===');
      console.log('Pass ID:', pass.passId);
      console.log('Extension Count:', pass.extensionCount);
      console.log('Extension Reason:', pass.extensionReason);
      console.log('Visit End Date:', pass.visitEndDate);
      console.log('Check-out Date:', pass.checkOutDate);
      console.log('\n=== FULL PASS OBJECT (extension fields) ===');
      console.log(JSON.stringify({
        extensionCount: pass.extensionCount,
        extensionReason: pass.extensionReason,
        extension_count: pass.extension_count,
        extension_reason: pass.extension_reason
      }, null, 2));
    } else {
      console.log('Pass not found in response');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPassAPI();
