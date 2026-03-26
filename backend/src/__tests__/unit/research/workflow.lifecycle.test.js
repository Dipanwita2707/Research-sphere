const ContributionService = require('../../../modules/research/services/contribution.service');
const ReviewService = require('../../../modules/research/services/review.service');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('research workflow lifecycle', () => {
  let state;
  let contributionRepo;
  let reviewRepo;
  let prisma;
  let workflowQueue;
  let contributionService;
  let reviewService;

  beforeEach(() => {
    state = {
      contribution: {
        id: 'contribution-1',
        applicationNumber: 'RP-2026-0001',
        title: 'Research Workflow Test',
        publicationType: 'research_paper',
        status: 'draft',
        applicantUserId: 'applicant-1',
        currentReviewerId: null,
        revisionCount: 0,
        incentiveAmount: null,
        pointsAwarded: null,
        creditedAt: null,
        completedAt: null,
        submittedAt: null,
        updatedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
        applicantDetails: {
          id: 'details-1',
          mentorUid: null,
          mentorName: null,
        },
        applicantUser: {
          id: 'applicant-1',
          uid: 'FAC001',
          role: { name: 'faculty' },
          studentLogin: null,
        },
        authors: [
          {
            id: 'author-1',
            userId: 'applicant-1',
            authorCategory: 'internal_faculty',
            authorType: 'first_author',
            incentiveShare: 0,
            pointsShare: 0,
          },
        ],
      },
      statusHistory: [],
      reviews: [],
      suggestions: [],
      notifications: [],
    };

    contributionRepo = {
      findById: jest.fn(async () => clone(state.contribution)),
      findFirst: jest.fn(),
      update: jest.fn(async (_id, data) => {
        state.contribution = { ...state.contribution, ...data };
        return clone(state.contribution);
      }),
      delete: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      findAll: jest.fn(),
    };

    reviewRepo = {
      create: jest.fn(async (data) => {
        const review = { id: `review-${state.reviews.length + 1}`, ...data };
        state.reviews.push(review);
        return clone(review);
      }),
      findMany: jest.fn(async (where, options = {}) => {
        let rows = state.reviews.filter((review) =>
          Object.entries(where).every(([key, value]) => review[key] === value)
        );
        if (options.take) rows = rows.slice(0, options.take);
        return clone(rows);
      }),
      findByContribution: jest.fn(async (contributionId, options = {}) => {
        let rows = state.reviews.filter((review) => review.researchContributionId === contributionId);
        if (options.where) {
          rows = rows.filter((review) =>
            Object.entries(options.where).every(([key, value]) => review[key] === value)
          );
        }
        return clone(rows);
      }),
    };

    workflowQueue = {
      isAvailable: jest.fn(() => false),
      dispatchNotification: jest.fn(async (data) => {
        state.notifications.push(data);
        return data;
      }),
      dispatchResearchStatusAudit: jest.fn(async () => ({})),
    };

    const transactionClient = {
      researchContribution: {
        updateMany: jest.fn(async ({ where, data }) => {
          const matchesStatus = where.status?.in
            ? where.status.in.includes(state.contribution.status)
            : where.status
              ? state.contribution.status === where.status
              : true;
          const matchesReviewer =
            where.currentReviewerId === undefined ||
            state.contribution.currentReviewerId === where.currentReviewerId;
          const matchesApplicant =
            where.applicantUserId === undefined ||
            state.contribution.applicantUserId === where.applicantUserId;

          if (state.contribution.id !== where.id || !matchesStatus || !matchesReviewer || !matchesApplicant) {
            return { count: 0 };
          }

          state.contribution = {
            ...state.contribution,
            ...data,
            updatedAt: new Date().toISOString(),
          };
          return { count: 1 };
        }),
        findUnique: jest.fn(async () => clone(state.contribution)),
      },
      researchContributionStatusHistory: {
        create: jest.fn(async ({ data }) => {
          state.statusHistory.push(data);
          return data;
        }),
      },
      researchContributionReview: {
        create: jest.fn(async ({ data }) => {
          const review = { id: `review-${state.reviews.length + 1}`, ...data };
          state.reviews.push(review);
          return review;
        }),
      },
      researchContributionEditSuggestion: {
        create: jest.fn(async ({ data }) => {
          state.suggestions.push(data);
          return data;
        }),
      },
      researchContributionAuthor: {
        update: jest.fn(async ({ where, data }) => {
          state.contribution.authors = state.contribution.authors.map((author) =>
            author.id === where.id ? { ...author, ...data } : author
          );
          return {};
        }),
      },
    };

    prisma = {
      $transaction: jest.fn(async (callback) => callback(transactionClient)),
      researchContributionStatusHistory: {
        create: jest.fn(async ({ data }) => {
          state.statusHistory.push(data);
          return data;
        }),
      },
      researchContributionEditSuggestion: {
        create: jest.fn(async ({ data }) => {
          state.suggestions.push(data);
          return data;
        }),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      researchContributionReview: {
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      researchIncentivePolicy: {
        findFirst: jest.fn(async () => ({
          first_author_percentage: 70,
          corresponding_author_percentage: 30,
        })),
      },
      userLogin: {
        findFirst: jest.fn(async ({ where }) =>
          where.uid === 'MENTOR001' ? { id: 'mentor-1', uid: 'MENTOR001' } : null
        ),
        findUnique: jest.fn(async ({ where }) =>
          where.id === 'mentor-1' ? { id: 'mentor-1', uid: 'MENTOR001' } : null
        ),
      },
      notification: {
        create: jest.fn(async ({ data }) => {
          state.notifications.push(data);
          return data;
        }),
      },
      facultySchoolList: {
        findMany: jest.fn(),
      },
      department: {
        findMany: jest.fn(),
      },
      centralDepartment: {
        findFirst: jest.fn(),
      },
      centralDepartmentPermission: {
        findFirst: jest.fn(),
      },
      grantApplication: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      grantApplicationStatusHistory: {
        create: jest.fn(),
      },
    };

    contributionService = new ContributionService(contributionRepo, null, null, prisma, workflowQueue);
    reviewService = new ReviewService(reviewRepo, contributionRepo, null, prisma, null, workflowQueue);

    jest.spyOn(reviewService, '_creditIncentivesToAuthors').mockResolvedValue({
      totalIncentiveAwarded: 100,
      totalPointsAwarded: 10,
      authorShares: [
        {
          ...state.contribution.authors[0],
          incentiveShare: 100,
          pointsShare: 10,
        },
      ],
    });
  });

  test('supports draft to changes_required to resubmitted to approved to completed lifecycle', async () => {
    await contributionService.submitContribution('contribution-1', 'applicant-1');
    expect(state.contribution.status).toBe('submitted');

    state.contribution.currentReviewerId = 'reviewer-1';
    await reviewService.submitReview('contribution-1', 'reviewer-1', {
      decision: 'changes_required',
      comments: 'Please fix metadata',
      suggestions: [{ fieldName: 'title', suggestedValue: 'Updated title' }],
    });
    expect(state.contribution.status).toBe('changes_required');
    expect(state.contribution.currentReviewerId).toBeNull();

    await contributionService.resubmitContribution('contribution-1', 'applicant-1', 'Fixed');
    expect(state.contribution.status).toBe('resubmitted');

    state.contribution.currentReviewerId = 'reviewer-1';
    const approval = await reviewService.approveContribution('contribution-1', 'drd-head', {
      comments: 'Approved',
    });
    expect(approval.updated.status).toBe('approved');
    expect(state.contribution.currentReviewerId).toBeNull();
    expect(state.notifications.some((entry) => entry.type === 'research_approved')).toBe(true);

    await reviewService.markCompleted('contribution-1', 'drd-head');
    expect(state.contribution.status).toBe('completed');
  });

  test('supports mentor approval path before DRD review', async () => {
    state.contribution.applicantUser.role.name = 'student';
    state.contribution.applicantUser.studentLogin = { id: 'student-login-1' };
    state.contribution.applicantDetails.mentorUid = 'MENTOR001';
    state.contribution.applicantDetails.mentorName = 'Mentor';

    await contributionService.submitContribution('contribution-1', 'applicant-1');
    expect(state.contribution.status).toBe('pending_mentor_approval');
    expect(state.notifications.some((entry) => entry.type === 'research_mentor_review')).toBe(true);

    await contributionService.mentorApprove('contribution-1', 'mentor-1', 'Approved by mentor');
    expect(state.contribution.status).toBe('submitted');
    expect(state.notifications.some((entry) => entry.type === 'research_mentor_approved')).toBe(true);
  });

  test('supports rejection path with applicant notification', async () => {
    state.contribution.status = 'under_review';

    await reviewService.rejectContribution('contribution-1', 'drd-head', {
      reason: 'Out of scope',
    });

    expect(state.contribution.status).toBe('rejected');
    expect(state.contribution.currentReviewerId).toBeNull();
    expect(state.notifications.some((entry) => entry.type === 'research_rejected')).toBe(true);
  });
});
