/**
 * Test script to verify Gate Entry Analytics endpoint
 * Run with: node test-analytics-endpoint.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:5001/api/v1';
const LOGIN_ENDPOINT = `${API_URL}/auth/login`;
const ANALYTICS_ENDPOINT = `${API_URL}/gate-entry/analytics`;

async function testAnalyticsEndpoint() {
  console.log('\n🧪 Testing Gate Entry Analytics Endpoint...\n');
  
  try {
    // Step 1: Login to get auth token
    console.log('Step 1: Logging in...');
    const loginResponse = await axios.post(LOGIN_ENDPOINT, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (!loginResponse.data.success) {
      console.error('❌ Login failed:', loginResponse.data.message);
      return;
    }
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful');
    console.log('   Token:', token.substring(0, 20) + '...');
    
    // Step 2: Call analytics endpoint with auth token
    console.log('\nStep 2: Fetching analytics data...');
    const analyticsResponse = await axios.get(ANALYTICS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15 second timeout
    });
    
    if (analyticsResponse.data.success) {
      console.log('✅ Analytics endpoint working!');
      console.log('\n📊 Analytics Data Structure:');
      const data = analyticsResponse.data.data;
      
      console.log('\n  Overview Stats:');
      console.log('    - Total passes:', data.overview?.total || 0);
      console.log('    - Active today:', data.overview?.activeToday || 0);
      console.log('    - Checked in now:', data.overview?.checkedInNow || 0);
      
      console.log('\n  Data Sections Available:');
      console.log('    - Purpose breakdown:', data.byPurpose ? '✓' : '✗');
      console.log('    - Status breakdown:', data.byStatus ? '✓' : '✗');
      console.log('    - Vehicle stats:', data.vehicleStats ? '✓' : '✗');
      console.log('    - Hostel bookings:', data.hostelBookings ? '✓' : '✗');
      console.log('    - Extensions:', data.extensions ? '✓' : '✗');
      console.log('    - Guard performance:', data.guardPerformance ? '✓' : '✗');
      console.log('    - Daily trend:', data.dailyTrend ? '✓' : '✗');
      console.log('    - Recent activity:', data.recentActivity ? '✓' : '✗');
      console.log('    - Top creators:', data.topCreators ? '✓' : '✗');
      
      console.log('\n✅ All tests passed!');
      console.log('🎯 You can now access the analytics page in browser\n');
      
    } else {
      console.error('❌ Analytics request failed:', analyticsResponse.data.message);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    
    if (error.code === 'ECONNABORTED') {
      console.error('   Error: Request timeout (took longer than 15 seconds)');
      console.error('   This might indicate a slow database query');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   Error: Cannot connect to backend');
      console.error('   Make sure backend is running on port 5001');
    } else if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Message:', error.response.data?.message || error.message);
      
      if (error.response.status === 500) {
        console.error('\n   💡 Check backend logs for detailed error message');
      }
    } else {
      console.error('   Error:', error.message);
    }
    
    console.error('\n');
  }
}

// Run the test
testAnalyticsEndpoint().catch(console.error);
