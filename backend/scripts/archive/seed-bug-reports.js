/**
 * Seed Bug Reports for Performance Testing
 * 
 * This script creates a large number of bug reports in the database
 * to test performance with 1000+ records.
 * 
 * Usage:
 *   node scripts/seed-bug-reports.js [count]
 * 
 * Example:
 *   node scripts/seed-bug-reports.js 1000
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Sample data for generating realistic bug reports
const bugDescriptions = [
  'The login button is not responding when clicked. I have to refresh the page multiple times.',
  'Dashboard is loading very slowly, taking more than 10 seconds to display data.',
  'Unable to upload files larger than 2MB, getting an error message.',
  'The search functionality is not working properly, returns no results even for valid queries.',
  'Navigation menu disappears when scrolling down the page.',
  'Form validation errors are not displaying correctly.',
  'Date picker component is showing incorrect dates.',
  'Unable to delete items from the list, delete button does nothing.',
  'Page crashes when trying to export data to CSV format.',
  'Mobile view is completely broken, elements are overlapping.',
  'Notification system is not sending email alerts.',
  'User profile image upload fails with 500 error.',
  'Cannot save changes to settings, getting validation errors.',
  'Table sorting is not working for numeric columns.',
  'Filter options are not persisting after page refresh.',
];

const pageUrls = [
  '/dashboard',
  '/admin/users',
  '/admin/settings',
  '/profile',
  '/reports',
  '/analytics',
  '/events',
  '/notifications',
  '/calendar',
  '/documents',
];

const routePaths = [
  '/dashboard',
  '/admin/users',
  '/admin/settings',
  '/profile',
  '/reports',
  '/analytics',
  '/events',
  '/notifications',
  '/calendar',
  '/documents',
];

const userRoles = ['student', 'faculty', 'admin', 'staff', 'parent'];

/**
 * Generate a random element from an array
 */
function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random date within the last 90 days
 */
function randomDate() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 90);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return date;
}

/**
 * Generate a random user identifier based on role
 */
function generateUserIdentifier(role) {
  if (role === 'student') {
    return `STU${Math.floor(Math.random() * 900000 + 100000)}`;
  } else {
    return `EMP${Math.floor(Math.random() * 9000 + 1000)}`;
  }
}

/**
 * Get a random user ID from the database
 */
async function getRandomUserId() {
  const users = await prisma.userLogin.findMany({
    select: { id: true },
    take: 100,
  });
  
  if (users.length === 0) {
    throw new Error('No users found in database. Please seed users first.');
  }
  
  return randomElement(users).id;
}

/**
 * Get admin user IDs for resolved reports
 */
async function getAdminUserIds() {
  const admins = await prisma.userLogin.findMany({
    where: {
      role: {
        in: ['admin', 'superadmin'],
      },
    },
    select: { id: true },
    take: 10,
  });
  
  return admins.map(a => a.id);
}

/**
 * Create a single bug report
 */
async function createBugReport(userId, adminIds) {
  const role = randomElement(userRoles);
  const isResolved = Math.random() > 0.6; // 40% resolved
  const createdAt = randomDate();
  
  const data = {
    userId,
    userRole: role,
    userIdentifier: generateUserIdentifier(role),
    userEmail: `user${Math.floor(Math.random() * 10000)}@example.com`,
    description: randomElement(bugDescriptions),
    pageUrl: `https://sgt-ums.example.com${randomElement(pageUrls)}`,
    routePath: randomElement(routePaths),
    resolutionStatus: isResolved ? 'resolved' : 'unresolved',
    createdAt,
    updatedAt: createdAt,
  };
  
  // Add resolution data if resolved
  if (isResolved && adminIds.length > 0) {
    const resolvedDate = new Date(createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
    data.resolvedAt = resolvedDate;
    data.resolvedBy = randomElement(adminIds);
  }
  
  return prisma.bugReport.create({ data });
}

/**
 * Seed bug reports
 */
async function seedBugReports(count = 1000) {
  console.log(`🌱 Seeding ${count} bug reports...`);
  console.log('='.repeat(60));
  
  try {
    // Get user IDs
    console.log('📋 Fetching user IDs...');
    const userId = await getRandomUserId();
    const adminIds = await getAdminUserIds();
    
    console.log(`✓ Found user ID: ${userId}`);
    console.log(`✓ Found ${adminIds.length} admin users`);
    
    // Check existing count
    const existingCount = await prisma.bugReport.count();
    console.log(`\n📊 Existing bug reports: ${existingCount}`);
    
    // Create bug reports in batches
    const batchSize = 100;
    const batches = Math.ceil(count / batchSize);
    let created = 0;
    
    console.log(`\n🚀 Creating ${count} bug reports in ${batches} batches...`);
    
    for (let i = 0; i < batches; i++) {
      const batchCount = Math.min(batchSize, count - created);
      const promises = [];
      
      for (let j = 0; j < batchCount; j++) {
        promises.push(createBugReport(userId, adminIds));
      }
      
      await Promise.all(promises);
      created += batchCount;
      
      const progress = ((created / count) * 100).toFixed(1);
      console.log(`  Batch ${i + 1}/${batches}: ${created}/${count} (${progress}%)`);
    }
    
    // Final count
    const finalCount = await prisma.bugReport.count();
    const resolvedCount = await prisma.bugReport.count({
      where: { resolutionStatus: 'resolved' },
    });
    const unresolvedCount = await prisma.bugReport.count({
      where: { resolutionStatus: 'unresolved' },
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Seeding completed successfully!');
    console.log('='.repeat(60));
    console.log(`Total bug reports: ${finalCount}`);
    console.log(`Resolved: ${resolvedCount}`);
    console.log(`Unresolved: ${unresolvedCount}`);
    console.log(`Newly created: ${created}`);
    
  } catch (error) {
    console.error('\n❌ Error seeding bug reports:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  const count = parseInt(process.argv[2]) || 1000;
  
  seedBugReports(count)
    .then(() => {
      console.log('\n✓ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Failed:', error);
      process.exit(1);
    });
}

module.exports = { seedBugReports };
