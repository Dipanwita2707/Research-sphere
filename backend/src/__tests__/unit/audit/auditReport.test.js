/**
 * Audit report data loading: statistics come from DB aggregation, detail rows are keyset-paged
 * with a hard cap (truncation noted in the workbook), only needed columns are selected, every
 * query runs under a statement timeout, and a stuck load fails fast with a readable error.
 * Prisma is mocked; no database.
 */

const mockLogs = [];
const mockCalls = { findMany: [], executeRaw: [], txOptions: [] };

const mockTx = {
  $executeRawUnsafe: jest.fn(async (sql) => { mockCalls.executeRaw.push(sql); }),
  auditLog: {
    findMany: jest.fn(async (args) => {
      mockCalls.findMany.push(args);
      const [range, after] = args.where.AND;
      let rows = mockLogs.filter((l) => l.createdAt >= range.createdAt.gte && l.createdAt <= range.createdAt.lte);
      if (range.OR) rows = rows.filter((l) => ['ERROR', 'CRITICAL'].includes(l.severity) || l.responseStatus >= 400);
      if (after.OR) {
        const [gt, eq] = after.OR;
        rows = rows.filter((l) => l.createdAt > gt.createdAt.gt || (l.createdAt.getTime() === eq.createdAt.getTime() && l.id > eq.id.gt));
      }
      rows.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      return rows.slice(0, args.take).map((l) => Object.fromEntries(Object.keys(args.select).map((k) => [k, l[k]])));
    }),
  },
  userLogin: { findMany: jest.fn(async ({ where }) => where.id.in.map((id) => ({ id, uid: id.toUpperCase(), employeeDetails: { displayName: `User ${id}` } }))) },
};

jest.mock('../../../shared/config/database', () => ({
  $transaction: jest.fn(async (fn, opts) => { mockCalls.txOptions.push(opts); return fn(mockTx); }),
}));
jest.mock('../../../modules/audit/services/audit.service', () => ({
  auditService: {
    getStatistics: jest.fn(async (_range, { db }) => {
      expect(db).toBe(mockTx); // runs inside the statement-timeout transaction
      return { totalLogs: mockLogs.length, byActionType: [], byModule: [], bySeverity: [], topActors: [], errorCount: 0 };
    }),
    log: jest.fn(async () => {}),
  },
  AuditActionType: {}, AuditModule: {}, AuditSeverity: {},
}));
jest.mock('../../../modules/core/services/email.service', () => ({ emailService: { sendAuditReport: jest.fn() } }));
jest.mock('../../../modules/core/services/excelExport.service', () => ({ excelExportService: { generateAuditReport: jest.fn(async () => Buffer.from('xlsx')) } }));

const { auditReportScheduler: scheduler, ReportTimeoutError } = require('../../../modules/audit/services/auditScheduler.service');
const { excelExportService } = require('../../../modules/core/services/excelExport.service');
const { emailService } = require('../../../modules/core/services/email.service');

const day = new Date('2026-10-01T00:00:00Z');
const end = new Date('2026-10-01T23:59:59.999Z');
const limits = (o = {}) => ({ maxRows: 50000, pageSize: 4, statementTimeoutMs: 60000, overallTimeoutMs: 600000, ...o });

beforeEach(() => {
  mockLogs.length = 0;
  // 10 logs, two sharing a timestamp (keyset must not skip/duplicate), every 3rd an error
  for (let i = 0; i < 10; i++) {
    mockLogs.push({
      id: `id-${String(i).padStart(2, '0')}`,
      createdAt: new Date(day.getTime() + Math.min(i, 8) * 60000),
      actorId: i % 2 ? 'u1' : null,
      action: `a${i}`, actionType: 'OTHER', severity: i % 3 === 0 ? 'ERROR' : 'INFO', responseStatus: 200,
      details: { huge: 'x'.repeat(1000) },
    });
  }
  mockCalls.findMany.length = 0;
  mockCalls.executeRaw.length = 0;
  mockCalls.txOptions.length = 0;
  jest.clearAllMocks();
});

test('pages through every log once, selecting only report columns, each query under a statement timeout', async () => {
  const data = await scheduler.loadReportData(day, end, limits());
  expect(data.logs.map((l) => l.id)).toEqual(mockLogs.map((l) => l.id));
  expect(data.truncation).toEqual({ truncated: false, shown: 10, total: 10, maxRows: 50000 });
  expect(data.errorLogs).toBeUndefined();
  expect(mockCalls.findMany.length).toBe(3); // 4 + 4 + 2
  for (const call of mockCalls.findMany) {
    expect(call.take).toBeLessThanOrEqual(4);
    expect(call.select.details).toBeUndefined();
    expect(call.include).toBeUndefined();
  }
  expect(mockCalls.executeRaw.every((s) => /SET LOCAL statement_timeout = \d+/.test(s))).toBe(true);
  expect(mockCalls.txOptions.every((o) => o.timeout > 0)).toBe(true);
  // actors resolved once, attached in the shape the workbook reads
  expect(mockTx.userLogin.findMany).toHaveBeenCalledTimes(1);
  expect(data.logs[1].actor.employeeDetails.displayName).toBe('User u1');
  expect(data.logs[0].actor).toBeNull();
});

test('caps detail rows, notes the truncation and loads error rows separately', async () => {
  const data = await scheduler.loadReportData(day, end, limits({ maxRows: 5 }));
  expect(data.logs).toHaveLength(5);
  expect(data.truncation).toEqual({ truncated: true, shown: 5, total: 10, maxRows: 5 });
  expect(data.errorLogs.map((l) => l.id)).toEqual(['id-00', 'id-03', 'id-06', 'id-09']);
});

test('buildReport hands the truncation and error rows to the workbook and sends no email', async () => {
  const r = await scheduler.buildReport({ startDate: day, endDate: end, limits: limits({ maxRows: 5 }) });
  expect(r.logCount).toBe(5);
  const arg = excelExportService.generateAuditReport.mock.calls[0][0];
  expect(arg.truncation.truncated).toBe(true);
  expect(arg.errorLogs).toHaveLength(4);
  expect(arg.period.year).toBe(2026);
  expect(emailService.sendAuditReport).not.toHaveBeenCalled();
});

test('an exhausted overall budget fails fast with a readable error', async () => {
  await expect(scheduler.loadReportData(day, end, limits({ overallTimeoutMs: 0 }))).rejects.toBeInstanceOf(ReportTimeoutError);
});

test('statement timeouts are reported plainly', () => {
  expect(scheduler.describeReportError(Object.assign(new Error('Raw query failed. Code: `57014`. canceling statement due to statement timeout'), {}))).toMatch(/timed out/);
  expect(scheduler.describeReportError(new Error('Transaction already closed: A query cannot be executed on an expired transaction'))).toMatch(/timed out/);
  expect(scheduler.describeReportError(new Error('boom'))).toBe('boom');
});

test('on-demand generation reports a timeout instead of hanging', async () => {
  const prisma = require('../../../shared/config/database');
  prisma.$transaction.mockImplementationOnce(async () => { throw new Error('canceling statement due to statement timeout'); });
  const r = await scheduler.generateOnDemandReport({ startDate: '2026-10-01', endDate: '2026-10-01' });
  expect(r).toEqual({ success: false, error: expect.stringMatching(/timed out/) });
});
