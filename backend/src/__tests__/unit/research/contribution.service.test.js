const ContributionService = require('../../../modules/research/services/contribution.service');

describe('ContributionService', () => {
  let service;

  beforeEach(() => {
    service = new ContributionService({}, null, null, {});
  });

  test('_buildContributionPayload stores bookPublicationType without sending legacy bookType to Prisma', () => {
    const payload = service._buildContributionPayload(
      {
        userId: 'user-1',
        userRole: 'faculty',
        publicationType: 'book_chapter',
        title: 'Imported chapter',
        bookType: 'authored',
        bookPublicationType: null,
        indexingCategories: [],
      },
      {},
      'BC-2026-0001',
      { totalPoolAmount: 1000, totalPoolPoints: 10 },
      { schoolId: null, departmentId: null }
    );

    expect(payload.bookPublicationType).toBe('authored');
    expect(payload).not.toHaveProperty('bookType');
  });

  test('_buildIncentiveContributionData falls back to bookPublicationType for incentive calculations', () => {
    const incentiveData = service._buildIncentiveContributionData({
      publicationDate: '2026-01-01',
      bookPublicationType: 'edited',
      indexingCategories: [],
      impactFactor: null,
      sjr: 0,
      naasRating: null,
      subsidiaryImpactFactor: null,
    });

    expect(incentiveData.bookType).toBe('edited');
  });

  test('dispatchPostCreationSideEffects skips audit and file logging when request context is missing', async () => {
    service = new ContributionService(
      {},
      null,
      {
        logResearchFiling: jest.fn(),
        logFileUpload: jest.fn(),
      },
      {}
    );

    await service.dispatchPostCreationSideEffects(
      {
        id: 'contribution-1',
        manuscriptFilePath: '/tmp/manuscript.pdf',
        supportingDocsFilePaths: ['/tmp/supporting.pdf'],
      },
      'user-1',
      null
    );

    expect(service.auditLogger.logResearchFiling).not.toHaveBeenCalled();
    expect(service.auditLogger.logFileUpload).not.toHaveBeenCalled();
  });
});
