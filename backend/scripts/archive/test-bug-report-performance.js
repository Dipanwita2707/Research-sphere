/**
 * Comprehensive Performance Testing Script for Bug Report System
 * 
 * This script verifies all performance targets from Requirements 32.1-32.2:
 * - Admin dashboard loads within 2 seconds with 1000+ bug reports
 * - Screenshot upload completes within 5 seconds per file
 * - Search returns results within 500ms
 * 
 * Usage:
 *   TEST_AUTH_TOKEN=your_token node scripts/test-bug-report-performance.js
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api/v1';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

// Configure axios with auth token
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
  },
  timeout: 30000, // 30 second timeout
});

/**
 * Measure execution time of an async function
 */
async function measureTime(name, fn, targetMs = null) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    let status = '✓';
    let statusText = '';
    
    if (targetMs !== null) {
      if (duration <= targetMs) {
        status = '✅';
        statusText = ` (PASS: ${duration}ms ≤ ${targetMs}ms)`;
      } else {
        status = '❌';
        statusText = ` (FAIL: ${duration}ms > ${targetMs}ms)`;
      }
    }
    
    console.log(`${status} ${name}: ${duration}ms${statusText}`);
    return { success: true, duration, result, passed: targetMs === null || duration <= targetMs };
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`✗ ${name}: ${duration}ms (ERROR)`);
    console.error(`  Error: ${error.message}`);
    return { success: false, duration, error, passed: false };
  }
}

/**
 * Create a test image file for screenshot upload testing
 */
function createTestImage(sizeKB = 100) {
  const buffer = Buffer.alloc(sizeKB * 1024);
  // Fill with random data to simulate image
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
}

/**
 * Test 1: Admin Dashboard Load Time with 1000+ Records
 * Requirement 32.1: Dashboard loads within 2 seconds
 */
async function testDashboardLoadTime() {
  console.log('\n📊 Test 1: Admin Dashboard Load Time (Requirement 32.1)');
  console.log('Target: < 2000ms with 1000+ bug reports\n');

  const result = await measureTime(
    'Fetch bug reports (page 1, limit 50)',
    async () => {
      const response = await api.get('/admin/bug-reports?page=1&limit=50&sortBy=createdAt&order=desc');
      return response.data;
    },
    2000 // Target: 2000ms
  );

  if (result.success) {
    const { reports, pagination, counts } = result.result;
    console.log(`  Total reports in DB: ${counts.total}`);
    console.log(`  Unresolved: ${counts.unresolved}`);
    console.log(`  Resolved: ${counts.resolved}`);
    console.log(`  Page size: ${reports.length}`);
    
    if (counts.total < 1000) {
      console.log(`  ⚠️  WARNING: Only ${counts.total} reports in database. Target is 1000+`);
      console.log(`  Run: node scripts/seed-bug-reports.js ${1000 - counts.total}`);
    }
  }

  return result;
}

/**
 * Test 2: Search Performance
 * Requirement 32.3: Search returns results within 500ms
 */
async function testSearchPerformance() {
  console.log('\n🔍 Test 2: Search Performance (Requirement 32.3)');
  console.log('Target: < 500ms\n');

  const searchTerms = ['error', 'bug', 'login', 'dashboard', 'upload'];
  const results = [];

  for (const term of searchTerms) {
    const result = await measureTime(
      `Search for "${term}"`,
      async () => {
        const response = await api.get(`/admin/bug-reports?search=${term}&limit=50`);
        return response.data;
      },
      500 // Target: 500ms
    );

    if (result.success) {
      console.log(`  Found: ${result.result.reports.length} reports`);
    }

    results.push(result);
  }

  return results;
}

/**
 * Test 3: Screenshot Upload Performance
 * Requirement 32.2: Screenshot upload completes within 5 seconds per file
 */
async function testScreenshotUploadPerformance() {
  console.log('\n📸 Test 3: Screenshot Upload Performance (Requirement 32.2)');
  console.log('Target: < 5000ms per file\n');

  const fileSizes = [
    { size: 100, label: '100KB' },
    { size: 500, label: '500KB' },
    { size: 1000, label: '1MB' },
    { size: 2000, label: '2MB' },
    { size: 5000, label: '5MB (max)' },
  ];

  const results = [];

  for (const { size, label } of fileSizes) {
    const result = await measureTime(
      `Upload ${label} screenshot`,
      async () => {
        const form = new FormData();
        const imageBuffer = createTestImage(size);
        
        form.append('description', 'Performance test bug report with screenshot');
        form.append('pageUrl', 'https://sgt-ums.example.com/test');
        form.append('routePath', '/test');
        form.append('userIdentifier', 'PERF_TEST_001');
        form.append('userRole', 'admin');
        form.append('screenshots', imageBuffer, {
          filename: `test-${label}.png`,
          contentType: 'image/png',
        });

        const response = await api.post('/bug-reports', form, {
          headers: {
            ...form.getHeaders(),
          },
        });
        
        return response.data;
      },
      5000 // Target: 5000ms
    );

    if (result.success) {
      console.log(`  Bug report created: ${result.result.id}`);
      console.log(`  Screenshots uploaded: ${result.result.screenshots?.length || 0}`);
    }

    results.push(result);
  }

  return results;
}

/**
 * Test 4: Multiple Screenshot Upload
 * Test uploading multiple screenshots (up to 5)
 */
async function testMultipleScreenshotUpload() {
  console.log('\n📸 Test 4: Multiple Screenshot Upload');
  console.log('Target: < 10000ms for 5 files\n');

  const result = await measureTime(
    'Upload 5 screenshots (1MB each)',
    async () => {
      const form = new FormData();
      
      form.append('description', 'Performance test with multiple screenshots');
      form.append('pageUrl', 'https://sgt-ums.example.com/test-multi');
      form.append('routePath', '/test-multi');
      form.append('userIdentifier', 'PERF_TEST_002');
      form.append('userRole', 'admin');
      
      // Add 5 screenshots
      for (let i = 1; i <= 5; i++) {
        const imageBuffer = createTestImage(1000); // 1MB each
        form.append('screenshots', imageBuffer, {
          filename: `test-screenshot-${i}.png`,
          contentType: 'image/png',
        });
      }

      const response = await api.post('/bug-reports', form, {
        headers: {
          ...form.getHeaders(),
        },
      });
      
      return response.data;
    },
    10000 // Target: 10000ms for 5 files
  );

  if (result.success) {
    console.log(`  Bug report created: ${result.result.id}`);
    console.log(`  Screenshots uploaded: ${result.result.screenshots?.length || 0}`);
  }

  return result;
}

/**
 * Test 5: Pagination Performance
 * Verify pagination works efficiently with large datasets
 */
async function testPaginationPerformance() {
  console.log('\n📄 Test 5: Pagination Performance');
  console.log('Target: < 2000ms per page\n');

  const pages = [1, 5, 10, 20];
  const results = [];

  for (const page of pages) {
    const result = await measureTime(
      `Fetch page ${page}`,
      async () => {
        const response = await api.get(`/admin/bug-reports?page=${page}&limit=50`);
        return response.data;
      },
      2000 // Target: 2000ms
    );

    if (result.success) {
      console.log(`  Reports on page: ${result.result.reports.length}`);
    }

    results.push(result);
  }

  return results;
}

/**
 * Test 6: Filtering Performance
 * Test filtering by resolution status
 */
async function testFilteringPerformance() {
  console.log('\n🔧 Test 6: Filtering Performance');
  console.log('Target: < 1000ms\n');

  const statuses = ['all', 'resolved', 'unresolved'];
  const results = [];

  for (const status of statuses) {
    const result = await measureTime(
      `Filter by status: ${status}`,
      async () => {
        const response = await api.get(`/admin/bug-reports?status=${status}&limit=50`);
        return response.data;
      },
      1000 // Target: 1000ms
    );

    if (result.success) {
      console.log(`  Reports found: ${result.result.reports.length}`);
    }

    results.push(result);
  }

  return results;
}

/**
 * Test 7: Sorting Performance
 * Test different sort options
 */
async function testSortingPerformance() {
  console.log('\n🔀 Test 7: Sorting Performance');
  console.log('Target: < 1000ms\n');

  const sortOptions = [
    { sortBy: 'createdAt', order: 'desc' },
    { sortBy: 'createdAt', order: 'asc' },
    { sortBy: 'resolutionStatus', order: 'desc' },
    { sortBy: 'userRole', order: 'asc' },
  ];

  const results = [];

  for (const { sortBy, order } of sortOptions) {
    const result = await measureTime(
      `Sort by ${sortBy} (${order})`,
      async () => {
        const response = await api.get(`/admin/bug-reports?sortBy=${sortBy}&order=${order}&limit=50`);
        return response.data;
      },
      1000 // Target: 1000ms
    );

    results.push(result);
  }

  return results;
}

/**
 * Test 8: Bug Report Detail Load Time
 * Test loading individual bug report with screenshots
 */
async function testDetailLoadTime() {
  console.log('\n📋 Test 8: Bug Report Detail Load Time');
  console.log('Target: < 1000ms\n');

  // First, get a bug report ID
  const listResult = await api.get('/admin/bug-reports?limit=1');
  
  if (listResult.data.reports.length === 0) {
    console.log('  ⚠️  No bug reports available for testing');
    return null;
  }

  const bugReportId = listResult.data.reports[0].id;

  const result = await measureTime(
    `Fetch bug report detail`,
    async () => {
      const response = await api.get(`/admin/bug-reports/${bugReportId}`);
      return response.data;
    },
    1000 // Target: 1000ms
  );

  if (result.success) {
    const report = result.result;
    console.log(`  Report ID: ${report.id}`);
    console.log(`  Screenshots: ${report.screenshots?.length || 0}`);
    console.log(`  Status: ${report.resolutionStatus}`);
  }

  return result;
}

/**
 * Generate Performance Report
 */
function generateReport(results) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(70));

  const allTests = results.flat().filter(r => r !== null);
  const passedTests = allTests.filter(r => r.passed);
  const failedTests = allTests.filter(r => !r.passed);
  const errorTests = allTests.filter(r => !r.success);

  console.log(`\nTotal Tests: ${allTests.length}`);
  console.log(`Passed: ${passedTests.length} ✅`);
  console.log(`Failed: ${failedTests.length} ❌`);
  console.log(`Errors: ${errorTests.length} ✗`);

  if (passedTests.length > 0) {
    const avgDuration = passedTests.reduce((sum, r) => sum + r.duration, 0) / passedTests.length;
    console.log(`\nAverage Response Time (passed tests): ${avgDuration.toFixed(2)}ms`);
  }

  // Check critical requirements
  console.log('\n' + '='.repeat(70));
  console.log('REQUIREMENT VERIFICATION');
  console.log('='.repeat(70));
  
  const dashboardTest = results[0];
  const searchTests = results[1];
  const screenshotTests = results[2];
  
  console.log('\n✓ Requirement 32.1: Admin dashboard loads within 2 seconds');
  console.log(`  Status: ${dashboardTest?.passed ? '✅ PASS' : '❌ FAIL'}`);
  if (dashboardTest?.success) {
    console.log(`  Actual: ${dashboardTest.duration}ms`);
  }
  
  console.log('\n✓ Requirement 32.2: Screenshot upload within 5 seconds per file');
  if (Array.isArray(screenshotTests)) {
    const allPassed = screenshotTests.every(t => t.passed);
    console.log(`  Status: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    screenshotTests.forEach((t, i) => {
      if (t.success) {
        console.log(`  File ${i + 1}: ${t.duration}ms`);
      }
    });
  }
  
  console.log('\n✓ Requirement 32.3: Search returns results within 500ms');
  if (Array.isArray(searchTests)) {
    const allPassed = searchTests.every(t => t.passed);
    console.log(`  Status: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    const avgSearch = searchTests.reduce((sum, t) => sum + t.duration, 0) / searchTests.length;
    console.log(`  Average: ${avgSearch.toFixed(2)}ms`);
  }

  console.log('\n' + '='.repeat(70));
  
  const allRequirementsPassed = 
    dashboardTest?.passed && 
    (Array.isArray(screenshotTests) && screenshotTests.every(t => t.passed)) &&
    (Array.isArray(searchTests) && searchTests.every(t => t.passed));
  
  if (allRequirementsPassed) {
    console.log('✅ ALL PERFORMANCE REQUIREMENTS MET');
  } else {
    console.log('❌ SOME PERFORMANCE REQUIREMENTS NOT MET');
  }
  
  console.log('='.repeat(70));
}

/**
 * Main test runner
 */
async function runPerformanceTests() {
  console.log('🚀 Bug Report System - Comprehensive Performance Tests');
  console.log('='.repeat(70));
  console.log('Testing Requirements 32.1-32.3');
  console.log('='.repeat(70));

  if (!AUTH_TOKEN) {
    console.error('\n❌ ERROR: No authentication token provided');
    console.error('Please set TEST_AUTH_TOKEN environment variable');
    console.error('Example: TEST_AUTH_TOKEN=your_token node scripts/test-bug-report-performance.js');
    process.exit(1);
  }

  const results = [];

  try {
    results.push(await testDashboardLoadTime());
    results.push(await testSearchPerformance());
    results.push(await testScreenshotUploadPerformance());
    results.push(await testMultipleScreenshotUpload());
    results.push(await testPaginationPerformance());
    results.push(await testFilteringPerformance());
    results.push(await testSortingPerformance());
    results.push(await testDetailLoadTime());

    generateReport(results);
    
    // Exit with appropriate code
    const allPassed = results.flat().filter(r => r !== null).every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
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
  testScreenshotUploadPerformance,
  testMultipleScreenshotUpload,
  testPaginationPerformance,
  testFilteringPerformance,
  testSortingPerformance,
  testDetailLoadTime,
};
