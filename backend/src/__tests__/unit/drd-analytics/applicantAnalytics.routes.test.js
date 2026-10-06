/**
 * Route guard: applicant analytics can be granted for all categories (applicant_analytics) or per
 * category (research_ / book_ / conference_ / ipr_ / grant_applicant_analytics). The category-aware
 * endpoints let any of these through (the service scopes the data); endpoints whose service only
 * understands the general key keep requiring it.
 */
const express = require('express');

let mockUser = null;
jest.mock('../../../shared/middleware/auth', () => {
  const actual = jest.requireActual('../../../shared/middleware/auth');
  return { ...actual, protect: (req, res, next) => { req.user = mockUser; next(); } };
});
jest.mock('../../../modules/drd-analytics/controllers/drdAnalytics.controller', () => new Proxy({}, {
  get: (_t, name) => (req, res) => res.json({ ok: true, handler: String(name) }),
}));

const router = require('../../../modules/drd-analytics/routes/drdAnalytics.routes');
const app = express().use('/drd-analytics', router);
const userWith = (permissions, role = 'faculty') => ({ id: 'u1', role, centralDeptPermissions: [{ permissions }] });

let server;
let baseUrl;
beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
const request = () => ({ get: (path) => fetch(`${baseUrl}${path}`) });

test('a research-only analytics holder reaches the category-aware applicant endpoints', async () => {
  mockUser = userWith({ research_applicant_analytics: true });
  for (const path of ['/applicant', '/applicant/category-breakdown', '/applicant/schools/s1', '/applicant/departments/d1', '/applicant/people/p2']) {
    const res = await request().get(`/drd-analytics${path}`);
    expect([path, res.status]).toEqual([path, 200]);
  }
});

test('endpoints that only understand the general key still require it', async () => {
  mockUser = userWith({ research_applicant_analytics: true });
  for (const path of ['/progress-tracker', '/applicant/contributions', '/applicant/affiliations']) {
    const res = await request().get(`/drd-analytics${path}`);
    expect([path, res.status]).toEqual([path, 403]);
  }
  mockUser = userWith({ applicant_analytics: true });
  expect((await request().get('/drd-analytics/progress-tracker')).status).toBe(200);
});

test('no analytics key: refused; admins and superadmins pass; anyone may open their own person view', async () => {
  mockUser = userWith({ research_review: true });
  expect((await request().get('/drd-analytics/applicant')).status).toBe(403);
  expect((await request().get('/drd-analytics/applicant/people/u1')).status).toBe(200);
  mockUser = userWith({}, 'admin');
  expect((await request().get('/drd-analytics/applicant')).status).toBe(200);
  mockUser = { id: 'sa', role: 'superadmin', centralDeptPermissions: [] };
  expect((await request().get('/drd-analytics/applicant')).status).toBe(200);
});
