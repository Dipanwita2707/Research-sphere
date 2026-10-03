/**
 * PATCH /ipr/:id/granted: input validation, patent/status gates, permission guard.
 */
const mockPrisma = {
  iprApplication: { findUnique: jest.fn(), update: jest.fn() },
  iprStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  notification: { create: jest.fn().mockResolvedValue({}) },
};
mockPrisma.$transaction = jest.fn(async (fn) => fn(mockPrisma));

jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../modules/audit/services/audit.service', () => ({
  auditService: { log: jest.fn().mockResolvedValue(null) },
  AuditActionType: { UPDATE: 'UPDATE' },
  AuditModule: { IPR: 'ipr' },
}));

const ctrl = require('../../../modules/ipr/controllers/iprGrant.controller');

const NOW = new Date('2026-10-02T06:00:00Z');
const head = { id: 'h-1', role: 'faculty', centralDeptPermissions: [{ permissions: { ipr_approve: true } }] };
const mockRes = () => ({
  statusCode: 200,
  body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const app = (over = {}) => ({
  id: 'i-1', title: 'Widget', status: 'published', iprType: 'patent', applicantUserId: 'a-1',
  publicationDate: new Date('2025-06-01T00:00:00Z'), grantedAt: null, patentNumber: null, ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('validateGrantedInput', () => {
  it('accepts a date and patent number', () => {
    const out = ctrl.validateGrantedInput({ grantedAt: '2026-09-30', patentNumber: ' 456789 ' }, NOW);
    expect(out.grantedAt.toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(out.patentNumber).toBe('456789');
  });
  it('treats null/null as clearing', () => {
    expect(ctrl.validateGrantedInput({ grantedAt: null, patentNumber: null }, NOW)).toEqual({ grantedAt: null, patentNumber: null });
  });
  it.each([
    [{ grantedAt: '2026-10-10', patentNumber: '1' }, 'grantedAt'],
    [{ grantedAt: '30-09-2026', patentNumber: '1' }, 'grantedAt'],
    [{ grantedAt: '2026-02-30', patentNumber: '1' }, 'grantedAt'],
    [{ grantedAt: '2026-01-01', patentNumber: '' }, 'patentNumber'],
    [{ grantedAt: '2026-01-01', patentNumber: '<script>' }, 'patentNumber'],
    [{ grantedAt: '2026-01-01', patentNumber: '9'.repeat(65) }, 'patentNumber'],
  ])('rejects %j', (body, field) => {
    let caught;
    try { ctrl.validateGrantedInput(body, NOW); } catch (e) { caught = e; }
    expect(caught && caught.field).toBe(field);
  });
});

describe('requireIprGrantManager', () => {
  it('allows ipr_approve holders and admins, blocks reviewers', () => {
    const run = (user) => { const next = jest.fn(); const res = mockRes(); ctrl.requireIprGrantManager({ user }, res, next); return next.mock.calls.length; };
    expect(run(head)).toBe(1);
    expect(run({ id: 'x', role: 'admin' })).toBe(1);
    expect(run({ id: 'y', role: 'faculty', centralDeptPermissions: [{ permissions: { ipr_review: true } }] })).toBe(0);
  });
});

describe('markGranted', () => {
  const call = async (body, application) => {
    mockPrisma.iprApplication.findUnique.mockResolvedValue(application);
    mockPrisma.iprApplication.update.mockImplementation(async ({ data }) => ({ id: 'i-1', status: application?.status, ...data }));
    const res = mockRes();
    await ctrl.markGranted({ params: { id: 'i-1' }, body, user: head }, res);
    return res;
  };

  it('rejects non-patents', async () => {
    const res = await call({ grantedAt: '2026-01-01', patentNumber: '1' }, app({ iprType: 'copyright' }));
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.iprApplication.update).not.toHaveBeenCalled();
  });

  it('rejects patents that are not yet published', async () => {
    const res = await call({ grantedAt: '2026-01-01', patentNumber: '1' }, app({ status: 'submitted_to_govt' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('IPR_NOT_PUBLISHED');
  });

  it('rejects a grant date before publication', async () => {
    const res = await call({ grantedAt: '2025-01-01', patentNumber: '1' }, app());
    expect(res.statusCode).toBe(400);
    expect(res.body.field).toBe('grantedAt');
  });

  it('404s when the application is not in this tenant', async () => {
    const res = await call({ grantedAt: '2026-01-01', patentNumber: '1' }, null);
    expect(res.statusCode).toBe(404);
  });

  it('marks a completed patent as granted and writes history', async () => {
    const res = await call({ grantedAt: '2026-09-01', patentNumber: 'IN 456789' }, app({ status: 'completed' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ grantedAt: '2026-09-01', patentNumber: 'IN 456789' }));
    expect(mockPrisma.iprStatusHistory.create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      fromStatus: 'completed', toStatus: 'completed', changedById: 'h-1',
    }));
  });
});
