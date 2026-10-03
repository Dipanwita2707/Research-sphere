/**
 * No silent ₹0:
 *   - DRD approval of a contribution with no applicable policy (or a ₹0 result) → 409
 *     NO_INCENTIVE_POLICY unless confirmZeroIncentive, which is then recorded in the history
 *   - book/chapter defaults are visible (usedDefaultPolicy) in the breakdown and history
 *   - contribution create/edit responses carry incentiveWarning when no policy applies
 */
const ReviewService = require('../../../modules/research/services/review.service');
const ContributionService = require('../../../modules/research/services/contribution.service');

const baseContribution = {
  id: 'c1',
  universityId: 'uni-1',
  applicationNumber: 'RP-2019-0001',
  title: 'Old paper',
  publicationType: 'research_paper',
  publicationDate: new Date('2019-05-01'),
  indexingCategories: ['pubmed'],
  doi: null,
  status: 'under_review',
  applicantUserId: 'u1',
  applicantUser: { id: 'u1', uid: 'FAC1', universityId: 'uni-1' },
  authors: [{ id: 'a1', userId: 'u1', authorType: 'first_and_corresponding_author', isInternal: true, authorOrder: 1 }],
};

function setup(contribution, { researchPolicy = null, bookPolicy = null } = {}) {
  const tx = {
    researchContribution: {
      findUnique: jest.fn().mockResolvedValueOnce({ ...contribution }).mockResolvedValue({ ...contribution, status: 'approved' }),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    researchIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(researchPolicy) },
    bookIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(bookPolicy) },
    bookChapterIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
    conferenceIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
    userLogin: { findMany: jest.fn().mockResolvedValue([]) },
    researchContributionAuthor: { update: jest.fn().mockResolvedValue({}) },
    researchContributionReview: { create: jest.fn().mockResolvedValue({}) },
    researchContributionStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    employeeDetails: { findMany: jest.fn().mockResolvedValue([]) },
    incentivePayout: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn(async ({ data }) => ({ count: data.length })) },
    incentivePayoutEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = { $transaction: jest.fn(async (cb) => cb(tx)), researchIncentivePolicy: tx.researchIncentivePolicy };
  const contributionRepo = { findById: jest.fn().mockResolvedValue({ ...contribution }) };
  const service = new ReviewService({ create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) }, contributionRepo, null, prisma, null);
  jest.spyOn(service, '_notifyAuthorsOnApproval').mockResolvedValue();
  jest.spyOn(service, '_notifyApplicantOnApproval').mockResolvedValue();
  jest.spyOn(service, '_notifyRecommendingReviewers').mockResolvedValue();
  jest.spyOn(service, '_dispatchStatusAudit').mockResolvedValue();
  return { tx, service };
}

describe('approveContribution — no applicable incentive policy', () => {
  test('409 NO_INCENTIVE_POLICY without confirmation; nothing is approved', async () => {
    const { tx, service } = setup(baseContribution);
    await expect(service.approveContribution('c1', 'drd-head', { comments: 'ok' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'NO_INCENTIVE_POLICY',
      message: expect.stringContaining('No incentive policy covers this publication date/type'),
    });
    expect(tx.researchContribution.updateMany).not.toHaveBeenCalled();
    expect(tx.incentivePayout.createMany).not.toHaveBeenCalled();
  });

  test('confirmZeroIncentive approves with ₹0 and records it in the status history', async () => {
    const { tx, service } = setup(baseContribution);
    const result = await service.approveContribution('c1', 'drd-head', { comments: 'ok', confirmZeroIncentive: true });
    expect(tx.researchContribution.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'approved', incentiveAmount: 0 }),
    }));
    const { comments } = tx.researchContributionStatusHistory.create.mock.calls[0][0].data;
    expect(comments).toMatch(/^ok\. Approved with ₹0 incentive — confirmed by approver/);
    expect(result.incentiveBreakdown).toMatchObject({ policyFound: false, zeroIncentiveConfirmed: true, totalIncentiveAwarded: 0 });
  });

  test('a policy that computes ₹0 also needs confirmation', async () => {
    const policy = { id: 'p', distributionMethod: 'author_role_based', first_author_percentage: 40, corresponding_author_percentage: 30, indexingBonuses: { indexingCategoryBonuses: [] } };
    const { service } = setup({ ...baseContribution, indexingCategories: [] }, { researchPolicy: policy });
    await expect(service.approveContribution('c1', 'drd-head', {})).rejects.toMatchObject({
      code: 'NO_INCENTIVE_POLICY', message: expect.stringContaining('computes ₹0'),
    });
  });

  test('a paying policy approves without confirmation', async () => {
    const policy = {
      id: 'p', distributionMethod: 'author_role_based', first_author_percentage: 40, corresponding_author_percentage: 30,
      indexingBonuses: { indexingCategoryBonuses: [{ category: 'pubmed', incentiveAmount: 15000, points: 15 }] },
    };
    const { tx, service } = setup(baseContribution, { researchPolicy: policy });
    const result = await service.approveContribution('c1', 'drd-head', {});
    expect(tx.researchContribution.updateMany.mock.calls[0][0].data.incentiveAmount).toBe(15000);
    expect(result.incentiveBreakdown).toMatchObject({ policyFound: true, usedDefaultPolicy: false, zeroIncentiveConfirmed: false });
  });

  test('book with no configured policy: defaults are used, and that is visible', async () => {
    const book = { ...baseContribution, publicationType: 'book', bookPublicationType: 'authored', indexingCategories: [] };
    const { tx, service } = setup(book);
    const result = await service.approveContribution('c1', 'drd-head', {});
    expect(tx.researchContribution.updateMany.mock.calls[0][0].data.incentiveAmount).toBe(50000);
    expect(result.incentiveBreakdown.usedDefaultPolicy).toBe(true);
    const { comments } = tx.researchContributionStatusHistory.create.mock.calls[0][0].data;
    expect(comments).toMatch(/built-in DEFAULT/);
  });
});

describe('contribution create/edit incentiveWarning', () => {
  const svc = (prisma) => new ContributionService({}, null, null, prisma);

  test('_incentiveWarningFrom flags policyFound:false only', () => {
    const s = svc({});
    expect(s._incentiveWarningFrom({ policyFound: false, reason: 'No incentive policy covers this publication date/type' })).toEqual({
      code: 'NO_INCENTIVE_POLICY',
      message: 'No incentive policy covers this publication date/type — incentive will be ₹0 unless a policy is configured',
      reason: 'No incentive policy covers this publication date/type',
    });
    expect(s._incentiveWarningFrom({ policyFound: true, incentiveAmount: 0 })).toBeNull();
  });

  test('_incentiveWarningFor re-checks a stored contribution against the date-based policy', async () => {
    const prisma = { researchIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) } };
    const warning = await svc(prisma)._incentiveWarningFor({ publicationType: 'research_paper', publicationDate: new Date('2019-05-01'), indexingCategories: ['pubmed'] });
    expect(warning).toMatchObject({ code: 'NO_INCENTIVE_POLICY' });
  });

  test('_incentiveWarningFor never fails a saved edit', async () => {
    const prisma = { researchIncentivePolicy: { findFirst: jest.fn().mockRejectedValue(new Error('db down')) } };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(svc(prisma)._incentiveWarningFor({ id: 'c1', publicationType: 'research_paper' })).resolves.toBeNull();
    spy.mockRestore();
  });
});
