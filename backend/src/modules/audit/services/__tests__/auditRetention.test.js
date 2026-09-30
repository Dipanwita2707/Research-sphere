/**
 * DPDP Rules require processing logs to be kept for at least one year: audit log
 * cleanup must never delete anything younger than 365 days.
 */
jest.mock('../../../../shared/config/database', () => ({
  auditLog: {
    deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
    create: jest.fn().mockResolvedValue({ id: 'log-1' }),
  },
  userLogin: { findUnique: jest.fn().mockResolvedValue(null) },
}));

const prisma = require('../../../../shared/config/database');
const { auditService, assertRetentionDays, MIN_AUDIT_RETENTION_DAYS } = require('../audit.service');

describe('audit retention floor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is one year', () => {
    expect(MIN_AUDIT_RETENTION_DAYS).toBe(365);
  });

  it.each([0, 1, 30, 364, -5, 365.5, '100', 'abc', null, NaN])('rejects %p', (value) => {
    expect(() => assertRetentionDays(value)).toThrow(/at least 365 days/);
    try {
      assertRetentionDays(value);
    } catch (e) {
      expect(e.statusCode).toBe(400);
    }
  });

  it.each([365, 366, '400', 3650])('accepts %p', (value) => {
    expect(assertRetentionDays(value)).toBe(Number(value));
  });

  it('cleanupOldLogs refuses a short retention without touching the database', async () => {
    await expect(auditService.cleanupOldLogs(30)).rejects.toThrow(/at least 365 days/);
    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it('cleanupOldLogs deletes only rows older than the retention cutoff', async () => {
    const before = Date.now();
    const result = await auditService.cleanupOldLogs(400);
    expect(result.count).toBe(3);
    const { where } = prisma.auditLog.deleteMany.mock.calls[0][0];
    const cutoff = where.createdAt.lt.getTime();
    const expected = before - 400 * 24 * 60 * 60 * 1000;
    // within a day of "now - 400 days" (DST / clock tolerance)
    expect(Math.abs(cutoff - expected)).toBeLessThan(24 * 60 * 60 * 1000 + 5000);
    expect(where.severity).toEqual({ notIn: ['ERROR', 'CRITICAL'] });
  });

  it('defaults to the minimum retention', async () => {
    await auditService.cleanupOldLogs();
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(1);
  });
});

describe('audit log filters use the details JSON (not missing columns)', () => {
  it('maps status / performedBy / search onto details paths', () => {
    const where = auditService.buildLogWhere({ status: 'failed', performedBy: 'Jane', search: 'login' });
    expect(where.status).toBeUndefined();
    expect(where.AND).toEqual(expect.arrayContaining([
      { details: { path: ['status'], equals: 'failed' } },
      { details: { path: ['performedByName'], string_contains: 'Jane' } },
    ]));
    const searchClause = where.AND.find((c) => c.OR);
    expect(searchClause.OR).toEqual(expect.arrayContaining([
      { action: { contains: 'login', mode: 'insensitive' } },
      { details: { path: ['description'], string_contains: 'login' } },
    ]));
  });
});
