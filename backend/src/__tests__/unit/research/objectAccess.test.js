/**
 * Object-level authorization for research contributions, grants, IPR applications
 * and progress trackers (within a tenant; tenant isolation is tested separately).
 */
const {
  hasAnyPermission,
  canViewContribution,
  canViewGrant,
  canViewIpr,
  canViewTracker,
  notFound,
} = require('../../../modules/research/utils/objectAccess');
const ContributionService = require('../../../modules/research/services/contribution.service');
const GrantService = require('../../../modules/grants/services/grant.service');

const user = (overrides = {}) => ({
  id: 'u-1',
  uid: 'UID1',
  role: 'faculty',
  centralDeptPermissions: [],
  schoolDeptPermissions: [],
  ...overrides,
});
const withPerms = (perms, overrides = {}) =>
  user({ centralDeptPermissions: [{ centralDeptId: 'drd', permissions: perms }], ...overrides });

const contribution = (overrides = {}) => ({
  id: 'c-1',
  applicantUserId: 'owner',
  currentReviewerId: null,
  authors: [],
  reviews: [],
  applicantDetails: null,
  ...overrides,
});

describe('objectAccess.hasAnyPermission', () => {
  test('matches central, school and drd_-prefixed permission keys', () => {
    expect(hasAnyPermission(withPerms({ research_review: true }), ['research_review'])).toBe(true);
    expect(hasAnyPermission(withPerms({ drd_ipr_review: true }), ['ipr_review'])).toBe(true);
    expect(hasAnyPermission(user({ schoolDeptPermissions: [{ permissions: { grant_approve: true } }] }), ['grant_approve'])).toBe(true);
  });

  test('ignores false values, missing permissions and missing user', () => {
    expect(hasAnyPermission(withPerms({ research_review: false }), ['research_review'])).toBe(false);
    expect(hasAnyPermission(user(), ['research_review'])).toBe(false);
    expect(hasAnyPermission(null, ['research_review'])).toBe(false);
  });
});

describe('objectAccess.canViewContribution', () => {
  test('denies an unrelated user of the same university', () => {
    expect(canViewContribution(user(), contribution())).toBe(false);
  });

  test('denies an unrelated admin without DRD permissions', () => {
    expect(canViewContribution(user({ role: 'admin' }), contribution())).toBe(false);
  });

  test('denies a missing record', () => {
    expect(canViewContribution(user(), null)).toBe(false);
  });

  test.each([
    ['applicant', contribution({ applicantUserId: 'u-1' })],
    ['author by userId', contribution({ authors: [{ userId: 'u-1' }] })],
    ['author by uid', contribution({ authors: [{ userId: null, uid: 'UID1' }] })],
    ['author by registration number', contribution({ authors: [{ registrationNo: 'UID1' }] })],
    ['current reviewer', contribution({ currentReviewerId: 'u-1' })],
    ['past reviewer', contribution({ reviews: [{ reviewerId: 'u-1' }] })],
    ['mentor', contribution({ applicantDetails: { mentorUid: 'UID1' } })],
  ])('allows the %s', (_label, record) => {
    expect(canViewContribution(user(), record)).toBe(true);
  });

  test.each(['research_review', 'research_approve', 'book_review', 'conference_approve', 'grant_review', 'finance_review'])(
    'allows DRD/finance staff holding %s',
    (perm) => {
      expect(canViewContribution(withPerms({ [perm]: true }), contribution())).toBe(true);
    }
  );

  test('does not treat an IPR-only permission as research access', () => {
    expect(canViewContribution(withPerms({ ipr_review: true }), contribution())).toBe(false);
  });

  test('allows superadmin', () => {
    expect(canViewContribution(user({ role: 'superadmin' }), contribution())).toBe(true);
  });
});

describe('objectAccess.canViewGrant', () => {
  const grant = (overrides = {}) => ({ applicantUserId: 'owner', investigators: [], reviews: [], ...overrides });

  test('denies unrelated users and research-paper-only reviewers', () => {
    expect(canViewGrant(user(), grant())).toBe(false);
    expect(canViewGrant(withPerms({ research_review: true }), grant())).toBe(false);
  });

  test('allows applicant, investigator, reviewer and grant staff', () => {
    expect(canViewGrant(user(), grant({ applicantUserId: 'u-1' }))).toBe(true);
    expect(canViewGrant(user(), grant({ investigators: [{ uid: 'UID1' }] }))).toBe(true);
    expect(canViewGrant(user(), grant({ reviews: [{ reviewerId: 'u-1' }] }))).toBe(true);
    expect(canViewGrant(withPerms({ grant_approve: true }), grant())).toBe(true);
  });
});

describe('objectAccess.canViewIpr', () => {
  const ipr = (overrides = {}) => ({ applicantUserId: 'owner', contributors: [], reviews: [], applicantDetails: {}, ...overrides });

  test('denies unrelated users, including holders of the own-dashboard permission only', () => {
    expect(canViewIpr(user(), ipr())).toBe(false);
    expect(canViewIpr(withPerms({ ipr_own_dashboard: true }), ipr())).toBe(false);
  });

  test('allows applicant, contributor, inventor, mentor, reviewer and IPR staff', () => {
    expect(canViewIpr(user(), ipr({ applicantUserId: 'u-1' }))).toBe(true);
    expect(canViewIpr(user(), ipr({ contributors: [{ userId: 'u-1' }] }))).toBe(true);
    expect(canViewIpr(user(), ipr({ applicantDetails: { inventorUid: 'UID1' } }))).toBe(true);
    expect(canViewIpr(user(), ipr({ applicantDetails: { mentorUid: 'UID1' } }))).toBe(true);
    expect(canViewIpr(user(), ipr({ reviews: [{ reviewerId: 'u-1' }] }))).toBe(true);
    expect(canViewIpr(withPerms({ ipr_all_dashboard: true }), ipr())).toBe(true);
  });
});

describe('objectAccess.canViewTracker', () => {
  test('owner only while unlinked; research staff once linked to a contribution', () => {
    const tracker = { userId: 'owner', researchContributionId: null };
    expect(canViewTracker(user({ id: 'owner' }), tracker)).toBe(true);
    expect(canViewTracker(withPerms({ research_review: true }), tracker)).toBe(false);
    expect(canViewTracker(user({ role: 'admin' }), tracker)).toBe(false);
    expect(canViewTracker(withPerms({ research_review: true }), { ...tracker, researchContributionId: 'c-1' })).toBe(true);
  });
});

describe('objectAccess.notFound', () => {
  test('is a 404 operational error', () => {
    const err = notFound('x');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('x');
  });
});

describe('ContributionService viewer checks', () => {
  const makeService = ({ contributionRecord = null, grantRecord = null } = {}) => {
    const repo = { findById: jest.fn().mockResolvedValue(contributionRecord) };
    const prisma = { grantApplication: { findUnique: jest.fn().mockResolvedValue(grantRecord) } };
    return new ContributionService(repo, null, {}, prisma);
  };

  test('getContributionForViewer returns 404 (not 403) for an unrelated user', async () => {
    const service = makeService({ contributionRecord: contribution() });
    await expect(service.getContributionForViewer('c-1', user())).rejects.toMatchObject({ statusCode: 404 });
  });

  test('getContributionForViewer returns the record for a co-author', async () => {
    const record = contribution({ authors: [{ userId: 'u-1' }] });
    const service = makeService({ contributionRecord: record });
    await expect(service.getContributionForViewer('c-1', user())).resolves.toEqual({ record, isGrant: false });
  });

  test('getContributionForViewer falls back to grants and applies the grant rule', async () => {
    const grant = { id: 'g-1', applicantUserId: 'owner', investigators: [], reviews: [] };
    await expect(makeService({ grantRecord: grant }).getContributionForViewer('g-1', user()))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(makeService({ grantRecord: { ...grant, applicantUserId: 'u-1' } }).getContributionForViewer('g-1', user()))
      .resolves.toMatchObject({ isGrant: true });
  });

  test('resolveDocumentForViewer hides manuscripts from unrelated users', async () => {
    const record = contribution({ manuscriptFilePath: JSON.stringify({ s3Key: 'research/owner/m.pdf', name: 'm.pdf' }) });
    await expect(makeService({ contributionRecord: record }).resolveDocumentForViewer('c-1', user(), 'manuscript', 'm.pdf'))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(makeService({ contributionRecord: record }).resolveDocumentForViewer('c-1', withPerms({ research_review: true }), 'manuscript', 'm.pdf'))
      .resolves.toEqual({ s3Key: 'research/owner/m.pdf', filename: 'm.pdf' });
  });

  test('resolveDocumentForViewer finds supporting documents by name', async () => {
    const record = contribution({
      applicantUserId: 'u-1',
      supportingDocsFilePaths: { files: [{ name: 'a.pdf', s3Key: 'research/supporting/u-1/a.pdf' }] },
    });
    await expect(makeService({ contributionRecord: record }).resolveDocumentForViewer('c-1', user(), 'supporting', 'a.pdf'))
      .resolves.toEqual({ s3Key: 'research/supporting/u-1/a.pdf', filename: 'a.pdf' });
    await expect(makeService({ contributionRecord: record }).resolveDocumentForViewer('c-1', user(), 'supporting', 'missing.pdf'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('GrantService.getApplicationById viewer check', () => {
  test('returns 404 for an unrelated user and the record for the applicant', async () => {
    const grant = { id: 'g-1', applicantUserId: 'owner', investigators: [], reviews: [] };
    const service = new GrantService({ findById: jest.fn().mockResolvedValue(grant) }, null, {});
    await expect(service.getApplicationById('g-1', user())).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getApplicationById('g-1', user({ id: 'owner' }))).resolves.toBe(grant);
  });
});
