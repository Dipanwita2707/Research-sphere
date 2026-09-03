/**
 * Test verify API for cancelled pass
 */
const https = require('http');

const data = JSON.stringify({
  searchTerm: 'UNI-PASS-20260303-004',
  searchType: 'pass_id'
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/v1/gate-entry/verify',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Testing verify API for cancelled pass...\n');

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      console.log('Status Code:', res.statusCode);
      console.log('Message:', response.message);
      console.log('\nResponse Data:');
      console.log('- isCancelled:', response.data?.isCancelled);
      console.log('- checkoutQRRemaining:', response.data?.checkoutQRRemaining);
      console.log('- Pass Status:', response.data?.pass?.passStatus);
      console.log('- Cancellation Type:', response.data?.pass?.cancellationType);
      console.log('- Checkout QR Expires:', response.data?.pass?.checkoutQrExpiresAt);
      
      if (response.data?.isCancelled) {
        console.log('\n✅ SUCCESS: isCancelled = true');
        if (response.data?.pass?.cancellationType === 'after_check_in') {
          console.log('✅ Correctly identified as AFTER check-in cancellation');
          console.log('   Checkout should be available with timer');
        } else if (response.data?.pass?.cancellationType === 'before_check_in') {
          console.log('✅ Correctly identified as BEFORE check-in cancellation');
          console.log('   No checkout required');
        }
      } else {
        console.log('\n❌ FAILED: isCancelled is not true');
      }
    } catch (e) {
      console.log('Response:', body);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.write(data);
req.end();
