/**
 * Performance Testing Script for Bug Report System
 * 
 * This script tests the performance of the bug report API endpoints
 * to verify they meet the requirements:
 * - Admin dashboard loads within 2 seconds
 * - Search returns results within 500ms
 * - Queries handle 1000+ records efficiently
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api/v1';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

// Configure axios with auth token
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
  },
});

/**
 * Measure execution time of an async function
 */
async function measureTime(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`✓ ${name}: ${duration}ms`);
    return { success: true, duration, result };
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`✗ ${name}: ${duration}ms (FAILED)`);
    console.error(`  Error: ${error.message}`);
    return { success: false, duration, error };
  }
}

/**
 * Test 1: Admin Dashboard Load Time
 * Target: < 2000ms with 1000+ records
 */
async function testDashboardLoadTime() {
  console.log('\n📊 Test 1: Admin Dashboard Load Time');
  console.log('Target: < 2000ms\n');

  const result = await measureTime('Fetch bug reports (page 1, limit 50)', async () => {
    const response = await api.get('/admin/bug-reports?page=1&limit=50&sortBy=createdAt&order=desc');
    return response.data;
  });

  if (result.success) {
    const { reports, pagination, counts } = result.result;
    console.log(`  Total reports: ${counts.total}`);
    console.log(`  Unresolved: ${counts.unresolved}`);
    console.log(`  Resolved: ${counts.resolved}`);
    console.log(`  Page size: ${reports.length}`);
    
    if (result.duration < 2000) {
      console.log('  ✅ PASS: Load time within target');
    } else {
      console.log('  ❌ FAIL: Load time exceeds target');
    }
  }

  return result;
}

/**
 * Test 2: Search Performance
 * Target: < 500ms
 */
async function testSearchPerformance() {
  console.log('\n🔍 Test 2: Search Performance');
  console.log('Target: < 500ms\n');

  const searchTerms = ['error', 'bug', 'issue', 'test'];
  const results = [];

  for (const term of searchTerms) {
    const result = await measureTime(`Search for "${term}"`, async () => {
      const response = await api.get(`/admin/bug-reports?search=${term}&limit=50`);
      return response.data;
    });

    if (result.success) {
      console.log(`  Found: ${result.result.reports.length} reports`);
      
      if (result.duration < 500) {
        console.log('  ✅ PASS: Search time within target');
      } else {
        console.log('  ❌ FAIL: Search time exceeds target');
      }
    }

    results.push(result);
  }

  return results;
}

/**
 * Test 3: Pagination Performance
 * Verify pagination works efficiently with large datasets
 */
async function testPaginationPerformance() {
  console.log('\n📄 Test 3: Pagination Performance');
  console.log('Testing multiple pages\n');

  const pages = [1, 2, 5, 10];
  const results = [];

  for (const page of pages) {
    const result = await measureTime(`Fetch page ${page}`, async () => {
      const response = await api.get(`/admin/bug-reports?page=${page}&limit=50`);
      return response.data;
    });

    if (result.success) {
      console.log(`  Reports on page: ${result.result.reports.length}`);
      
      if (result.duration < 2000) {
        console.log('  ✅ PASS: Page load within target');
      } else {
        console.log('  ❌ FAIL: Page load exceeds target');
      }
    }

    results.push(result);
  }

  return results;
}

/**
 * Test 4: Filtering Performance
 * Test filtering by resolution status
 */
async function testFilteringPerformance() {
  console.log('\n🔧 Test 4: Filtering Performance');
  console.log('Testing status filters\n');

  const statuses = ['all', 'resolved', 'unresolved'];
  const results = [];

  for (const status of statuses) {
    const result = await measureTime(`Filter by status: ${status}`, async () => {
      const response = await api.get(`/admin/bug-reports?status=${status}&limit=50`);
      return response.data;
    });

    if (result.success) {
      console.log(`  Reports found: ${result.result.reports.length}`);
      
      if (result.duration < 1000) {
        console.log('  ✅ PASS: Filter time acceptable');
      } else {
        console.log('  ❌ FAIL: Filter time too slow');
      }
    }

    results.push(result);
  }

  return results;
}

/**
 * Test 5: Sorting Performance
 * Test different sort options
 */
async function testSortingPerformance() {
  console.log('\n🔀 Test 5: Sorting Performance');
  console.log('Testing different sort options\n');

  const sortOptions = [
    { sortBy: 'createdAt', order: 'desc' },
    { sortBy: 'createdAt', order: 'asc' },
    { sortBy: 'resolutionStatus', order: 'desc' },
    { sortBy: 'userRole', order: 'asc' },
  ];

  const results = [];

  for (const { sortBy, order } of sortOptions) {
    const result = await measureTime(`Sort by ${sortBy} (${order})`, async () => {
      const response = await api.get(`/admin/bug-reports?sortBy=${sortBy}&order=${order}&limit=50`);
      return response.data;
    });

    if (result.success) {
      if (result.duration < 1000) {
        console.log('  ✅ PASS: Sort time acceptable');
      } else {
        console.log('  ❌ FAIL: Sort time too slow');
      }
    }

    results.push(result);
  }

  return results;
}

/**
 * Test 6: Bug Report Detail Load Time
 * Test loading individual bug report with screenshots
 */
async function testDetailLoadTime() {
  console.log('\n📋 Test 6: Bug Report Detail Load Time');
  console.log('Target: < 1000ms\n');

  // First, get a bug report ID
  const listResult = await api.get('/admin/bug-reports?limit=1');
  
  if (listResult.data.reports.length === 0) {
    console.log('  ⚠️  No bug reports available for testing');
    return null;
  }

  const bugReportId = listResult.data.reports[0].id;

  const result = await measureTime(`Fetch bug report detail (${bugReportId})`, async () => {
    const response = await api.get(`/admin/bug-reports/${bugReportId}`);
    return response.data;
  });

  if (result.success) {
    const report = result.result;
    console.log(`  Screenshots: ${report.screenshots?.length || 0}`);
    console.log(`  Status: ${report.resolutionStatus}`);
    
    if (result.duration < 1000) {
      console.log('  ✅ PASS: Detail load time acceptable');
    } else {
      console.log('  ❌ FAIL: Detail load time too slow');
    }
  }

  return result;
}

/**
 * Generate Performance Report
 */
function generateReport(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(60));

  const allTests = results.flat().filter(r => r !== null);
  const passedTests = allTests.filter(r => r.success);
  const failedTests = allTests.filter(r => !r.success);

  console.log(`\nTotal Tests: ${allTests.length}`);
  console.log(`Passed: ${passedTests.length} ✅`);
  console.log(`Failed: ${failedTests.length} ❌`);

  if (passedTests.length > 0) {
    const avgDuration = passedTests.reduce((sum, r) => sum + r.duration, 0) / passedTests.length;
    console.log(`\nAverage Response Time: ${avgDuration.toFixed(2)}ms`);
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Main test runner
 */
async function runPerformanceTests() {
  console.log('🚀 Bug Report System - Performance Tests');
  console.log('='.repeat(60));

  if (!AUTH_TOKEN) {
    console.error('\n❌ ERROR: No authentication token provided');
    console.error('Please set TEST_AUTH_TOKEN environment variable');
    console.error('Example: TEST_AUTH_TOKEN=your_token node test-performance.js');
    process.exit(1);
  }

  const results = [];

  try {
    results.push(await testDashboardLoadTime());
    results.push(await testSearchPerformance());
    results.push(await testPaginationPerformance());
    results.push(await testFilteringPerformance());
    results.push(await testSortingPerformance());
    results.push(await testDetailLoadTime());

    generateReport(results);
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runPerformanceTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  testDashboardLoadTime,
  testSearchPerformance,
  testPaginationPerformance,
  testFilteringPerformance,
  testSortingPerformance,
  testDetailLoadTime,
};
