/**
 * Mass-assignment and IDOR guards on research/IPR writes whose keys come from a request:
 *   - applicant contribution update (allowlisted fields only)
 *   - author update/delete scoped to the contribution in the URL
 *   - accepted research edit suggestions
 *   - IPR edit suggestions and accept-edits-and-resubmit
 */
const mockPrisma = {
  iprApplication: { findUnique: jest.fn(), update: jest.fn(async ({ data }) => ({ id: 'ipr-1', ...data })) },
  iprStatusHistory: { create: jest.fn() },
  iprEditSuggestion: { create: jest.fn() },
};
jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/utils/auditLogger', () => ({ logIprStatusChange: jest.fn(() => Promise.resolve()), logIprUpdate: jest.fn(() => Promise.resolve()) }));

const ContributionService = require('../../../modules/research/services/contribution.service');
const ReviewService = require('../../../modules/research/services/review.service');
const collaborativeEditing = require('../../../modules/research/controllers/collaborativeEditing.controller');
const drdReview = require('../../../modules/research/controllers/drdReview.controller');

const APPLICANT = 'user-1';

const makeContributionService = (contribution) => {
  const repo = {
    findById: jest.fn(async () => contribution),
    findFirst: jest.fn(async () => contribution),
    update: jest.fn(async (_id, data) => ({ ...contribution, ...data })),
  };
  const prisma = {
    department: { findUnique: jest.fn(async () => null) },
    facultySchoolList: { findUnique: jest.fn(async () => null) },
    employeeDetails: { findFirst: jest.fn(async () => null) },
    studentDetails: { findFirst: jest.fn(async () => null) },
    researchContributionApplicantDetails: { update: jest.fn() },
    researchContributionAuthor: {
      findFirst: jest.fn(),
      update: jest.fn(async ({ data }) => data),
      delete: jest.fn(),
      count: jest.fn(async () => 1),
      deleteMany: jest.fn(),
    },
  };
  return { service: new ContributionService(repo, null, null, prisma), repo, prisma };
};

describe('updateContribution allowlist', () => {
  const draft = { id: 'c1', applicantUserId: APPLICANT, status: 'draft', schoolId: null, departmentId: null, applicantDetails: { id: 'ad1' } };

  it('drops status, incentive, ownership and workflow fields from the request', async () => {
    const { service, repo, prisma } = makeContributionService(draft);
    await service.updateContribution('c1', APPLICANT, {
      title: 'New title',
      impactFactor: '3.2',
      isPresenter: 'yes',
      sdgGoals: ['sdg1'],
      status: 'approved',
      incentiveAmount: 999999,
      calculatedIncentiveAmount: 999999,
      pointsAwarded: 500,
      calculatedPoints: 500,
      creditedAt: new Date(),
      applicantUserId: 'someone-else',
      universityId: 'other-tenant',
      applicationNumber: 'RC-1',
      currentReviewerId: 'me',
      revisionCount: 0,
      manuscriptFilePath: 'documents/other-user/secret.pdf',
      specialReviewRequired: false,
      id: 'c2',
      applicantDetails: { mentorName: 'M', researchContributionId: 'c9', universityId: 'x', id: 'ad9' },
    });
    const data = repo.update.mock.calls[0][1];
    expect(data).toMatchObject({ title: 'New title', impactFactor: '3.2', isPresenter: true, sdg_goals: ['sdg1'] });
    for (const forbidden of ['status', 'incentiveAmount', 'calculatedIncentiveAmount', 'pointsAwarded', 'calculatedPoints',
      'creditedAt', 'applicantUserId', 'universityId', 'applicationNumber', 'currentReviewerId', 'revisionCount',
      'manuscriptFilePath', 'specialReviewRequired', 'id', 'sdgGoals', 'applicantDetails']) {
      expect(data).not.toHaveProperty(forbidden);
    }
    expect(prisma.researchContributionApplicantDetails.update).toHaveBeenCalledWith({
      where: { id: 'ad1' }, data: { mentorName: 'M' },
    });
  });
});

describe('author update/delete IDOR', () => {
  const draft = { id: 'c1', applicantUserId: APPLICANT, status: 'draft', title: 'T' };

  it('404s when the author belongs to another contribution', async () => {
    const { service, prisma } = makeContributionService(draft);
    prisma.researchContributionAuthor.findFirst.mockResolvedValue(null);
    await expect(service.updateAuthor('c1', 'author-of-c2', APPLICANT, { name: 'x' })).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.researchContributionAuthor.findFirst).toHaveBeenCalledWith({
      where: { id: 'author-of-c2', researchContributionId: 'c1' }, select: { id: true },
    });
    expect(prisma.researchContributionAuthor.update).not.toHaveBeenCalled();

    await expect(service.removeAuthor('c1', 'author-of-c2', APPLICANT)).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.researchContributionAuthor.delete).not.toHaveBeenCalled();
  });

  it('only writes allowlisted author fields', async () => {
    const { service, prisma } = makeContributionService(draft);
    prisma.researchContributionAuthor.findFirst.mockResolvedValue({ id: 'a1' });
    await service.updateAuthor('c1', 'a1', APPLICANT, {
      name: 'New Name', affiliation: 'X', userId: 'victim', uid: 'V1', incentiveShare: 1e6, pointsShare: 99,
      canEdit: true, researchContributionId: 'c2', universityId: 'u2',
    });
    expect(prisma.researchContributionAuthor.update).toHaveBeenCalledWith({
      where: { id: 'a1' }, data: { name: 'New Name', affiliation: 'X' },
    });
  });
});

describe('accepted research edit suggestions', () => {
  const makeReviewService = (fieldName) => {
    const prisma = {
      researchContributionEditSuggestion: {
        findUnique: jest.fn(async () => ({
          id: 's1', fieldName, suggestedValue: 'approved', researchContributionId: 'c1',
          researchContribution: { applicantUserId: APPLICANT },
        })),
        update: jest.fn(),
        count: jest.fn(async () => 0),
      },
      researchContribution: { update: jest.fn() },
      researchContributionReview: { updateMany: jest.fn() },
    };
    return { service: new ReviewService({}, {}, null, prisma), prisma };
  };

  it.each(['status', 'incentiveAmount', 'applicantUserId', 'currentReviewerId'])('refuses to write %s', async (field) => {
    const { service, prisma } = makeReviewService(field);
    await expect(service.respondToSuggestion('s1', APPLICANT, true, 'ok')).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.researchContribution.update).not.toHaveBeenCalled();
    expect(prisma.researchContributionEditSuggestion.update).not.toHaveBeenCalled();
  });

  it('applies an editable field', async () => {
    const { service, prisma } = makeReviewService('title');
    await service.respondToSuggestion('s1', APPLICANT, true, 'ok');
    expect(prisma.researchContribution.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { title: 'approved' } });
  });
});

describe('IPR edit suggestions', () => {
  const makeRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects suggestions for non-editable IPR fields', async () => {
    for (const fieldName of ['status', 'incentiveAmount', 'applicantUserId', 'constructor']) {
      const res = makeRes();
      await collaborativeEditing.createEditSuggestion(
        { params: { iprApplicationId: 'ipr-1' }, user: { id: 'rev' }, body: { fieldName, suggestedValue: 'x' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    const res = makeRes();
    await collaborativeEditing.mentorSubmitBatchSuggestions(
      { params: { iprApplicationId: 'ipr-1' }, user: { id: 'mentor' }, body: { suggestions: [{ fieldName: 'title', suggestedValue: 'a' }, { fieldName: 'status', suggestedValue: 'approved' }] } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.iprEditSuggestion.create).not.toHaveBeenCalled();
  });

  it('acceptEditsAndResubmit only writes descriptive fields', async () => {
    mockPrisma.iprApplication.findUnique.mockResolvedValue({ id: 'ipr-1', status: 'changes_required' });
    const res = makeRes();
    await drdReview.acceptEditsAndResubmit({
      params: { id: 'ipr-1' }, user: { id: 'rev' }, headers: {}, get: () => 'ua', ip: '127.0.0.1',
      body: { updatedData: { title: 'T2', status: 'completed', incentiveAmount: 5e5, applicantUserId: 'x', universityId: 'u2' } },
    }, res);
    const { data } = mockPrisma.iprApplication.update.mock.calls[0][0];
    expect(data.title).toBe('T2');
    expect(data.status).toBe('resubmitted');
    expect(data).not.toHaveProperty('incentiveAmount');
    expect(data).not.toHaveProperty('applicantUserId');
    expect(data).not.toHaveProperty('universityId');
  });

  it('acceptEditsAndResubmit refuses applications that are not awaiting changes', async () => {
    mockPrisma.iprApplication.findUnique.mockResolvedValue({ id: 'ipr-1', status: 'completed' });
    const res = makeRes();
    await drdReview.acceptEditsAndResubmit({ params: { id: 'ipr-1' }, user: { id: 'rev' }, body: { updatedData: {} } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.iprApplication.update).not.toHaveBeenCalled();
  });
});
