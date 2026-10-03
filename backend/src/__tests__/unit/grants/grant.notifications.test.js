/**
 * Grant notifications (sent after the writes commit, never failing the request) and
 * enum validation (unknown enum values are a 400, not a Prisma 500).
 */
jest.mock('../../../shared/utils/auditLogger', () => ({
  logResearchFiling: jest.fn(() => Promise.resolve()),
  logResearchUpdate: jest.fn(() => Promise.resolve()),
  logResearchStatusChange: jest.fn(() => Promise.resolve()),
  logFileUpload: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../shared/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));
jest.mock('../../../shared/config/database', () => ({}));
jest.mock('../../../jobs/researchWorkflowQueue', () => ({ dispatchNotification: jest.fn() }));
jest.mock('../../../shared/utils/s3', () => ({ uploadToS3: jest.fn() }));
jest.mock('../../../modules/finance/services/incentivePayout.service', () => ({
  createLines: jest.fn(async () => ({ created: 1, skippedDuplicates: 0 })),
}));

const GrantService = require('../../../modules/grants/services/grant.service');
const { validateGrantEnums } = GrantService;

const GRANT = {
  id: 'g1', title: 'Soil Health', applicantUserId: 'u-app', applicationNumber: 'GRT-2026-00001',
  status: 'under_review', schoolId: 'sch-1', universityId: 'uni-1', projectCategory: 'govt', projectType: 'indian',
  numberOfConsortiumOrgs: 0, revisionCount: 0,
};

function makeRepo(grant, prismaOverrides = {}) {
  const prisma = {
    $transaction: jest.fn(async (cb) => cb(prisma)),
    userLogin: { findUnique: jest.fn().mockResolvedValue({ uid: 'APP' }), findMany: jest.fn().mockResolvedValue([]) },
    grantApplicationReview: { findFirst: jest.fn().mockResolvedValue(null) },
    centralDepartmentPermission: { findMany: jest.fn().mockResolvedValue([]) },
    role: { findMany: jest.fn().mockResolvedValue([]) },
    ...prismaOverrides,
  };
  return {
    prisma,
    findById: jest.fn().mockResolvedValue(grant ? { ...grant } : null),
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn(async (id, data) => ({ ...grant, ...data })),
    create: jest.fn(),
    createReview: jest.fn().mockResolvedValue({}),
    createStatusHistory: jest.fn().mockResolvedValue({}),
    createSuggestion: jest.fn().mockResolvedValue({}),
    findActivePolicy: jest.fn().mockResolvedValue({ baseIncentiveAmount: 25000, basePoints: 10 }),
    findSuggestionById: jest.fn(),
    updateSuggestion: jest.fn(async (id, data) => ({ id, ...data })),
    deleteInvestigators: jest.fn(),
    deleteConsortiumOrgs: jest.fn(),
    createInvestigator: jest.fn(),
  };
}

const makeService = (grant, prismaOverrides) => {
  const repo = makeRepo(grant, prismaOverrides);
  const notifier = { dispatchNotification: jest.fn().mockResolvedValue({}) };
  const service = new GrantService(repo, null, notifier);
  return { repo, notifier, service, sent: () => notifier.dispatchNotification.mock.calls.map((c) => c[0]) };
};

describe('grant notifications', () => {
  test('approval tells the applicant the incentive amount, after the transaction commits', async () => {
    const { service, repo, notifier, sent } = makeService(GRANT);
    let committed = false;
    repo.prisma.$transaction.mockImplementation(async (cb) => {
      const r = await cb(repo.prisma);
      committed = true;
      return r;
    });
    notifier.dispatchNotification.mockImplementation(async () => { expect(committed).toBe(true); });

    await service.approveGrant('g1', 'drd-head', 'good');

    const [n] = sent();
    expect(n).toMatchObject({ userId: 'u-app', type: 'grant_approved', referenceType: 'grant_application', referenceId: 'g1' });
    expect(n.message).toBe('Your grant "Soil Health" was approved. Incentive ₹25,000 approved; finance will process the payment.');
  });

  test('a failing notification never fails the approval', async () => {
    const { service, notifier } = makeService(GRANT);
    notifier.dispatchNotification.mockRejectedValue(new Error('redis down'));
    await expect(service.approveGrant('g1', 'drd-head', 'ok')).resolves.toMatchObject({ status: 'approved' });
  });

  test('a failed approval transaction sends nothing', async () => {
    const { service, repo, notifier } = makeService(GRANT);
    repo.createStatusHistory.mockRejectedValue(new Error('db down'));
    await expect(service.approveGrant('g1', 'drd-head', 'ok')).rejects.toThrow('db down');
    expect(notifier.dispatchNotification).not.toHaveBeenCalled();
  });

  test('changes requested includes the comments', async () => {
    const { service, sent } = makeService(GRANT);
    await service.requestChanges('g1', 'rev', 'Budget table is missing', [{ fieldName: 'title', suggestedValue: 'x' }]);
    const [n] = sent();
    expect(n.type).toBe('grant_changes_requested');
    expect(n.userId).toBe('u-app');
    expect(n.message).toContain('Budget table is missing');
    expect(n.metadata.comments).toBe('Budget table is missing');
  });

  test('rejection tells the applicant with the reason', async () => {
    const { service, sent } = makeService(GRANT);
    await service.rejectGrant('g1', 'head', null, 'Out of scope');
    const [n] = sent();
    expect(n.type).toBe('grant_rejected');
    expect(n.message).toContain('Out of scope');
  });

  test('recommendation tells the applicant', async () => {
    const { service, sent } = makeService(GRANT);
    await service.recommendForApproval('g1', 'rev', 'fine');
    expect(sent().map((n) => n.type)).toEqual(['grant_recommended']);
  });

  test('submit: applicant receipt + school-matching DRD reviewers (direct and via role)', async () => {
    const { service, sent } = makeService({ ...GRANT, status: 'draft' }, {
      centralDepartmentPermission: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'rev-all', permissions: { grant_review: true }, assignedGrantSchoolIds: [] },
          { userId: 'rev-sch1', permissions: { research_review: true }, assignedGrantSchoolIds: ['sch-1'] },
          { userId: 'rev-sch2', permissions: { grant_review: true }, assignedGrantSchoolIds: ['sch-2'] },
          { userId: 'not-reviewer', permissions: { research_view: true }, assignedGrantSchoolIds: [] },
        ]),
      },
      role: { findMany: jest.fn().mockResolvedValue([{ id: 'role-1', permissions: { centralDeptPermissions: { grant_review: true } } }, { id: 'role-2', permissions: {} }]) },
      userLogin: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([{ id: 'rev-role' }, { id: 'rev-all' }]) },
    });
    await service.submitApplication('g1', 'u-app');

    const notes = sent();
    expect(notes[0]).toMatchObject({ userId: 'u-app', type: 'grant_submitted' });
    const reviewers = notes.filter((n) => n.type === 'grant_submitted_for_review').map((n) => n.userId).sort();
    expect(reviewers).toEqual(['rev-all', 'rev-role', 'rev-sch1']);
  });

  test('resubmit: notifies the reviewer who asked for the changes', async () => {
    const { service, sent, repo } = makeService({ ...GRANT, status: 'changes_required' });
    repo.prisma.grantApplicationReview.findFirst.mockResolvedValue({ reviewerId: 'rev-7' });
    await service.submitApplication('g1', 'u-app');
    const notes = sent();
    expect(notes.map((n) => [n.userId, n.type])).toEqual([
      ['u-app', 'grant_resubmitted'],
      ['rev-7', 'grant_resubmitted_for_review'],
    ]);
    expect(repo.prisma.centralDepartmentPermission.findMany).not.toHaveBeenCalled();
  });

  test('reviewer lookup failure does not fail the submit', async () => {
    const { service, sent } = makeService({ ...GRANT, status: 'draft' }, {
      centralDepartmentPermission: { findMany: jest.fn().mockRejectedValue(new Error('boom')) },
    });
    await expect(service.submitApplication('g1', 'u-app')).resolves.toMatchObject({ status: 'submitted' });
    expect(sent().map((n) => n.type)).toEqual(['grant_submitted']);
  });

  test('falls back to prisma.notification.create without a notifier', async () => {
    const repo = makeRepo(GRANT, { notification: { create: jest.fn().mockResolvedValue({}) } });
    await new GrantService(repo).rejectGrant('g1', 'head', 'no');
    expect(repo.prisma.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'grant_rejected' }) });
  });
});

describe('grant enum validation', () => {
  test('rejects an unknown fundingAgencyType with 400 and the allowed values', () => {
    expect(() => validateGrantEnums({ fundingAgencyType: 'govt' })).toThrow(
      "Invalid fundingAgencyType 'govt'. Allowed values: dst, dbt, anrf, csir, icssr, other"
    );
    try { validateGrantEnums({ fundingAgencyType: 'govt' }); } catch (e) { expect(e.statusCode).toBe(400); }
  });

  test.each([
    ['projectCategory', 'private'],
    ['projectType', 'national'],
    ['projectStatus', 'pending'],
    ['myRole', 'lead'],
  ])('rejects bad %s', (field, value) => {
    expect(() => validateGrantEnums({ [field]: value })).toThrow(`Invalid ${field} '${value}'`);
  });

  test('rejects a bad investigator roleType', () => {
    expect(() => validateGrantEnums({ investigators: [{ name: 'A', roleType: 'pi' }, { name: 'B', roleType: 'boss' }] }))
      .toThrow("Invalid investigators[1].roleType 'boss'");
  });

  test('accepts valid values, normalises case, and leaves empty values alone', () => {
    expect(validateGrantEnums({ fundingAgencyType: 'DST', projectCategory: 'non_govt', projectType: '', myRole: null, title: 't' }))
      .toEqual({ fundingAgencyType: 'dst', projectCategory: 'non_govt', projectType: '', myRole: null, title: 't' });
  });

  test('createApplication: invalid enum is a 400 before anything is written', async () => {
    const repo = makeRepo(null);
    await expect(new GrantService(repo).createApplication({ title: 'T', fundingAgencyType: 'govt' }, 'u1', null, jest.fn(), {}))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  test('updateApplication: invalid enum is a 400 before anything is written', async () => {
    const repo = makeRepo({ ...GRANT, status: 'draft' });
    await expect(new GrantService(repo).updateApplication('g1', 'u-app', { title: 'T', projectCategory: 'private' }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(repo.deleteInvestigators).not.toHaveBeenCalled();
  });
});

describe('grant controller error mapping', () => {
  const { _sendError } = require('../../../modules/grants/controllers/grant.controller');
  const res = () => {
    const r = { statusCode: 0, body: null };
    r.status = jest.fn((c) => { r.statusCode = c; return r; });
    r.json = jest.fn((b) => { r.body = b; return r; });
    return r;
  };

  test('PrismaClientValidationError → 400', () => {
    const err = new Error('\nInvalid `prisma.grantApplication.create()` invocation:\n\n{...}\n\nInvalid value for argument `fundingAgencyType`. Expected GrantFundingAgencyEnum.');
    err.name = 'PrismaClientValidationError';
    const r = res();
    _sendError(r, err, 'Failed');
    expect(r.statusCode).toBe(400);
    expect(r.body.message).toContain('Expected GrantFundingAgencyEnum');
  });

  test('statusCode 400 keeps its message, unknown errors are 500 with the fallback', () => {
    const r1 = res();
    _sendError(r1, Object.assign(new Error('bad enum'), { statusCode: 400 }), 'Failed');
    expect([r1.statusCode, r1.body.message]).toEqual([400, 'bad enum']);
    const r2 = res();
    _sendError(r2, new Error('secret db detail'), 'Failed to create grant application');
    expect([r2.statusCode, r2.body.message]).toEqual([500, 'Failed to create grant application']);
  });
});
