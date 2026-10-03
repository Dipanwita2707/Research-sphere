/**
 * Grants and IPR feed the payout ledger:
 *   - approveGrant writes the approval and the applicant's payout line in one transaction
 *   - IPR publication splits the incentive per inventor into ledger lines, exactly once
 */
const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/utils/auditLogger', () => ({
  logIprStatusChange: jest.fn(() => Promise.resolve()),
  logIprUpdate: jest.fn(() => Promise.resolve()),
  logResearchFiling: jest.fn(() => Promise.resolve()),
  logResearchUpdate: jest.fn(() => Promise.resolve()),
  logResearchStatusChange: jest.fn(() => Promise.resolve()),
  logFileUpload: jest.fn(() => Promise.resolve()),
}));

const GrantService = require('../../../modules/grants/services/grant.service');
const drdReview = require('../../../modules/research/controllers/drdReview.controller');

const ledgerMocks = () => ({
  employeeDetails: { findMany: jest.fn().mockResolvedValue([]) },
  userLogin: { findMany: jest.fn().mockResolvedValue([]) },
  incentivePayout: {
    findMany: jest.fn().mockResolvedValue([]),
    createMany: jest.fn(async ({ data }) => ({ count: data.length })),
  },
  incentivePayoutEvent: { create: jest.fn() },
});

const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
};

describe('GrantService.approveGrant() → payout ledger', () => {
  const grant = {
    id: 'g1', universityId: 'uni-1', applicationNumber: 'GRT-2026-00001', title: 'Smart irrigation', status: 'recommended',
    applicantUserId: 'u-pi', projectCategory: 'govt', projectType: 'indian', numberOfConsortiumOrgs: 0,
  };
  let tx;
  let repo;

  beforeEach(() => {
    tx = {
      ...ledgerMocks(),
      userLogin: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue({ uid: 'FAC9', employeeDetails: { displayName: 'Dr PI' } }) },
    };
    repo = {
      findById: jest.fn().mockResolvedValue({ ...grant }),
      findActivePolicy: jest.fn().mockResolvedValue({ baseIncentiveAmount: 25000, basePoints: 30 }),
      update: jest.fn(async function update(id, data) { return { ...grant, ...data }; }),
      createReview: jest.fn(),
      createStatusHistory: jest.fn(),
      prisma: { $transaction: jest.fn(async (cb) => cb(tx)) },
    };
  });

  test('pays the applicant the full incentive in the same transaction as the approval', async () => {
    const service = new GrantService(repo);
    const updated = await service.approveGrant('g1', 'drd-head', 'ok');

    expect(updated.status).toBe('approved');
    expect(repo.prisma.$transaction).toHaveBeenCalledTimes(1);
    // the approval write ran on the transaction client
    expect(repo.update.mock.contexts[0].prisma).toBe(tx);
    const { data } = tx.incentivePayout.createMany.mock.calls[0][0];
    expect(data).toEqual([expect.objectContaining({
      sourceType: 'grant', sourceId: 'g1', workType: 'grant', workKey: null, referenceNumber: 'GRT-2026-00001',
      payeeUserId: 'u-pi', payeeName: 'Dr PI', approvedAmount: 25000, points: 30,
    })]);
  });

  test('creates no line when the incentive and points are both zero', async () => {
    repo.findActivePolicy.mockResolvedValue(null);
    await new GrantService(repo).approveGrant('g1', 'drd-head', 'ok', { confirmZeroIncentive: true });
    expect(tx.incentivePayout.createMany).not.toHaveBeenCalled();
  });

  test('a failed ledger write fails the approval (same transaction)', async () => {
    tx.incentivePayout.createMany.mockRejectedValue(new Error('db down'));
    await expect(new GrantService(repo).approveGrant('g1', 'drd-head', 'ok')).rejects.toThrow('db down');
  });
});

describe('drdReview.addPublicationId() → IPR payout lines', () => {
  let tx;
  const application = {
    id: 'ipr-1', universityId: 'uni-1', title: 'Soil sensor', iprType: 'patent', applicationNumber: 'IPR-2026-0001',
    status: 'govt_application_filed', applicantUserId: 'u-app', creditedAt: null, contributors: [],
  };

  beforeEach(() => {
    for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
    tx = {
      ...ledgerMocks(),
      iprApplication: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(async ({ data }) => ({ ...application, status: 'published', ...data })),
      },
      incentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) }, // default patent policy: 50000 / 50
      iprContributor: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'u-inv1', name: 'Inventor One', role: 'inventor' },
          { userId: 'u-inv2', name: 'Inventor Two', role: 'co-inventor' },
        ]),
      },
      userLogin: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue({ uid: 'APP', employeeDetails: { displayName: 'Applicant Person' } }) },
      iprStatusHistory: { create: jest.fn() },
    };
    Object.assign(mockPrisma, {
      $transaction: jest.fn(async (cb) => cb(tx)),
      iprApplication: { findUnique: jest.fn().mockResolvedValue({ ...application }) },
      iprContributor: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { create: jest.fn(), createMany: jest.fn().mockResolvedValue({ count: 3 }) },
    });
  });

  test('splits the incentive equally and creates one ledger line per internal inventor', async () => {
    const res = makeRes();
    await drdReview.addPublicationId({ params: { id: 'ipr-1' }, body: { publicationId: 'PUB-1' }, user: { id: 'drd' } }, res);

    expect(res.statusCode).toBe(200);
    expect(tx.iprApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'ipr-1', creditedAt: null }),
      data: expect.objectContaining({ status: 'published', creditedAt: expect.any(Date) }),
    }));
    const { data } = tx.incentivePayout.createMany.mock.calls[0][0];
    expect(data.map((d) => [d.payeeUserId, d.approvedAmount, d.points])).toEqual([
      ['u-inv1', 16666, 16], ['u-inv2', 16666, 16], ['u-app', 16666, 16],
    ]);
    expect(data[0]).toMatchObject({ sourceType: 'ipr', sourceId: 'ipr-1', workType: 'patent', referenceNumber: 'IPR-2026-0001' });

    const notes = mockPrisma.notification.createMany.mock.calls[0][0].data;
    expect(notes).toHaveLength(3);
    expect(notes[0].message).toContain('approved; finance will process the payment');
    expect(notes[0].message).not.toMatch(/credited/i);
  });

  test('a second call does not credit again', async () => {
    mockPrisma.iprApplication.findUnique.mockResolvedValue({ ...application, status: 'published', creditedAt: new Date() });
    const res = makeRes();
    await drdReview.addPublicationId({ params: { id: 'ipr-1' }, body: { publicationId: 'PUB-1' }, user: { id: 'drd' } }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('ALREADY_CREDITED');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  test('a concurrent call that loses the race credits nothing', async () => {
    tx.iprApplication.updateMany.mockResolvedValue({ count: 0 });
    const res = makeRes();
    await drdReview.addPublicationId({ params: { id: 'ipr-1' }, body: { publicationId: 'PUB-1' }, user: { id: 'drd' } }, res);

    expect(res.statusCode).toBe(409);
    expect(tx.incentivePayout.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });
});
