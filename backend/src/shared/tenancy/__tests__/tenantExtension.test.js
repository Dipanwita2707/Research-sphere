const { scopeArgs, isTenantScoped, TenantViolationError } = require('../tenantExtension');

const T = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

describe('tenant extension: scopeArgs', () => {
  describe('which models are scoped', () => {
    it('scopes tenant-owned models, University and UserLogin', () => {
      expect(isTenantScoped('IprApplication')).toBe(true);
      expect(isTenantScoped('ResearchContribution')).toBe(true);
      expect(isTenantScoped('AuditLog')).toBe(true);
      expect(isTenantScoped('UserLogin')).toBe(true);
      expect(isTenantScoped('University')).toBe(true);
    });

    it('leaves platform-level models alone', () => {
      expect(isTenantScoped('License')).toBeFalsy();
      expect(isTenantScoped('SaaSTier')).toBeFalsy();
      expect(isTenantScoped('PasswordResetToken')).toBeFalsy();
    });
  });

  describe('reads', () => {
    it('ANDs the tenant filter into findMany, keeping the caller filter', () => {
      const out = scopeArgs('IprApplication', 'findMany', { where: { status: 'draft' } }, T);
      expect(out.where).toEqual({ status: 'draft', AND: [{ universityId: T }] });
    });

    it('keeps unique fields at the top level for findUnique', () => {
      const out = scopeArgs('ResearchContribution', 'findUnique', { where: { id: 'x' } }, T);
      expect(out.where.id).toBe('x');
      expect(out.where.AND).toEqual([{ universityId: T }]);
    });

    it('appends to an existing AND array instead of replacing it', () => {
      const out = scopeArgs('Department', 'findFirst', { where: { AND: [{ isActive: true }] } }, T);
      expect(out.where.AND).toEqual([{ isActive: true }, { universityId: T }]);
    });

    it('scopes count, aggregate and groupBy', () => {
      for (const op of ['count', 'aggregate', 'groupBy']) {
        expect(scopeArgs('GrantApplication', op, {}, T).where).toEqual({ universityId: T });
      }
    });

    it('lets tenants read global rows of shared models', () => {
      const out = scopeArgs('Role', 'findMany', {}, T);
      expect(out.where).toEqual({ OR: [{ universityId: T }, { universityId: null }] });
    });

    it('limits University reads to the current tenant', () => {
      expect(scopeArgs('University', 'findMany', {}, T).where).toEqual({ id: T });
    });
  });

  describe('updates and deletes', () => {
    it('scopes update/delete where clauses', () => {
      for (const op of ['update', 'delete', 'updateMany', 'deleteMany']) {
        const out = scopeArgs('IprApplication', op, { where: { id: 'x' }, data: { title: 'y' } }, T);
        expect(out.where.AND).toEqual([{ universityId: T }]);
      }
    });

    it('cannot write global rows of shared models', () => {
      const out = scopeArgs('Role', 'update', { where: { id: 'r' }, data: { name: 'n' } }, T);
      expect(out.where.AND).toEqual([{ universityId: T }]);
    });

    it('blocks moving a row to another tenant', () => {
      expect(() => scopeArgs('IprApplication', 'update', { where: { id: 'x' }, data: { universityId: OTHER } }, T))
        .toThrow(TenantViolationError);
      expect(() => scopeArgs('IprApplication', 'updateMany', { where: {}, data: { universityId: OTHER } }, T))
        .toThrow(TenantViolationError);
      expect(() => scopeArgs('IprApplication', 'update', {
        where: { id: 'x' }, data: { university: { connect: { id: OTHER } } },
      }, T)).toThrow(TenantViolationError);
    });
  });

  describe('creates', () => {
    it('stamps universityId on a plain create', () => {
      const out = scopeArgs('FacultySchoolList', 'create', { data: { facultyCode: 'ENG', facultyName: 'Eng' } }, T);
      expect(out.data.universityId).toBe(T);
    });

    it('uses a relation connect when the payload uses relation inputs', () => {
      const out = scopeArgs('Department', 'create', {
        data: { departmentCode: 'CSE', departmentName: 'CS', faculty: { connect: { id: 'f' } } },
      }, T);
      expect(out.data.university).toEqual({ connect: { id: T } });
      expect(out.data.universityId).toBeUndefined();
    });

    it('uses the scalar when the payload uses foreign-key scalars', () => {
      const out = scopeArgs('Department', 'create', {
        data: { departmentCode: 'CSE', departmentName: 'CS', facultyId: 'f' },
      }, T);
      expect(out.data.universityId).toBe(T);
      expect(out.data.university).toBeUndefined();
    });

    it('accepts an explicit universityId equal to the tenant', () => {
      const out = scopeArgs('Department', 'create', { data: { universityId: T, facultyId: 'f' } }, T);
      expect(out.data.universityId).toBe(T);
    });

    it('rejects creating a row in another tenant', () => {
      expect(() => scopeArgs('Department', 'create', { data: { universityId: OTHER, facultyId: 'f' } }, T))
        .toThrow(TenantViolationError);
    });

    it('rejects creating universities from a tenant context', () => {
      expect(() => scopeArgs('University', 'create', { data: { code: 'X' } }, T)).toThrow(TenantViolationError);
    });

    it('stamps every row of createMany with the scalar', () => {
      const out = scopeArgs('IprSdg', 'createMany', { data: [{ iprApplicationId: 'a' }, { iprApplicationId: 'b' }] }, T);
      expect(out.data.every((d) => d.universityId === T)).toBe(true);
    });

    it('stamps nested creates, createMany and connectOrCreate', () => {
      const out = scopeArgs('IprApplication', 'create', {
        data: {
          title: 'x',
          applicantUser: { connect: { id: 'u' } },
          statusHistory: { create: { toStatus: 'draft', changedBy: { connect: { id: 'u' } } } },
          contributors: { createMany: { data: [{ name: 'a' }] } },
          sdgs: { connectOrCreate: [{ where: { id: 's' }, create: { sdgCode: '1' } }] },
        },
      }, T);
      expect(out.data.university).toEqual({ connect: { id: T } });
      expect(out.data.statusHistory.create.university).toEqual({ connect: { id: T } });
      expect(out.data.contributors.createMany.data[0].universityId).toBe(T);
      expect(out.data.sdgs.connectOrCreate[0].create.universityId).toBe(T);
    });

    it('stamps nested creates inside an update', () => {
      const out = scopeArgs('IprApplication', 'update', {
        where: { id: 'x' },
        data: { reviews: { create: { comments: 'ok', reviewerId: 'u' } } },
      }, T);
      expect(out.data.reviews.create.universityId).toBe(T);
    });

    it('stamps the create branch of upsert and scopes its where', () => {
      const out = scopeArgs('UserDepartmentPermission', 'upsert', {
        where: { id: 'p' }, create: { userId: 'u', department: 'X' }, update: { isActive: true },
      }, T);
      expect(out.where.AND).toEqual([{ universityId: T }]);
      expect(out.create.universityId).toBe(T);
    });
  });

  it('does not mutate the caller args', () => {
    const args = { where: { id: 'x' }, data: { title: 't' } };
    const copy = JSON.parse(JSON.stringify(args));
    scopeArgs('IprApplication', 'update', args, T);
    expect(args).toEqual(copy);
  });
});
