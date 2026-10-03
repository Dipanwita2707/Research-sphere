/**
 * Route wiring: who may export, parameter validation, and xlsx response headers.
 * `protect` is replaced by a stub that takes the user from a test header; the real
 * checkAnyPermission and controller run, with the report service mocked.
 */
const mockLog = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };

jest.mock('../../../shared/config/database', () => ({}));
jest.mock('../../../shared/config/redis', () => ({ getOrSet: jest.fn(), del: jest.fn(), CACHE_KEYS: {} }));
jest.mock('../../../shared/utils/licenseState', () => ({ isVerified: () => true }));
jest.mock('../../../modules/bug-reports/utils/securityLogger', () => ({ logAuthenticationFailure: jest.fn() }));
jest.mock('../../../shared/utils/logger', () => ({ ...mockLog, createModuleLogger: () => mockLog }));
jest.mock('../../../shared/middleware/auth', () => {
  const actual = jest.requireActual('../../../shared/middleware/auth');
  return {
    ...actual,
    protect: (req, res, next) => {
      req.user = JSON.parse(req.headers['x-test-user'] || 'null');
      return req.user ? next() : res.status(401).json({ success: false });
    },
  };
});
jest.mock('../../../modules/reports/services/reports.service', () => ({
  generateNaacWorkbook: jest.fn(async (p) => ({
    buffer: Buffer.from('PK-fake'),
    filename: `NAAC-Criterion3-TU-${p.fromYear}-${p.toYear}.xlsx`,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })),
  generateNirfWorkbook: jest.fn(async () => ({ buffer: Buffer.from('PK'), filename: 'NIRF.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })),
  getSummary: jest.fn(async (naac, nirf) => ({ naac, nirf })),
}));

const http = require('http');
const express = require('express');
const service = require('../../../modules/reports/services/reports.service');
const reportsRouter = require('../../../modules/reports');

let server;
let port;

beforeAll((done) => {
  const app = express();
  app.use('/api/v1/reports', reportsRouter);
  server = app.listen(0, () => {
    port = server.address().port;
    done();
  });
});
afterAll(() => new Promise((resolve) => server.close(() => resolve())));
beforeEach(() => jest.clearAllMocks());

const get = (path, user) =>
  new Promise((resolve, reject) => {
    const req = http.request({ port, path, method: 'GET', headers: user ? { 'x-test-user': JSON.stringify(user) } : {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });

const admin = { id: 'a', role: 'admin' };
const superadmin = { id: 's', role: 'superadmin' };
const plainStaff = { id: 'x', role: 'staff', centralDeptPermissions: [], schoolDeptPermissions: [] };
const drdMember = { id: 'm', role: 'staff', centralDeptPermissions: [{ permissions: { drd_member_analytics: true } }] };
const applicantAnalyst = { id: 'n', role: 'faculty', centralDeptPermissions: [{ permissions: { applicant_analytics: true } }] };

describe('GET /api/v1/reports', () => {
  test('requires login', async () => {
    expect((await get('/api/v1/reports/summary')).status).toBe(401);
  });

  test.each([
    ['admin', admin, 200],
    ['superadmin', superadmin, 200],
    ['drd_member_analytics holder', drdMember, 200],
    ['applicant_analytics holder', applicantAnalyst, 200],
    ['staff without permission', plainStaff, 403],
  ])('%s → %i', async (_label, user, status) => {
    expect((await get('/api/v1/reports/summary?fromYear=2022&toYear=2024', user)).status).toBe(status);
  });

  test('NAAC export streams an xlsx attachment with a descriptive filename', async () => {
    const res = await get('/api/v1/reports/naac/criterion3?fromYear=2022&toYear=2026', admin);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toBe('attachment; filename="NAAC-Criterion3-TU-2022-2026.xlsx"');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(service.generateNaacWorkbook).toHaveBeenCalledWith(expect.objectContaining({ fromYear: 2022, toYear: 2026, paperBasis: 'calendar' }));
  });

  test.each([
    '/api/v1/reports/naac/criterion3?fromYear=1990&toYear=2000',
    '/api/v1/reports/naac/criterion3?fromYear=2010&toYear=2025',
    '/api/v1/reports/naac/criterion3?fromYear=2024&toYear=2022',
    '/api/v1/reports/naac/criterion3?paperYearBasis=weekly',
    '/api/v1/reports/nirf/research?financialYears=2023-25',
    '/api/v1/reports/summary?financialYears=junk',
  ])('rejects invalid params: %s', async (path) => {
    const res = await get(path, admin);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).success).toBe(false);
    expect(service.generateNaacWorkbook).not.toHaveBeenCalled();
  });

  test('NIRF export parses financial years', async () => {
    const res = await get('/api/v1/reports/nirf/research?financialYears=2024-25,2023-24', drdMember);
    expect(res.status).toBe(200);
    expect(service.generateNirfWorkbook).toHaveBeenCalledWith({ starts: [2023, 2024], labels: ['2023-24', '2024-25'] });
  });

  test('service errors become 500 without leaking details', async () => {
    service.getSummary.mockRejectedValueOnce(new Error('db exploded at host x'));
    const res = await get('/api/v1/reports/summary', admin);
    expect(res.status).toBe(500);
    expect(res.body).not.toMatch(/exploded/);
  });
});
