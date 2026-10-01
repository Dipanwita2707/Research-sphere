/**
 * Research Intelligence access rules (user-wise).
 * Prisma is mocked: these tests pin the decision logic, not the database.
 */

const mockDb = {
  modules: [],
  grants: [],
  users: [],
};

jest.mock('../../../shared/config/database', () => ({
  universityModule: {
    findFirst: jest.fn(async ({ where }) => mockDb.modules.find((m) => m.universityId === where.universityId && m.moduleKey === where.moduleKey) || null),
    upsert: jest.fn(async ({ where, update, create }) => {
      const k = where.universityId_moduleKey;
      let m = mockDb.modules.find((x) => x.universityId === k.universityId && x.moduleKey === k.moduleKey);
      if (m) Object.assign(m, Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)));
      else mockDb.modules.push((m = { id: `m${mockDb.modules.length}`, ...create }));
      return m;
    }),
  },
  university: { findFirst: jest.fn(async ({ where }) => (where.id === 'U1' ? { id: 'U1', name: 'Uni One' } : null)) },
  ripUserAccess: {
    findFirst: jest.fn(async ({ where }) => mockDb.grants.find((g) => g.userId === where.userId) || null),
    create: jest.fn(async ({ data }) => { const g = { id: `g${mockDb.grants.length}`, ...data }; mockDb.grants.push(g); return g; }),
    update: jest.fn(async ({ where, data }) => Object.assign(mockDb.grants.find((g) => g.id === where.id), data)),
    deleteMany: jest.fn(async ({ where }) => { mockDb.grants = mockDb.grants.filter((g) => g.userId !== where.userId); return { count: 1 }; }),
    count: jest.fn(async () => 0),
  },
  userLogin: {
    findFirst: jest.fn(async ({ where }) => mockDb.users.find((u) => u.id === where.id) || null),
    findMany: jest.fn(async ({ where }) => {
      if (where?.id?.in) return mockDb.users.filter((u) => where.id.in.includes(u.id)).map((u) => ({ ...u, ripAccess: mockDb.grants.find((g) => g.userId === u.id) || null }));
      return [];
    }),
    count: jest.fn(async () => 0),
  },
}));

const access = require('../services/access.service');
const { RIP_PRESETS, ALL_RIP_PERMISSION_KEYS } = require('../config/ripPermissions');

const admin = { id: 'a1', role: 'admin' };
const faculty = { id: 'f1', role: 'faculty', centralDeptPermissions: [{ permissions: { rip_view_overview: true } }] };
const can = async (user, key) => (await access.resolveAccess(user, 'U1')).permissions[key];

const enable = () => access.setUniversityModule({ id: 'sa' }, 'U1', { enabled: true });

beforeEach(() => {
  mockDb.modules = [];
  mockDb.grants = [];
  mockDb.users = [
    { id: 'f1', uid: 'F1', email: 'f1@x', role: 'faculty' },
    { id: 'f2', uid: 'F2', email: 'f2@x', role: 'faculty' },
    { id: 's1', uid: 'S1', email: 's1@x', role: 'student' },
    { id: 'a1', uid: 'A1', email: 'a1@x', role: 'admin' },
  ];
  access.invalidate('U1');
});

describe('university switch', () => {
  it('is off by default: nobody has access, not even administrators', async () => {
    const r = await access.resolveAccess(admin, 'U1');
    expect(r.enabled).toBe(false);
    expect(Object.values(r.permissions).every((v) => v === false)).toBe(true);
  });

  it('turning it off revokes everything immediately', async () => {
    await enable();
    await access.setGrant(admin, 'f1', { permissions: ['rip_access_research_gpt'] });
    expect(await can(faculty, 'rip_access_research_gpt')).toBe(true);
    await access.setUniversityModule({ id: 'sa' }, 'U1', { enabled: false });
    expect(await can(faculty, 'rip_access_research_gpt')).toBe(false);
    expect(await can(admin, 'rip_manage_access')).toBe(false);
  });

  it('rejects non-boolean values and unknown universities', async () => {
    await expect(access.setUniversityModule({ id: 'sa' }, 'U1', { enabled: 'yes' })).rejects.toThrow(/true or false/);
    await expect(access.setUniversityModule({ id: 'sa' }, 'nope', { enabled: true })).rejects.toThrow(/not found/);
  });
});

describe('user-wise access', () => {
  beforeEach(enable);

  it('administrators hold every capability', async () => {
    const r = await access.resolveAccess(admin, 'U1');
    expect(r.source).toBe('admin');
    expect(ALL_RIP_PERMISSION_KEYS.every((k) => r.permissions[k])).toBe(true);
  });

  it('a user holds exactly what was granted to them', async () => {
    await access.setGrant(admin, 'f1', { permissions: ['rip_access_research_gpt', 'rip_view_knowledge_graph'] });
    expect(await can(faculty, 'rip_access_research_gpt')).toBe(true);
    expect(await can(faculty, 'rip_view_knowledge_graph')).toBe(true);
    expect(await can(faculty, 'rip_manage_taxonomy')).toBe(false);
  });

  it('department or role permissions never grant access (even rip_* keys in them)', async () => {
    expect(await can(faculty, 'rip_view_overview')).toBe(false);
    expect((await access.resolveAccess(faculty, 'U1')).source).toBe('none');
  });

  it('an expired grant stops counting', async () => {
    await access.setGrant(admin, 'f1', { permissions: ['rip_access_research_gpt'] });
    mockDb.grants[0].expiresAt = new Date(Date.now() - 1000);
    expect(await can(faculty, 'rip_access_research_gpt')).toBe(false);
  });

  it('only administrators can hand out access management', async () => {
    await expect(access.setGrant({ id: 'f2', role: 'faculty' }, 's1', { permissions: ['rip_manage_access'] })).rejects.toThrow(/administrators/);
    await expect(access.setGrant(admin, 's1', { permissions: ['rip_manage_access'] })).resolves.toBeTruthy();
  });

  it('validates keys, end dates and targets', async () => {
    await expect(access.setGrant(admin, 'f1', { permissions: ['rip_everything'] })).rejects.toThrow(/Unknown/);
    await expect(access.setGrant(admin, 'f1', { permissions: ['rip_view_overview'], expiresAt: '2001-01-01' })).rejects.toThrow(/future/);
    await expect(access.setGrant(admin, 'nope', { permissions: ['rip_view_overview'] })).rejects.toThrow(/not found/);
    await expect(access.setGrant(admin, 'a1', { permissions: ['rip_view_overview'] })).rejects.toThrow(/Administrators already/);
  });

  it('an empty permission list removes the grant', async () => {
    await access.setGrant(admin, 'f1', { permissions: ['rip_view_overview'] });
    await access.setGrant(admin, 'f1', { permissions: [] });
    expect(mockDb.grants).toHaveLength(0);
  });
});

describe('bulk changes', () => {
  beforeEach(enable);
  const ids = ['f1', 'f2', 's1'];

  it('add merges with existing access; remove subtracts; replace overwrites', async () => {
    await access.setGrant(admin, 'f1', { permissions: ['rip_view_overview'] });
    await access.bulkSet(admin, { userIds: ids, permissions: ['rip_access_research_gpt'], mode: 'add' });
    expect(mockDb.grants.find((g) => g.userId === 'f1').permissions.sort()).toEqual(['rip_access_research_gpt', 'rip_view_overview']);
    expect(mockDb.grants.find((g) => g.userId === 's1').permissions).toEqual(['rip_access_research_gpt']);

    await access.bulkSet(admin, { userIds: ids, permissions: ['rip_access_research_gpt'], mode: 'remove' });
    expect(mockDb.grants.find((g) => g.userId === 'f1').permissions).toEqual(['rip_view_overview']);
    expect(mockDb.grants.find((g) => g.userId === 's1')).toBeUndefined(); // nothing left, so the grant is deleted

    await access.bulkSet(admin, { userIds: ['f1'], permissions: ['rip_view_taxonomy'], mode: 'replace' });
    expect(mockDb.grants.find((g) => g.userId === 'f1').permissions).toEqual(['rip_view_taxonomy']);
  });

  it('skips administrators and unknown users but still applies the rest', async () => {
    const r = await access.bulkSet(admin, { userIds: ['f1', 'a1', 'ghost'], permissions: ['rip_view_overview'], mode: 'add' });
    expect(r.updated).toHaveLength(1);
    expect(r.skipped.map((s) => s.userId).sort()).toEqual(['a1', 'ghost']);
  });

  it('enforces limits and the access-management rule', async () => {
    await expect(access.bulkSet(admin, { userIds: [], permissions: ['rip_view_overview'] })).rejects.toThrow(/at least one user/);
    await expect(access.bulkSet(admin, { userIds: Array.from({ length: 201 }, (_, i) => `u${i}`), permissions: ['rip_view_overview'] })).rejects.toThrow(/at most 200/);
    await expect(access.bulkSet({ id: 'f2', role: 'faculty' }, { userIds: ids, permissions: ['rip_manage_access'], mode: 'add' })).rejects.toThrow(/administrators/);
    await expect(access.bulkSet(admin, { userIds: ids, permissions: ['rip_view_overview'], mode: 'wipe' })).rejects.toThrow(/mode/);
  });
});

describe('middleware', () => {
  const run = (mw, req) => new Promise((resolve) => {
    const res = { status: (c) => ({ json: (b) => resolve({ code: c, body: b }) }) };
    mw(req, res, (err) => resolve({ next: true, err }));
  });

  it('403 RIP_MODULE_DISABLED, then 403 RIP_PERMISSION_REQUIRED, then pass', async () => {
    const req = { user: faculty, tenantId: 'U1' };
    expect((await run(access.requireModule, req)).body.code).toBe('RIP_MODULE_DISABLED');
    await enable();
    access.invalidate('U1');
    expect((await run(access.requireModule, req)).next).toBe(true);
    expect((await run(access.requireCapability('rip_manage_taxonomy'), req)).body.code).toBe('RIP_PERMISSION_REQUIRED');
    await access.setGrant(admin, 'f1', { permissions: ['rip_access_research_gpt'] });
    const req2 = { user: faculty, tenantId: 'U1' };
    await run(access.requireModule, req2);
    expect((await run(access.requireCapability('rip_access_research_gpt'), req2)).next).toBe(true);
  });
});

describe('presets', () => {
  it('only contain real keys, are nested, and never include access management', () => {
    for (const p of RIP_PRESETS) {
      expect(p.permissions.every((k) => ALL_RIP_PERMISSION_KEYS.includes(k))).toBe(true);
      expect(p.permissions).not.toContain('rip_manage_access');
    }
    for (let i = 1; i < RIP_PRESETS.length; i++) {
      expect(RIP_PRESETS[i - 1].permissions.every((k) => RIP_PRESETS[i].permissions.includes(k))).toBe(true);
    }
  });
});
