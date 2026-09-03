const axios = require('axios');

async function testGuardianAPI() {
  try {
    console.log('\n=== Testing Guardian API ===\n');
    
    // Get a token from localStorage simulation (use actual student token)
    const testUserId = 'eeb36948-1289-4966-8a34-a1b8f9085b1d';
    
    // Test without auth first
    try {
      const response = await axios.get('http://localhost:5000/api/v1/gate-entry/guardians', {
        headers: {
          'Authorization': `Bearer test-token`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ API Response:', JSON.stringify(response.data, null, 2));
    } catch (err) {
      console.log('❌ API Error:', err.response?.data || err.message);
      console.log('Status:', err.response?.status);
    }

    // Also check if backend is running
    try {
      const healthCheck = await axios.get('http://localhost:5000/health');
      console.log('\n✅ Backend is running');
    } catch (err) {
      console.log('\n❌ Backend is NOT running or not accessible');
      console.log('Please start backend with: cd backend && npm start');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testGuardianAPI();
