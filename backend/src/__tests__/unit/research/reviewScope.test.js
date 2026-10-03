/**
 * School-assignment scope for DRD reviewers (reviewScope) and the places that use it:
 * action middleware, detail views, research/grant queues and statistics.
 */

const mockPrisma = {
  centralDepartment: { findFirst: jest.fn() },
  centralDepartmentPermission: { findFirst: jest.fn() },
  researchContribution: { findUnique: jest.fn() },
  grantApplication: { findUnique: jest.fn() },
  iprApplication: { findUnique: jest.fn() },
  iprStatusUpdate: { findUnique: jest.fn() },
  iprCollaborativeSession: { findUnique: jest.fn() },
  userLogin: { findUnique: jest.fn() },
};
mockPrisma.iprApplication.findFirst = jest.fn();
mockPrisma.grantApplication.findFirst = jest.fn();
mockPrisma.researchContribution.findFirst = jest.fn();
jest.mock('../../../shared/config/database', () => mockPrisma);

const cache = require('../../../shared/config/redis');
const reviewScope = require('../../../modules/research/services/reviewScope');
const ReviewService = require('../../../modules/research/services/review.service');
const GrantService = require('../../../modules/grants/services/grant.service');

const X = '11111111-1111-4111-8111-111111111111';
const Y = '22222222-2222-4222-8222-222222222222';
const ITEM = '33333333-3333-4333-8333-333333333333';
const reviewer = { id: 'rev-1', role: 'faculty', centralDeptPermissions: [] };

function drdRow(overrides = {}) {
  return {
    permissions: { research_review: true, book_review: true, conference_review: true, grant_review: true, ipr_review: true },
    assignedSchoolIds: [],
    assignedResearchSchoolIds: [],
    assignedBookSchoolIds: [],
    assignedConferenceSchoolIds: [],
    assignedGrantSchoolIds: [],
    ...overrides,
  };
}

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  reviewScope.clearCache();
  mockPrisma.centralDepartment.findFirst.mockResolvedValue({ id: 'drd-1' });
  mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(null);
});

describe('getSchoolScope / assertCanActOnSchool', () => {
  test('admins and superadmins cover all schools without a DRD row lookup', async () => {
    await expect(reviewScope.getSchoolScope({ id: 'a', role: 'admin' }, 'research')).resolves.toEqual({ all: true, schoolIds: [] });
    await expect(reviewScope.getSchoolScope({ id: 's', role: 'superadmin' }, 'ipr')).resolves.toEqual({ all: true, schoolIds: [] });
    expect(mockPrisma.centralDepartmentPermission.findFirst).not.toHaveBeenCalled();
  });

  test('no DRD row, or an empty list, means all schools (including items without a school)', async () => {
    await expect(reviewScope.assertCanActOnSchool(reviewer, 'grant', Y)).resolves.toMatchObject({ all: true });
    reviewScope.clearCache();
    mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({ assignedResearchSchoolIds: [X] }));
    await expect(reviewScope.assertCanActOnSchool(reviewer, 'book', Y)).resolves.toMatchObject({ all: true });
    await expect(reviewScope.assertCanActOnSchool(reviewer, 'book', null)).resolves.toMatchObject({ all: true });
  });

  test('a non-empty list restricts that category only, and excludes items without a school', async () => {
    mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({ assignedResearchSchoolIds: [X], assignedSchoolIds: [X] }));
    await expect(reviewScope.assertCanActOnSchool(reviewer, 'research', X)).resolves.toMatchObject({ all: false, schoolIds: [X] });
    await expect(reviewScope.assertCanActOnSchool(reviewer, 'research', Y)).rejects.toMatchObject({ statusCode: 403, code: 'OUT_OF_ASSIGNED_SCHOOLS' });
    await expect(reviewScope.assertCanActOnSchool(reviewer, 'research', null)).rejects.toMatchObject({ statusCode: 403 });
    await expect(reviewScope.assertCanActOnSchool(reviewer, 'ipr', Y)).rejects.toMatchObject({ code: 'OUT_OF_ASSIGNED_SCHOOLS' });
    await expect(reviewScope.assertCanActOnSchool(reviewer, 'conference', Y)).resolves.toBeTruthy();
  });

  test('JSON lists stored as strings or with junk entries are normalised', async () => {
    mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({ assignedGrantSchoolIds: JSON.stringify([X, null, '', X]) }));
    await expect(reviewScope.getSchoolScope(reviewer, 'grant')).resolves.toEqual({ all: false, schoolIds: [X] });
  });

  test('unknown category is a programming error', async () => {
    await expect(reviewScope.getSchoolScope(reviewer, 'patent')).rejects.toThrow('Unknown review category');
  });
});

describe('scope cache', () => {
  test('the DRD row is cached, and cache.invalidateUser drops it immediately', async () => {
    mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({ assignedResearchSchoolIds: [X] }));
    await reviewScope.getSchoolScope(reviewer, 'research');
    await reviewScope.getSchoolScope(reviewer, 'research');
    expect(mockPrisma.centralDepartmentPermission.findFirst).toHaveBeenCalledTimes(1);

    // Assignment changed by an admin: the write path calls cache.invalidateUser(userId)
    mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow());
    await cache.invalidateUser(reviewer.id);
    await expect(reviewScope.getSchoolScope(reviewer, 'research')).resolves.toEqual({ all: true, schoolIds: [] });
    expect(mockPrisma.centralDepartmentPermission.findFirst).toHaveBeenCalledTimes(2);
  });

  test('entries expire after the short TTL', async () => {
    const now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow());
      await reviewScope.getSchoolScope({ id: 'ttl-user', role: 'faculty' }, 'ipr');
      spy.mockReturnValue(now + reviewScope.SCOPE_TTL_MS + 1);
      await reviewScope.getSchoolScope({ id: 'ttl-user', role: 'faculty' }, 'ipr');
      expect(mockPrisma.centralDepartmentPermission.findFirst).toHaveBeenCalledTimes(2);
      expect(reviewScope.SCOPE_TTL_MS).toBeLessThanOrEqual(15_000);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('requireSchoolScope middleware (DRD actions)', () => {
  beforeEach(() => {
    mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({
      assignedResearchSchoolIds: [X], assignedBookSchoolIds: [X], assignedConferenceSchoolIds: [X],
      assignedGrantSchoolIds: [X], assignedSchoolIds: [X],
    }));
  });

  test.each([
    ['research_paper'], ['book'], ['book_chapter'], ['conference_paper'],
  ])('%s outside the assigned schools → 403 OUT_OF_ASSIGNED_SCHOOLS', async (publicationType) => {
    mockPrisma.researchContribution.findUnique.mockResolvedValue({ schoolId: Y, publicationType });
    const res = mockRes(); const next = jest.fn();
    await reviewScope.requireSchoolScope('research')({ user: reviewer, params: { id: ITEM } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 'OUT_OF_ASSIGNED_SCHOOLS' });
  });

  test('item inside the assigned schools passes through', async () => {
    mockPrisma.researchContribution.findUnique.mockResolvedValue({ schoolId: X, publicationType: 'book' });
    const res = mockRes(); const next = jest.fn();
    await reviewScope.requireSchoolScope('research')({ user: reviewer, params: { id: ITEM } }, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('/research/:id/review/start falls back to grants and checks the grant list', async () => {
    mockPrisma.researchContribution.findUnique.mockResolvedValue(null);
    mockPrisma.grantApplication.findUnique.mockResolvedValue({ schoolId: Y });
    const res = mockRes(); const next = jest.fn();
    await reviewScope.requireSchoolScope('research')({ user: reviewer, params: { id: ITEM } }, res, next);
    expect(res.statusCode).toBe(403);
  });

  test('grant routes check the grant list', async () => {
    mockPrisma.grantApplication.findUnique.mockResolvedValue({ schoolId: X });
    const next = jest.fn();
    await reviewScope.requireSchoolScope('grant')({ user: reviewer, params: { id: ITEM } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('IPR: out of scope → 403, unless the DRD Head assigned the application to this reviewer', async () => {
    mockPrisma.iprApplication.findUnique.mockResolvedValue({ schoolId: Y, currentReviewerId: 'someone-else' });
    const res = mockRes();
    await reviewScope.requireSchoolScope('ipr')({ user: reviewer, params: { id: ITEM } }, res, jest.fn());
    expect(res.statusCode).toBe(403);

    mockPrisma.iprApplication.findUnique.mockResolvedValue({ schoolId: Y, currentReviewerId: reviewer.id });
    const next = jest.fn();
    await reviewScope.requireSchoolScope('ipr')({ user: reviewer, params: { id: ITEM } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('IPR status-update delete resolves the application through the update id', async () => {
    mockPrisma.iprStatusUpdate.findUnique.mockResolvedValue({ iprApplicationId: ITEM });
    mockPrisma.iprApplication.findUnique.mockResolvedValue({ schoolId: Y, currentReviewerId: null });
    const res = mockRes();
    await reviewScope.requireSchoolScope('ipr')({ user: reviewer, params: { updateId: ITEM } }, res, jest.fn());
    expect(res.statusCode).toBe(403);
  });

  test('unknown or malformed ids fall through to the handler (which answers 404)', async () => {
    mockPrisma.researchContribution.findUnique.mockResolvedValue(null);
    mockPrisma.grantApplication.findUnique.mockResolvedValue(null);
    const next = jest.fn();
    await reviewScope.requireSchoolScope('research')({ user: reviewer, params: { id: ITEM } }, mockRes(), next);
    await reviewScope.requireSchoolScope('research')({ user: reviewer, params: { id: 'not-a-uuid' } }, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe('assertCanViewInScope (detail views)', () => {
  beforeEach(() => {
    mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({ assignedResearchSchoolIds: [X] }));
  });

  test('reviewer cannot open an out-of-scope item by id (404)', async () => {
    await expect(reviewScope.assertCanViewInScope(reviewer, 'research', Y)).rejects.toMatchObject({ statusCode: 404 });
    await expect(reviewScope.assertCanViewInScope(reviewer, 'research', X)).resolves.toBeUndefined();
  });

  test('participants (applicant, author, mentor, reviewer of record) keep access', async () => {
    await expect(reviewScope.assertCanViewInScope(reviewer, 'research', Y, { participant: true })).resolves.toBeUndefined();
  });

  test('finance staff keep university-wide view', async () => {
    const financeUser = { ...reviewer, centralDeptPermissions: [{ permissions: { finance_review: true, research_review: true } }] };
    await expect(reviewScope.assertCanViewInScope(financeUser, 'research', Y)).resolves.toBeUndefined();
  });
});

describe('ReviewService queue scoping', () => {
  let contributionRepo;
  let prisma;
  let service;

  beforeEach(() => {
    contributionRepo = {
      findAll: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _count: { id: 0 }, _sum: {} }),
    };
    prisma = {
      centralDepartment: { findFirst: jest.fn().mockResolvedValue({ id: 'drd-1' }) },
      centralDepartmentPermission: { findFirst: jest.fn() },
      grantApplication: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) },
    };
    service = new ReviewService({}, contributionRepo, null, prisma, null);
  });

  const whereOf = () => contributionRepo.findAll.mock.calls[0][0].where;

  test('research assigned, book/conference unassigned: book and conference stay visible for all schools', async () => {
    prisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({
      permissions: { research_review: true, book_review: true, conference_review: true },
      assignedResearchSchoolIds: [X],
    }));
    await service.getPendingReviews('rev-1', {}, []);
    const scope = whereOf().AND[1];
    expect(scope.OR).toEqual(expect.arrayContaining([
      { AND: [{ publicationType: 'research_paper' }, { schoolId: { in: [X] } }] },
      { publicationType: { in: ['book', 'book_chapter'] } },
      { publicationType: 'conference_paper' },
    ]));
    // No "schoolId: null" or "any recommended item" escape hatch
    expect(JSON.stringify(scope)).not.toContain('null');
  });

  test('no assignment at all: every permitted category across all schools', async () => {
    prisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({ permissions: { book_review: true, conference_review: true } }));
    await service.getPendingReviews('rev-1', {}, []);
    expect(whereOf().AND[1]).toEqual({ publicationType: { in: ['book', 'book_chapter', 'conference_paper'] } });
  });

  test('research_* still covers books and conferences in the queue (deprecated fallback)', async () => {
    prisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({ permissions: { research_review: true } }));
    const result = await service.getPendingReviews('rev-1', {}, []);
    expect(whereOf().AND[1]).toEqual({ publicationType: { in: ['research_paper', 'book', 'book_chapter', 'conference_paper'] } });
    expect(result.userPermissions).toMatchObject({ hasBookReview: true, hasConferenceReview: true });
  });

  test('explicit ?schoolId narrows the scope instead of replacing it', async () => {
    prisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({
      permissions: { research_review: true },
      assignedResearchSchoolIds: [X],
    }));
    await service.getPendingReviews('rev-1', { schoolId: Y }, []);
    const where = whereOf();
    expect(where.AND).toEqual(expect.arrayContaining([{ schoolId: Y }]));
    expect(JSON.stringify(where.AND[1])).toContain(X);
  });

  test('approve-and-review users no longer see recommended items from unassigned schools', async () => {
    prisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({
      permissions: { research_review: true, research_approve: true },
      assignedResearchSchoolIds: [X],
    }));
    await service.getPendingReviews('rev-1', {}, []);
    expect(JSON.stringify(whereOf())).not.toContain('recommended');
  });

  test('statistics follow the reviewer scope', async () => {
    prisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({ assignedResearchSchoolIds: [X] }));
    await service.getStatistics({}, reviewer);
    const where = contributionRepo.groupBy.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain(X);
  });
});

describe('GrantService.getPendingReviews scoping', () => {
  test('assigned grant schools apply to approvers too', async () => {
    const repo = {
      findDrdDepartment: jest.fn().mockResolvedValue({ id: 'drd-1' }),
      findDirectPermission: jest.fn().mockResolvedValue({ assignedGrantSchoolIds: [X] }),
      findAll: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
    };
    const service = new GrantService(repo);
    await service.getPendingReviews('rev-1', { grant_approve: true }, {});
    expect(repo.findAll.mock.calls[0][0].where.schoolId).toEqual({ in: [X] });
  });
});

describe('per-category permissions (requireReviewAccess)', () => {
  const userWith = (permissions) => ({ id: 'rev-perm', role: 'faculty', centralDeptPermissions: [{ permissions }] });
  const run = async (user, item, action) => {
    mockPrisma.researchContribution.findUnique.mockResolvedValue(item);
    const res = mockRes(); const next = jest.fn();
    await reviewScope.requireReviewAccess('research', action)({ user, params: { id: ITEM } }, res, next);
    return { res, next };
  };

  test.each([
    ['book', { book_review: true }, 'review', true],
    ['book_chapter', { book_review: true }, 'review', true],
    ['book', { book_review: true }, 'approve', false],
    ['book', { book_approve: true }, 'approve', true],
    ['conference_paper', { conference_review: true }, 'review', true],
    ['conference_paper', { book_review: true }, 'review', false],
    ['research_paper', { book_review: true, conference_review: true }, 'review', false],
    ['research_paper', { research_review: true }, 'review', true],
    ['research_paper', { drd_research_approve: true }, 'approve', true],
  ])('%s with %j -> %s allowed=%s', async (publicationType, permissions, action, allowed) => {
    const { res, next } = await run(userWith(permissions), { schoolId: X, publicationType }, action);
    if (allowed) expect(next).toHaveBeenCalled();
    else expect(res.statusCode).toBe(403);
  });

  test('research_* still covers books and conferences, with a one-off deprecation warning', async () => {
    const logger = require('../../../shared/utils/logger');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const user = { ...userWith({ research_review: true, research_approve: true }), id: 'rev-legacy' };
    for (const publicationType of ['book', 'book_chapter', 'conference_paper']) {
      const { next } = await run(user, { schoolId: X, publicationType }, 'review');
      expect(next).toHaveBeenCalled();
    }
    await run(user, { schoolId: X, publicationType: 'book' }, 'review');
    expect(warn.mock.calls.filter(([m]) => /DEPRECATION.*book/.test(m))).toHaveLength(1);
    expect(warn.mock.calls.filter(([m]) => /DEPRECATION.*conference/.test(m))).toHaveLength(1);
    warn.mockRestore();
  });

  test('grant items reached through /research/:id/review/start need grant_review (or research_review)', async () => {
    mockPrisma.researchContribution.findUnique.mockResolvedValue(null);
    mockPrisma.grantApplication.findUnique.mockResolvedValue({ schoolId: X });
    const res = mockRes();
    await reviewScope.requireReviewAccess('research', 'review')({ user: userWith({ book_review: true }), params: { id: ITEM } }, res, jest.fn());
    expect(res.statusCode).toBe(403);
    const next2 = jest.fn();
    await reviewScope.requireReviewAccess('research', 'review')({ user: userWith({ grant_review: true }), params: { id: ITEM } }, mockRes(), next2);
    expect(next2).toHaveBeenCalled();
  });

  test('unknown id: any category capability passes so the handler can answer 404', async () => {
    mockPrisma.researchContribution.findUnique.mockResolvedValue(null);
    mockPrisma.grantApplication.findUnique.mockResolvedValue(null);
    const next = jest.fn();
    await reviewScope.requireReviewAccess('research', 'approve')({ user: userWith({ conference_approve: true }), params: { id: ITEM } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
    const res = mockRes();
    await reviewScope.requireReviewAccess('research', 'approve')({ user: userWith({ book_review: true }), params: { id: ITEM } }, res, jest.fn());
    expect(res.statusCode).toBe(403);
  });
});

describe('requireViewScope (files, history, suggestions, status updates)', () => {
  beforeEach(() => {
    mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({ assignedSchoolIds: [X], assignedResearchSchoolIds: [X], assignedGrantSchoolIds: [X] }));
  });

  test('reviewer reading an out-of-scope IPR item -> 404; in scope -> next', async () => {
    mockPrisma.iprApplication.findUnique.mockResolvedValue({ schoolId: Y, applicantUserId: 'someone', contributors: [], reviews: [] });
    const res = mockRes();
    await reviewScope.requireViewScope('ipr')({ user: reviewer, params: { iprApplicationId: ITEM } }, res, jest.fn());
    expect(res.statusCode).toBe(404);
    mockPrisma.iprApplication.findUnique.mockResolvedValue({ schoolId: X, applicantUserId: 'someone', contributors: [], reviews: [] });
    const next = jest.fn();
    await reviewScope.requireViewScope('ipr')({ user: reviewer, params: { iprApplicationId: ITEM } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('owners, contributors and mentors keep access to out-of-scope items', async () => {
    const owner = { id: 'owner-1', uid: 'OWN', role: 'faculty', centralDeptPermissions: [] };
    for (const app of [
      { schoolId: Y, applicantUserId: 'owner-1', contributors: [], reviews: [] },
      { schoolId: Y, applicantUserId: 'x', contributors: [{ userId: 'owner-1' }], reviews: [] },
      { schoolId: Y, applicantUserId: 'x', contributors: [], reviews: [], applicantDetails: { mentorUid: 'OWN' } },
    ]) {
      mockPrisma.iprApplication.findUnique.mockResolvedValue(app);
      const next = jest.fn();
      await reviewScope.requireViewScope('ipr')({ user: owner, params: { id: ITEM } }, mockRes(), next);
      expect(next).toHaveBeenCalled();
    }
  });

  test('collaborative session end resolves the application through the session id', async () => {
    mockPrisma.iprCollaborativeSession.findUnique.mockResolvedValue({ iprApplicationId: ITEM });
    mockPrisma.iprApplication.findUnique.mockResolvedValue({ schoolId: Y, currentReviewerId: null, contributors: [], reviews: [] });
    const res = mockRes();
    await reviewScope.requireSchoolScope('ipr')({ user: reviewer, params: { sessionId: ITEM } }, res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('OUT_OF_ASSIGNED_SCHOOLS');
  });

  test('research documents / tracker history use the contribution category scope', async () => {
    mockPrisma.researchContribution.findUnique.mockResolvedValue({ schoolId: Y, publicationType: 'research_paper', authors: [], reviews: [] });
    const res = mockRes();
    await reviewScope.requireViewScope('research')({ user: reviewer, params: { contributionId: ITEM } }, res, jest.fn());
    expect(res.statusCode).toBe(404);
  });

  test('audit history: target id passed through req._scopeItemId', async () => {
    mockPrisma.grantApplication.findUnique.mockResolvedValue({ schoolId: Y, investigators: [], reviews: [] });
    const res = mockRes();
    await reviewScope.requireViewScope('grant')({ user: reviewer, params: { targetTable: 'grant_application', targetId: ITEM }, _scopeItemId: ITEM }, res, jest.fn());
    expect(res.statusCode).toBe(404);
  });
});

describe('canReadLinkedFile (generic upload downloads)', () => {
  const key = 'ipr/annexures/44444444-4444-4444-8444-444444444444/file.pdf';
  const staff = { ...reviewer, centralDeptPermissions: [{ permissions: { ipr_review: true } }] };

  beforeEach(() => {
    mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({ assignedSchoolIds: [X] }));
    mockPrisma.iprApplication.findFirst.mockResolvedValue(null);
    mockPrisma.grantApplication.findFirst.mockResolvedValue(null);
    mockPrisma.researchContribution.findFirst.mockResolvedValue(null);
  });

  test('an IPR annexure of an out-of-scope school is refused; in scope is served', async () => {
    mockPrisma.iprApplication.findFirst.mockResolvedValue({ schoolId: Y, applicantUserId: 'a', contributors: [], reviews: [] });
    await expect(reviewScope.canReadLinkedFile(staff, key)).resolves.toBe(false);
    mockPrisma.iprApplication.findFirst.mockResolvedValue({ schoolId: X, applicantUserId: 'a', contributors: [], reviews: [] });
    await expect(reviewScope.canReadLinkedFile(staff, key)).resolves.toBe(true);
  });

  test('a contributor reads it regardless of school; unrelated users without IPR staff permission do not', async () => {
    mockPrisma.iprApplication.findFirst.mockResolvedValue({ schoolId: Y, applicantUserId: 'a', contributors: [{ userId: 'contrib' }], reviews: [] });
    await expect(reviewScope.canReadLinkedFile({ id: 'contrib', role: 'faculty', centralDeptPermissions: [] }, key)).resolves.toBe(true);
    await expect(reviewScope.canReadLinkedFile({ id: 'nobody', role: 'faculty', centralDeptPermissions: [] }, key)).resolves.toBe(false);
  });

  test('files not linked to any DRD item keep the tenant-level rule', async () => {
    await expect(reviewScope.canReadLinkedFile(staff, 'documents/44444444-4444-4444-8444-444444444444/x.pdf')).resolves.toBe(true);
  });
});

describe('legacy IPR register scope', () => {
  test('managers with assigned IPR schools reach only their schools; creator and admin always', async () => {
    const manager = { id: 'mgr', role: 'staff', centralDeptPermissions: [{ permissions: { ipr_review: true } }] };
    mockPrisma.centralDepartmentPermission.findFirst.mockResolvedValue(drdRow({ assignedSchoolIds: [X] }));
    mockPrisma.userLogin.findUnique.mockResolvedValue({ employeeDetails: { primarySchoolId: Y } });
    await expect(reviewScope.canAccessLegacyIpr(manager, { createdById: 'creator' })).resolves.toBe(false);
    mockPrisma.userLogin.findUnique.mockResolvedValue({ employeeDetails: { primarySchoolId: null, primaryDepartment: { facultyId: X } } });
    await expect(reviewScope.canAccessLegacyIpr(manager, { createdById: 'creator' })).resolves.toBe(true);
    await expect(reviewScope.canAccessLegacyIpr({ id: 'creator', role: 'faculty' }, { createdById: 'creator' })).resolves.toBe(true);
    await expect(reviewScope.canAccessLegacyIpr({ id: 'a', role: 'admin' }, { createdById: 'creator' })).resolves.toBe(true);
  });

  test('list filter matches the creator school or primary department school', () => {
    expect(reviewScope.legacyIprSchoolWhere([X])).toEqual({
      createdBy: { employeeDetails: { is: { OR: [{ primarySchoolId: { in: [X] } }, { primaryDepartment: { is: { facultyId: { in: [X] } } } }] } } },
    });
  });
});
