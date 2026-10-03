/**
 * DRD IPR workflow:
 *   - every DRD transition is guarded by its allowed source statuses (409 otherwise), checked
 *     up front and again atomically (updateMany where status in allowed → count check)
 *   - submitDrdReview writes no unknown column and creates the review inside the same
 *     transaction as the status change (no orphan review on failure)
 *   - publication sends each inventor exactly one notification
 */
const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/utils/auditLogger', () => ({
  logIprStatusChange: jest.fn(() => Promise.resolve()),
  logIprUpdate: jest.fn(() => Promise.resolve()),
}));

const drdReview = require('../../../modules/research/controllers/drdReview.controller');

const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
};

// The DRD user holds both review and approve rights (approving needs ipr_approve).
const DRD_USER = { id: 'drd-user', role: 'staff', centralDeptPermissions: [{ permissions: { ipr_review: true, ipr_approve: true } }] };
const req = (body = {}, user = DRD_USER) => ({ params: { id: 'ipr-1' }, body, user, headers: {}, get: () => 'ua', ip: '127.0.0.1' });

let tx;
const setup = (application) => {
  for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
  tx = {
    iprApplication: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(async ({ data }) => ({ ...application, ...data })),
      findUnique: jest.fn(async () => ({ ...application })),
    },
    iprReview: { create: jest.fn(async ({ data }) => ({ id: 'rev-1', ...data })) },
    iprStatusHistory: { create: jest.fn() },
  };
  Object.assign(mockPrisma, {
    $transaction: jest.fn(async (cb) => cb(tx)),
    iprApplication: { findUnique: jest.fn().mockResolvedValue({ ...application }), update: jest.fn() },
    iprReview: { create: jest.fn() },
    iprStatusHistory: { create: jest.fn() },
    iprContributor: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    userLogin: { findUnique: jest.fn().mockResolvedValue({ uid: 'R1', employeeDetails: { displayName: 'Reviewer' } }) },
  });
};

const app = (status, extra = {}) => ({ id: 'ipr-1', title: 'Design X', status, applicantUserId: 'u-app', iprType: 'design', creditedAt: null, contributors: [], ...extra });

describe('submitDrdReview (approve)', () => {
  test('a reviewer without ipr_approve cannot approve (403, nothing written)', async () => {
    const reviewerOnly = { id: 'reviewer', role: 'staff', centralDeptPermissions: [{ permissions: { ipr_review: true } }] };
    const res = makeRes();
    await drdReview.submitDrdReview(req({ decision: 'approved' }, reviewerOnly), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'APPROVE_PERMISSION_REQUIRED' }));
  });

  test('approve succeeds without writing the non-existent approvedAt column, all in one transaction', async () => {
    setup(app('under_drd_review'));
    const res = makeRes();
    await drdReview.submitDrdReview(req({ decision: 'approved', comments: 'ok' }), res);

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const call = tx.iprApplication.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'ipr-1', status: { in: ['submitted', 'under_drd_review', 'resubmitted'] } });
    expect(call.data).toEqual({ status: 'drd_head_approved' });
    expect(call.data).not.toHaveProperty('approvedAt');
    expect(tx.iprReview.create).toHaveBeenCalledTimes(1);
    expect(tx.iprStatusHistory.create).toHaveBeenCalledTimes(1);
    // nothing written outside the transaction
    expect(mockPrisma.iprReview.create).not.toHaveBeenCalled();
    expect(mockPrisma.iprApplication.update).not.toHaveBeenCalled();
  });

  test('lost race (status changed meanwhile) → 409 and no review row', async () => {
    setup(app('submitted'));
    tx.iprApplication.updateMany.mockResolvedValue({ count: 0 });
    const res = makeRes();
    await drdReview.submitDrdReview(req({ decision: 'approved' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    expect(tx.iprReview.create).not.toHaveBeenCalled();
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  test('a failing status update rolls back with the review (500, review created only in tx)', async () => {
    setup(app('submitted'));
    tx.iprStatusHistory.create.mockRejectedValue(new Error('db down'));
    const res = makeRes();
    await drdReview.submitDrdReview(req({ decision: 'approved' }), res);
    expect(res.statusCode).toBe(500);
    expect(mockPrisma.iprReview.create).not.toHaveBeenCalled();
  });

  test.each(['draft', 'pending_mentor_approval', 'published', 'drd_head_approved'])('refuses %s with 409', async (status) => {
    setup(app(status));
    const res = makeRes();
    await drdReview.submitDrdReview(req({ decision: 'approved' }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toContain(status);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('IPR transition guards', () => {
  const cases = [
    // [handler, body, blocked statuses, an allowed status]
    ['recommendToHead', { comments: 'c' }, ['draft', 'pending_mentor_approval', 'recommended_to_head', 'published'], 'under_drd_review'],
    ['headApproveAndSubmitToGovt', {}, ['draft', 'pending_mentor_approval', 'submitted', 'under_drd_review'], 'recommended_to_head'],
    ['finalApproval', {}, ['draft', 'pending_mentor_approval', 'published', 'govt_application_filed'], 'recommended_to_head'],
    ['finalRejection', { comments: 'no' }, ['draft', 'pending_mentor_approval', 'published'], 'under_drd_review'],
    ['requestChanges', { comments: 'fix' }, ['draft', 'pending_mentor_approval', 'published'], 'submitted'],
    ['addGovtApplicationId', { govtApplicationId: 'G-1' }, ['draft', 'pending_mentor_approval', 'submitted', 'recommended_to_head'], 'submitted_to_govt'],
    ['markGovtRejected', { comments: 'no' }, ['draft', 'pending_mentor_approval', 'submitted'], 'govt_application_filed'],
    ['assignDrdReviewer', { reviewerId: 'r2' }, ['draft', 'pending_mentor_approval', 'published'], 'submitted'],
  ];

  for (const [handler, body, blocked, allowedStatus] of cases) {
    test.each(blocked)(`${handler} refuses %s with 409 and writes nothing`, async (status) => {
      setup(app(status));
      const res = makeRes();
      await drdReview[handler](req(body), res);
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.iprApplication.update).not.toHaveBeenCalled();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    test(`${handler} from ${allowedStatus} moves atomically with a status guard`, async () => {
      setup(app(allowedStatus));
      const res = makeRes();
      await drdReview[handler](req(body), res);
      expect(res.statusCode).toBe(200);
      const { where } = tx.iprApplication.updateMany.mock.calls[0][0];
      expect(where.id).toBe('ipr-1');
      expect(where.status.in).toContain(allowedStatus);
      expect(where.status.in).not.toContain('draft');
      expect(where.status.in).not.toContain('pending_mentor_approval');
    });
  }

  test('mentor bypass: DRD cannot recommend a design still pending mentor approval', async () => {
    setup(app('pending_mentor_approval'));
    const res = makeRes();
    await drdReview.recommendToHead(req({ comments: 'go' }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/pending_mentor_approval/);
  });

  test('addPublicationId: a submitted trademark cannot jump to published (no payment)', async () => {
    setup(app('submitted', { iprType: 'trademark' }));
    const res = makeRes();
    await drdReview.addPublicationId(req({ publicationId: 'PUB-9' }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  test('addPublicationId claim only matches govt_application_filed', async () => {
    setup(app('govt_application_filed'));
    tx.iprApplication.updateMany.mockResolvedValue({ count: 0 });
    const res = makeRes();
    await drdReview.addPublicationId(req({ publicationId: 'PUB-9' }), res);
    expect(res.statusCode).toBe(409);
    expect(tx.iprApplication.updateMany.mock.calls[0][0].where).toEqual({
      id: 'ipr-1', creditedAt: null, status: { in: ['govt_application_filed'] },
    });
  });
});

describe('addPublicationId notifications', () => {
  test('each inventor gets exactly one combined notification; non-inventor contributors get an info one', async () => {
    const application = app('govt_application_filed', { iprType: 'patent', universityId: 'uni-1', applicationNumber: 'IPR-1' });
    setup(application);
    Object.assign(tx, {
      employeeDetails: { findMany: jest.fn().mockResolvedValue([]) },
      incentivePayout: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn(async ({ data }) => ({ count: data.length })) },
      incentivePayoutEvent: { create: jest.fn() },
      incentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
      iprContributor: { findMany: jest.fn().mockResolvedValue([{ userId: 'u-inv1', name: 'Inv One', role: 'inventor' }]) },
      userLogin: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue({ uid: 'APP', employeeDetails: { displayName: 'Applicant' } }) },
    });
    // All internal contributor rows (as notifyContributors sees them), incl. the applicant row
    mockPrisma.iprContributor.findMany.mockResolvedValue([
      { userId: 'u-inv1', name: 'Inv One' },
      { userId: 'u-app', name: 'Applicant' },
      { userId: 'u-helper', name: 'Helper' },
      { userId: 'u-helper', name: 'Helper dup' },
    ]);

    const res = makeRes();
    await drdReview.addPublicationId(req({ publicationId: 'PUB-1' }), res);
    expect(res.statusCode).toBe(200);

    const combined = mockPrisma.notification.createMany.mock.calls[0][0].data;
    expect(combined.map((n) => n.userId).sort()).toEqual(['u-app', 'u-inv1']);
    for (const n of combined) {
      expect(n.type).toBe('ipr_published');
      expect(n.message).toContain('PUB-1');
      expect(n.message).toContain('approved; finance will process the payment');
    }

    const single = mockPrisma.notification.create.mock.calls.map((c) => c[0].data);
    expect(single.map((n) => n.userId)).toEqual(['u-helper']);
    expect(single[0].title).not.toMatch(/PAYMENT/);

    // per user: never more than one notification for this publication
    const all = [...combined, ...single].map((n) => n.userId);
    expect(new Set(all).size).toBe(all.length);
  });
});
