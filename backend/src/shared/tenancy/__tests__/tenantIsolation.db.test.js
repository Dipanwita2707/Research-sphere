/**
 * Tenant isolation against a real database. Everything runs inside one
 * transaction that is always rolled back, so nothing is left behind.
 *
 * Opt-in: RUN_DB_TESTS=1 npx jest src/shared/tenancy
 */
const runDbTests = process.env.RUN_DB_TESTS === '1';
const describeDb = runDbTests ? describe : describe.skip;

describeDb('tenant isolation (database)', () => {
  jest.setTimeout(120000);

  let prisma;
  let tenantContext;

  beforeAll(() => {
    prisma = require('../../config/database');
    tenantContext = require('../tenantContext');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  class Rollback extends Error {}

  it('scopes reads, writes and nested creates to the current tenant', async () => {
    const results = {};
    const suffix = Date.now().toString(36);

    await prisma.$transaction(async (tx) => {
      // ── fixtures, created as system ───────────────────────────────────────
      const [uniA, uniB] = await tenantContext.runAsSystem(() => Promise.all([
        tx.university.create({ data: { code: `TA${suffix}`, name: 'Tenant A', slug: `ta-${suffix}` } }),
        tx.university.create({ data: { code: `TB${suffix}`, name: 'Tenant B', slug: `tb-${suffix}` } }),
      ]));
      const schoolB = await tenantContext.runAsSystem(() => tx.facultySchoolList.create({
        data: { universityId: uniB.id, facultyCode: 'ENG', facultyName: 'B Engineering', facultyType: 'engineering' },
      }));
      await tenantContext.runAsSystem(() => tx.role.createMany({
        data: [
          { roleCode: `G${suffix}`, name: `Global ${suffix}`, universityId: null },
          { roleCode: `B${suffix}`, name: `B only ${suffix}`, universityId: uniB.id },
        ],
      }));

      await tenantContext.runForTenant(uniA.id, async () => {
        // create with no universityId: stamped by the extension
        const schoolA = await tx.facultySchoolList.create({
          data: { facultyCode: 'ENG', facultyName: 'A Engineering', facultyType: 'engineering' },
        });
        results.schoolAUniversity = schoolA.universityId;

        // relation-style create (faculty connect) → university connect injected
        const dept = await tx.department.create({
          data: { departmentCode: 'CSE', departmentName: 'CS', faculty: { connect: { id: schoolA.id } } },
        });
        results.deptUniversity = dept.universityId;

        // FK-style create with a nested create of another tenant model
        const program = await tx.program.create({
          data: {
            departmentId: dept.id,
            programCode: 'BTECH',
            programName: 'B.Tech',
            programType: 'undergraduate',
            specializations: { create: { specializationCode: `AI-${suffix}`, specializationName: 'AI' } },
          },
          include: { specializations: true },
        });
        results.nestedUniversity = program.specializations[0].universityId;

        // reads only see tenant A
        results.schoolsSeen = (await tx.facultySchoolList.findMany()).map((s) => s.facultyName);
        results.foreignById = await tx.facultySchoolList.findUnique({ where: { id: schoolB.id } });
        results.countAll = await tx.facultySchoolList.count();

        // shared model: global + own rows, never other tenants'
        const roles = await tx.role.findMany({ where: { roleCode: { endsWith: suffix } } });
        results.rolesSeen = roles.map((r) => r.roleCode).sort();

        // writes to another tenant's row behave as not found
        results.foreignUpdate = await tx.facultySchoolList
          .update({ where: { id: schoolB.id }, data: { facultyName: 'hacked' } })
          .then(() => 'updated', (e) => e.code);
        results.foreignDeleteMany = (await tx.facultySchoolList.deleteMany({ where: { id: schoolB.id } })).count;

        // creating into another tenant is refused
        results.crossCreate = await tx.facultySchoolList
          .create({ data: { universityId: uniB.id, facultyCode: 'X', facultyName: 'X', facultyType: 'engineering' } })
          .then(() => 'created', (e) => e.name);

        // own university only
        results.universitiesSeen = (await tx.university.findMany()).map((u) => u.id);
      });

      results.schoolBAfter = await tenantContext.runAsSystem(() =>
        tx.facultySchoolList.findUnique({ where: { id: schoolB.id } }));
      results.uniA = uniA.id;
      results.uniB = uniB.id;
      throw new Rollback();
    }, { timeout: 110000, maxWait: 20000 }).catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });

    expect(results.schoolAUniversity).toBe(results.uniA);
    expect(results.deptUniversity).toBe(results.uniA);
    expect(results.nestedUniversity).toBe(results.uniA);
    expect(results.schoolsSeen).toEqual(['A Engineering']);
    expect(results.foreignById).toBeNull();
    expect(results.countAll).toBe(1);
    expect(results.rolesSeen).toEqual([expect.stringMatching(/^G/)]);
    expect(results.foreignUpdate).toBe('P2025');
    expect(results.foreignDeleteMany).toBe(0);
    expect(results.crossCreate).toBe('TenantViolationError');
    expect(results.universitiesSeen).toEqual([results.uniA]);
    expect(results.schoolBAfter.facultyName).toBe('B Engineering');
  });
});
