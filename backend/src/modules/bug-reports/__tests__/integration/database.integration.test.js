/**
 * Database Integration Tests for Bug Report System
 * 
 * Tests database operations including:
 * - Bug report creation and retrieval
 * - Screenshot association with bug reports
 * - Cascade delete behavior
 * - Index performance
 * 
 * Validates: Requirements 6.1-6.13, 10.1-10.14, 17.1-17.8, 19.1-19.11
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

describe('Bug Report Database Integration Tests', () => {
  let testUserId;
  let testAdminId;

  beforeAll(async () => {
    // Create test users for the integration tests
    const testUser = await prisma.userLogin.findFirst({
      where: { role: 'student' }
    });
    
    const testAdmin = await prisma.userLogin.findFirst({
      where: { role: { in: ['admin', 'superadmin'] } }
    });

    if (!testUser || !testAdmin) {
      throw new Error('Test requires at least one student and one admin user in the database');
    }

    testUserId = testUser.id;
    testAdminId = testAdmin.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.bugReport.deleteMany({
      where: {
        description: { contains: '[TEST]' }
      }
    });
    await prisma.$disconnect();
  });

  describe('Bug Report Creation and Retrieval', () => {
    test('should create a bug report with all required fields', async () => {
      const bugReportData = {
        userId: testUserId,
        userRole: 'student',
        userIdentifier: 'TEST123',
        userEmail: 'test@example.com',
        description: '[TEST] This is a test bug report',
        pageUrl: 'https://example.com/test-page',
        routePath: '/test-page',
        resolutionStatus: 'unresolved'
      };

      const createdReport = await prisma.bugReport.create({
        data: bugReportData
      });

      expect(createdReport).toBeDefined();
      expect(createdReport.id).toBeDefined();
      expect(createdReport.userId).toBe(testUserId);
      expect(createdReport.userRole).toBe('student');
      expect(createdReport.userIdentifier).toBe('TEST123');
      expect(createdReport.description).toBe('[TEST] This is a test bug report');
      expect(createdReport.pageUrl).toBe('https://example.com/test-page');
      expect(createdReport.routePath).toBe('/test-page');
      expect(createdReport.resolutionStatus).toBe('unresolved');
      expect(createdReport.resolvedAt).toBeNull();
      expect(createdReport.resolvedBy).toBeNull();
      expect(createdReport.createdAt).toBeDefined();
    });

    test('should retrieve a bug report by ID', async () => {
      const bugReport = await prisma.bugReport.create({
        data: {
          userId: testUserId,
          userRole: 'student',
          userIdentifier: 'TEST456',
          description: '[TEST] Retrieve test bug report',
          pageUrl: 'https://example.com/retrieve-test',
          routePath: '/retrieve-test'
        }
      });

      const retrievedReport = await prisma.bugReport.findUnique({
        where: { id: bugReport.id }
      });

      expect(retrievedReport).toBeDefined();
      expect(retrievedReport.id).toBe(bugReport.id);
      expect(retrievedReport.description).toBe('[TEST] Retrieve test bug report');
    });

    test('should retrieve bug reports with filtering by status', async () => {
      // Create unresolved report
      await prisma.bugReport.create({
        data: {
          userId: testUserId,
          userRole: 'student',
          userIdentifier: 'TEST789',
          description: '[TEST] Unresolved bug report',
          pageUrl: 'https://example.com/unresolved',
          routePath: '/unresolved',
          resolutionStatus: 'unresolved'
        }
      });

      // Create resolved report
      await prisma.bugReport.create({
        data: {
          userId: testUserId,
          userRole: 'student',
          userIdentifier: 'TEST790',
          description: '[TEST] Resolved bug report',
          pageUrl: 'https://example.com/resolved',
          routePath: '/resolved',
          resolutionStatus: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: testAdminId
        }
      });

      const unresolvedReports = await prisma.bugReport.findMany({
        where: {
          resolutionStatus: 'unresolved',
          description: { contains: '[TEST]' }
        }
      });

      const resolvedReports = await prisma.bugReport.findMany({
        where: {
          resolutionStatus: 'resolved',
          description: { contains: '[TEST]' }
        }
      });

      expect(unresolvedReports.length).toBeGreaterThan(0);
      expect(resolvedReports.length).toBeGreaterThan(0);
      expect(unresolvedReports.every(r => r.resolutionStatus === 'unresolved')).toBe(true);
      expect(resolvedReports.every(r => r.resolutionStatus === 'resolved')).toBe(true);
    });

    test('should update resolution status with timestamp and admin ID', async () => {
      const bugReport = await prisma.bugReport.create({
        data: {
          userId: testUserId,
          userRole: 'student',
          userIdentifier: 'TEST791',
          description: '[TEST] Status update test',
          pageUrl: 'https://example.com/status-test',
          routePath: '/status-test'
        }
      });

      const resolvedAt = new Date();
      const updatedReport = await prisma.bugReport.update({
        where: { id: bugReport.id },
        data: {
          resolutionStatus: 'resolved',
          resolvedAt: resolvedAt,
          resolvedBy: testAdminId
        }
      });

      expect(updatedReport.resolutionStatus).toBe('resolved');
      expect(updatedReport.resolvedAt).toBeDefined();
      expect(updatedReport.resolvedBy).toBe(testAdminId);
    });
  });

  describe('Screenshot Association with Bug Reports', () => {
    test('should create bug report with associated screenshots', async () => {
      const bugReport = await prisma.bugReport.create({
        data: {
          userId: testUserId,
          userRole: 'student',
          userIdentifier: 'TEST792',
          description: '[TEST] Bug report with screenshots',
          pageUrl: 'https://example.com/screenshots-test',
          routePath: '/screenshots-test',
          screenshots: {
            create: [
              {
                originalFilename: 'test-screenshot-1.png',
                storedFilename: `${uuidv4()}.png`,
                fileSize: 102400,
                mimeType: 'image/png',
                storagePath: '/uploads/bug-reports/test-1.png'
              },
              {
                originalFilename: 'test-screenshot-2.jpg',
                storedFilename: `${uuidv4()}.jpg`,
                fileSize: 204800,
                mimeType: 'image/jpeg',
                storagePath: '/uploads/bug-reports/test-2.jpg'
              }
            ]
          }
        },
        include: {
          screenshots: true
        }
      });

      expect(bugReport.screenshots).toBeDefined();
      expect(bugReport.screenshots.length).toBe(2);
      expect(bugReport.screenshots[0].originalFilename).toBe('test-screenshot-1.png');
      expect(bugReport.screenshots[1].originalFilename).toBe('test-screenshot-2.jpg');
    });

    test('should retrieve bug report with screenshots', async () => {
      const bugReport = await prisma.bugReport.create({
        data: {
          userId: testUserId,
          userRole: 'student',
          userIdentifier: 'TEST793',
          description: '[TEST] Retrieve with screenshots',
          pageUrl: 'https://example.com/retrieve-screenshots',
          routePath: '/retrieve-screenshots',
          screenshots: {
            create: [
              {
                originalFilename: 'retrieve-test.png',
                storedFilename: `${uuidv4()}.png`,
                fileSize: 51200,
                mimeType: 'image/png',
                storagePath: '/uploads/bug-reports/retrieve-test.png'
              }
            ]
          }
        }
      });

      const retrievedReport = await prisma.bugReport.findUnique({
        where: { id: bugReport.id },
        include: {
          screenshots: true
        }
      });

      expect(retrievedReport.screenshots).toBeDefined();
      expect(retrievedReport.screenshots.length).toBe(1);
      expect(retrievedReport.screenshots[0].bugReportId).toBe(bugReport.id);
    });

    test('should retrieve screenshot by ID', async () => {
      const bugReport = await prisma.bugReport.create({
        data: {
          userId: testUserId,
          userRole: 'student',
          userIdentifier: 'TEST794',
          description: '[TEST] Screenshot by ID test',
          pageUrl: 'https://example.com/screenshot-id',
          routePath: '/screenshot-id',
          screenshots: {
            create: [
              {
                originalFilename: 'screenshot-id-test.png',
                storedFilename: `${uuidv4()}.png`,
                fileSize: 76800,
                mimeType: 'image/png',
                storagePath: '/uploads/bug-reports/screenshot-id-test.png'
              }
            ]
          }
        },
        include: {
          screenshots: true
        }
      });

      const screenshotId = bugReport.screenshots[0].id;
      const screenshot = await prisma.bugReportScreenshot.findUnique({
        where: { id: screenshotId }
      });

      expect(screenshot).toBeDefined();
      expect(screenshot.id).toBe(screenshotId);
      expect(screenshot.bugReportId).toBe(bugReport.id);
      expect(screenshot.originalFilename).toBe('screenshot-id-test.png');
    });
  });

  describe('Cascade Delete Behavior', () => {
    test('should delete associated screenshots when bug report is deleted', async () => {
      const bugReport = await prisma.bugReport.create({
        data: {
          userId: testUserId,
          userRole: 'student',
          userIdentifier: 'TEST795',
          description: '[TEST] Cascade delete test',
          pageUrl: 'https://example.com/cascade-delete',
          routePath: '/cascade-delete',
          screenshots: {
            create: [
              {
                originalFilename: 'cascade-test-1.png',
                storedFilename: `${uuidv4()}.png`,
                fileSize: 102400,
                mimeType: 'image/png',
                storagePath: '/uploads/bug-reports/cascade-1.png'
              },
              {
                originalFilename: 'cascade-test-2.png',
                storedFilename: `${uuidv4()}.png`,
                fileSize: 102400,
                mimeType: 'image/png',
                storagePath: '/uploads/bug-reports/cascade-2.png'
              }
            ]
          }
        },
        include: {
          screenshots: true
        }
      });

      const screenshotIds = bugReport.screenshots.map(s => s.id);

      // Delete the bug report
      await prisma.bugReport.delete({
        where: { id: bugReport.id }
      });

      // Verify screenshots are also deleted
      const remainingScreenshots = await prisma.bugReportScreenshot.findMany({
        where: {
          id: { in: screenshotIds }
        }
      });

      expect(remainingScreenshots.length).toBe(0);
    });
  });

  describe('Index Performance', () => {
    test('should efficiently query by userId with index', async () => {
      // Create multiple bug reports for the same user
      const reports = [];
      for (let i = 0; i < 5; i++) {
        reports.push({
          userId: testUserId,
          userRole: 'student',
          userIdentifier: `TEST80${i}`,
          description: `[TEST] Performance test report ${i}`,
          pageUrl: `https://example.com/perf-test-${i}`,
          routePath: `/perf-test-${i}`
        });
      }

      await prisma.bugReport.createMany({
        data: reports
      });

      const startTime = Date.now();
      const userReports = await prisma.bugReport.findMany({
        where: { userId: testUserId }
      });
      const queryTime = Date.now() - startTime;

      expect(userReports.length).toBeGreaterThanOrEqual(5);
      // Query should complete quickly (under 1000ms for indexed query)
      expect(queryTime).toBeLessThan(1000);
    });

    test('should efficiently query by resolutionStatus with index', async () => {
      const startTime = Date.now();
      const unresolvedReports = await prisma.bugReport.findMany({
        where: { resolutionStatus: 'unresolved' },
        take: 50
      });
      const queryTime = Date.now() - startTime;

      expect(unresolvedReports).toBeDefined();
      // Query should complete quickly (under 1000ms for indexed query)
      expect(queryTime).toBeLessThan(1000);
    });

    test('should efficiently query by createdAt with index', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const startTime = Date.now();
      const recentReports = await prisma.bugReport.findMany({
        where: {
          createdAt: { gte: yesterday }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      const queryTime = Date.now() - startTime;

      expect(recentReports).toBeDefined();
      // Query should complete quickly (under 1000ms for indexed query)
      expect(queryTime).toBeLessThan(1000);
    });

    test('should efficiently query with multiple filters', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const startTime = Date.now();
      const filteredReports = await prisma.bugReport.findMany({
        where: {
          resolutionStatus: 'unresolved',
          createdAt: { gte: yesterday }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      const queryTime = Date.now() - startTime;

      expect(filteredReports).toBeDefined();
      // Query should complete quickly (under 1500ms for multi-filter indexed query)
      expect(queryTime).toBeLessThan(1500);
    });
  });

  describe('Data Integrity', () => {
    test('should enforce required fields', async () => {
      await expect(
        prisma.bugReport.create({
          data: {
            userId: testUserId,
            // Missing required fields
          }
        })
      ).rejects.toThrow();
    });

    test('should enforce foreign key constraint for userId', async () => {
      const nonExistentUserId = uuidv4();

      await expect(
        prisma.bugReport.create({
          data: {
            userId: nonExistentUserId,
            userRole: 'student',
            userIdentifier: 'TEST999',
            description: '[TEST] Foreign key test',
            pageUrl: 'https://example.com/fk-test',
            routePath: '/fk-test'
          }
        })
      ).rejects.toThrow();
    });

    test('should default resolutionStatus to unresolved', async () => {
      const bugReport = await prisma.bugReport.create({
        data: {
          userId: testUserId,
          userRole: 'student',
          userIdentifier: 'TEST806',
          description: '[TEST] Default status test',
          pageUrl: 'https://example.com/default-status',
          routePath: '/default-status'
          // Not specifying resolutionStatus
        }
      });

      expect(bugReport.resolutionStatus).toBe('unresolved');
      expect(bugReport.resolvedAt).toBeNull();
      expect(bugReport.resolvedBy).toBeNull();
    });
  });
});
