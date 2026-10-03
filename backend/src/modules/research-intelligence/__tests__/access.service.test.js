/**
 * Research Intelligence access rules: module switch, role templates assigned to people,
 * individual extra grants. Prisma is mocked: these tests pin the decision logic.
 */

const mockDb = { modules: [], grants: [], users: [], roles: [] };

jest.mock('../../../shared/config/redis', () => ({ invalidateUser: jest.fn(async () => {}) }));

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
  role: {
    findMany: jest.fn(async () => mockDb.roles.filter((r) => r.isActive)),
    findFirst: jest.fn(async ({ where }) => mockDb.roles.find((r) => where.OR.some((c) => (c.roleCode && r.roleCode === c.roleCode) || (c.name && r.name === c.name))) || null),
    create: jest.fn(async ({ data }) => { const r = { id: `r${mockDb.roles.length + 1}`, isActive: true, ...data }; mockDb.roles.push(r); return r; }),
  },
  ripUserAccess: {
    findFirst: jest.fn(async ({ where }) => mockDb.grants.find((g) => g.userId === where.userId) || null),
    create: jest.fn(async ({ data }) => { const g = { id: `g${mockDb.grants.length}`, ...data }; mockDb.grants.push(g); return g; }),
    update: jest.fn(async ({ where, data }) => Object.assign(mockDb.grants.find((g) => g.id === where.id), data)),
    deleteMany: jest.fn(async ({ where }) => { mockDb.grants = mockDb.grants.filter((g) => g.userId !== where.userId); return { count: 1 }; }),
    count: jest.fn(async () => 0),
  },
  userLogin: {
    findFirst: jest.fn(async ({ where }) => mockDb.users.find((u) => u.id === where.id) || null),
    update: jest.fn(async ({ where, data }) => Object.assign(mockDb.users.find((u) => u.id === where.id), data)),
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
  },
}));

const access = require('../services/access.service');
const { RIP_TEMPLATES, ALL_RIP_PERMISSION_KEYS } = require('../config/ripPermissions');

const admin = { id: 'a1', role: 'admin' };
const enable = () => access.setUniversityModule({ id: 'sa' }, 'U1', { enabled: true });
const can = async (user, key) => (await access.resolveAccess(user, 'U1')).permissions[key];
const role = (id, name, central, school = {}) => ({ id, name, roleCode: name.toUpperCase(), isActive: true, permissions: { centralDeptPermissions: central, schoolDeptPermissions: school } });
const holder = (id, roleName, keys) => ({ id, role: 'faculty', centralDeptPermissions: [{ permissions: Object.fromEntries(keys.map((k) => [k, true])), fromRole: !!roleName, roleName }], schoolDeptPermissions: [] });

beforeEach(() => {
  mockDb.modules = [];
  mockDb.grants = [];
  mockDb.users = [
    { id: 'f1', uid: 'F1', email: 'f1@x', role: 'faculty', assignedRoleIds: [] },
    { id: 'f2', uid: 'F2', email: 'f2@x', role: 'faculty', assignedRoleIds: ['other'] },
    { id: 'a1', uid: 'A1', email: 'a1@x', role: 'admin', assignedRoleIds: [] },
  ];
  mockDb.roles = [
    role('r-assist', 'RI Assistant', { rip_access_research_gpt: true }),
    role('r-analyst', 'RI Analyst', { rip_access_research_gpt: true, rip_view_overview: true }),
    role('r-mixed', 'DRD Reviewer + RI', { rip_access_research_gpt: true, research_review: true }),
    role('other', 'Finance Clerk', { fee_collect: true }),
  ];
  access.invalidate('U1');
});

describe('university switch', () => {
  it('is off by default: nobody has access, not even administrators', async () => {
    const r = await access.resolveAccess(admin, 'U1');
    expect(r.enabled).toBe(false);
    expect(Object.values(r.permissions).every((v) => v === false)).toBe(true);
  });

  it('turning it off revokes role-based access immediately', async () => {
    await enable();
    const u = holder('f1', 'RI Assistant', ['rip_access_research_gpt']);
    expect(await can(u, 'rip_access_research_gpt')).toBe(true);
    await access.setUniversityModule({ id: 'sa' }, 'U1', { enabled: false });
    expect(await can(u, 'rip_access_research_gpt')).toBe(false);
    expect(await can(admin, 'rip_manage_access')).toBe(false);
  });

  it('rejects non-boolean values and unknown universities', async () => {
    await expect(access.setUniversityModule({ id: 'sa' }, 'U1', { enabled: 'yes' })).rejects.toThrow(/true or false/);
    await expect(access.setUniversityModule({ id: 'sa' }, 'nope', { enabled: true })).rejects.toThrow(/not found/);
  });
});

describe('no university in context', () => {
  it('answers "no access" instead of failing (e.g. a superadmin who has not picked a university)', async () => {
    const r = await access.resolveAccess({ id: 'sa1', role: 'superadmin' }, null);
    expect(r.enabled).toBe(false);
    expect(Object.values(r.permissions).every((v) => v === false)).toBe(true);
  });
});

describe('who has access', () => {
  beforeEach(enable);

  it('administrators hold every capability', async () => {
    const r = await access.resolveAccess(admin, 'U1');
    expect(r.source).toBe('admin');
    expect(ALL_RIP_PERMISSION_KEYS.every((k) => r.permissions[k])).toBe(true);
  });

  it('a role assigned to the employee grants exactly its Research Intelligence keys', async () => {
    const u = holder('f1', 'RI Analyst', ['rip_access_research_gpt', 'rip_view_overview', 'research_review']);
    const r = await access.resolveAccess(u, 'U1');
    expect(r.source).toBe('role');
    expect(r.roles).toEqual(['RI Analyst']);
    expect(r.permissions.rip_view_overview).toBe(true);
    expect(r.permissions.rip_manage_taxonomy).toBe(false);
  });

  it('keys held through a direct department assignment count as well', async () => {
    const u = { id: 'f1', role: 'staff', centralDeptPermissions: [{ permissions: { rip_view_taxonomy: true } }], schoolDeptPermissions: [] };
    expect(await can(u, 'rip_view_taxonomy')).toBe(true);
  });

  it('people without any Research Intelligence key have no access', async () => {
    const u = holder('f2', 'Finance Clerk', ['fee_collect']);
    expect((await access.resolveAccess(u, 'U1')).source).toBe('none');
  });

  it('an individual extra grant adds to the role; an expired one stops counting', async () => {
    const u = holder('f1', 'RI Assistant', ['rip_access_research_gpt']);
    await access.setGrant(admin, 'f1', { permissions: ['rip_view_knowledge_graph'] });
    expect(await can(u, 'rip_view_knowledge_graph')).toBe(true);
    mockDb.grants[0].expiresAt = new Date(Date.now() - 1000);
    expect(await can(u, 'rip_view_knowledge_graph')).toBe(false);
    expect(await can(u, 'rip_access_research_gpt')).toBe(true);
  });
});

describe('role templates', () => {
  beforeEach(enable);

  it('classifies roles: only Research-Intelligence-only roles are assignable', async () => {
    const roles = await access.loadRipRoles();
    const byName = Object.fromEntries(roles.map((r) => [r.name, r]));
    expect(byName['RI Assistant'].assignable).toBe(true);
    expect(byName['DRD Reviewer + RI'].assignable).toBe(false);
    expect(byName['DRD Reviewer + RI'].otherPermissionCount).toBe(1);
    expect(byName['Finance Clerk']).toBeUndefined();
  });

  it('only administrators create roles; an identical role is reused, not duplicated', async () => {
    await expect(access.createRoleFromTemplate({ id: 'f1', role: 'faculty' }, 'assistant')).rejects.toThrow(/Only administrators/);
    const again = await access.createRoleFromTemplate(admin, 'assistant');
    expect(again.created).toBe(false);
    expect(again.role.id).toBe('r-assist');
    expect(mockDb.roles).toHaveLength(4);
  });

  it('creates a real, editable role with the template permissions', async () => {
    const r = await access.createRoleFromTemplate(admin, 'explorer');
    expect(r.created).toBe(true);
    const saved = mockDb.roles.find((x) => x.id === r.role.id);
    expect(Object.keys(saved.permissions.centralDeptPermissions).sort()).toEqual([...RIP_TEMPLATES.find((t) => t.key === 'explorer').permissions].sort());
    expect(saved.requiresDepartmentAssignment).toBe(false);
    await expect(access.createRoleFromTemplate(admin, 'nope')).rejects.toThrow(/Unknown template/);
  });
});

describe('assigning roles to people', () => {
  beforeEach(enable);

  it("replaces the person's Research Intelligence roles and never touches their other roles", async () => {
    const r = await access.setUserRoles('f2', ['r-assist']);
    expect(r.roleIds).toEqual(['r-assist']);
    expect(mockDb.users.find((u) => u.id === 'f2').assignedRoleIds.sort()).toEqual(['other', 'r-assist']);
    await access.setUserRoles('f2', []);
    expect(mockDb.users.find((u) => u.id === 'f2').assignedRoleIds).toEqual(['other']);
  });

  it('refuses roles that carry other privileges, unknown roles, administrators and unknown users', async () => {
    await expect(access.setUserRoles('f1', ['r-mixed'])).rejects.toThrow(/nothing else/);
    await expect(access.setUserRoles('f1', ['other'])).rejects.toThrow(/nothing else/);
    await expect(access.setUserRoles('f1', ['ghost'])).rejects.toThrow(/nothing else/);
    await expect(access.setUserRoles('a1', ['r-assist'])).rejects.toThrow(/Administrator/);
    await expect(access.setUserRoles('nope', ['r-assist'])).rejects.toThrow(/not found/);
  });

  it('does not write when nothing changes', async () => {
    const db = require('../../../shared/config/database');
    db.userLogin.update.mockClear();
    await access.setUserRoles('f1', []);
    expect(db.userLogin.update).not.toHaveBeenCalled();
  });
});

describe('bulk role changes', () => {
  beforeEach(enable);

  it('adds or removes one role for many people, skipping administrators and unknown users', async () => {
    const r = await access.bulkRole({ userIds: ['f1', 'f2', 'a1', 'ghost'], roleId: 'r-analyst', mode: 'add' });
    expect(r.updated).toHaveLength(2);
    expect(r.skipped.map((s) => s.userId).sort()).toEqual(['a1', 'ghost']);
    expect(mockDb.users.find((u) => u.id === 'f2').assignedRoleIds.sort()).toEqual(['other', 'r-analyst']);

    await access.bulkRole({ userIds: ['f1', 'f2'], roleId: 'r-analyst', mode: 'remove' });
    expect(mockDb.users.find((u) => u.id === 'f1').assignedRoleIds).toEqual([]);
    expect(mockDb.users.find((u) => u.id === 'f2').assignedRoleIds).toEqual(['other']);
  });

  it('enforces limits, mode and assignable roles', async () => {
    await expect(access.bulkRole({ userIds: [], roleId: 'r-assist' })).rejects.toThrow(/at least one/);
    await expect(access.bulkRole({ userIds: Array.from({ length: 201 }, (_, i) => `u${i}`), roleId: 'r-assist' })).rejects.toThrow(/at most 200/);
    await expect(access.bulkRole({ userIds: ['f1'], roleId: 'r-assist', mode: 'wipe' })).rejects.toThrow(/mode/);
    await expect(access.bulkRole({ userIds: ['f1'], roleId: 'r-mixed' })).rejects.toThrow(/nothing else/);
  });
});

describe('individual extra grants', () => {
  beforeEach(enable);

  it('validates keys, end dates and targets; only admins grant access management', async () => {
    await expect(access.setGrant(admin, 'f1', { permissions: ['rip_everything'] })).rejects.toThrow(/Unknown/);
    await expect(access.setGrant(admin, 'f1', { permissions: ['rip_view_overview'], expiresAt: '2001-01-01' })).rejects.toThrow(/future/);
    await expect(access.setGrant(admin, 'nope', { permissions: ['rip_view_overview'] })).rejects.toThrow(/not found/);
    await expect(access.setGrant(admin, 'a1', { permissions: ['rip_view_overview'] })).rejects.toThrow(/Administrators already/);
    await expect(access.setGrant({ id: 'f2', role: 'faculty' }, 'f1', { permissions: ['rip_manage_access'] })).rejects.toThrow(/administrators/);
  });

  it('an empty list removes the grant', async () => {
    await access.setGrant(admin, 'f1', { permissions: ['rip_view_overview'] });
    await access.setGrant(admin, 'f1', { permissions: [] });
    expect(mockDb.grants).toHaveLength(0);
  });
});

describe('middleware', () => {
  const run = (mw, req) => new Promise((resolve) => {
    const res = { status: (c) => ({ json: (b) => resolve({ code: c, body: b }) }) };
    mw(req, res, (err) => resolve({ next: true, err }));
  });

  it('403 RIP_MODULE_DISABLED, then 403 RIP_PERMISSION_REQUIRED, then pass', async () => {
    const user = holder('f1', 'RI Assistant', ['rip_access_research_gpt']);
    const req = { user, tenantId: 'U1' };
    expect((await run(access.requireModule, req)).body.code).toBe('RIP_MODULE_DISABLED');
    await enable();
    access.invalidate('U1');
    expect((await run(access.requireModule, req)).next).toBe(true);
    expect((await run(access.requireCapability('rip_manage_taxonomy'), req)).body.code).toBe('RIP_PERMISSION_REQUIRED');
    expect((await run(access.requireCapability('rip_access_research_gpt'), req)).next).toBe(true);
  });
});

describe('shared read features', () => {
  const run = (mw, req) => new Promise((resolve) => {
    const res = { status: (c) => ({ json: (b) => resolve({ code: c, body: b }) }) };
    mw(req, res, () => resolve({ next: true }));
  });
  const ANY = access.requireAnyCapability(['rip_view_overview', 'rip_access_research_gpt', 'rip_view_knowledge_graph']);

  it('open to anyone with at least one of the capabilities (e.g. the Explorer role has no overview)', async () => {
    expect((await run(ANY, { ripAccess: { permissions: { rip_view_knowledge_graph: true } } })).next).toBe(true);
    expect((await run(ANY, { ripAccess: { permissions: { rip_access_research_gpt: true } } })).next).toBe(true);
  });

  it('closed to everyone else', async () => {
    const r = await run(ANY, { ripAccess: { permissions: { rip_manage_taxonomy: true } } });
    expect(r.body.code).toBe('RIP_PERMISSION_REQUIRED');
    expect((await run(ANY, {})).code).toBe(403);
  });
});

describe('listing people by access', () => {
  beforeEach(enable);
  const whereFor = async (access_) => {
    const db = require('../../../shared/config/database');
    db.userLogin.count.mockClear();
    await access.listUsers({ access: access_ });
    return db.userLogin.count.mock.calls[0][0].where.AND;
  };
  const accessClause = (and) => and.find((c) => c.OR || c.NOT);

  it('counts administrators as having access, matching resolveAccess', async () => {
    const without = accessClause(await whereFor('without'));
    expect(without.NOT.OR).toContainEqual({ role: { in: expect.arrayContaining(['admin', 'superadmin']) } });
    const withAccess = accessClause(await whereFor('with'));
    expect(withAccess.OR).toContainEqual({ role: { in: expect.arrayContaining(['admin', 'superadmin']) } });
  });

  it('unknown users get a single "not found" in the message', async () => {
    await expect(access.setUserRoles('nope', [])).rejects.toThrow('User in this university not found');
  });
});

describe('templates', () => {
  it('only contain real keys, are nested, and never include access management', () => {
    for (const t of RIP_TEMPLATES) {
      expect(t.permissions.every((k) => ALL_RIP_PERMISSION_KEYS.includes(k))).toBe(true);
      expect(t.permissions).not.toContain('rip_manage_access');
    }
    for (let i = 1; i < RIP_TEMPLATES.length; i++) {
      expect(RIP_TEMPLATES[i - 1].permissions.every((k) => RIP_TEMPLATES[i].permissions.includes(k))).toBe(true);
    }
  });
});
