/**
 * Bug Report Service Unit Tests
 */

const bugReportService = require('../bugReport.service');
const prisma = require('../../../../shared/config/database');
const screenshotService = require('../screenshot.service');

// Mock dependencies
jest.mock('../../../../shared/config/database', () => ({
  bugReport: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../screenshot.service', () => ({
  saveScreenshots: jest.fn(),
  getScreenshotsByBugReportId: jest.fn(),
}));

describe('Bug Report Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBugReport', () => {
    const validData = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      userRole: 'student',
      userIdentifier: 'STU001',
      userEmail: 'test@example.com',
      description: 'This is a test bug description with more than 10 characters',
      pageUrl: 'https://example.com/page',
      routePath: '/page',
    };

    it('should create a bug report without screenshots', async () => {
      const mockBugReport = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        ...validData,
        resolutionStatus: 'unresolved',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: validData.userId,
          uid: 'UID001',
          email: validData.userEmail,
          role: validData.userRole,
        },
        screenshots: [],
      };

      prisma.bugReport.create.mockResolvedValue(mockBugReport);

      const result = await bugReportService.createBugReport(validData);

      expect(prisma.bugReport.create).toHaveBeenCalledWith({
        data: {
          userId: validData.userId,
          userRole: validData.userRole,
          userIdentifier: validData.userIdentifier,
          userEmail: validData.userEmail,
          description: validData.description,
          pageUrl: validData.pageUrl,
          routePath: validData.routePath,
          resolutionStatus: 'unresolved',
          resolvedAt: null,
          resolvedBy: null,
        },
        include: {
          user: {
            select: {
              id: true,
              uid: true,
              email: true,
              role: true,
            },
          },
          screenshots: true,
        },
      });

      expect(result).toEqual(mockBugReport);
      expect(screenshotService.saveScreenshots).not.toHaveBeenCalled();
    });

    it('should create a bug report with screenshots', async () => {
      const mockBugReport = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        ...validData,
        resolutionStatus: 'unresolved',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: validData.userId,
          uid: 'UID001',
          email: validData.userEmail,
          role: validData.userRole,
        },
        screenshots: [],
      };

      const mockScreenshots = [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          bugReportId: mockBugReport.id,
          originalFilename: 'screenshot1.png',
          storedFilename: 'uuid1.png',
          fileSize: 1024,
          mimeType: 'image/png',
          storagePath: 'bug-reports/screenshots/2024/01/01/uuid1.png',
          uploadedAt: new Date(),
        },
      ];

      const mockFiles = [
        {
          originalname: 'screenshot1.png',
          mimetype: 'image/png',
          size: 1024,
          buffer: Buffer.from('fake image data'),
        },
      ];

      prisma.bugReport.create.mockResolvedValue(mockBugReport);
      screenshotService.saveScreenshots.mockResolvedValue(mockScreenshots);

      const result = await bugReportService.createBugReport(validData, mockFiles);

      expect(prisma.bugReport.create).toHaveBeenCalled();
      expect(screenshotService.saveScreenshots).toHaveBeenCalledWith(
        mockFiles, 
        mockBugReport.id,
        validData.userId,
        validData.userIdentifier
      );
      expect(result.screenshots).toEqual(mockScreenshots);
    });

    it('should throw error if description is too short', async () => {
      const invalidData = {
        ...validData,
        description: 'Short',
      };

      await expect(bugReportService.createBugReport(invalidData)).rejects.toThrow(
        'Description must be at least 10 characters'
      );
    });

    it('should throw error if description is too long', async () => {
      const invalidData = {
        ...validData,
        description: 'a'.repeat(2001),
      };

      await expect(bugReportService.createBugReport(invalidData)).rejects.toThrow(
        'Description must not exceed 2000 characters'
      );
    });

    it('should throw error if more than 5 screenshots', async () => {
      const mockFiles = Array(6).fill({
        originalname: 'screenshot.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('fake image data'),
      });

      await expect(bugReportService.createBugReport(validData, mockFiles)).rejects.toThrow(
        'Maximum 5 screenshots allowed per bug report'
      );
    });

    it('should throw error if required fields are missing', async () => {
      await expect(bugReportService.createBugReport({})).rejects.toThrow('User ID is required');

      await expect(
        bugReportService.createBugReport({ userId: '123' })
      ).rejects.toThrow('User role is required');

      await expect(
        bugReportService.createBugReport({ userId: '123', userRole: 'student' })
      ).rejects.toThrow('User identifier is required');
    });
  });

  describe('getBugReportById', () => {
    it('should retrieve a bug report by ID', async () => {
      const mockBugReport = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        userRole: 'student',
        userIdentifier: 'STU001',
        userEmail: 'test@example.com',
        description: 'Test bug description',
        pageUrl: 'https://example.com/page',
        routePath: '/page',
        resolutionStatus: 'unresolved',
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          uid: 'UID001',
          email: 'test@example.com',
          role: 'student',
        },
        resolver: null,
        screenshots: [],
      };

      prisma.bugReport.findUnique.mockResolvedValue(mockBugReport);

      const result = await bugReportService.getBugReportById(mockBugReport.id);

      expect(prisma.bugReport.findUnique).toHaveBeenCalledWith({
        where: { id: mockBugReport.id },
        include: {
          user: {
            select: {
              id: true,
              uid: true,
              email: true,
              role: true,
            },
          },
          resolver: {
            select: {
              id: true,
              uid: true,
              email: true,
            },
          },
          screenshots: {
            orderBy: {
              uploadedAt: 'asc',
            },
          },
        },
      });

      expect(result).toEqual(mockBugReport);
    });

    it('should throw error if bug report not found', async () => {
      prisma.bugReport.findUnique.mockResolvedValue(null);

      await expect(
        bugReportService.getBugReportById('123e4567-e89b-12d3-a456-426614174001')
      ).rejects.toThrow('Bug report not found');
    });

    it('should throw error if ID is not provided', async () => {
      await expect(bugReportService.getBugReportById()).rejects.toThrow(
        'Bug report ID is required'
      );
    });
  });

  describe('updateResolutionStatus', () => {
    const bugReportId = '123e4567-e89b-12d3-a456-426614174001';
    const adminId = '123e4567-e89b-12d3-a456-426614174002';

    it('should mark bug report as resolved', async () => {
      const existingReport = {
        id: bugReportId,
        resolutionStatus: 'unresolved',
      };

      const updatedReport = {
        ...existingReport,
        resolutionStatus: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: adminId,
      };

      prisma.bugReport.findUnique.mockResolvedValue(existingReport);
      prisma.bugReport.update.mockResolvedValue(updatedReport);

      const result = await bugReportService.updateResolutionStatus(
        bugReportId,
        'resolved',
        adminId
      );

      expect(prisma.bugReport.update).toHaveBeenCalledWith({
        where: { id: bugReportId },
        data: {
          resolutionStatus: 'resolved',
          resolvedAt: expect.any(Date),
          resolvedBy: adminId,
        },
        include: {
          user: {
            select: {
              id: true,
              uid: true,
              email: true,
              role: true,
            },
          },
          resolver: {
            select: {
              id: true,
              uid: true,
              email: true,
            },
          },
          screenshots: true,
        },
      });

      expect(result.resolutionStatus).toBe('resolved');
    });

    it('should mark bug report as unresolved', async () => {
      const existingReport = {
        id: bugReportId,
        resolutionStatus: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: adminId,
      };

      const updatedReport = {
        ...existingReport,
        resolutionStatus: 'unresolved',
        resolvedAt: null,
        resolvedBy: null,
      };

      prisma.bugReport.findUnique.mockResolvedValue(existingReport);
      prisma.bugReport.update.mockResolvedValue(updatedReport);

      const result = await bugReportService.updateResolutionStatus(
        bugReportId,
        'unresolved',
        null
      );

      expect(prisma.bugReport.update).toHaveBeenCalledWith({
        where: { id: bugReportId },
        data: {
          resolutionStatus: 'unresolved',
          resolvedAt: null,
          resolvedBy: null,
        },
        include: {
          user: {
            select: {
              id: true,
              uid: true,
              email: true,
              role: true,
            },
          },
          resolver: {
            select: {
              id: true,
              uid: true,
              email: true,
            },
          },
          screenshots: true,
        },
      });

      expect(result.resolutionStatus).toBe('unresolved');
      expect(result.resolvedAt).toBeNull();
      expect(result.resolvedBy).toBeNull();
    });

    it('should throw error if admin ID not provided when marking as resolved', async () => {
      const existingReport = {
        id: bugReportId,
        resolutionStatus: 'unresolved',
      };

      prisma.bugReport.findUnique.mockResolvedValue(existingReport);

      await expect(
        bugReportService.updateResolutionStatus(bugReportId, 'resolved', null)
      ).rejects.toThrow('Admin user ID is required when marking as resolved');
    });

    it('should throw error if bug report not found', async () => {
      prisma.bugReport.findUnique.mockResolvedValue(null);

      await expect(
        bugReportService.updateResolutionStatus(bugReportId, 'resolved', adminId)
      ).rejects.toThrow('Bug report not found');
    });

    it('should throw error if invalid status provided', async () => {
      await expect(
        bugReportService.updateResolutionStatus(bugReportId, 'invalid', adminId)
      ).rejects.toThrow('Status must be either "resolved" or "unresolved"');
    });
  });

  describe('getAllBugReports', () => {
    it('should retrieve all bug reports with default filters', async () => {
      const mockReports = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          description: 'Bug 1',
          resolutionStatus: 'unresolved',
          createdAt: new Date(),
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          description: 'Bug 2',
          resolutionStatus: 'resolved',
          createdAt: new Date(),
        },
      ];

      prisma.bugReport.count.mockResolvedValueOnce(2); // total
      prisma.bugReport.count.mockResolvedValueOnce(1); // resolved
      prisma.bugReport.count.mockResolvedValueOnce(1); // unresolved
      prisma.bugReport.findMany.mockResolvedValue(mockReports);

      const result = await bugReportService.getAllBugReports();

      expect(result).toEqual({
        reports: mockReports,
        pagination: {
          total: 2,
          page: 1,
          limit: 50,
          totalPages: 1,
        },
        counts: {
          total: 2,
          resolved: 1,
          unresolved: 1,
        },
      });
    });

    it('should filter by resolution status', async () => {
      prisma.bugReport.count.mockResolvedValueOnce(1); // total
      prisma.bugReport.count.mockResolvedValueOnce(1); // resolved
      prisma.bugReport.count.mockResolvedValueOnce(1); // unresolved
      prisma.bugReport.findMany.mockResolvedValue([]);

      await bugReportService.getAllBugReports({ status: 'unresolved' });

      expect(prisma.bugReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resolutionStatus: 'unresolved' },
        })
      );
    });

    it('should search across multiple fields', async () => {
      prisma.bugReport.count.mockResolvedValueOnce(0); // total
      prisma.bugReport.count.mockResolvedValueOnce(1); // resolved
      prisma.bugReport.count.mockResolvedValueOnce(1); // unresolved
      prisma.bugReport.findMany.mockResolvedValue([]);

      await bugReportService.getAllBugReports({ search: 'test' });

      expect(prisma.bugReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { description: { contains: 'test', mode: 'insensitive' } },
              { userIdentifier: { contains: 'test', mode: 'insensitive' } },
              { pageUrl: { contains: 'test', mode: 'insensitive' } },
              { userEmail: { contains: 'test', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('should handle pagination correctly', async () => {
      prisma.bugReport.count.mockResolvedValueOnce(100); // total
      prisma.bugReport.count.mockResolvedValueOnce(50); // resolved
      prisma.bugReport.count.mockResolvedValueOnce(50); // unresolved
      prisma.bugReport.findMany.mockResolvedValue([]);

      await bugReportService.getAllBugReports({ page: 2, limit: 25 });

      expect(prisma.bugReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        })
      );
    });

    it('should enforce maximum limit of 100', async () => {
      prisma.bugReport.count.mockResolvedValueOnce(0); // total
      prisma.bugReport.count.mockResolvedValueOnce(0); // resolved
      prisma.bugReport.count.mockResolvedValueOnce(0); // unresolved
      prisma.bugReport.findMany.mockResolvedValue([]);

      await bugReportService.getAllBugReports({ limit: 200 });

      expect(prisma.bugReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });
  });

  describe('getScreenshots', () => {
    it('should retrieve screenshots for a bug report', async () => {
      const bugReportId = '123e4567-e89b-12d3-a456-426614174001';
      const mockScreenshots = [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          bugReportId,
          originalFilename: 'screenshot1.png',
          storedFilename: 'uuid1.png',
          fileSize: 1024,
          mimeType: 'image/png',
          storagePath: 'bug-reports/screenshots/2024/01/01/uuid1.png',
          uploadedAt: new Date(),
        },
      ];

      prisma.bugReport.findUnique.mockResolvedValue({ id: bugReportId });
      screenshotService.getScreenshotsByBugReportId.mockResolvedValue(mockScreenshots);

      const result = await bugReportService.getScreenshots(bugReportId);

      expect(prisma.bugReport.findUnique).toHaveBeenCalledWith({
        where: { id: bugReportId },
      });
      expect(screenshotService.getScreenshotsByBugReportId).toHaveBeenCalledWith(bugReportId);
      expect(result).toEqual(mockScreenshots);
    });

    it('should throw error if bug report not found', async () => {
      prisma.bugReport.findUnique.mockResolvedValue(null);

      await expect(
        bugReportService.getScreenshots('123e4567-e89b-12d3-a456-426614174001')
      ).rejects.toThrow('Bug report not found');
    });

    it('should throw error if bug report ID not provided', async () => {
      await expect(bugReportService.getScreenshots()).rejects.toThrow(
        'Bug report ID is required'
      );
    });
  });
});
