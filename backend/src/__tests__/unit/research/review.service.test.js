const ReviewService = require('../../../modules/research/services/review.service');

describe('research review.service', () => {
  let reviewRepo;
  let contributionRepo;
  let prisma;
  let service;

  beforeEach(() => {
    reviewRepo = {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    };

    contributionRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    prisma = {
      $transaction: jest.fn(async (callback) =>
        callback({
          researchContribution: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValue({
              id: 'contribution-4',
              status: 'completed',
              currentReviewerId: null,
            }),
          },
          researchContributionStatusHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
          researchContributionReview: {
            create: jest.fn().mockResolvedValue({}),
          },
        })
      ),
      researchContributionStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      notification: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    service = new ReviewService(reviewRepo, contributionRepo, null, prisma, null);
  });

  test('submitReview blocks users who are not the assigned reviewer', async () => {
    contributionRepo.findById.mockResolvedValue({
      id: 'contribution-1',
      status: 'under_review',
      currentReviewerId: 'assigned-reviewer',
    });

    await expect(
      service.submitReview('contribution-1', 'other-reviewer', {
        decision: 'changes_required',
        comments: 'Needs edits',
        suggestions: [],
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Only the assigned reviewer can submit a review',
    });

    expect(reviewRepo.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('recommendForApproval blocks users who are not the assigned reviewer', async () => {
    contributionRepo.findById.mockResolvedValue({
      id: 'contribution-2',
      status: 'under_review',
      currentReviewerId: 'assigned-reviewer',
      applicantUser: { id: 'applicant-1' },
    });

    await expect(
      service.recommendForApproval('contribution-2', 'other-reviewer', 'Looks good')
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Only the assigned reviewer can recommend this contribution',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('rejectContribution blocks terminal or invalid statuses', async () => {
    contributionRepo.findById.mockResolvedValue({
      id: 'contribution-3',
      status: 'completed',
      currentReviewerId: null,
      title: 'Completed contribution',
      publicationType: 'research_paper',
    });

    await expect(
      service.rejectContribution('contribution-3', 'drd-head', {
        reason: 'Should not be allowed',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot reject for contribution in status: completed',
    });

    expect(reviewRepo.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('markCompleted clears current reviewer on terminal completion', async () => {
    contributionRepo.findById.mockResolvedValue({
      id: 'contribution-4',
      status: 'approved',
      currentReviewerId: 'reviewer-1',
    });

    const result = await service.markCompleted('contribution-4', 'drd-head');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.currentReviewerId).toBeNull();
  });
});

describe('research review.service - extended coverage', () => {
  let reviewRepo;
  let contributionRepo;
  let prisma;
  let service;

  function makeContribution(overrides = {}) {
    return {
      id: 'c-1',
      status: 'under_review',
      currentReviewerId: 'reviewer-1',
      title: 'Test Paper',
      publicationType: 'research_paper',
      applicantUserId: 'user-1',
      applicantUser: { id: 'user-1' },
      authors: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    reviewRepo = {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    };

    contributionRepo = {
      findById: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'c-1' }),
    };

    prisma = {
      $transaction: jest.fn(async (callback) =>
        callback({
          researchContribution: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValue({ id: 'c-1', status: 'completed', currentReviewerId: null }),
          },
          researchContributionStatusHistory: { create: jest.fn().mockResolvedValue({}) },
          researchContributionReview: { create: jest.fn().mockResolvedValue({}) },
        })
      ),
      researchContributionStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      notification: { create: jest.fn().mockResolvedValue({}) },
      researchContribution: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      researchContributionReview: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      grantApplication: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      school: { findMany: jest.fn().mockResolvedValue([]) },
      researchContributionEditSuggestion: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      centralDepartment: { findFirst: jest.fn().mockResolvedValue(null) },
      centralDepartmentPermission: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    contributionRepo.findAll = jest.fn().mockResolvedValue([]);

    service = new ReviewService(reviewRepo, contributionRepo, null, prisma, null);
  });

  // ── assignReviewer ────────────────────────────────────────────────────────

  describe('assignReviewer()', () => {
    test('throws 404 when contribution not found', async () => {
      contributionRepo.findById.mockResolvedValue(null);
      await expect(service.assignReviewer('c-1', 'reviewer-1')).rejects.toMatchObject({ statusCode: 404 });
    });

    test('throws 400 when status is not submitted or resubmitted', async () => {
      contributionRepo.findById.mockResolvedValue(makeContribution({ status: 'draft' }));
      await expect(service.assignReviewer('c-1', 'reviewer-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    test('assigns reviewer to submitted contribution via transaction', async () => {
      contributionRepo.findById.mockResolvedValue(makeContribution({ status: 'submitted', currentReviewerId: null }));
      const result = await service.assignReviewer('c-1', 'reviewer-1');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  // ── submitReview - happy path ─────────────────────────────────────────────

  describe('submitReview() - happy path', () => {
    test('submits changes_required review successfully', async () => {
      contributionRepo.findById.mockResolvedValue(makeContribution({ currentReviewerId: 'reviewer-1' }));
      await expect(
        service.submitReview('c-1', 'reviewer-1', { decision: 'changes_required', comments: 'Needs work', suggestions: [] })
      ).resolves.toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('submits recommended review successfully', async () => {
      contributionRepo.findById.mockResolvedValue(makeContribution({ currentReviewerId: 'reviewer-1' }));
      await expect(
        service.submitReview('c-1', 'reviewer-1', { decision: 'recommended', comments: 'Looks good', suggestions: [] })
      ).resolves.toBeDefined();
    });
  });

  // ── recommendForApproval - happy path ────────────────────────────────────

  describe('recommendForApproval() - happy path', () => {
    test('recommends contribution when reviewer is assigned', async () => {
      contributionRepo.findById.mockResolvedValue(makeContribution({ currentReviewerId: 'reviewer-1' }));
      await expect(
        service.recommendForApproval('c-1', 'reviewer-1', 'Excellent work')
      ).resolves.toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── rejectContribution - happy path ──────────────────────────────────────

  describe('rejectContribution() - happy path', () => {
    test('rejects under_review contribution', async () => {
      contributionRepo.findById.mockResolvedValue(makeContribution({ status: 'under_review', currentReviewerId: null }));
      await expect(
        service.rejectContribution('c-1', 'drd-head', { reason: 'Not eligible', comments: 'Rejected' })
      ).resolves.toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('rejects recommended contribution', async () => {
      // 'recommended' is not in the allowed statuses for rejectContribution
      contributionRepo.findById.mockResolvedValue(makeContribution({ status: 'recommended', currentReviewerId: null }));
      await expect(
        service.rejectContribution('c-1', 'drd-head', { reason: 'Not eligible' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ── getStatistics ─────────────────────────────────────────────────────────

  describe('getStatistics()', () => {
    test('returns stats object with byStatus and byPublicationType', async () => {
      contributionRepo.groupBy = jest.fn().mockResolvedValue([]);
      contributionRepo.aggregate = jest.fn().mockResolvedValue({ _count: { id: 0 }, _sum: { incentiveAmount: 0, pointsAwarded: 0 } });
      const result = await service.getStatistics({});
      expect(result).toHaveProperty('byStatus');
      expect(result).toHaveProperty('byPublicationType');
      expect(result).toHaveProperty('totals');
    });
  });

  // ── getPendingReviews ─────────────────────────────────────────────────────

  describe('getPendingReviews()', () => {
    test('returns object with contributions and stats when no permissions', async () => {
      // No permissions → returns empty result object
      const result = await service.getPendingReviews('user-1', {}, []);
      expect(result).toHaveProperty('contributions');
      expect(result).toHaveProperty('stats');
      expect(result.contributions).toHaveLength(0);
    });

    test('returns pagination metadata when requested', async () => {
      prisma.centralDepartment.findFirst.mockResolvedValue({ id: 'drd-1' });
      prisma.centralDepartmentPermission.findFirst.mockResolvedValue({
        permissions: { research_review: true },
        assignedResearchSchoolIds: [],
        assignedBookSchoolIds: [],
        assignedConferenceSchoolIds: [],
      });
      contributionRepo.findAll.mockResolvedValue([makeContribution({ status: 'submitted' })]);
      contributionRepo.count = jest.fn().mockResolvedValue(9);
      contributionRepo.groupBy = jest.fn().mockResolvedValue([{ status: 'submitted', _count: { id: 9 } }]);

      const result = await service.getPendingReviews('user-1', { page: '2', limit: '5' }, []);
      expect(result.pagination).toMatchObject({ page: 2, limit: 5, total: 9, totalPages: 2 });
      expect(result.stats.total).toBe(9);
    });
  });

  // ── respondToSuggestion ───────────────────────────────────────────────────

  describe('respondToSuggestion()', () => {
    test('throws 404 when suggestion not found', async () => {
      prisma.researchContributionEditSuggestion.findUnique.mockResolvedValue(null);
      await expect(service.respondToSuggestion('sug-1', 'user-1', true, 'ok')).rejects.toMatchObject({ statusCode: 404 });
    });

    test('throws 403 when user is not the applicant', async () => {
      prisma.researchContributionEditSuggestion.findUnique.mockResolvedValue({
        id: 'sug-1', status: 'pending',
        researchContribution: { applicantUserId: 'other-user' },
      });
      await expect(service.respondToSuggestion('sug-1', 'user-1', true, 'ok')).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
