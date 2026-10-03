/**
 * University branding: input validation, image upload safety, who may edit whose
 * branding (tenant isolation), public lookup and the audit trail.
 *
 * `protect` is replaced by a stub that takes the user (and tenant) from a test header;
 * Prisma and the audit service are mocked. Image processing runs the real sharp pipeline.
 */
const mockLog = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };

const UNI_A = '11111111-1111-4111-8111-111111111111';
const UNI_B = '22222222-2222-4222-8222-222222222222';

const mockRows = {};
const mockPrisma = {
  university: {
    findUnique: jest.fn(async ({ where }) => {
      const row = where.id ? mockRows[where.id] : Object.values(mockRows).find((r) => r.slug === where.slug);
      return row ? { ...row } : null;
    }),
    update: jest.fn(async ({ where, data }) => {
      mockRows[where.id] = { ...mockRows[where.id], ...data };
      return { ...mockRows[where.id] };
    }),
  },
};

jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/config/redis', () => ({ getOrSet: jest.fn(), del: jest.fn(), get: jest.fn(), set: jest.fn(), CACHE_KEYS: {} }));
jest.mock('../../../shared/utils/licenseState', () => ({ isVerified: () => true }));
jest.mock('../../../modules/bug-reports/utils/securityLogger', () => ({ logAuthenticationFailure: jest.fn() }));
jest.mock('../../../shared/utils/logger', () => ({ ...mockLog, createModuleLogger: () => mockLog }));
jest.mock('../../../modules/core/services/affiliation.service', () => ({ invalidateUniversityAffiliationCache: jest.fn() }));
jest.mock('../../../modules/audit/services/audit.service', () => ({
  auditService: { log: jest.fn(async () => undefined) },
  AuditActionType: { CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE', UPLOAD: 'UPLOAD', CONFIG_CHANGE: 'CONFIG_CHANGE' },
  AuditModule: { ADMIN: 'admin' },
  AuditSeverity: { INFO: 'INFO' },
}));
jest.mock('../../../modules/branding/services/brandAsset.service', () => {
  const actual = jest.requireActual('../../../modules/branding/services/brandAsset.service');
  return {
    ...actual,
    storeBrandImage: jest.fn(async (buf, universityId, variant) => `branding/${universityId}/1-abc-${variant}.png`),
    deleteBrandImage: jest.fn(async () => undefined),
  };
});
jest.mock('../../../shared/middleware/auth', () => {
  const actual = jest.requireActual('../../../shared/middleware/auth');
  const tenantContext = jest.requireActual('../../../shared/tenancy/tenantContext');
  return {
    ...actual,
    invalidateTenantStatus: jest.fn(),
    protect: (req, res, next) => {
      const user = JSON.parse(req.headers['x-test-user'] || 'null');
      if (!user) return res.status(401).json({ success: false });
      req.user = user;
      req.tenantId = user.role === 'superadmin' ? null : user.universityId;
      return tenantContext.run({ tenantId: req.tenantId }, () => next());
    },
  };
});

const http = require('http');
const express = require('express');
const sharp = require('sharp');
const { auditService } = require('../../../modules/audit/services/audit.service');
const assets = require('../../../modules/branding/services/brandAsset.service');
const { parseBrandingUpdate } = require('../../../modules/branding/validation/branding.validation');
const brandingRouter = require('../../../modules/branding');
const superadminRouter = require('../../../modules/superadmin');

const baseRow = (id, code, slug) => ({
  id, code, slug, name: `${code} University`, isActive: true,
  displayName: null, shortName: null, tagline: null, logoUrl: null, logoDarkKey: null, faviconKey: null,
  themePreset: 'classic-wine', primaryColor: null, accentColor: null, heroHeading: null, heroSubheading: null, brandingUpdatedAt: null,
});

let server;
let port;
beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/public/branding', brandingRouter.publicRoutes);
  app.use('/api/v1/branding', brandingRouter);
  app.use('/api/v1/superadmin', superadminRouter);
  server = app.listen(0, () => { port = server.address().port; done(); });
});
afterAll(() => new Promise((resolve) => server.close(() => resolve())));
beforeEach(() => {
  jest.clearAllMocks();
  mockRows[UNI_A] = baseRow(UNI_A, 'AAA', 'uni-a');
  mockRows[UNI_B] = baseRow(UNI_B, 'BBB', 'uni-b');
});

function request(method, path, { user, json, multipart } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (user) headers['x-test-user'] = JSON.stringify(user);
    let body = null;
    if (json !== undefined) {
      body = Buffer.from(JSON.stringify(json));
      headers['Content-Type'] = 'application/json';
    } else if (multipart) {
      const boundary = 'b0undaryXyz';
      body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${multipart.filename}"\r\nContent-Type: ${multipart.mime}\r\n\r\n`),
        multipart.buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
    }
    if (body) headers['Content-Length'] = body.length;
    const req = http.request({ port, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (_) { /* binary */ }
        resolve({ status: res.statusCode, headers: res.headers, json: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const adminA = { id: 'admin-a', role: 'admin', universityId: UNI_A };
const facultyA = { id: 'fac-a', role: 'faculty', universityId: UNI_A };
const superadmin = { id: 'root', role: 'superadmin', universityId: null };

const png = (w = 64, h = 32) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 29, g: 78, b: 216, alpha: 1 } } }).png().toBuffer();

describe('validation', () => {
  test('accepts hex colours, known presets and trims text', () => {
    const r = parseBrandingUpdate({ displayName: '  Rungta  International ', primaryColor: '#1d4ed8', themePreset: 'royal-blue', tagline: '' });
    expect(r).toEqual({ ok: true, data: { displayName: 'Rungta International', primaryColor: '#1D4ED8', themePreset: 'royal-blue', tagline: null } });
  });
  test.each([
    [{ primaryColor: 'blue' }, /hex colour/],
    [{ accentColor: '#12345' }, /hex colour/],
    [{ themePreset: 'neon' }, /Theme must be one of/],
    [{ shortName: 'x'.repeat(33) }, /at most 32/],
    [{ logoUrl: 'https://evil.example/x.png' }, /Unknown field/],
    [{ universityId: UNI_B }, /Unknown field/],
  ])('rejects %j', (body, message) => {
    const r = parseBrandingUpdate(body);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(message);
  });
  test('strips control characters', () => {
    expect(parseBrandingUpdate({ heroHeading: 'Hi\u0000\u0007 there' }).data.heroHeading).toBe('Hi there');
  });
});

describe('image upload safety', () => {
  test('re-encodes a PNG and keeps it within the logo box', async () => {
    const out = await assets.processBrandImage({ originalname: 'logo.png', mimetype: 'image/png', buffer: await png(2400, 600) }, 'light');
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBeLessThanOrEqual(1200);
    expect(meta.height).toBeLessThanOrEqual(400);
  });
  test('rasterises a clean SVG to PNG', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><rect width="200" height="60" fill="#1D4ED8"/><text x="10" y="40" fill="#fff">RISU</text></svg>');
    const out = await assets.processBrandImage({ originalname: 'logo.svg', mimetype: 'image/svg+xml', buffer: svg }, 'light');
    expect((await sharp(out.buffer).metadata()).format).toBe('png');
  });
  test.each([
    ['script', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', /scripts/],
    ['external image', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="https://evil.example/a.png"/></svg>', /external/],
    ['entity', '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>', /DOCTYPE|ENTITY/],
    ['foreignObject', '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"/></foreignObject></svg>', /foreignObject/],
  ])('rejects an SVG with %s', async (_label, text, message) => {
    await expect(assets.processBrandImage({ originalname: 'x.svg', mimetype: 'image/svg+xml', buffer: Buffer.from(text) }, 'light')).rejects.toThrow(message);
  });
  test('rejects content that does not match the extension', async () => {
    await expect(assets.processBrandImage({ originalname: 'logo.png', mimetype: 'image/png', buffer: Buffer.from('<html><script>alert(1)</script></html>') }, 'light'))
      .rejects.toThrow(/does not match/);
  });
  test('rejects other types and oversize files', async () => {
    await expect(assets.processBrandImage({ originalname: 'logo.gif', mimetype: 'image/gif', buffer: Buffer.from('GIF89a') }, 'light')).rejects.toThrow(/not allowed/);
    await expect(assets.processBrandImage({ originalname: 'logo.png', mimetype: 'image/png', buffer: Buffer.alloc(1024 * 1024 + 1) }, 'light')).rejects.toThrow(/1 MB/);
  });
  test('keys are only honoured for the owning university', () => {
    expect(assets.keyBelongsTo(`branding/${UNI_A}/1-abc-light.png`, UNI_A)).toBe(true);
    expect(assets.keyBelongsTo(`branding/${UNI_A}/1-abc-light.png`, UNI_B)).toBe(false);
    expect(assets.keyBelongsTo(`branding/${UNI_A}/../../secret.png`, UNI_A)).toBe(false);
    expect(assets.keyBelongsTo('documents/x/y.png', UNI_A)).toBe(false);
  });
});

describe('who may read and edit branding', () => {
  test('GET /branding/me returns the caller\'s own university', async () => {
    mockRows[UNI_A].themePreset = 'royal-blue';
    const r = await request('GET', '/api/v1/branding/me', { user: facultyA });
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ universityId: UNI_A, code: 'AAA', themePreset: 'royal-blue' });
    expect(mockPrisma.university.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: UNI_A } }));
  });

  test('superadmin without a selected tenant gets no branding (default theme)', async () => {
    const r = await request('GET', '/api/v1/branding/me', { user: superadmin });
    expect(r.status).toBe(200);
    expect(r.json.data).toBeNull();
  });

  test('tenant admin edits only their own university; a foreign id in the body is rejected', async () => {
    const ok = await request('PUT', '/api/v1/branding/admin', { user: adminA, json: { themePreset: 'emerald', shortName: 'AU' } });
    expect(ok.status).toBe(200);
    expect(mockPrisma.university.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: UNI_A } }));
    expect(mockRows[UNI_B].themePreset).toBe('classic-wine');

    const sneaky = await request('PUT', '/api/v1/branding/admin', { user: adminA, json: { universityId: UNI_B, themePreset: 'crimson' } });
    expect(sneaky.status).toBe(400);
    expect(mockRows[UNI_B].themePreset).toBe('classic-wine');
  });

  test('non-admin tenant users cannot edit branding', async () => {
    expect((await request('PUT', '/api/v1/branding/admin', { user: facultyA, json: { themePreset: 'crimson' } })).status).toBe(403);
    expect((await request('POST', '/api/v1/branding/admin/reset', { user: facultyA })).status).toBe(403);
    expect(mockPrisma.university.update).not.toHaveBeenCalled();
  });

  test('tenant admins cannot use the superadmin endpoints for another university', async () => {
    const r = await request('PUT', `/api/v1/superadmin/universities/${UNI_B}/branding`, { user: adminA, json: { themePreset: 'crimson' } });
    expect(r.status).toBe(403);
    expect(mockRows[UNI_B].themePreset).toBe('classic-wine');
  });

  test('superadmin edits any university by id', async () => {
    const r = await request('PUT', `/api/v1/superadmin/universities/${UNI_B}/branding`, { user: superadmin, json: { themePreset: 'royal-blue', displayName: 'B International' } });
    expect(r.status).toBe(200);
    expect(r.json.data.branding).toMatchObject({ themePreset: 'royal-blue', displayName: 'B International', legalName: 'BBB University' });
    expect(mockRows[UNI_B].brandingUpdatedAt).toBeInstanceOf(Date);
  });

  test('unauthenticated calls are refused', async () => {
    expect((await request('GET', '/api/v1/branding/me')).status).toBe(401);
    expect((await request('PUT', '/api/v1/branding/admin', { json: {} })).status).toBe(401);
  });
});

describe('audit trail', () => {
  test('a change is audited with old and new values; a no-op is not', async () => {
    await request('PUT', `/api/v1/superadmin/universities/${UNI_A}/branding`, { user: superadmin, json: { themePreset: 'teal-slate', primaryColor: '#0f766e' } });
    expect(auditService.log).toHaveBeenCalledTimes(1);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'root',
      universityId: UNI_A,
      category: 'branding',
      actionType: 'CONFIG_CHANGE',
      oldValues: { themePreset: 'classic-wine', primaryColor: null },
      newValues: { themePreset: 'teal-slate', primaryColor: '#0F766E' },
    }));
    auditService.log.mockClear();
    await request('PUT', `/api/v1/superadmin/universities/${UNI_A}/branding`, { user: superadmin, json: { themePreset: 'teal-slate' } });
    expect(auditService.log).not.toHaveBeenCalled();
  });

  test('upload stores a re-encoded PNG under the university and is audited', async () => {
    const r = await request('POST', '/api/v1/branding/admin/assets/light', {
      user: adminA,
      multipart: { filename: 'logo.png', mime: 'image/png', buffer: await png() },
    });
    expect(r.status).toBe(200);
    expect(assets.storeBrandImage).toHaveBeenCalledWith(expect.any(Buffer), UNI_A, 'light');
    expect(r.json.data.branding.logoUrl).toMatch(/^\/api\/v1\/public\/branding\/uni-a\/logo\/light\?v=\d+$/);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'UPLOAD', universityId: UNI_A }));
  });

  test('an upload with spoofed content is refused before anything is stored', async () => {
    const r = await request('POST', '/api/v1/branding/admin/assets/light', {
      user: adminA,
      multipart: { filename: 'logo.png', mime: 'image/png', buffer: Buffer.from('<svg onload=alert(1)>') },
    });
    expect(r.status).toBe(400);
    expect(assets.storeBrandImage).not.toHaveBeenCalled();
  });

  test('reset clears every field and image and is audited', async () => {
    Object.assign(mockRows[UNI_A], { themePreset: 'crimson', displayName: 'X', logoUrl: `branding/${UNI_A}/1-abc-light.png` });
    const r = await request('POST', '/api/v1/branding/admin/reset', { user: adminA });
    expect(r.status).toBe(200);
    expect(mockRows[UNI_A]).toMatchObject({ themePreset: 'classic-wine', displayName: null, logoUrl: null });
    expect(assets.deleteBrandImage).toHaveBeenCalledWith(`branding/${UNI_A}/1-abc-light.png`, UNI_A);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ category: 'branding', universityId: UNI_A }));
  });
});

describe('public branding', () => {
  test('served by slug without login, without the internal id', async () => {
    const r = await request('GET', '/api/v1/public/branding/uni-b');
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ slug: 'uni-b', displayName: 'BBB University', shortName: 'BU' });
    expect(r.json.data.universityId).toBeUndefined();
  });
  test('inactive or unknown universities are a 404', async () => {
    mockRows[UNI_B].isActive = false;
    expect((await request('GET', '/api/v1/public/branding/uni-b')).status).toBe(404);
    expect((await request('GET', '/api/v1/public/branding/nope')).status).toBe(404);
    expect((await request('GET', '/api/v1/public/branding/uni-a/logo/light')).status).toBe(404); // no logo uploaded
    expect((await request('GET', '/api/v1/public/branding/uni-a/logo/evil')).status).toBe(404);
  });
});
